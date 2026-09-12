/* MIDI 键盘:钢琴键 / 电脑按键 / Web MIDI 三种输入;内置 MIDI→CV 转换,
   同时直接输出音高、门、力度电压。 */

import { clamp } from '../core/utils.js';
import { ctx } from '../core/audio.js';
import { kit } from '../kit/index.js';

export const keyboard = {
  id: 'keyboard', name: 'MIDI键盘', en: 'MIDI KEYBOARD', cat: 'control', w: 20, h: 7,
  desc: 'MIDI 键盘:钢琴键 / 电脑按键 / Web MIDI 三种输入,从 MIDI 口发出音符;内置 MIDI→CV 转换,同时直接输出音高、门、力度电压。',
  ports: [
    { id: 'MIDI', dir: 'out', name: 'MIDI', desc: 'MIDI 音符信号(3.5mm TRS-MIDI 惯例)→ 接 MIDI-CV 或支持 MIDI 的模块' },
    { id: 'VOCT', dir: 'out', name: 'V/OCT', desc: '内置 MIDI→CV:音高 1V/oct,C4 = 0V' },
    { id: 'GATE', dir: 'out', name: 'GATE', desc: '内置 MIDI→CV:按住 = +10V' },
    { id: 'VEL', dir: 'out', name: 'VEL', desc: '内置 MIDI→CV:力度 0~10V(琴键越靠下越大)' }
  ],
  state: () => ({ oct: 0 }),
  build() {
    this.cCv = ctx.createConstantSource(); this.cGt = ctx.createConstantSource(); this.cVe = ctx.createConstantSource();
    this.cCv.offset.value = 0; this.cGt.offset.value = 0; this.cVe.offset.value = 0;
    this.cCv.connect(this.outs.VOCT); this.cGt.connect(this.outs.GATE); this.cVe.connect(this.outs.VEL);
    this.cCv.start(); this.cGt.start(); this.cVe.start();
    this.held = []; this._keys = new Map(); this._comp = {};
    this.midiTry();
  },
  ui() { kit.keys(this); },
  noteOn(n, vel = 100) {
    n = clamp(Math.round(n), 48, 72);
    this.held = this.held.filter(x => x.n !== n);
    this.held.push({ n, v: clamp(vel, 1, 127) });
    this.applyKb(); this.paintKey(n, true);
    this.emitMidi('MIDI', { type: 'noteon', note: n, vel: clamp(vel, 1, 127) });
  },
  noteOff(n) {
    n = clamp(Math.round(n), 48, 72);
    this.held = this.held.filter(x => x.n !== n);
    this.applyKb(); this.paintKey(n, false);
    this.emitMidi('MIDI', { type: 'noteoff', note: n });
  },
  applyKb() {
    const top = this.held[this.held.length - 1];
    if (top) {
      this.cCv.offset.value = (top.n - 60) / 12;
      this.cGt.offset.value = 10;
      this.cVe.offset.value = top.v / 127 * 10;
    } else {
      this.cGt.offset.value = 0;
    }
  },
  paintKey(n, on) {
    const k = this._keys.get(n);
    if (k) k.classList.toggle('pressed', on);
  },
  /** 电脑按键 → 音符(offset 为 KEYMAP 半音偏移) */
  compNote(off, down) {
    const n = clamp(60 + 12 * (this.state.oct || 0) + off, 48, 72);
    if (down) { if (this._comp[off]) return; this._comp[off] = n; this.noteOn(n, 100); }
    else { if (this._comp[off] !== n) return; delete this._comp[off]; this.noteOff(n); }
  },
  shiftOct(d) {
    this.state.oct = clamp((this.state.oct || 0) + d, -2, 2);
    if (this._hint) this._hint.textContent =
      `电脑键:A W S E D F T G Y H U J K O L P ;(八度 ${this.state.oct >= 0 ? '+' + this.state.oct : this.state.oct}) · MIDI:待接入`;
  },
  midiTry() {
    const self = this;
    if (!navigator.requestMIDIAccess) return;
    navigator.requestMIDIAccess().then(acc => {
      let any = false;
      const plug = inp => {
        any = true;
        inp.onmidimessage = e => {
          const [st, d1, d2] = e.data, cmd = st & 0xf0;
          if (cmd === 0x90 && d2 > 0) self.noteOn(d1, d2);
          else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) self.noteOff(d1);
        };
      };
      acc.inputs.forEach(plug);
      acc.onstatechange = e => { if (e.port.type === 'input') plug(e.port); };
      if (self._hint && any) self._hint.textContent =
        self._hint.textContent.replace('MIDI:待接入', 'MIDI:已连接 ✓');
    }).catch(() => {});
  }
};
