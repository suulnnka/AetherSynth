/* 信号源组件:振荡器 / FM / 低频振荡 / 噪声 / 麦克风 */

import { ctx } from '../core/audio.js';
import { kit } from '../kit/index.js';

export const sources = {
  vco: {
    id: 'vco', name: '振荡器', en: 'VCO', cat: 'source', w: 8, h: 6,
    desc: '压控振荡器,四种波形同时输出。0V = C4(261.6Hz),1V/oct;FM 为线性调频(10V ≈ ±40Hz)。',
    ports: [
      { id: 'SIN', dir: 'out', name: 'SIN', desc: '正弦波' },
      { id: 'TRI', dir: 'out', name: 'TRI', desc: '三角波' },
      { id: 'SAW', dir: 'out', name: 'SAW', desc: '锯齿波' },
      { id: 'SQR', dir: 'out', name: 'SQR', desc: '方波' },
      { id: 'VOCT', dir: 'in', name: 'V/OCT', desc: '音高 1V/oct(默认 0V = C4)' },
      { id: 'FM', dir: 'in', name: 'FM', desc: '线性调频 ±40Hz @10V' }
    ],
    build() {
      this.oscs = [];
      const mk = (type, out) => {
        const o = ctx.createOscillator();
        o.type = type; o.frequency.value = 261.6256;
        o.connect(this.outs[out]); o.start();
        this.oscs.push(o); return o;
      };
      mk('sine', 'SIN'); mk('triangle', 'TRI'); mk('sawtooth', 'SAW'); mk('square', 'SQR');
      const p = ctx.createGain(); p.gain.value = 1200; this.ins.VOCT.connect(p);
      const f = ctx.createGain(); f.gain.value = 40; this.ins.FM.connect(f);
      this.oscs.forEach(o => { p.connect(o.detune); f.connect(o.frequency); });
      kit.hint('0V = C4 · 1V/OCT', this);
    },
    dispose() { this.oscs.forEach(o => { try { o.stop(); } catch (e) {} }); }
  },

  fm: {
    id: 'fm', name: 'FM振荡器', en: 'FM PAIR 2-OP', cat: 'source', w: 8, h: 6,
    desc: '双算子 FM:正弦调制器以 RATIO 频率比对载波调频。INDEX 越大音色越亮越金属;把包络 / 另一振荡器接进 INDEX 可做铜管、钟声、泛音扫描。M.OUT 可级联出第三算子。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '载波输出(已调频)' },
      { id: 'M', dir: 'out', name: 'M.OUT', desc: '调制器正弦输出(可接到别的 FM 模块级联)' },
      { id: 'VOCT', dir: 'in', name: 'V/OCT', desc: '音高 1V/oct,载波与调制器同步(0V = C4)' },
      { id: 'RATIO', dir: 'in', name: 'RATIO', desc: '调制比:1V = ×2(0V = 1:1;负电压降比例)' },
      { id: 'INDEX', dir: 'in', name: 'INDEX', desc: '调制指数 0~10V → 频偏 0~1200Hz(未接 = 0,纯正弦)' }
    ],
    build() {
      this.car = ctx.createOscillator(); this.car.type = 'sine';
      this.car.frequency.value = 261.6256;
      this.car.connect(this.outs.OUT); this.car.start();
      this.mod = ctx.createOscillator(); this.mod.type = 'sine';
      this.mod.frequency.value = 261.6256;
      this.mod.connect(this.outs.M); this.mod.start();
      // 音高:载波与调制器走同一 V/OCT,保持频率比
      const p = ctx.createGain(); p.gain.value = 1200;
      this.ins.VOCT.connect(p); p.connect(this.car.detune); p.connect(this.mod.detune);
      // 频率比:调制器额外 detune,1V = ×2
      const r = ctx.createGain(); r.gain.value = 1200;
      this.ins.RATIO.connect(r); r.connect(this.mod.detune);
      // 调制指数:调制器输出 × 偏差深度 加到载波频率
      const ix = ctx.createGain(); ix.gain.value = 120;
      this.ins.INDEX.connect(ix); ix.connect(this.car.frequency);
      kit.hint('RATIO 1V=×2 · INDEX 10V=1200Hz', this);
    },
    dispose() { try { this.car.stop(); this.mod.stop(); } catch (e) {} }
  },

  lfo: {
    id: 'lfo', name: '低频振荡', en: 'LFO', cat: 'source', w: 8, h: 6,
    desc: '低频振荡器。RATE:1V = +1Hz(未接线时 2Hz)。方波可当廉价时钟用。',
    ports: [
      { id: 'SIN', dir: 'out', name: 'SIN', desc: '正弦 ±1' },
      { id: 'TRI', dir: 'out', name: 'TRI', desc: '三角 ±1' },
      { id: 'SQR', dir: 'out', name: 'SQR', desc: '方波 ±1(可当时钟)' },
      { id: 'SAW', dir: 'out', name: 'SAW', desc: '锯齿 ±1' },
      { id: 'RATE', dir: 'in', name: 'RATE', desc: '频率:1V = +1Hz(默认 2Hz)' }
    ],
    build() {
      this.oscs = [];
      const mk = (type, out) => {
        const o = ctx.createOscillator();
        o.type = type; o.frequency.value = 2;
        o.connect(this.outs[out]); o.start();
        this.oscs.push(o); return o;
      };
      mk('sine', 'SIN'); mk('triangle', 'TRI'); mk('square', 'SQR'); mk('sawtooth', 'SAW');
      const r = ctx.createGain(); r.gain.value = 1; this.ins.RATE.connect(r);
      this.oscs.forEach(o => { r.connect(o.frequency); this.addBase('RATE', o.frequency, 2, 0.05); });
      kit.hint('RATE: 1V = +1Hz', this);
    },
    dispose() { this.oscs.forEach(o => { try { o.stop(); } catch (e) {} }); }
  },

  noise: {
    id: 'noise', name: '噪声', en: 'NOISE', cat: 'source', w: 4, h: 4,
    desc: '白噪声与粉噪声发生器。',
    ports: [
      { id: 'WHITE', dir: 'out', name: 'WHITE', desc: '白噪声' },
      { id: 'PINK', dir: 'out', name: 'PINK', desc: '粉噪声(低通近似)' }
    ],
    build() {
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.src = ctx.createBufferSource();
      this.src.buffer = buf; this.src.loop = true;
      this.src.connect(this.outs.WHITE);
      const f1 = ctx.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.value = 400; f1.Q.value = 0.4;
      const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 130; f2.Q.value = 0.4;
      const g = ctx.createGain(); g.gain.value = 2.4;
      this.src.connect(f1); f1.connect(f2); f2.connect(g); g.connect(this.outs.PINK);
      this.src.start();
    },
    dispose() { try { this.src.stop(); } catch (e) {} }
  },

  mic: {
    id: 'mic', name: '麦克风', en: 'MIC', cat: 'source', w: 4, h: 5,
    desc: '电脑麦克风。组件放入画布时请求系统授权,声音从 OUT 口输出。',
    ports: [{ id: 'OUT', dir: 'out', name: 'OUT', desc: '麦克风信号' }],
    state: () => ({ st: 'wait' }),
    build() {
      kit.screen(this, 'scr');
      const self = this;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.state.st = 'no'; return;
      }
      navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      }).then(stream => {
        self.stream = stream;
        self.srcNode = ctx.createMediaStreamSource(stream);
        self.srcNode.connect(self.outs.OUT);
        self.state.st = 'ok';
      }).catch(() => { self.state.st = 'deny'; });
    },
    tick() {
      const s = this.scr; if (!s) return;
      const { c, w: W, h: H } = s;
      c.fillStyle = '#0b0d10'; c.fillRect(0, 0, W, H);
      c.font = '10px monospace'; c.textAlign = 'center';
      const map = { wait: ['授权中…', '#ffd24d'], ok: ['MIC LIVE ●', '#7dffb0'], deny: ['已拒绝授权', '#ff5d5d'], no: ['不支持', '#ff5d5d'] };
      const [t, col] = map[this.state.st] || ['—', '#888'];
      c.fillStyle = col;
      c.fillText(t, W / 2, H / 2 + 3);
      c.textAlign = 'left';
    },
    dispose() {
      if (this.stream) this.stream.getTracks().forEach(t => t.stop());
      if (this.srcNode) { try { this.srcNode.disconnect(); } catch (e) {} }
    }
  }
};
