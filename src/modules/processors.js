/* 处理类组件:滤波 / 压控放大 / 包络 / 延迟 / 衰减 / 分配 / 量化 /
   采样保持 / 混音 / MIDI→CV 转换 */

import { clamp } from '../core/utils.js';
import { ctx } from '../core/audio.js';
import { kit } from '../kit/index.js';
import { saveSoon } from '../core/save.js';

export const processors = {
  vcf: {
    id: 'vcf', name: '滤波器', en: 'VCF', cat: 'process', w: 8, h: 5,
    desc: '压控滤波器,低通 / 高通 / 带通三路同时输出。CUTOFF 1V/oct(0V = 200Hz);RESO 10V ≈ Q20。',
    ports: [
      { id: 'LP', dir: 'out', name: 'LP', desc: '低通输出' },
      { id: 'HP', dir: 'out', name: 'HP', desc: '高通输出' },
      { id: 'BP', dir: 'out', name: 'BP', desc: '带通输出' },
      { id: 'IN', dir: 'in', name: 'IN', desc: '音频输入' },
      { id: 'CUTOFF', dir: 'in', name: 'CUTOFF', desc: '截止频率 1V/oct(默认约 6.4kHz)' },
      { id: 'RESO', dir: 'in', name: 'RESO', desc: '共振 0~10V → Q 0~20(默认少量)' }
    ],
    build() {
      this.bqs = [];
      const mk = (type, out) => {
        const b = ctx.createBiquadFilter();
        b.type = type; b.frequency.value = 200;
        this.ins.IN.connect(b); b.connect(this.outs[out]);
        this.bqs.push(b); return b;
      };
      mk('lowpass', 'LP'); mk('highpass', 'HP'); mk('bandpass', 'BP');
      const c = ctx.createGain(); c.gain.value = 1200; this.ins.CUTOFF.connect(c);
      const q = ctx.createGain(); q.gain.value = 1.8; this.ins.RESO.connect(q);
      this.bqs.forEach(b => {
        c.connect(b.detune); q.connect(b.Q);
        this.addBase('CUTOFF', b.detune, 6000, 0);
        this.addBase('RESO', b.Q, 0.5, 0);
      });
    }
  },

  vca: {
    id: 'vca', name: '压控放大', en: 'VCA', cat: 'process', w: 6, h: 5,
    desc: '压控放大器。GAIN 10V = 增益 1;未接线时默认全开(增益 1)。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '输出' },
      { id: 'IN', dir: 'in', name: 'IN', desc: '音频输入' },
      { id: 'GAIN', dir: 'in', name: 'GAIN', desc: '增益 0~10V(默认全开)' }
    ],
    build() {
      const g = ctx.createGain();
      this.ins.IN.connect(g); g.connect(this.outs.OUT);
      const s = ctx.createGain(); s.gain.value = 0.1;
      this.ins.GAIN.connect(s); s.connect(g.gain);
      this.addBase('GAIN', g.gain, 1, 0);
      this.gn = g;
    }
  },

  amp: {
    id: 'amp', name: '放大器', en: 'AMPLIFIER', cat: 'process', w: 4, h: 5,
    desc: '定增益放大:面板旋钮直接设定放大倍数(×0~×10),GAIN 口的 CV 可再叠加(10V = +10×)。要把小信号推大时用它;VCA 是用 CV 控音量,这个是定增益提升。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '放大后输出' },
      { id: 'IN', dir: 'in', name: 'IN', desc: '音频输入' },
      { id: 'GAIN', dir: 'in', name: 'GAIN', desc: '增益叠加 0~10V(默认 0)' }
    ],
    state: () => ({ v: 2 }),
    build() {
      this.g = ctx.createGain(); this.g.gain.value = this.state.v;
      this.ins.IN.connect(this.g); this.g.connect(this.outs.OUT);
      this.cs = ctx.createConstantSource(); this.cs.offset.value = this.state.v;
      this.cs.connect(this.g.gain); this.cs.start();
      const s = ctx.createGain(); s.gain.value = 1;
      this.ins.GAIN.connect(s); s.connect(this.g.gain);
      kit.knob(this, { min: 0, max: 10, value: this.state.v, unit: '×' });
    },
    dispose() { try { this.cs.stop(); } catch (e) {} }
  },

  adsr: {
    id: 'adsr', name: '包络', en: 'ADSR', cat: 'process', w: 10, h: 7,
    desc: 'ADSR 包络发生器,GATE 触发。A/D/R 接旋钮(0~10V → 0~3.5 秒),S 为电平。ENV 输出 0~+10V。',
    ports: [
      { id: 'ENV', dir: 'out', name: 'ENV', desc: '包络输出 0~+10V' },
      { id: 'GATE', dir: 'in', name: 'GATE', desc: '门输入(≥0.5V 触发)' },
      { id: 'A', dir: 'in', name: 'A', desc: '起音(默认 1V ≈ 40ms)' },
      { id: 'D', dir: 'in', name: 'D', desc: '衰减(默认 4V)' },
      { id: 'S', dir: 'in', name: 'S', desc: '延音电平(默认 10V = 100%)' },
      { id: 'R', dir: 'in', name: 'R', desc: '释音(默认 3V)' }
    ],
    build() {
      // 包络 = gain 自动化;节点需要一路恒定输入才能有输出
      this.env = ctx.createGain(); this.env.gain.value = 0;
      const dc = ctx.createConstantSource(); dc.offset.value = 1;
      dc.connect(this.env); dc.start();
      this._dc = dc;
      this.env.connect(this.outs.ENV);
      this.mon('GATE'); this.mon('A'); this.mon('D'); this.mon('S'); this.mon('R');
      kit.screen(this, 'scr');
      this._rel = false;
    },
    stageT(v) { return 0.004 + Math.pow(clamp(v, 0, 10) / 10, 2) * 3.5; },
    trigger() {
      const t = ctx.currentTime, g = this.env.gain;
      const A = this.stageT(this.volts('A', 1));
      const D = this.stageT(this.volts('D', 4));
      const S = clamp(this.volts('S', 10) / 10, 0, 1);
      if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
      else g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(10, t + A);
      g.linearRampToValueAtTime(10 * S, t + A + D);
      this._rel = false;
    },
    release() {
      const t = ctx.currentTime, g = this.env.gain;
      const R = this.stageT(this.volts('R', 3));
      if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
      else g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0, t + R);
      this._rel = true;
    },
    tick() {
      const e = this.edge('GATE');
      if (e === 1) this.trigger();
      else if (e === -1) this.release();
      const s = this.scr; if (!s) return;
      const { c, w: W, h: H } = s;
      c.fillStyle = '#0b0d10'; c.fillRect(0, 0, W, H);
      const A = this.stageT(this.volts('A', 1)), D = this.stageT(this.volts('D', 4));
      const S = clamp(this.volts('S', 10) / 10, 0, 1), R = this.stageT(this.volts('R', 3));
      const tot = A + D + R + 0.001;
      const X = t => 4 + (t / tot) * (W - 10);
      const Y = v => H - 5 - clamp(v, 0, 1) * (H - 14);
      c.strokeStyle = '#e8b34b'; c.lineWidth = 1.5; c.beginPath();
      c.moveTo(X(0), Y(0)); c.lineTo(X(A), Y(1)); c.lineTo(X(A + D), Y(S));
      c.lineTo(X(A + D + R), Y(0)); c.stroke();
      c.setLineDash([3, 3]); c.strokeStyle = 'rgba(232,179,75,.35)';
      c.beginPath(); c.moveTo(X(A + D), Y(S)); c.lineTo(X(A + D + R), Y(S)); c.stroke();
      c.setLineDash([]);
      c.fillStyle = '#9a9f6a'; c.font = '9px monospace';
      c.fillText(`A${A.toFixed(2)} D${D.toFixed(2)} S${S.toFixed(1)} R${R.toFixed(2)}`, 5, 10);
      const lv = this.env.gain.value / 10;
      c.fillStyle = lv > 0.02 ? '#ffd24d' : '#445';
      c.beginPath(); c.arc(W - 8, 8, 3.5, 0, 7); c.fill();
    },
    dispose() { try { this._dc.stop(); } catch (e) {} }
  },

  delay: {
    id: 'delay', name: '延迟', en: 'DELAY', cat: 'process', w: 8, h: 5,
    desc: '回声延迟(湿声并联在干声上)。TIME 10V = 1s;FB 10V ≈ 0.9;MIX 10V = 100% 湿。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '干 + 湿输出' },
      { id: 'IN', dir: 'in', name: 'IN', desc: '音频输入' },
      { id: 'TIME', dir: 'in', name: 'TIME', desc: '延迟时间 0~10V → 0~1s(默认 0.3s)' },
      { id: 'FB', dir: 'in', name: 'FB', desc: '反馈 0~10V(默认 0.45)' },
      { id: 'MIX', dir: 'in', name: 'MIX', desc: '湿量 0~10V(默认 50%)' }
    ],
    build() {
      const dl = ctx.createDelay(2.0); dl.delayTime.value = 0.3;
      const fb = ctx.createGain(); fb.gain.value = 0.45;
      const wet = ctx.createGain(); wet.gain.value = 0.5;
      const dry = ctx.createGain(); dry.gain.value = 1;
      this.ins.IN.connect(dry); dry.connect(this.outs.OUT);
      this.ins.IN.connect(dl); dl.connect(wet); wet.connect(this.outs.OUT);
      dl.connect(fb); fb.connect(dl);
      const sT = ctx.createGain(); sT.gain.value = 0.1; this.ins.TIME.connect(sT); sT.connect(dl.delayTime);
      const sF = ctx.createGain(); sF.gain.value = 0.09; this.ins.FB.connect(sF); sF.connect(fb.gain);
      const sM = ctx.createGain(); sM.gain.value = 0.1; this.ins.MIX.connect(sM); sM.connect(wet.gain);
      this.addBase('TIME', dl.delayTime, 0.3, 0);
      this.addBase('FB', fb.gain, 0.45, 0);
      this.addBase('MIX', wet.gain, 0.5, 0);
    }
  },

  atten: {
    id: 'atten', name: '衰减器', en: 'ATTENUATOR', cat: 'process', w: 6, h: 5,
    desc: '输出 = 输入 × AMT/10。给 LFO / 音频调幅度,或给电压调比例。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '输出' },
      { id: 'IN', dir: 'in', name: 'IN', desc: '信号输入' },
      { id: 'AMT', dir: 'in', name: 'AMT', desc: '衰减量 0~10V(默认 10 = 不衰减)' }
    ],
    build() {
      const g = ctx.createGain();
      this.ins.IN.connect(g); g.connect(this.outs.OUT);
      const s = ctx.createGain(); s.gain.value = 0.1;
      this.ins.AMT.connect(s); s.connect(g.gain);
      this.addBase('AMT', g.gain, 1, 0);
    }
  },

  mult: {
    id: 'mult', name: '多路分配', en: 'MULT ×4', cat: 'process', w: 8, h: 5,
    desc: '无源多路分配:一个输入,四路输出(也可少接)。',
    ports: [
      { id: 'O1', dir: 'out', name: '1', desc: '分配输出 1' },
      { id: 'O2', dir: 'out', name: '2', desc: '分配输出 2' },
      { id: 'O3', dir: 'out', name: '3', desc: '分配输出 3' },
      { id: 'O4', dir: 'out', name: '4', desc: '分配输出 4' },
      { id: 'IN', dir: 'in', name: 'IN', desc: '输入(任意信号)' }
    ],
    build() { ['O1', 'O2', 'O3', 'O4'].forEach(o => this.ins.IN.connect(this.outs[o])); }
  },

  mult8: {
    id: 'mult8', name: '一分八', en: 'MULT ×8', cat: 'process', w: 16, h: 5,
    desc: '八路信号分配:一路输入复制到八个输出口,每路可单独开关(熄灭 = 静音)。要把一组信号同时送给多个组件时用它。',
    ports: [
      { id: 'IN', dir: 'in', name: 'IN', desc: '输入(任意信号)' },
      { id: 'O1', dir: 'out', name: '1', desc: '分配输出 1' },
      { id: 'O2', dir: 'out', name: '2', desc: '分配输出 2' },
      { id: 'O3', dir: 'out', name: '3', desc: '分配输出 3' },
      { id: 'O4', dir: 'out', name: '4', desc: '分配输出 4' },
      { id: 'O5', dir: 'out', name: '5', desc: '分配输出 5' },
      { id: 'O6', dir: 'out', name: '6', desc: '分配输出 6' },
      { id: 'O7', dir: 'out', name: '7', desc: '分配输出 7' },
      { id: 'O8', dir: 'out', name: '8', desc: '分配输出 8' }
    ],
    state: () => ({ ch: [1, 1, 1, 1, 1, 1, 1, 1] }),
    build() {
      for (let i = 1; i <= 8; i++) this.outs['O' + i].gain.value = this.state.ch[i - 1] ? 1 : 0;
      // 面板:8 路通道开关
      const row = document.createElement('div');
      row.className = 'mch-row';
      this._sw = [];
      for (let i = 1; i <= 8; i++) {
        const b = document.createElement('div');
        b.className = 'mch' + (this.state.ch[i - 1] ? ' on' : '');
        b.textContent = i;
        b.dataset.ctl = '1';
        b.addEventListener('pointerdown', e => { e.stopPropagation(); this.setCh(i, !this.state.ch[i - 1]); });
        row.appendChild(b);
        this._sw.push(b);
      }
      this.body.appendChild(row);
    },
    setCh(i, on) {
      this.state.ch[i - 1] = on ? 1 : 0;
      this.outs['O' + i].gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.004);
      const sw = this._sw[i - 1];
      if (sw) sw.classList.toggle('on', !!on);
      saveSoon();
    }
  },

  quant: {
    id: 'quant', name: '量化器', en: 'QUANTIZER', cat: 'process', w: 4, h: 5,
    desc: '把任意电压吸附到最近的半音(1/12V 网格)。音序器 / 噪声接振荡器前先过这里。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '半音化电压' },
      { id: 'CV', dir: 'in', name: 'CV', desc: '连续电压输入' }
    ],
    build() {
      this.cs = ctx.createConstantSource(); this.cs.offset.value = 0;
      this.cs.connect(this.outs.OUT); this.cs.start();
      this.mon('CV'); this._lastQ = null;
    },
    tick() {
      const q = Math.round(this.volts('CV', 0) * 12) / 12;
      if (q !== this._lastQ) {
        this._lastQ = q;
        this.cs.offset.value = q;
      }
    },
    dispose() { try { this.cs.stop(); } catch (e) {} }
  },

  sh: {
    id: 'sh', name: '采样保持', en: 'S&H', cat: 'process', w: 6, h: 5,
    desc: '经典采样保持:TRIG 上升沿采样 IN 瞬时值并保持输出。噪声接 IN、时钟接 TRIG = 阶梯随机电压。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '保持电压输出' },
      { id: 'IN', dir: 'in', name: 'IN', desc: '被采样信号(典型:噪声)' },
      { id: 'TRIG', dir: 'in', name: 'TRIG', desc: '触发采样(上升沿)' }
    ],
    build() {
      this.cs = ctx.createConstantSource(); this.cs.offset.value = 0;
      this.cs.connect(this.outs.OUT); this.cs.start();
      this.mon('TRIG'); this.mon('IN'); this._last = null;
    },
    tick() {
      if (this.edge('TRIG') === 1) {
        const v = this.volts('IN', 0);
        if (v !== this._last) {
          this._last = v;
          this.cs.offset.setTargetAtTime(v, ctx.currentTime, 0.002);
        }
      }
    },
    dispose() { try { this.cs.stop(); } catch (e) {} }
  },

  mix: {
    id: 'mix', name: '混音器', en: 'MIX ×3', cat: 'process', w: 8, h: 5,
    desc: '三路等比混音(每路 ≈0.33)后输出。要控制电平,在各输入前接衰减器 + 旋钮。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '混音输出' },
      { id: 'A', dir: 'in', name: 'A', desc: '输入 A' },
      { id: 'B', dir: 'in', name: 'B', desc: '输入 B' },
      { id: 'C', dir: 'in', name: 'C', desc: '输入 C' }
    ],
    build() {
      const g = ctx.createGain(); g.gain.value = 1 / 3;
      this.ins.A.connect(g); this.ins.B.connect(g); this.ins.C.connect(g);
      g.connect(this.outs.OUT);
    }
  },

  midicv: {
    id: 'midicv', name: 'MIDI-CV', en: 'MIDI→CV', cat: 'process', w: 6, h: 4,
    desc: '独立 MIDI→CV 转换器:从 MIDI 口接收音符,转成 1V/oct 音高、Gate、力度电压(MIDI 键盘 / 音序器已内置此转换,它们可以直接用 CV 口)。',
    ports: [
      { id: 'VOCT', dir: 'out', name: 'V/OCT', desc: '音高 1V/oct(C4 = 0V)' },
      { id: 'GATE', dir: 'out', name: 'GATE', desc: '按住 = +10V' },
      { id: 'VEL', dir: 'out', name: 'VEL', desc: '力度 0~10V' },
      { id: 'MIDI', dir: 'in', name: 'MIDI', desc: 'MIDI 音符输入(接键盘 / 音序器的 MIDI 口)' }
    ],
    state: () => ({}),
    build() {
      this.cCv = ctx.createConstantSource(); this.cGt = ctx.createConstantSource(); this.cVe = ctx.createConstantSource();
      this.cCv.offset.value = 0; this.cGt.offset.value = 0; this.cVe.offset.value = 0;
      this.cCv.connect(this.outs.VOCT); this.cGt.connect(this.outs.GATE); this.cVe.connect(this.outs.VEL);
      this.cCv.start(); this.cGt.start(); this.cVe.start();
      this._held = [];
    },
    midiIn(msg) {
      if (msg.type === 'noteon') {
        this._held = this._held.filter(x => x.note !== msg.note);
        this._held.push({ note: msg.note, vel: msg.vel || 100 });
      } else if (msg.type === 'noteoff') {
        this._held = this._held.filter(x => x.note !== msg.note);
      }
      const top = this._held[this._held.length - 1];
      if (top) {
        this.cCv.offset.value = (top.note - 60) / 12;
        this.cGt.offset.value = 10;
        this.cVe.offset.value = top.vel / 127 * 10;
      } else {
        this.cGt.offset.value = 0;
      }
    },
    dispose() { try { this.cCv.stop(); this.cGt.stop(); this.cVe.stop(); } catch (e) {} }
  }
};
