/* 穆格拆解示例:不用「迷你穆格」组件,用分立组件搭出一台 Model D。
   ---------------------------------------------------------------------
   模块对应关系(面板区块 → 组件):
     控制器   TUNE → 双极旋钮(振荡器 FM 口直流失谐)
              GLIDE → 滑音(SLEW)模块;MOD(振动)→ LFO + 衰减器深度
     振荡器组 三台 VCO(SAW/SAW/SQR),1V/oct 由滑音后的电压驱动
     混音器   混音器×2:三振荡器 → 一路,再与白噪声合路
     修正器   VCF 低通:CUTOFF 旋钮 + 滤波包络经 CONTOUR 衰减器推 CUTOFF
              EMPHASIS → RESO 旋钮;滤波包络 = ADSR(衰减/延音旋钮塑形)
     响度     ADSR → VCA.GAIN(响度包络)→ 喇叭
   音序器提供旋律:CV 走滑音进音高,GATE 分配给两条包络。 */

import { firstGesture, getCtx } from '../core/audio.js';
import { createModule } from '../core/module.js';
import { addCable } from '../core/cables.js';
import { clearAll } from '../core/serialize.js';
import { fitView } from '../core/view.js';
import { toast } from '../ui/toast.js';
import { phrase } from './minimoog-songs.js';

/* C 小调上行句:C Eb G Bb C Bb G Eb(每步 = 16 分音符) */
const MELODY = [
  [0, 0, 2], [2, 3, 1], [4, 7, 2], [6, 10, 2],
  [8, 12, 2], [10, 10, 1], [12, 7, 2], [14, 3, 2]
];

export const MODEL_DEMO = {
  id: 'm-modeld',
  name: '穆格拆解 · Model D 分立搭棚(120 BPM)',
  build: () => buildModelD()
};

export function buildModelD() {
  clearAll();
  firstGesture();
  const c0 = getCtx();
  if (c0.state !== 'running') c0.resume();

  /* ---- 控制器:时钟 + 音序器 ---- */
  const clk = createModule('lfo', 0, 0);                       // 时钟
  const bpm = createModule('knob', 11, 1, null, { v: 4 });     // 4V = 120BPM(时钟 1V=+1Hz)
  addCable(bpm.id, 'CV', clk.id, 'RATE');
  const seq = createModule('seq', 14, 0, null,
    { steps: phrase(MELODY), len: 16, gate: 3 });
  addCable(clk.id, 'SQR', seq.id, 'CLK');

  /* ---- 键盘接口:GLIDE 滑音 + GATE 分配 ---- */
  const glide = createModule('glide', 0, 8, null, { time: 0.06 });
  const mPitch = createModule('mult', 5, 8);                   // 音高一分三
  const mGate = createModule('mult', 14, 13);                  // 门一分二
  addCable(seq.id, 'CV', glide.id, 'IN');
  addCable(glide.id, 'OUT', mPitch.id, 'IN');
  addCable(seq.id, 'GATE', mGate.id, 'IN');

  /* ---- 振荡器组:三台 VCO ---- */
  const vco1 = createModule('vco', 0, 14);
  const vco2 = createModule('vco', 11, 14);
  const vco3 = createModule('vco', 22, 14);
  addCable(mPitch.id, 'O1', vco1.id, 'VOCT');
  addCable(mPitch.id, 'O2', vco2.id, 'VOCT');
  addCable(mPitch.id, 'O3', vco3.id, 'VOCT');

  /* 调制:总调音 / 失谐 / 振动(全部进 VCO 的 FM 口,与音高独立) */
  const tune = createModule('biknob', 33, 14, null, { v: 0 });   // TUNE ±20Hz
  const det = createModule('biknob', 33, 20, null, { v: 0.5 });  // OSC2/3 失谐 +2Hz
  const vib = createModule('lfo', 36, 14);                       // MOD:LFO 振动
  const vibD = createModule('atten', 47, 14);                    // OSC MOD 深度
  const vibK = createModule('knob', 54, 15, null, { v: 3 });     // 深度 0.3
  addCable(vib.id, 'SIN', vibD.id, 'IN');
  addCable(vibK.id, 'CV', vibD.id, 'AMT');
  addCable(tune.id, 'CV', vco1.id, 'FM');
  addCable(det.id, 'CV', vco2.id, 'FM');
  addCable(det.id, 'CV', vco3.id, 'FM');
  addCable(vibD.id, 'OUT', vco1.id, 'FM');
  addCable(vibD.id, 'OUT', vco2.id, 'FM');
  addCable(vibD.id, 'OUT', vco3.id, 'FM');

  /* ---- 混音器:三振荡器 + 噪声 ---- */
  const mix1 = createModule('mix', 0, 21);
  const nz = createModule('noise', 9, 21);
  const mix2 = createModule('mix', 14, 21);
  addCable(vco1.id, 'SAW', mix1.id, 'A');
  addCable(vco2.id, 'SAW', mix1.id, 'B');
  addCable(vco3.id, 'SQR', mix1.id, 'C');
  addCable(mix1.id, 'OUT', mix2.id, 'A');
  addCable(nz.id, 'WHITE', mix2.id, 'B');

  /* ---- 修正器:24dB 低通 + 滤波包络(CONTOUR)---- */
  const cutK = createModule('knob', 0, 28, null, { v: 3 });      // CUTOFF 基准
  const vcf = createModule('vcf', 3, 27);
  const emphK = createModule('knob', 12, 28, null, { v: 4 });    // EMPHASIS
  const adsrF = createModule('adsr', 16, 27);                    // 滤波包络
  const conA = createModule('atten', 27, 27);                    // CONTOUR 深度
  const conK = createModule('knob', 34, 28, null, { v: 2.5 });   // 深度 0.25(≈3 个八度扫频)
  const fDec = createModule('knob', 37, 28, null, { v: 2.5 });   // 滤波衰减
  const fSus = createModule('knob', 40, 28, null, { v: 3 });     // 滤波延音
  addCable(cutK.id, 'CV', vcf.id, 'CUTOFF');
  addCable(emphK.id, 'CV', vcf.id, 'RESO');
  addCable(adsrF.id, 'ENV', conA.id, 'IN');
  addCable(conA.id, 'OUT', vcf.id, 'CUTOFF');
  addCable(conK.id, 'CV', conA.id, 'AMT');
  addCable(fDec.id, 'CV', adsrF.id, 'D');
  addCable(fSus.id, 'CV', adsrF.id, 'S');
  addCable(mGate.id, 'O1', adsrF.id, 'GATE');
  addCable(mix2.id, 'OUT', vcf.id, 'IN');

  /* ---- 响度:ADSR → VCA → 喇叭 ---- */
  const adsrL = createModule('adsr', 0, 35);
  const vca = createModule('vca', 11, 35);
  const spk = createModule('spk', 18, 35);
  addCable(mGate.id, 'O2', adsrL.id, 'GATE');
  addCable(adsrL.id, 'ENV', vca.id, 'GAIN');
  addCable(vcf.id, 'LP', vca.id, 'IN');
  addCable(vca.id, 'OUT', spk.id, 'L');
  addCable(vca.id, 'OUT', spk.id, 'R');

  fitView();
  toast('穆格拆解:三 VCO → 混音(含噪声)→ 滤波(CONTOUR 包络)→ VCA → 喇叭,音序器自动循环演奏');
}
