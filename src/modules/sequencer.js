/* MIDI 音序器:1024 步内置步进存储。
   ---------------------------------------------------------------------
   屏幕即编辑器:点击 / 拖拽直接绘制每步的电压(0~10V,0 = 休止),
   LEN 设定有效步数(1~512,循环播放),门宽可调;步进电压按 1V/oct
   量化为 MIDI 音符从 MIDI 口发出,内置 MIDI→CV 同时输出 CV / Gate。
   CLK 上升沿走一步,RST 高电平回第 1 步。
   播放中可以随时重画,实时改变旋律。 */

import { clamp } from '../core/utils.js';
import { ctx } from '../core/audio.js';
import { kit } from '../kit/index.js';
import { saveSoon } from '../core/save.js';

/* ---- 钢琴卷帘纯函数(可单测) ---- */
export const ROLL_KEYS = 25;                                  // C3 ~ C5
/** 键位 → 电压:1V/oct,0V = C4(k=12) */
export const rollKeyVolts = k => (k - 12) / 12;
/** 键位 → MIDI 音符号 */
export const rollKeyMidi = k => 48 + k;
/** 是否黑键(用于卷帘行着色) */
export const rollIsBlack = k => [1, 3, 6, 8, 10].includes((48 + k) % 12);
/** 一格(16 分音符)的时长秒数 */
export const rollCellSec = bpm => 15 / bpm;
/** pos(格,可为小数)处 sounding 的音符:取起始最晚的一个;无则 null */
export function rollActiveNote(notes, pos) {
  let best = null;
  for (const n of notes)
    if (n.c <= pos && pos < n.c + n.l && (!best || n.c >= best.c)) best = n;
  return best;
}

export const seq = {
  id: 'seq', name: 'MIDI音序器', en: 'MIDI SEQUENCER 1024', cat: 'control', w: 20, h: 12,
  desc: '1024 步 MIDI 音序器(128 小节 @ 8 步/小节,或 256 小节 @ 16 分音符):在屏幕上点击 / 拖拽绘制每步电压(0~10V,拖到最低 = 休止),LEN 设定有效步数(1~1024)循环播放;内置 MIDI→CV 转换同时输出 CV/Gate。CLK 上升沿走一步,RST 高电平回第 1 步。播放中可随时重画。旧 128/512 步存档自动补齐。',
  ports: [
    { id: 'MIDI', dir: 'out', name: 'MIDI', desc: 'MIDI 音符信号(步进电压按 1V/oct 量化为半音符)' },
    { id: 'CV', dir: 'out', name: 'CV', desc: '当前步电压 0~10V' },
    { id: 'GATE', dir: 'out', name: 'GATE', desc: '步内 Gate(门宽可调)' },
    { id: 'CLK', dir: 'in', name: 'CLK', desc: '时钟输入(上升沿走一步,可接 LFO 方波)' },
    { id: 'RST', dir: 'in', name: 'RST', desc: '复位:≥0.5V 时下一步回到第 1 步' }
  ],
  state: () => ({ steps: new Array(1024).fill(null), len: 16, gate: 6 }),
  build() {
    const N = 1024;
    const old = this.state.steps;
    // 旧存档(128 步等)自动补齐到 512;超长截断
    this.steps = (Array.isArray(old) && old.length)
      ? old.slice(0, N).concat(new Array(Math.max(0, N - old.length)).fill(null))
      : new Array(N).fill(null);
    this.len = clamp(Math.round(this.state.len ?? 16), 1, N);
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
    kit.knob(this, { parent: knobRow, key: 'len', label: '长度(步)', min: 1, max: 1024, value: this.len, unit: '', int: true });
    kit.knob(this, { parent: knobRow, key: 'gate', label: '门宽', min: 1, max: 9, value: 6, unit: '' });
  },
  /** 屏幕绘制:把指针位置换算成步序号与电压(中线 = 0V,向上正 / 向下负) */
  paintAt(e) {
    const cv = this.scr.cv;
    const r = cv.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const i = clamp(Math.floor((e.clientX - r.left) / r.width * this.len), 0, this.len - 1);
    const v = Math.round(clamp((0.5 - (e.clientY - r.top) / r.height) * 20, -10, 10) * 10) / 10;
    if (e.shiftKey) { this.steps[i] = null; return; }   // Shift + 拖拽 = 擦除
    this.steps[i] = v;
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
      const raw = this.steps[this.idx];
      const v = raw == null ? 0 : raw;
      const rest = raw == null;                     // null = 休止(未绘制)
      const g = this.cGt.offset;
      const gateSec = Math.max(0.02, this.period * (this.state.gate ?? 6) / 10);
      g.cancelScheduledValues(t);
      if (rest) g.setValueAtTime(0, t);
      else {
        g.setValueAtTime(10, t);
        g.setValueAtTime(0, t + gateSec);
      }
      if (!rest) this.cCv.offset.setValueAtTime(v, t);
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
    const mid = H / 2;
    c.fillStyle = '#0b0d10'; c.fillRect(0, 0, W, H);
    // 零电平线
    c.strokeStyle = 'rgba(255,255,255,.25)';
    c.beginPath(); c.moveTo(0, mid); c.lineTo(W, mid); c.stroke();
    // 小节分隔线(每 8 步)
    c.strokeStyle = 'rgba(255,255,255,.13)';
    for (let b = 8; b < n; b += 8) {
      const x = b * (W / n);
      c.beginPath(); c.moveTo(x, 2); c.lineTo(x, H - 2); c.stroke();
    }
    const bw = W / n;
    for (let i = 0; i < n; i++) {
      const v = this.steps[i];
      if (v == null) continue;
      const hgt = (Math.abs(v) / 10) * (mid - 4);
      c.fillStyle = i === this.idx ? '#ffd24d' : 'rgba(125,200,255,.55)';
      if (v >= 0) c.fillRect(i * bw + 1, mid - hgt, Math.max(1, bw - 2), hgt);
      else c.fillRect(i * bw + 1, mid, Math.max(1, bw - 2), hgt);
      if ((n <= 48) || i % Math.ceil(n / 48) === 0) {
        c.fillStyle = '#cfd6dd'; c.font = '7px monospace';
        c.fillText((+v).toFixed(1), i * bw + 1, v >= 0 ? mid - hgt - 2 : mid + hgt + 8);
      }
    }
    // 播放头
    c.strokeStyle = 'rgba(125,255,176,.9)';
    c.beginPath(); c.moveTo((this.idx + 0.5) * bw, 2); c.lineTo((this.idx + 0.5) * bw, H - 2); c.stroke();
    c.fillStyle = this.cGt.offset.value >= 5 ? '#7dffb0' : '#445';
    c.beginPath(); c.arc(W - 9, 9, 4, 0, 7); c.fill();
    c.fillStyle = '#cfd6dd'; c.font = '10px monospace';
    c.fillText('STEP ' + (this.idx + 1) + '/' + n + '  ' + (this.steps[this.idx] == null ? '—' : (+this.steps[this.idx]).toFixed(1) + 'V'), 5, 12);
  },
  dispose() { try { this.cCv.stop(); this.cGt.stop(); } catch (e) {} }
};

/* 钢琴卷帘:D AW 式音符编辑器。
   ---------------------------------------------------------------------
   左侧钢琴键 + 右侧时间网格(16 分音符格),音符可任意变长:
   一个音 1/4 拍(1 格),另一个音 1 拍(4 格)甚至整小节。
   点空白 = 画出音符(拖动可拉长),拖音符 = 移动,拖右缘 = 改长度,
   右键 = 删除。内置 BPM 时钟循环播放,输出 1V/oct CV + Gate + MIDI。
   PLAY 门(未接线默认播放),RST 上升沿回开头。 */
export const roll = {
  id: 'roll', name: '钢琴卷帘', en: 'PIANO ROLL', cat: 'control', w: 24, h: 15,
  desc: 'DAW 式钢琴卷帘音序器:左侧琴键 + 16 分音符网格,音符长度任意(1 格 = 1/4 拍,4 格 = 1 拍)。点空白画出音符并拖动拉长,拖音符移动,拖右缘改变时值,右键删除。内置 BPM 时钟循环播放,输出 1V/oct CV(0V = C4)+ Gate + MIDI。PLAY 门未接线默认播放,RST 上升沿回开头。',
  ports: [
    { id: 'CV', dir: 'out', name: 'CV', desc: '音高电压 1V/oct(0V = C4)' },
    { id: 'GATE', dir: 'out', name: 'GATE', desc: '音符 Gate(门宽 % 可调)' },
    { id: 'MIDI', dir: 'out', name: 'MIDI', desc: 'MIDI noteon/noteoff(按力度)' },
    { id: 'PLAY', dir: 'in', name: 'PLAY', desc: '播放门(≥0.5V 播放;未接线默认播放)' },
    { id: 'RST', dir: 'in', name: 'RST', desc: '复位:上升沿回到小节开头' }
  ],
  state: () => ({ notes: [], bpm: 120, bars: 2, gate: 90 }),
  build() {
    // 恢复并清洗音符(纯数据,直接序列化)
    this.notes = (Array.isArray(this.state.notes) ? this.state.notes : []).filter(n =>
      n && Number.isFinite(n.c) && Number.isFinite(n.k) && Number.isFinite(n.l)).map(n => ({
        c: clamp(Math.round(n.c), 0, 63),
        k: clamp(Math.round(n.k), 0, ROLL_KEYS - 1),
        l: clamp(Math.round(n.l) || 1, 1, 64),
        v: clamp(Math.round(n.v ?? 8), 1, 10)
      }));
    this.state.notes = this.notes;
    this.cCv = ctx.createConstantSource(); this.cGt = ctx.createConstantSource();
    this.cCv.offset.value = 0; this.cGt.offset.value = 0;
    this.cCv.connect(this.outs.CV); this.cGt.connect(this.outs.GATE);
    this.cCv.start(); this.cGt.start();
    this.mon('PLAY'); this.mon('RST');
    this.playing = false; this._t0 = 0; this._cur = null;
    this._lastLen = 4; this._drag = null; this._paint = false;
    // 屏幕即编辑器 + 下方旋钮行
    const scrHost = document.createElement('div');
    scrHost.style.cssText = 'flex:1;min-height:0';
    const knobRow = document.createElement('div');
    knobRow.style.cssText = 'flex:0 0 46px;display:flex;gap:12px;justify-content:center;align-items:flex-start';
    this.body.style.cssText += ';display:flex;flex-direction:column;gap:3px';
    this.body.append(scrHost, knobRow);
    const realBody = this.body;
    this.body = scrHost;
    kit.screen(this, 'scr');
    this.body = realBody;
    const cv = this.scr.cv;
    cv.style.cursor = 'crosshair';
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => { e.stopPropagation(); this._paint = true; this.downAt(e); });
    cv.addEventListener('pointermove', e => { if (this._paint) this.dragAt(e); });
    window.addEventListener('pointerup', () => {
      if (this._paint && this._drag) { this._lastLen = this._drag.note.l; saveSoon(); }
      this._paint = false; this._drag = null;
    });
    kit.knob(this, { parent: knobRow, key: 'bpm', label: 'BPM', min: 40, max: 240, value: this.state.bpm, unit: '' });
    kit.knob(this, { parent: knobRow, key: 'bars', label: '小节', min: 1, max: 4, value: this.state.bars, unit: '', int: true });
    kit.knob(this, { parent: knobRow, key: 'gate', label: '门宽 %', min: 10, max: 100, value: this.state.gate, unit: '' });
  },
  /** 画布几何:左侧琴键列 + 顶部拍号线 + 网格区 */
  geom() {
    const s = this.scr, W = s.w, H = s.h;
    const KEYW = 20, HEAD = 9;
    const cells = this.state.bars * 16;
    const gw = W - KEYW - 1, gh = H - HEAD - 1;
    return { W, H, KEYW, HEAD, cells, gw, gh, gx: KEYW + 1, gy: HEAD + 1,
      cellW: gw / cells, rowH: gh / ROLL_KEYS };
  },
  /** 指针位置 → (格, 键位);落在琴键列 / 拍号行返回 null */
  hitAt(e) {
    const r = this.scr.cv.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    const g = this.geom();
    const x = (e.clientX - r.left) * g.W / r.width;
    const y = (e.clientY - r.top) * g.H / r.height;
    if (x < g.gx || y < g.gy) return null;
    const cell = clamp(Math.floor((x - g.gx) / g.cellW), 0, g.cells - 1);
    const k = clamp(ROLL_KEYS - 1 - Math.floor((y - g.gy) / g.rowH), 0, ROLL_KEYS - 1);
    return { cell, k };
  },
  noteAt(cell, k) {
    return this.notes.find(n => n.k === k && n.c <= cell && cell < n.c + n.l) || null;
  },
  downAt(e) {
    const h = this.hitAt(e); if (!h) return;
    // 右键 = 删除音符
    if (e.button === 2) {
      const n = this.noteAt(h.cell, h.k);
      if (n) { this.notes.splice(this.notes.indexOf(n), 1); if (this._cur === n) this._cur = null; saveSoon(); }
      return;
    }
    const n = this.noteAt(h.cell, h.k);
    if (n) {
      const edgeCell = n.c + n.l - Math.max(1, Math.round(n.l / 4));
      this._drag = { mode: h.cell >= edgeCell ? 'resize' : 'move', note: n,
        oc: n.c, ok: n.k, ol: n.l, gc: h.cell, gk: h.k };
    } else {
      const nn = { c: h.cell, k: h.k, l: Math.min(this._lastLen, this.geom().cells - h.cell), v: 8 };
      this.notes.push(nn);
      this._drag = { mode: 'new', note: nn, oc: nn.c, ok: nn.k, ol: nn.l, gc: h.cell, gk: h.k };
      saveSoon();
    }
  },
  dragAt(e) {
    const d = this._drag, h = this.hitAt(e); if (!d || !h) return;
    const n = d.note;
    if (d.mode === 'move') {
      n.c = clamp(d.oc + h.cell - d.gc, 0, this.geom().cells - d.ol);
      n.k = clamp(d.ok + h.k - d.gk, 0, ROLL_KEYS - 1);
    } else {                                   // new / resize:右缘拉长度
      n.l = clamp(h.cell - n.c + 1, 1, this.geom().cells - n.c);
    }
  },
  _start(t) { this.playing = true; this._t0 = t; this._cur = null; },
  _stop(t) {
    this.playing = false;
    if (this._cur) { this.emitMidi('MIDI', { type: 'noteoff', note: rollKeyMidi(this._cur.k) }); this._cur = null; }
    this.cGt.offset.cancelScheduledValues(t); this.cGt.offset.setValueAtTime(0, t);
  },
  tick() {
    const t = ctx.currentTime;
    // 播放门:接线后跟随实时电平,未接线默认播放
    const pv = this.volts('PLAY', 10) >= 0.5;
    if (pv && !this.playing) this._start(t);
    else if (!pv && this.playing) this._stop(t);
    if (this.playing && this.edge('RST') === 1) { this._t0 = t; this._cur = null; }
    if (this.playing) {
      const loop = this.state.bars * 16, cs = rollCellSec(this.state.bpm);
      const pos = ((t - this._t0) / cs) % loop;
      const cur = rollActiveNote(this.notes, pos);
      if (cur !== this._cur) {
        if (this._cur) this.emitMidi('MIDI', { type: 'noteoff', note: rollKeyMidi(this._cur.k) });
        this._cur = cur;
        const g = this.cGt.offset;
        g.cancelScheduledValues(t);
        if (cur) {
          this.cCv.offset.cancelScheduledValues(t);
          this.cCv.offset.setTargetAtTime(rollKeyVolts(cur.k), t, 0.004);
          g.setValueAtTime(10, t);
          const dur = Math.max(0.03, (cur.c + cur.l - pos) * cs * (this.state.gate / 100));
          g.setValueAtTime(0, t + dur);
          this.emitMidi('MIDI', { type: 'noteon', note: rollKeyMidi(cur.k), vel: cur.v * 12 });
        } else g.setValueAtTime(0, t);
      }
      this._pos = pos;
    } else this._pos = null;
    this.draw();
  },
  draw() {
    const s = this.scr; if (!s) return;
    const g = this.geom(), c = s.c, pos = this._pos;
    c.fillStyle = '#0b0d10'; c.fillRect(0, 0, g.W, g.H);
    // 琴键行明暗(黑键行更暗)
    for (let k = 0; k < ROLL_KEYS; k++) {
      const y = g.gy + (ROLL_KEYS - 1 - k) * g.rowH;
      c.fillStyle = rollIsBlack(k) ? 'rgba(255,255,255,.030)' : 'rgba(255,255,255,.065)';
      c.fillRect(g.gx, y, g.gw, Math.max(1, g.rowH - 0.5));
    }
    // 竖线:格(淡)/ 拍(中)/ 小节(亮)
    for (let i = 0; i <= g.cells; i++) {
      const x = g.gx + i * g.cellW;
      c.strokeStyle = i % 16 === 0 ? 'rgba(255,255,255,.30)'
        : i % 4 === 0 ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.06)';
      c.beginPath(); c.moveTo(x, g.gy); c.lineTo(x, g.gy + g.gh); c.stroke();
    }
    // 音符块(右缘留亮边提示可拉长)
    for (const n of this.notes) {
      const x = g.gx + n.c * g.cellW, w = Math.max(2, n.l * g.cellW - 1);
      const y = g.gy + (ROLL_KEYS - 1 - n.k) * g.rowH;
      const on = this.playing && this._cur === n;
      c.fillStyle = on ? '#ffd24d' : `rgba(125,200,255,${0.4 + n.v * 0.05})`;
      c.fillRect(x, y + 0.5, w, Math.max(1, g.rowH - 1.5));
      if (n.l >= 2) {
        c.fillStyle = on ? '#fff3c4' : 'rgba(220,240,255,.65)';
        c.fillRect(x + w - 1.5, y + 0.5, 1.5, Math.max(1, g.rowH - 1.5));
      }
    }
    // 左侧钢琴列
    for (let k = 0; k < ROLL_KEYS; k++) {
      const y = g.gy + (ROLL_KEYS - 1 - k) * g.rowH;
      const blk = rollIsBlack(k);
      c.fillStyle = blk ? '#15181d' : '#aeb6bf';
      c.fillRect(1, y, g.KEYW - 2, Math.max(1, g.rowH - 0.5));
      if (k % 12 === 0) {
        c.fillStyle = blk ? '#ddd' : '#333'; c.font = '7px monospace';
        c.fillText('C' + (3 + Math.floor(k / 12)), 3, y + g.rowH - 0.5);
      }
    }
    // 拍号行
    c.fillStyle = '#66707c'; c.font = '7px monospace';
    for (let b = 0; b < g.cells; b += 4)
      c.fillText(String(b / 4 + 1), g.gx + b * g.cellW + 1, g.HEAD - 1);
    // 播放头
    if (pos != null) {
      const x = g.gx + pos * g.cellW;
      c.strokeStyle = 'rgba(125,255,176,.95)';
      c.beginPath(); c.moveTo(x, g.gy); c.lineTo(x, g.gy + g.gh); c.stroke();
    }
    // 状态行
    c.fillStyle = '#8fb4d8'; c.font = '9px monospace';
    const bar = pos == null ? '-' : String(Math.floor(pos / 16) + 1);
    const beat = pos == null ? '-' : String(Math.floor(pos % 16 / 4) + 1);
    c.fillText(`${this.state.bpm}BPM  ${bar}.${beat}  ${this.notes.length}音`, g.gx + 2, g.gy + 9);
  },
  dispose() { try { this.cCv.stop(); this.cGt.stop(); } catch (e) {} }
};
