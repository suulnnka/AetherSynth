/* MIDI 导入示例:1.mid(8-bit 曲目)转换成的音序器数据搭棚回放。
   ---------------------------------------------------------------------
   数据:src/songs/mid-data.js —— 105 BPM,16 分音符网格,591 步,
   四轨:主旋律 / 对旋律 / 贝斯(1V/oct)+ 踩镲(电压 = 力度)。
   组件配置(8-bit 电子琴风格):
     主旋律  方波 VCO(诺斯卡尔 2A03 主声部)
     对旋律  脉冲波 VCO(和声填充)
     贝斯    三角波 VCO + 低通柔化(Famicom 无贝斯道的近似)
     打击乐  踩镲(源 MIDI 打击乐轨全部为 42 号=闭合踩镲)
   五条音序器共享同一时钟保持同步,LEN = 591 循环整曲。 */

import { firstGesture, getCtx } from '../core/audio.js';
import { createModule } from '../core/module.js';
import { addCable } from '../core/cables.js';
import { clearAll } from '../core/serialize.js';
import { fitView } from '../core/view.js';
import { toast } from '../ui/toast.js';
import { MID_BPM, MID_STEPS, MID_TRACKS } from './mid-data.js';

export const MID_DEMO = {
  id: 'midi-import',
  name: 'MIDI 导入示例 · 8-bit 曲目(105 BPM)',
  build: () => buildMidImport()
};

export function buildMidImport() {
  clearAll();
  firstGesture();
  const c0 = getCtx();
  if (c0.state !== 'running') c0.resume();

  /* ---- 时钟 + 主旋律音序器 ---- */
  const clk = createModule('lfo', 0, 0);
  const bpm = createModule('knob', 11, 1, null, { v: MID_BPM / 30 });
  const seqL = createModule('seq', 14, 0, null,
    { steps: MID_TRACKS.lead.flat().slice(0, 1024), len: MID_STEPS, gate: 5 });
  addCable(bpm.id, 'CV', clk.id, 'RATE');
  addCable(clk.id, 'SQR', seqL.id, 'CLK');

  /* ---- 主旋律:方波 ---- */
  const vcoL = createModule('vco', 36, 2);
  const vcaL = createModule('vca', 48, 2);
  const envL = createModule('adsr', 56, 2);
  addCable(seqL.id, 'CV', vcoL.id, 'VOCT');
  addCable(seqL.id, 'GATE', envL.id, 'GATE');
  addCable(envL.id, 'ENV', vcaL.id, 'GAIN');
  addCable(vcoL.id, 'SQR', vcaL.id, 'IN');

  /* ---- 对旋律:脉冲波 ---- */
  const seqC = createModule('seq', 0, 14, null,
    { steps: MID_TRACKS.counter.flat().slice(0, 1024), len: MID_STEPS, gate: 5 });
  addCable(clk.id, 'SQR', seqC.id, 'CLK');
  const vcoC = createModule('vco', 22, 15);
  const vcaC = createModule('vca', 34, 15);
  const envC = createModule('adsr', 42, 15);
  addCable(seqC.id, 'CV', vcoC.id, 'VOCT');
  addCable(seqC.id, 'GATE', envC.id, 'GATE');
  addCable(envC.id, 'ENV', vcaC.id, 'GAIN');
  addCable(vcoC.id, 'PUL', vcaC.id, 'IN');

  /* ---- 贝斯:三角波 + 低通 ---- */
  const seqB = createModule('seq', 0, 28, null,
    { steps: MID_TRACKS.bass.flat().slice(0, 1024), len: MID_STEPS, gate: 6 });
  addCable(clk.id, 'SQR', seqB.id, 'CLK');
  const vcoB = createModule('vco', 22, 29);
  const vcfB = createModule('vcf', 34, 29);
  const vcaB = createModule('vca', 43, 29);
  const envB = createModule('adsr', 50, 29);
  const cutB = createModule('knob', 34, 35, null, { v: 2.2 });
  addCable(seqB.id, 'CV', vcoB.id, 'VOCT');
  addCable(seqB.id, 'GATE', envB.id, 'GATE');
  addCable(envB.id, 'ENV', vcaB.id, 'GAIN');
  addCable(vcoB.id, 'TRI', vcfB.id, 'IN');
  addCable(cutB.id, 'CV', vcfB.id, 'CUTOFF');
  addCable(vcfB.id, 'LP', vcaB.id, 'IN');

  /* ---- 打击乐:源 MIDI 打击乐轨全为闭合踩镲 ---- */
  const seqH = createModule('seq', 0, 42, null,
    { steps: MID_TRACKS.hat.flat().slice(0, 1024), len: MID_STEPS, gate: 6 });
  addCable(clk.id, 'SQR', seqH.id, 'CLK');
  const hat = createModule('hat', 22, 43);
  addCable(seqH.id, 'CV', hat.id, 'TRIG');

  /* ---- 母线:三声部乐器混音 + 踩镲直入喇叭 ---- */
  const mixI = createModule('mix', 56, 15);
  const spk = createModule('spk', 65, 8);
  const scope = createModule('scope', 65, 15);
  addCable(vcaL.id, 'OUT', mixI.id, 'A');
  addCable(vcaC.id, 'OUT', mixI.id, 'B');
  addCable(vcaB.id, 'OUT', mixI.id, 'C');
  addCable(mixI.id, 'OUT', spk.id, 'L');
  addCable(mixI.id, 'OUT', spk.id, 'R');
  addCable(hat.id, 'OUT', spk.id, 'L');
  addCable(hat.id, 'OUT', spk.id, 'R');
  addCable(mixI.id, 'OUT', scope.id, 'IN');

  fitView();
  toast('MIDI 导入回放:105 BPM / 591 步(16 分音符网格),方波主音 + 脉冲和声 + 三角波贝斯 + 踩镲');
}
