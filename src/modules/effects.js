/* 音频效果器:压限器 / 比特量化 / 重采样 —— 动态控制与 lo-fi 三件套。
   全部为音频率处理:IN/OUT 走音频,CV 口按控制率采样。 */

import { clamp } from '../core/utils.js';
import { ctx } from '../core/audio.js';
import { kit } from '../kit/index.js';

export const effects = {

  /* 压限器:DynamicsCompressor,四个 CV 口分别控制门限 / 比例 / 启动 / 释放 */
  comp: {
    id: 'comp', name: '压限器', en: 'COMPRESSOR', cat: 'process', w: 8, h: 6,
    desc: '动态压缩:自动压低过响的峰值,让声音更稳更肥。THRESH 定门限(10V = 0dB,0V = −50dB),RATIO 10V = 20:1,ATK/REL 控制动作速度;屏幕实时显示增益削减。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '压缩后输出' },
      { id: 'IN', dir: 'in', name: 'IN', desc: '音频输入' },
      { id: 'THRESH', dir: 'in', name: 'THRESH', desc: '门限 0~10V → 0~−50dB(默认 −24dB)' },
      { id: 'RATIO', dir: 'in', name: 'RATIO', desc: '压缩比 10V = 20:1(默认 4:1)' },
      { id: 'ATK', dir: 'in', name: 'ATK', desc: '启动 10V = 0.2s(默认 3ms)' },
      { id: 'REL', dir: 'in', name: 'REL', desc: '释放 10V = 0.5s(默认 0.25s)' }
    ],
    build() {
      this.cp = ctx.createDynamicsCompressor();
      this.ins.IN.connect(this.cp); this.cp.connect(this.outs.OUT);
      const sT = ctx.createGain(); sT.gain.value = -5;   // 10V → −50dB
      this.ins.THRESH.connect(sT); sT.connect(this.cp.threshold);
      this.addBase('THRESH', this.cp.threshold, -24, 0);
      const sR = ctx.createGain(); sR.gain.value = 2;    // 10V → 20:1
      this.ins.RATIO.connect(sR); sR.connect(this.cp.ratio);
      this.addBase('RATIO', this.cp.ratio, 4, 0);
      const sA = ctx.createGain(); sA.gain.value = 0.02; // 10V → 0.2s
      this.ins.ATK.connect(sA); sA.connect(this.cp.attack);
      this.addBase('ATK', this.cp.attack, 0.003, 0);
      const sL = ctx.createGain(); sL.gain.value = 0.05; // 10V → 0.5s
      this.ins.REL.connect(sL); sL.connect(this.cp.release);
      this.addBase('REL', this.cp.release, 0.25, 0);
      this._gr = 0;
      kit.screen(this, 'scr');
    },
    tick() {
      // reduction 为负 dB,取绝对值做平滑后画增益削减表
      const red = typeof this.cp.reduction === 'number' ? this.cp.reduction : this.cp.reduction.value;
      this._gr += (Math.max(0, -red) - this._gr) * 0.2;
      const s = this.scr; if (!s) return;
      const { c, w: W, h: H } = s;
      c.fillStyle = '#0b0d10'; c.fillRect(0, 0, W, H);
      const bw = W - 20;
      c.fillStyle = '#1a2027'; c.fillRect(10, H / 2 - 9, bw, 18);
      const gr = clamp(this._gr / 32, 0, 1) * bw;   // 显示范围 0~−32dB
      c.fillStyle = this._gr > 16 ? '#ffd24d' : '#7dc8ff';
      c.fillRect(10, H / 2 - 9, gr, 18);
      c.fillStyle = '#8fb4d8'; c.font = '9px monospace'; c.textAlign = 'center';
      c.fillText('GR −' + this._gr.toFixed(1) + ' dB', W / 2, H / 2 - 14);
      c.fillText(this._gr > 0.05 ? 'COMPRESSING' : 'CLEAN', W / 2, H / 2 + 20);
      c.textAlign = 'left';
    }
  },

  /* 比特量化:WaveShaper 把幅度吸附到 2^N 格, Bits CV 控制位深 */
  bquant: {
    id: 'bquant', name: '比特量化', en: 'BIT CRUSH', cat: 'process', w: 6, h: 6,
    desc: '把采样幅度量化到 N 比特(2~8bit),制造数字颗粒感与早期采样机音色。BITS 越低越糙:0V = 2bit,10V = 8bit(默认 8bit)。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '量化后输出' },
      { id: 'IN', dir: 'in', name: 'IN', desc: '音频输入' },
      { id: 'BITS', dir: 'in', name: 'BITS', desc: '位深 0~10V → 2~8bit(默认 10V = 8bit)' }
    ],
    build() {
      this.ws = ctx.createWaveShaper();
      this.ins.IN.connect(this.ws); this.ws.connect(this.outs.OUT);
      this.mon('BITS');
      this._bits = -1;
      this.setBits(8);
      kit.screen(this, 'scr');
    },
    /** 重建量化曲线(阶梯:2^N 格) */
    setBits(n) {
      n = clamp(Math.round(n), 1, 8);
      if (n === this._bits) return;
      this._bits = n;
      const half = Math.pow(2, n - 1);
      const N = 2048, curve = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const x = (i / (N - 1)) * 2 - 1;
        curve[i] = Math.round(x * half) / half;
      }
      this.ws.curve = curve;
    },
    tick() {
      this.setBits(2 + this.volts('BITS', 10) * 0.6);   // 0~10V → 2~8bit
      const s = this.scr; if (!s) return;
      const { c, w: W, h: H } = s;
      c.fillStyle = '#0b0d10'; c.fillRect(0, 0, W, H);
      // 量化阶梯示意
      const half = Math.pow(2, this._bits - 1);
      const rows = Math.min(half * 2, H);
      c.strokeStyle = 'rgba(125,255,176,.5)';
      for (let i = 1; i < rows; i++) {
        const y = (i / rows) * (H - 8) + 4;
        c.beginPath(); c.moveTo(6, y); c.lineTo(W - 6, y); c.stroke();
      }
      c.fillStyle = '#7dffb0'; c.font = 'bold 14px monospace'; c.textAlign = 'center';
      c.fillText(this._bits + ' BIT', W / 2, H / 2 + 5);
      c.textAlign = 'left';
    }
  },

  /* 重采样:采样保持式降率,等效采样率 = 引擎采样率 ÷ 抽取倍数 */
  sred: {
    id: 'sred', name: '重采样', en: 'SR REDUCE', cat: 'process', w: 6, h: 6,
    desc: '降低有效采样率(采样保持):RATE 每 2V 采样率减半,10V = 1/32,从轻微沙哑一路退化到复古电子游戏音。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '重采样输出' },
      { id: 'IN', dir: 'in', name: 'IN', desc: '音频输入' },
      { id: 'RATE', dir: 'in', name: 'RATE', desc: '抽取率 0~10V → 1~32 倍,每 2V 减半(默认 4 倍)' }
    ],
    build() {
      this._factor = 4; this._count = 0; this._hold = 0;
      this.sp = ctx.createScriptProcessor(4096, 1, 1);
      this.ins.IN.connect(this.sp);
      this.sp.connect(this.outs.OUT);
      // ScriptProcessor 需要一路连到 destination 才会被引擎拉动(与录音机同款静音泵)
      this.mute = ctx.createGain(); this.mute.gain.value = 0;
      this.sp.connect(this.mute); this.mute.connect(ctx.destination);
      const self = this;
      this.sp.onaudioprocess = e => {
        const inp = e.inputBuffer.getChannelData(0);
        const out = e.outputBuffer.getChannelData(0);
        const f = Math.max(1, Math.round(self._factor));
        for (let i = 0; i < inp.length; i++) {
          if (self._count <= 0) { self._hold = inp[i]; self._count = f; }
          self._count--;
          out[i] = self._hold;
        }
      };
      this.mon('RATE');
      kit.screen(this, 'scr');
    },
    tick() {
      this._factor = Math.pow(2, clamp(this.volts('RATE', 4), 0, 10) / 2);
      const s = this.scr; if (!s) return;
      const { c, w: W, h: H } = s;
      c.fillStyle = '#0b0d10'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#5dffe1'; c.font = 'bold 13px monospace'; c.textAlign = 'center';
      c.fillText('1/' + Math.round(this._factor), W / 2, H / 2 - 4);
      c.font = '9px monospace';
      c.fillText('EFF ' + (ctx.sampleRate / this._factor / 1000).toFixed(1) + ' kHz', W / 2, H / 2 + 12);
      c.textAlign = 'left';
    },
    dispose() {
      this.sp.onaudioprocess = null;
      try { this.sp.disconnect(); this.mute.disconnect(); } catch (e) {}
    }
  }
};
