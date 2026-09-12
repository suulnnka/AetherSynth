/* 穆格示例乐曲:三首用「迷你穆格」演奏的小品。
   每首 = 时钟 + 音序器(128 步内画好的旋律)+ 迷你穆格(+ 可选延迟),
   音序器 CV/Gate 驱动穆格的 V-OCT / GATE。 */

import { firstGesture, getCtx } from '../core/audio.js';
import { createModule } from '../core/module.js';
import { addCable } from '../core/cables.js';
import { clearAll } from '../core/serialize.js';
import { fitView } from '../core/view.js';
import { toast } from '../ui/toast.js';

const BARS = 16;

/** 8 步核心型 → 128 步(active(bar) 决定该小节是否演奏) */
function expandSteps(core, active) {
  const steps = new Array(128).fill(0);
  for (let bar = 0; bar < BARS; bar++) {
    if (!active(bar)) continue;
    for (let s = 0; s < 8; s++) steps[bar * 8 + s] = core[s];
  }
  return steps;
}

/** 旋律短语:[步, 半音(相对 C4), 长度步数] → 电压步进数组 */
export function phrase(notes, total = 128) {
  const steps = new Array(Math.min(total, 128)).fill(null);   // null = 休止
  for (const [st, semi, len] of notes)
    for (let i = 0; i < len && st + i < steps.length; i++)
      steps[st + i] = semi / 12;                 // 1V/oct:每半音 1/12 V(可低于 C4)
  return steps;
}

/* ---------------- 三首小品 ---------------- */

// 晨光:C 大调五声慢旋律,带滑音与延迟回声
const DAWN_NOTES = [
  [0, 4, 2], [2, 7, 2], [4, 9, 2], [6, 9, 2], [8, 7, 2], [10, 4, 2], [12, 2, 2], [14, 0, 2],
  [16, 4, 2], [18, 7, 2], [20, 9, 2], [22, 12, 2], [24, 9, 2], [26, 7, 2], [28, 4, 2], [30, 2, 2]
];

// 放克:D 小调 16 步律动,断奏 + 高共振
const FUNK_NOTES = [
  [0, -10, 2], [3, -10, 1], [6, -7, 1], [8, -10, 2],
  [10, 0, 1], [12, -3, 1], [14, -5, 2]
];

// 琶音雨:A 小调琶音上下行,16 步型 ×2
const ARP = [
  [0, -3, 1], [1, 0, 1], [2, 4, 1], [3, 9, 1],
  [4, 12, 1], [5, 16, 1], [6, 12, 1], [7, 9, 1],
  [8, -3, 1], [9, 0, 1], [10, 4, 1], [11, 9, 1],
  [12, 12, 1], [13, 16, 1], [14, 12, 1], [15, 9, 1]
];

export const MOOG_PIECES = [
  {
    id: 'm-dawn', name: '晨光', label: '穆格 · 晨光(70 BPM)',
    build: () => buildMoogPiece({
      name: '晨光', bpm: 70, len: 32, gate: 8,
      steps: phrase(DAWN_NOTES),
      moog: { w1: 1, cutoff: 6, emph: 4, contour: 7, glide: 3, lA: 3, lD: 5, lS: 7, lR: 6, vol: 6 },
      delay: true
    })
  },
  {
    id: 'm-funk', name: '放克律动', label: '穆格 · 放克律动(115 BPM)',
    build: () => buildMoogPiece({
      name: '放克律动', bpm: 115, len: 16, gate: 3,
      steps: phrase(FUNK_NOTES),
      moog: { w2: 2, cutoff: 4, emph: 8, contour: 8, glide: 0, lA: 0, lD: 2, lS: 3, lR: 2, vol: 6 },
      delay: false
    })
  },
  {
    id: 'm-rain', name: '琶音雨', label: '穆格 · 琶音雨(128 BPM)',
    build: () => buildMoogPiece({
      name: '琶音雨', bpm: 128, len: 16, gate: 5,
      steps: phrase(ARP.concat(ARP)),
      moog: { w1: 2, cutoff: 5, emph: 6, contour: 5, glide: 0, lA: 0, lD: 3, lS: 5, lR: 3, vol: 6 },
      delay: true
    })
  }
];

/** 搭建一首穆格小品:时钟 + 音序器(旋律)+ 迷你穆格(+ 延迟)→ 喇叭 */
export function buildMoogPiece(p) {
  clearAll();
  firstGesture();
  const c0 = getCtx();
  if (c0.state !== 'running') c0.resume();

  // 时钟 + 速度
  const clk = createModule('lfo', 0, 2);
  const tempo = createModule('knob', 10, 2);
  tempo.setKnob(p.bpm / 30);
  addCable(tempo.id, 'CV', clk.id, 'RATE');
  const seq = createModule('seq', 0, 16, null,
    { steps: p.steps.slice(), len: p.len, gate: p.gate ?? 6 });
  addCable(clk.id, 'SQR', seq.id, 'CLK');

  // 迷你穆格:音序器驱动
  const mm = createModule('minimoog', 24, 2);
  for (const [k, v] of Object.entries(p.moog || {})) {
    mm.state[k] = v;
    mm.applyParam(k, v);
  }
  addCable(seq.id, 'CV', mm.id, 'V/OCT');
  addCable(seq.id, 'GATE', mm.id, 'GATE');

  // 输出链:穆格 → 延迟(可选)→ 喇叭 L / R
  const spk = createModule('spk', 58, 2);
  if (p.delay) {
    const dly = createModule('delay', 58, 14);
    addCable(mm.id, 'OUT', dly.id, 'IN');
    addCable(dly.id, 'OUT', spk.id, 'L');
    addCable(dly.id, 'OUT', spk.id, 'R');
  } else {
    addCable(mm.id, 'OUT', spk.id, 'L');
    addCable(mm.id, 'OUT', spk.id, 'R');
  }
  fitView();
}
