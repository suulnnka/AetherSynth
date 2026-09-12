/* 音频 ↔ CV 调制桥:环形调制 / 滑音 / 包络跟随。
   环形调制走音频率(GainNode 参数调制),滑音与包络跟随走控制率。 */

import { clamp } from '../core/utils.js';
import { ctx } from '../core/audio.js';
import { kit } from '../kit/index.js';

export const cvmod = {
  /* ---- 环形调制:OUT = X × Y(音频率四象限相乘) ---- */
  ringmod: {
    id: 'ringmod', name: '环形调制', en: 'RING MOD', cat: 'process', w: 4, h: 5,
    desc: '环形调制器:输出 = X × Y(真正的音频率相乘,X 进信号通路、Y 进增益参数)。正弦×正弦产生原始两个频率之外的和差边带 —— 钟 / 金属 / 机器人音色。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: 'X × Y 相乘输出' },
      { id: 'X', dir: 'in', name: 'X', desc: '载波输入(信号通路)' },
      { id: 'Y', dir: 'in', name: 'Y', desc: '调制输入(增益参数,双极性)' }
    ],
    flow: { OUT: ['X', 'Y'] },
    build() {
      this.g = ctx.createGain();
      this.g.gain.value = 0;              // Y 双极摆动 → 四象限相乘
      this.ins.X.connect(this.g);
      this.ins.Y.connect(this.g.gain);
      this.g.connect(this.outs.OUT);
    },
    dispose() {}
  },

  /* ---- 滑音:CV 波特限制器(时间常数滑向输入) ---- */
  glide: {
    id: 'glide', name: '滑音', en: 'SLEW', cat: 'process', w: 4, h: 6,
    desc: '滑音 / 波特限制器:输出以 TIME 时间常数平滑滑向输入电压。接在音序器 CV 与振荡器之间做 portamento;对任意 CV 也有低通滤波效果。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '平滑后的电压' },
      { id: 'IN', dir: 'in', name: 'IN', desc: 'CV 输入' }
    ],
    flow: { OUT: ['IN'] },
    state: () => ({ time: 0.12 }),
    build() {
      this.cs = ctx.createConstantSource(); this.cs.offset.value = 0;
      this.cs.connect(this.outs.OUT); this.cs.start();
      this.mon('IN');
    },
    tick() {
      this.cs.offset.setTargetAtTime(this.volts('IN', 0), ctx.currentTime, this.state.time);
    },
    ui() {
      kit.knob(this, { key: 'time', label: 'TIME', min: 0.005, max: 1.5, value: this.state.time, unit: 's' });
      kit.hint('时间常数滑音', this);
    },
    dispose() { try { this.cs.stop(); } catch (e) {} }
  },

  /* ---- 包络跟随:音频幅度 → CV(0~10V) ---- */
  envf: {
    id: 'envf', name: '包络跟随', en: 'ENV FOLLOW', cat: 'source', w: 5, h: 8,
    desc: '包络跟随器:检测输入音频的峰值幅度,按 GAIN 换算成 0~10V 控制电压输出。让鼓机 / 音乐驱动滤波器与 VCA —— 音频改 CV 的关键桥梁。',
    ports: [
      { id: 'CV', dir: 'out', name: 'CV', desc: '幅度电压 0~10V' },
      { id: 'IN', dir: 'in', name: 'IN', desc: '音频输入' }
    ],
    flow: { CV: ['IN'] },
    state: () => ({ gain: 5 }),
    build() {
      this.cs = ctx.createConstantSource(); this.cs.offset.value = 0;
      this.cs.connect(this.outs.CV); this.cs.start();
      this.an = ctx.createAnalyser(); this.an.fftSize = 512;
      this.ins.IN.connect(this.an);
      this._buf = new Float32Array(512);
      this._hist = new Float32Array(96); this._hi = 0; this._v = 0;
      kit.screen(this, 'scr');
    },
    tick() {
      this.an.getFloatTimeDomainData(this._buf);
      let pk = 0;
      for (let i = 0; i < this._buf.length; i += 2) {
        const a = Math.abs(this._buf[i]);
        if (a > pk) pk = a;
      }
      // 包络检出:快攻慢放(上升立跟,下降 8 个 tick 缓降)
      const v = clamp(pk * this.state.gain * 10, 0, 10);
      this._v = v > this._v ? v : this._v * 0.82 + v * 0.18;
      this._hist[this._hi] = this._v;
      this._hi = (this._hi + 1) % this._hist.length;
      this.cs.offset.setTargetAtTime(this._v, ctx.currentTime, 0.012);
      this.draw();
    },
    draw() {
      const s = this.scr; if (!s) return;
      const { c, w: W, h: H } = s;
      c.fillStyle = '#0b0d10'; c.fillRect(0, 0, W, H);
      const n = this._hist.length;
      c.strokeStyle = '#ffd24d'; c.lineWidth = 1; c.beginPath();
      for (let i = 0; i < n; i++) {
        const v = this._hist[(this._hi + i) % n];
        const x = i / (n - 1) * (W - 4), y = H - 6 - v / 10 * (H - 12);
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
      c.fillStyle = '#8fb4d8'; c.font = '9px monospace';
      c.fillText(this._v.toFixed(1) + 'V', 4, 10);
    },
    ui() {
      kit.knob(this, { key: 'gain', label: 'GAIN', min: 0.5, max: 10, value: this.state.gain, unit: '' });
    },
    dispose() { try { this.cs.stop(); } catch (e) {} }
  }
};
