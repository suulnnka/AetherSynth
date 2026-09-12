/* MIDI 音序器:128 步内置步进存储。
   ---------------------------------------------------------------------
   屏幕即编辑器:点击 / 拖拽直接绘制每步的电压(0~10V,0 = 休止),
   LEN 设定有效步数(1~128,循环播放),门宽可调;步进电压按 1V/oct
   量化为 MIDI 音符从 MIDI 口发出,内置 MIDI→CV 同时输出 CV / Gate。
   CLK 上升沿走一步,RST 高电平回第 1 步。
   播放中可以随时重画,实时改变旋律。 */

import { clamp } from '../core/utils.js';
import { ctx } from '../core/audio.js';
import { kit } from '../kit/index.js';

export const seq = {
  id: 'seq', name: 'MIDI音序器', en: 'MIDI SEQUENCER 128', cat: 'control', w: 20, h: 12,
  desc: '128 步 MIDI 音序器:在屏幕上点击 / 拖拽绘制每步电压(0~10V,拖到最低 = 休止),LEN 设定有效步数(1~128)循环播放;内置 MIDI→CV 转换同时输出 CV/Gate。CLK 上升沿走一步,RST 高电平回第 1 步。播放中可随时重画。',
  ports: [
    { id: 'MIDI', dir: 'out', name: 'MIDI', desc: 'MIDI 音符信号(步进电压按 1V/oct 量化为半音符)' },
    { id: 'CV', dir: 'out', name: 'CV', desc: '当前步电压 0~10V' },
    { id: 'GATE', dir: 'out', name: 'GATE', desc: '步内 Gate(门宽可调)' },
    { id: 'CLK', dir: 'in', name: 'CLK', desc: '时钟输入(上升沿走一步,可接 LFO 方波)' },
    { id: 'RST', dir: 'in', name: 'RST', desc: '复位:≥0.5V 时下一步回到第 1 步' }
  ],
  state: () => ({ steps: new Array(128).fill(0), len: 16, gate: 6 }),
  build() {
    this.steps = (this.state.steps && this.state.steps.length === 128)
      ? this.state.steps
      : new Array(128).fill(0);
    this.len = clamp(Math.round(this.state.len ?? 16), 1, 128);
    this.cCv = ctx.createConstantSource(); this.cGt = ctx.createConstantSource();
    this.cCv.offset.value = 0; this.cGt.offset.value = 0;
    this.cCv.connect(this.outs.CV); this.cGt.connect(this.outs.GATE);
    this.cCv.start(); this.cGt.start();
    this.mon('CLK'); this.mon('RST');
    this.idx = 0; this.lastRise = 0; this.period = 0.35; this._mnote = null;
    this._paint = false;
    // 屏幕即编辑器:上部屏幕(可绘制),下部长度 / 门宽旋钮
    const scrHost = document.createElement('div');
    scrHost.style.cssText = 'flex:1;min-height:0';
    const knobRow = document.createElement('div');
    knobRow.style.cssText = 'flex:0 0 58px;display:flex;gap:10px;justify-content:center;align-items:flex-start';
    this.body.style.cssText += ';display:flex;flex-direction:column;gap:4px';
    this.body.append(scrHost, knobRow);
    const realBody = this.body;
    this.body = scrHost;
    kit.screen(this, 'scr');
    this.body = realBody;
    const cv = this.scr.cv;
    cv.style.cursor = 'crosshair';
    cv.addEventListener('pointerdown', e => {
      e.stopPropagation();
      this._paint = true;
      this.paintAt(e);
    });
    cv.addEventListener('pointermove', e => { if (this._paint) this.paintAt(e); });
    window.addEventListener('pointerup', () => { this._paint = false; });
    kit.knob(this, { parent: knobRow, key: 'len', label: '长度(步)', min: 1, max: 128, value: this.len, unit: '', int: true });
    kit.knob(this, { parent: knobRow, key: 'gate', label: '门宽', min: 1, max: 9, value: 6, unit: '' });
  },
  /** 屏幕绘制:把指针位置换算成步序号与电压 */
  paintAt(e) {
    const cv = this.scr.cv;
    const r = cv.getBoundingClientRect();
    if (r.width < 2) return;
    const i = clamp(Math.floor((e.clientX - r.left) / r.width * this.len), 0, this.len - 1);
    const v = clamp((1 - (e.clientY - r.top) / r.height) * 10, 0, 10);
    this.steps[i] = Math.round(v * 10) / 10;
  },
  tick() {
    const e = this.edge('CLK');
    const rst = this.volts('RST', 0) >= 0.5;
    if (e === 1) {
      const t = ctx.currentTime;
      const dt = t - this.lastRise;
      if (dt > 0.05 && dt < 4) this.period = dt;
      this.lastRise = t;
      this.idx = rst ? 0 : (this.idx + 1) % this.len;
      const v = clamp(this.steps[this.idx] ?? 0, 0, 10);
      const rest = v < 0.2;                       // 步进电压 <0.2V = 休止
      const g = this.cGt.offset;
      const gateSec = Math.max(0.02, this.period * (this.state.gate ?? 6) / 10);
      g.cancelScheduledValues(t);
      if (rest) g.setValueAtTime(0, t);
      else {
        g.setValueAtTime(10, t);
        g.setValueAtTime(0, t + gateSec);
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
    this.draw();
  },
  draw() {
    const s = this.scr; if (!s) return;
    const { c, w: W, h: H } = s;
    const n = this.len;
    c.fillStyle = '#0b0d10'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,.07)';
    for (const f of [0, 0.5, 1]) {
      const y = H - 11 - f * (H - 20);
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    }
    // 每小节(8 步)分隔线
    c.strokeStyle = 'rgba(255,255,255,.13)';
    for (let b = 8; b < n; b += 8) {
      const x = b * (W / n);
      c.beginPath(); c.moveTo(x, 4); c.lineTo(x, H - 11); c.stroke();
    }
    const bw = W / n;
    for (let i = 0; i < n; i++) {
      const v = clamp(this.steps[i] ?? 0, 0, 10);
      const bh = (v / 10) * (H - 20);
      c.fillStyle = i === this.idx ? '#ffd24d' : 'rgba(255,210,77,.32)';
      c.fillRect(i * bw + 1, H - 11 - bh, Math.max(1, bw - 2), bh);
      if (n <= 32 || i % Math.ceil(n / 32) === 0) {
        c.fillStyle = i === this.idx ? '#fff' : 'rgba(255,255,255,.35)';
        c.font = '8px monospace';
        c.fillText(i + 1, i * bw + 1, H - 2);
      }
    }
    // 播放头
    c.strokeStyle = 'rgba(125,255,176,.9)';
    c.beginPath(); c.moveTo((this.idx + 0.5) * bw, 4); c.lineTo((this.idx + 0.5) * bw, H - 11); c.stroke();
    c.fillStyle = this.cGt.offset.value >= 5 ? '#7dffb0' : '#445';
    c.beginPath(); c.arc(W - 9, 9, 4, 0, 7); c.fill();
    c.fillStyle = '#cfd6dd'; c.font = '10px monospace';
    c.fillText('STEP ' + (this.idx + 1) + '/' + n + '  ' + (this.steps[this.idx] ?? 0).toFixed(1) + 'V', 5, 12);
  },
  dispose() { try { this.cCv.stop(); this.cGt.stop(); } catch (e) {} }
};
