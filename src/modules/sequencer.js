/* MIDI 音序器:8 步,每步电压(接旋钮设定)量化为 MIDI 音符,
   内置 MIDI→CV 转换,同时输出 CV/Gate。CLK 上升沿走步,RST 回第 1 步。 */

import { clamp } from '../core/utils.js';
import { ctx } from '../core/audio.js';
import { kit } from '../kit/index.js';

export const seq = {
  id: 'seq', name: 'MIDI音序器', en: 'MIDI SEQUENCER', cat: 'control', w: 20, h: 8,
  desc: '8 步 MIDI 音序器:每步电压(接旋钮设定)量化为 MIDI 音符从 MIDI 口发出;内置 MIDI→CV 转换,同时输出 CV/Gate。CLK 时钟上升沿走步,RST 高电平回第 1 步。',
  ports: [
    { id: 'MIDI', dir: 'out', name: 'MIDI', desc: 'MIDI 音符信号(步进电压按 1V/oct 量化为半音符)' },
    { id: 'CV', dir: 'out', name: 'CV', desc: '内置 MIDI→CV:当前步电压 0~10V' },
    { id: 'GATE', dir: 'out', name: 'GATE', desc: '内置 MIDI→CV:步内 Gate(约 60% 时值)' },
    { id: 'CLK', dir: 'in', name: 'CLK', desc: '时钟输入(上升沿走一步,可接 LFO 方波)' },
    { id: 'RST', dir: 'in', name: 'RST', desc: '复位:≥0.5V 时下一步回到第 1 步' },
    { id: 'V1', dir: 'in', name: 'V1', desc: '第 1 步电压(接旋钮)' },
    { id: 'V2', dir: 'in', name: 'V2', desc: '第 2 步电压' },
    { id: 'V3', dir: 'in', name: 'V3', desc: '第 3 步电压' },
    { id: 'V4', dir: 'in', name: 'V4', desc: '第 4 步电压' },
    { id: 'V5', dir: 'in', name: 'V5', desc: '第 5 步电压' },
    { id: 'V6', dir: 'in', name: 'V6', desc: '第 6 步电压' },
    { id: 'V7', dir: 'in', name: 'V7', desc: '第 7 步电压' },
    { id: 'V8', dir: 'in', name: 'V8', desc: '第 8 步电压' }
  ],
  build() {
    this.cCv = ctx.createConstantSource(); this.cGt = ctx.createConstantSource();
    this.cCv.offset.value = 0; this.cGt.offset.value = 0;
    this.cCv.connect(this.outs.CV); this.cGt.connect(this.outs.GATE);
    this.cCv.start(); this.cGt.start();
    this.mon('CLK'); this.mon('RST');
    for (let i = 1; i <= 8; i++) this.mon('V' + i);
    this.idx = 0; this.lastRise = 0; this.period = 0.35; this._mnote = null;
    kit.screen(this, 'scr');
  },
  tick() {
    const e = this.edge('CLK');
    const rst = this.volts('RST', 0) >= 0.5;
    if (e === 1) {
      const t = ctx.currentTime;
      const dt = t - this.lastRise;
      if (dt > 0.05 && dt < 4) this.period = dt;
      this.lastRise = t;
      this.idx = rst ? 0 : (this.idx + 1) % 8;
      const v = clamp(this.volts('V' + (this.idx + 1), 0), 0, 10);
      const rest = v < 0.2;                       // 步进电压 <0.2V = 休止
      const g = this.cGt.offset;
      g.cancelScheduledValues(t);
      if (rest) {
        g.setValueAtTime(0, t);
      } else {
        g.setValueAtTime(10, t);
        g.setValueAtTime(0, t + Math.max(0.02, this.period * 0.6));
      }
      this.cCv.offset.setValueAtTime(v, t);
      // MIDI:步进电压按 1V/oct 量化为半音符,换步时发送 noteoff/noteon(休止不发)
      if (!rest) {
        const note = clamp(60 + Math.round(v * 12), 0, 127);
        if (this._mnote !== null && this._mnote !== note) {
          this.emitMidi('MIDI', { type: 'noteoff', note: this._mnote });
          this._mnote = null;
        }
        if (this._mnote !== note) {
          this.emitMidi('MIDI', { type: 'noteon', note, vel: 100 });
          this._mnote = note;
        }
      }
    }
    const s = this.scr; if (!s) return;
    const { c, w: W, h: H } = s;
    c.fillStyle = '#0b0d10'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,.07)';
    for (const f of [0, 0.5, 1]) {
      const y = H - 11 - f * (H - 20);
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    }
    const bw = W / 8;
    for (let i = 0; i < 8; i++) {
      const v = clamp(this.volts('V' + (i + 1), 0), 0, 10);
      const bh = (v / 10) * (H - 20);
      c.fillStyle = i === this.idx ? '#ffd24d' : 'rgba(255,210,77,.32)';
      c.fillRect(i * bw + 3, H - 11 - bh, bw - 6, bh);
      c.fillStyle = i === this.idx ? '#fff' : 'rgba(255,255,255,.35)';
      c.font = '9px monospace';
      c.fillText(i + 1, i * bw + bw / 2 - 4, H - 2);
    }
    c.fillStyle = this.cGt.offset.value >= 5 ? '#7dffb0' : '#445';
    c.beginPath(); c.arc(W - 9, 9, 4, 0, 7); c.fill();
    c.fillStyle = '#cfd6dd'; c.font = '10px monospace';
    c.fillText('STEP ' + (this.idx + 1) + '  ' + this.volts('V' + (this.idx + 1), 0).toFixed(1) + 'V', 5, 12);
  },
  dispose() { try { this.cCv.stop(); this.cGt.stop(); } catch (e) {} }
};
