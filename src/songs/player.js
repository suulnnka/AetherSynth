/* 示例歌曲搭棚:每首 = 128 步(16 小节)的完整编曲。
   结构:0-3 小节鼓组前奏 → 4-7 加入贝斯 → 8-11 加入吉他 → 12-15 加入主音。
   音序器步进全部存在音序器内部(不再需要外接步进旋钮)。 */

import { firstGesture, getCtx } from '../core/audio.js';
import { createModule } from '../core/module.js';
import { addCable } from '../core/cables.js';
import { clearAll } from '../core/serialize.js';
import { fitView } from '../core/view.js';
import { SONGS } from './data.js';
import { toast } from '../ui/toast.js';

const BARS = 16;

/** 8 步核心型 → 128 步(16 小节;active(bar) 决定该小节是否演奏) */
function expandSteps(core, active) {
  const steps = new Array(128).fill(0);
  for (let bar = 0; bar < BARS; bar++) {
    if (!active(bar)) continue;
    for (let s = 0; s < 8; s++) steps[bar * 8 + s] = core[s];
  }
  return steps;
}

export function buildSongPatch(s) {
  clearAll();
  firstGesture();
  const c0 = getCtx();
  if (c0.state !== 'running') c0.resume();

  // 时钟:LFO 方波 = 8 分音符时钟,速度旋钮 1V ≈ 30 BPM
  const clk = createModule('lfo', 0, 2);
  const tempo = createModule('knob', 10, 2);
  tempo.setKnob(s.bpm / 30);
  addCable(tempo.id, 'CV', clk.id, 'RATE');
  const clockSeq = sq => addCable(clk.id, 'SQR', sq.id, 'CLK');

  // 一条 128 步轨道(active(bar) 决定该小节是否演奏;步进经初始状态传入)
  const track = (x, y, core, active) => {
    const sq = createModule('seq', x, y, null, { steps: expandSteps(core, active), len: 128 });
    clockSeq(sq);
    return sq;
  };

  // 鼓组三轨:音序器 CV → TRIG(电压 = 力度)
  const mix1 = createModule('mix', 46, 4);
  [['kick', s.kick, 6, 'A'], ['snare', s.snare, 19, 'B'], ['hat', s.hat, 32, 'C']].forEach(([def, core, y, ch]) => {
    const sq = track(0, y, core, () => true);
    const mod = createModule(def, 22, y + 1);
    addCable(sq.id, 'CV', mod.id, 'TRIG');
    addCable(mod.id, 'OUT', mix1.id, ch);
  });

  // 乐器音色:音序器 CV → 音高,GATE → 包络
  const mkVoice = (x, y, spec) => {
    const sq = track(x, y, spec.notes.map(n => (n == null ? 0 : n / 12)), () => true);
    const vco = createModule('vco', x + 24, y);
    const vcf = spec.cut != null ? createModule('vcf', x + 36, y) : null;
    const vca = createModule('vca', x + 48, y);
    const env = createModule('adsr', x + 56, y);
    addCable(sq.id, 'CV', vco.id, 'VOCT');
    addCable(sq.id, 'GATE', env.id, 'GATE');
    addCable(env.id, 'ENV', vca.id, 'GAIN');
    if (spec.oct) {
      const bk = createModule('biknob', x + 22, y + 6);
      bk.setKnob(spec.oct);
      addCable(bk.id, 'CV', vco.id, 'VOCT');
    }
    if (vcf) {
      vco.waveOut(spec.wave, vcf.id, 'IN');
      const cut = createModule('knob', x + 36, y + 7); cut.setKnob(spec.cut);
      const res = createModule('knob', x + 36, y + 12); res.setKnob(spec.res);
      addCable(cut.id, 'CV', vcf.id, 'CUTOFF');
      addCable(res.id, 'CV', vcf.id, 'RESO');
      addCable(vcf.id, 'LP', vca.id, 'IN');
    } else {
      vco.waveOut(spec.wave, vca.id, 'IN');
    }
    if (spec.sus != null) {
      const sus = createModule('knob', x + 48, y + 6);
      sus.setKnob(spec.sus);
      addCable(sus.id, 'CV', env.id, 'S');
    }
    return { sq, vco, vcf, vca, env };
  };

  // 贝斯(低两个八度 + 低通)/ 吉他拨弦(带滤波)/ 主音
  const bassV = mkVoice(0, 45, s.bass);
  const gtV = mkVoice(0, 61, s.guitar);
  const ldV = mkVoice(0, 77, s.lead);
  const mix2 = createModule('mix', 46, 21);
  addCable(bassV.vca.id, 'OUT', mix2.id, 'A');
  addCable(gtV.vca.id, 'OUT', mix2.id, 'B');
  addCable(ldV.vca.id, 'OUT', mix2.id, 'C');

  // 两条母线并联进喇叭(输入口自动求和):鼓母线 + 乐器母线
  const spk = createModule('spk', 46, 33);
  const scope = createModule('scope', 54, 33);
  addCable(mix1.id, 'OUT', spk.id, 'L');
  addCable(mix1.id, 'OUT', spk.id, 'R');
  addCable(mix2.id, 'OUT', spk.id, 'L');
  addCable(mix2.id, 'OUT', spk.id, 'R');
  addCable(mix2.id, 'OUT', scope.id, 'IN');
  fitView();
}

export function loadSong(id) {
  const song = SONGS.find(x => x.id === id);
  if (!song) return;
  buildSongPatch(song);
  fitView();
  toast('▶ ' + song.name + ' — ' + song.bpm + ' BPM(128 步 / 16 小节)');
}

/** 菜单「歌曲」的菜单项(由菜单栏调用) */
export function songMenuItems() {
  return SONGS.map(s => ({
    label: `${s.name} · ${s.bpm} BPM`,
    action: () => { firstGesture(); loadSong(s.id); }
  }));
}
