/* FM 合成器示例:双操作器组叠层的钟琴音色。
   ---------------------------------------------------------------------
   FM 三要素(对应本示例的接线):
     操作器   = 振荡器 + 包络。fm 模块内置一组「载波 + 调制器」:
              载波决定音高,调制器不直接发声、只改变载波的音色。
     RATIO    谐波比:调制器频率 = 载波 × 2^(电压 V)。整数倍(1V=2:1,
              2V=4:1)谐和似木琴;非整数(如 1.5V)立刻金属/钟铃。
     INDEX    调制指数 = 亮度:边带数量随 INDEX 增长。0V = 纯正弦。
   经典手法:亮度包络 —— INDEX 挂一条快衰减 ADSR,起音亮、延音暗,
   正是 DX7 电钢琴 / 钟琴的来源。本示例用两组不同谐波比的 FM 叠层,
   经 VCA(响度包络)→ 延迟回声 → 喇叭。 */

import { firstGesture, getCtx } from '../core/audio.js';
import { createModule } from '../core/module.js';
import { addCable } from '../core/cables.js';
import { clearAll } from '../core/serialize.js';
import { fitView } from '../core/view.js';
import { toast } from '../ui/toast.js';
import { phrase } from './minimoog-songs.js';

/* 五声音阶钟琴句(C 大调五声:C D E G A,跨两个八度) */
const MELODY = [
  [0, 0, 3], [3, 7, 2], [6, 12, 3], [9, 10, 2],
  [12, 7, 3], [15, 15, 1]
];

export const FM_DEMO = {
  id: 'fm-bell',
  name: 'FM 合成器 · 双操作器钟琴(100 BPM)',
  build: () => buildFmBell()
};

export function buildFmBell() {
  clearAll();
  firstGesture();
  const c0 = getCtx();
  if (c0.state !== 'running') c0.resume();

  /* ---- 时钟 + 音序器 ---- */
  const clk = createModule('lfo', 0, 0);
  const bpm = createModule('knob', 11, 1, null, { v: 3.33 });   // 100 BPM
  const seq = createModule('seq', 14, 0, null,
    { steps: phrase(MELODY), len: 16, gate: 4 });
  addCable(bpm.id, 'CV', clk.id, 'RATE');
  addCable(clk.id, 'SQR', seq.id, 'CLK');

  /* ---- 键盘接口:滑音 + 门分配 ---- */
  const glide = createModule('glide', 0, 8, null, { time: 0.05 });
  const mGate = createModule('mult', 5, 8);
  addCable(seq.id, 'CV', glide.id, 'IN');
  addCable(seq.id, 'GATE', mGate.id, 'IN');

  /* ---- FM 组 1:2:1 木质感 + 亮度包络 ---- */
  const fm1 = createModule('fm', 0, 14);
  const ratio1 = createModule('knob', 9, 15, null, { v: 1 });     // 2:1
  const idx1 = createModule('knob', 12, 15, null, { v: 3 });      // 基准亮度 360Hz
  const adsrB = createModule('adsr', 15, 14);                     // 亮度包络(快衰减)
  const attB = createModule('atten', 26, 14);                     // 包络深度
  const idxD = createModule('knob', 33, 15, null, { v: 2 });      // 深度 0.2(240Hz)
  addCable(ratio1.id, 'CV', fm1.id, 'RATIO');
  addCable(idx1.id, 'CV', fm1.id, 'INDEX');
  addCable(adsrB.id, 'ENV', attB.id, 'IN');
  addCable(idxD.id, 'CV', attB.id, 'AMT');
  addCable(attB.id, 'OUT', fm1.id, 'INDEX');
  addCable(mGate.id, 'O1', adsrB.id, 'GATE');

  /* ---- FM 组 2:4:1 更亮更「电子」,固定亮度 ---- */
  const fm2 = createModule('fm', 0, 21);
  const ratio2 = createModule('knob', 9, 22, null, { v: 2 });     // 4:1
  const idx2 = createModule('knob', 12, 22, null, { v: 1.5 });    // 较暗
  addCable(ratio2.id, 'CV', fm2.id, 'RATIO');
  addCable(idx2.id, 'CV', fm2.id, 'INDEX');

  /* ---- 音高:滑音后的 1V/oct 同时喂两组 ---- */
  addCable(glide.id, 'OUT', fm1.id, 'VOCT');
  addCable(glide.id, 'OUT', fm2.id, 'VOCT');

  /* ---- 混音 → 响度包络 → 回声 → 喇叭 ---- */
  const mix = createModule('mix', 15, 21);
  const adsrL = createModule('adsr', 24, 21);
  const vca = createModule('vca', 35, 21);
  const dly = createModule('delay', 42, 21);
  const spk = createModule('spk', 51, 21);
  addCable(fm1.id, 'OUT', mix.id, 'A');
  addCable(fm2.id, 'OUT', mix.id, 'B');
  addCable(mix.id, 'OUT', vca.id, 'IN');
  addCable(adsrL.id, 'ENV', vca.id, 'GAIN');
  addCable(mGate.id, 'O2', adsrL.id, 'GATE');
  addCable(vca.id, 'OUT', dly.id, 'IN');
  addCable(dly.id, 'OUT', spk.id, 'L');
  addCable(dly.id, 'OUT', spk.id, 'R');

  fitView();
  toast('FM 示例:调制器不发声、只改音色 —— 拧 RATIO 听谐和↔金属,拧 INDEX 听亮度,亮度包络做出钟琴的「叮」感');
}
