/* 8-bit 长曲示例:「像素远征」原创 chiptune,512 步(64 小节)。
   ---------------------------------------------------------------------
   展示音序器扩容后的完整曲式结构(每小节 8 步,方波时钟 = 8 分音符):
     0-1    前奏鼓点
     2-9    A 段(主旋律 + 贝斯)
     10-17  A 段重复(主旋律高八度)
     18-25  B 段(下行和声进行)
     26-33  A 段再现
     34-41  C 段(上行爬音 + 密集镲)
     42-57  尾段(主题回归)
     58-63  结尾(主和弦收束)
   全曲为原创旋律,C 大调,五声音阶为主的跳跃感 8-bit 风格。 */

import { firstGesture, getCtx } from '../core/audio.js';
import { createModule } from '../core/module.js';
import { addCable } from '../core/cables.js';
import { clearAll } from '../core/serialize.js';
import { fitView } from '../core/view.js';
import { toast } from '../ui/toast.js';
import { t } from '../core/i18n.js';

const N = 512, SPB = 8;

/** 每小节 8 步的音型 → 填进 512 步长卷的 [起, 止) 小节区间 */
function fill(arr, from, to, pat) {
  for (let bar = from; bar < to; bar++)
    for (let s = 0; s < SPB; s++)
      arr[bar * SPB + s] = pat[s % pat.length];
}

/* ---- 主旋律音型(半音,相对 C4;null = 休止) ---- */
const LA = [12, null, 16, 19, null, 19, 16, 12];            // 主题句:C E G
const LA2 = [14, null, 17, 21, null, 21, 17, 14];           // D F A 回答句
const LB = [19, 16, 12, 16, 19, null, 23, null];            // B 段下行对句
const LC = [12, 14, 16, 19, 21, 19, 24, null];              // C 段爬升
const LEND = [24, null, null, null, null, null, null, null]; // 结尾长音 C6
const REST8 = new Array(8).fill(null);

/* ---- 贝斯音型(r = 根音半音,跨八度跳跃) ---- */
const bassOf = r => [r, null, r + 12, null, r, null, r + 12, null];
const BASS_ROOT = [-12, -12, -17, -17, -19, -19, -12, -12];  // C C F F G G C C(A 段)
const BASS_B = [-9, -9, -17, -17, -19, -19, -17, -17];      // A m F G F(Am F G F)
const BASS_C = [-17, -19, -12, -12, -17, -19, -12, -12];    // F G C C F G C C
const BASS_END = [-12, null, null, null, null, null, null, null];

/* ---- 鼓组音型(0 = 不打,其余 = 力度) ---- */
const K_INTRO = [8, 0, 8, 0, 8, 0, 8, 8];
const K_A = [8, 0, 0, 0, 0, 0, 8, 0];
const K_C = [8, 0, 6, 0, 8, 0, 6, 0];
const K_END = [8, 0, 8, 0, 8, 8, 8, 8];
const SN_A = [0, 0, 0, 0, 8, 0, 0, 3];
const HAT = [4, 2, 4, 2, 4, 2, 5, 2];
const HAT_C = [4, 3, 4, 3, 4, 3, 6, 4];
const HOFF = new Array(8).fill(0);

/** 512 步主旋律:按曲式逐小节铺 */
function buildLead() {
  const g = new Array(N).fill(null);
  fill(g, 2, 10, LA);          // A 段
  fill(g, 10, 18, LA2);
  fill(g, 18, 26, LA);         // A 段(高八度在后面整体 +12)
  fill(g, 26, 34, LA2);
  fill(g, 34, 42, LC);         // C 段爬升
  fill(g, 42, 50, LA);
  fill(g, 50, 58, LA2);
  fill(g, 58, 59, LEND);       // 结尾长音
  // 34-41(C 段)主旋律提高八度后再叠一层原八度 → 42-57 主题回归不加花
  for (let i = 34 * SPB; i < 42 * SPB; i++) g[i] = g[i] == null ? null : g[i] + 12;
  return g;
}

/** 512 步贝斯:按小节取根音音型 */
function buildBass() {
  const g = new Array(N).fill(null);
  for (let bar = 2; bar < 10; bar++) fill(g, bar, bar + 1, bassOf(BASS_ROOT[bar % 8]));
  for (let bar = 10; bar < 18; bar++) fill(g, bar, bar + 1, bassOf(BASS_ROOT[bar % 8]));
  for (let bar = 18; bar < 26; bar++) fill(g, bar, bar + 1, bassOf(BASS_B[bar % 8]));
  for (let bar = 26; bar < 34; bar++) fill(g, bar, bar + 1, bassOf(BASS_ROOT[bar % 8]));
  for (let bar = 34; bar < 50; bar++) fill(g, bar, bar + 1, bassOf(BASS_C[bar % 8]));
  for (let bar = 50; bar < 58; bar++) fill(g, bar, bar + 1, bassOf(BASS_ROOT[bar % 8]));
  fill(g, 58, 64, BASS_END);
  return g;
}

/** 512 步鼓组:三轨分开铺 */
function buildDrums() {
  const kick = new Array(N).fill(0), snare = new Array(N).fill(0), hat = new Array(N).fill(0);
  fill(kick, 0, 2, K_INTRO);
  fill(kick, 2, 34, K_A);
  fill(kick, 34, 50, K_C);
  fill(kick, 50, 62, K_A);
  fill(kick, 62, 64, K_END);
  fill(snare, 2, 34, SN_A);
  fill(snare, 34, 50, SN_A);
  fill(snare, 50, 62, SN_A);
  fill(hat, 0, 34, HAT);
  fill(hat, 34, 50, HAT_C);
  fill(hat, 50, 62, HAT);
  return { kick, snare, hat };
}

export const CHIP_DEMO = {
  id: 'chip-quest',
  name: '像素远征 · 8-bit 长卷(512 步 / 64 小节)',
  build: () => buildChipQuest()
};

export function buildChipQuest() {
  clearAll();
  firstGesture();
  const c0 = getCtx();
  if (c0.state !== 'running') c0.resume();

  /* ---- 时钟:方波 = 8 分音符;160 BPM ---- */
  const clk = createModule('lfo', 0, 0);
  const bpm = createModule('knob', 11, 1, null, { v: 160 / 30 });
  const seq = createModule('seq', 14, 0, null,
    { steps: buildLead(), len: N, gate: 5 });
  addCable(bpm.id, 'CV', clk.id, 'RATE');
  addCable(clk.id, 'SQR', seq.id, 'CLK');

  /* ---- 鼓组三轨(512 步 × 3)---- */
  const d = buildDrums();
  const mixD = createModule('mix', 46, 4);
  [['kick', d.kick, 6, 'A'], ['snare', d.snare, 14, 'B'], ['hat', d.hat, 22, 'C']]
    .forEach(([def, steps, y, ch]) => {
      const sq = createModule('seq', 0, y, null, { steps, len: N, gate: 6 });
      addCable(clk.id, 'SQR', sq.id, 'CLK');
      const mod = createModule(def, 22, y + 1);
      addCable(sq.id, 'CV', mod.id, 'TRIG');
      addCable(mod.id, 'OUT', mixD.id, ch);
    });

  /* ---- 贝斯:三角波 + 低通(柔化跳跃感)---- */
  const sqB = createModule('seq', 0, 30, null, { steps: buildBass(), len: N, gate: 6 });
  addCable(clk.id, 'SQR', sqB.id, 'CLK');
  const vcoB = createModule('vco', 22, 30);
  const vcfB = createModule('vcf', 34, 30);
  const vcaB = createModule('vca', 43, 30);
  const envB = createModule('adsr', 50, 30);
  addCable(sqB.id, 'CV', vcoB.id, 'VOCT');
  addCable(sqB.id, 'GATE', envB.id, 'GATE');
  addCable(envB.id, 'ENV', vcaB.id, 'GAIN');
  addCable(vcoB.id, 'TRI', vcfB.id, 'IN');
  const cutB = createModule('knob', 34, 36, null, { v: 2.4 });
  addCable(cutB.id, 'CV', vcfB.id, 'CUTOFF');
  addCable(vcfB.id, 'LP', vcaB.id, 'IN');

  /* ---- 主音:方波 chiptune ---- */
  const vcoL = createModule('vco', 22, 38);
  const vcaL = createModule('vca', 43, 38);
  const envL = createModule('adsr', 50, 38);
  addCable(seq.id, 'CV', vcoL.id, 'VOCT');
  addCable(seq.id, 'GATE', envL.id, 'GATE');
  addCable(envL.id, 'ENV', vcaL.id, 'GAIN');
  addCable(vcoL.id, 'SQR', vcaL.id, 'IN');

  /* ---- 母线:鼓母线 + 乐器母线 → 喇叭;乐器母线 → 示波器 ---- */
  const mixI = createModule('mix', 46, 30);
  addCable(vcaB.id, 'OUT', mixI.id, 'A');
  addCable(vcaL.id, 'OUT', mixI.id, 'B');
  const spk = createModule('spk', 51, 4);
  const scope = createModule('scope', 56, 33);
  addCable(mixD.id, 'OUT', spk.id, 'L');
  addCable(mixD.id, 'OUT', spk.id, 'R');
  addCable(mixI.id, 'OUT', spk.id, 'L');
  addCable(mixI.id, 'OUT', spk.id, 'R');
  addCable(mixI.id, 'OUT', scope.id, 'IN');

  fitView();
  toast(t('像素远征:原创 8-bit 长曲,五条 512 步音序器(主音/贝斯/鼓×3)自动循环 64 小节', 'Pixel Expedition: original 8-bit long form — five 512-step sequencers (lead / bass / drums ×3) loop 64 bars'));
}
