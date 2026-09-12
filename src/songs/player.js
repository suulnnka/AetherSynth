/* 示例歌曲搭棚:把一首歌构建为完整的多音轨模块补丁 */

import { firstGesture, getCtx } from '../core/audio.js';
import { createModule } from '../core/module.js';
import { addCable } from '../core/cables.js';
import { clearAll } from '../core/serialize.js';
import { fitView } from '../core/view.js';
import { SONGS } from './data.js';
import { toast } from '../ui/toast.js';

export function buildSongPatch(s) {
  clearAll();
  firstGesture();
  const ctx = getCtx();
  if (ctx.state !== 'running') ctx.resume();

  // 时钟:LFO 方波 = 8 分音符时钟,速度旋钮 1V ≈ 30 BPM
  const clk = createModule('lfo', 0, 2);
  const tempo = createModule('knob', 9, 2);
  tempo.setKnob(s.bpm / 30);
  addCable(tempo.id, 'CV', clk.id, 'RATE');
  const clockSeq = seq => addCable(clk.id, 'SQR', seq.id, 'CLK');

  // 一条轨道:音序器 + 8 个步进旋钮(0 = 休止)
  const track = (x, y, steps) => {
    const seq = createModule('seq', x, y);
    steps.forEach((v, i) => {
      const k = createModule('knob', x + (i % 4) * 2, y + 9 + ((i / 4) | 0) * 6);
      k.setKnob(v);
      addCable(k.id, 'CV', seq.id, 'V' + (i + 1));
    });
    clockSeq(seq);
    return seq;
  };

  // 鼓组三轨:音序器 CV → TRIG(电压 = 力度)
  const mix1 = createModule('mix', 112, 12);
  [['kick', s.kick, 12, 'A'], ['snare', s.snare, 34, 'B'], ['hat', s.hat, 56, 'C']]
    .forEach(([def, steps, y, ch], i) => {
      const seq = track(0, y, steps);
      const mod = createModule(def, 22, y + 1);
      addCable(seq.id, 'CV', mod.id, 'TRIG');
      addCable(mod.id, 'OUT', mix1.id, ch);
    });

  // 乐器音色:音序器 CV → 音高, GATE → 包络
  const mkVoice = (tx, ty, x, y, spec) => {
    const seq = track(tx, ty, spec.notes.map(n => (n == null ? 0 : n / 12)));
    const vco = createModule('vco', x, y);
    const vcf = spec.cut != null ? createModule('vcf', x, y + 7) : null;
    const vca = createModule('vca', x, y + 13);
    const env = createModule('adsr', x, y + 19);
    addCable(seq.id, 'CV', vco.id, 'VOCT');
    addCable(seq.id, 'GATE', env.id, 'GATE');
    addCable(env.id, 'ENV', vca.id, 'GAIN');
    if (spec.oct) {
      const bk = createModule('biknob', x - 4, y);
      bk.setKnob(spec.oct);
      addCable(bk.id, 'CV', vco.id, 'VOCT');
    }
    if (vcf) {
      vco.waveOut(spec.wave, vcf.id, 'IN');
      const cut = createModule('knob', x + 12, y + 7); cut.setKnob(spec.cut);
      const res = createModule('knob', x + 12, y + 12); res.setKnob(spec.res);
      addCable(cut.id, 'CV', vcf.id, 'CUTOFF');
      addCable(res.id, 'CV', vcf.id, 'RESO');
      addCable(vcf.id, 'LP', vca.id, 'IN');
    } else {
      vco.waveOut(spec.wave, vca.id, 'IN');
    }
    if (spec.sus != null) {
      const sus = createModule('knob', x + 12, y + 19);
      sus.setKnob(spec.sus);
      addCable(sus.id, 'CV', env.id, 'S');
    }
    return { seq, vco, vcf, vca, env };
  };

  // 贝斯(低两个八度 + 低通) / 吉他拨弦(带滤波) / 主音键盘(三角波 + 延迟)
  const bassV = mkVoice(30, 12, 58, 12, s.bass);
  const gtV = mkVoice(30, 34, 76, 12, s.guitar);
  const ldV = mkVoice(30, 56, 94, 12, s.lead);
  const mix2 = createModule('mix', 112, 18);
  addCable(bassV.vca.id, 'OUT', mix2.id, 'A');
  addCable(gtV.vca.id, 'OUT', mix2.id, 'B');
  addCable(ldV.vca.id, 'OUT', mix2.id, 'C');

  // 两条母线并联进喇叭(输入口自动求和),立体声:L / R 各接双份
  const spk = createModule('spk', 122, 12);
  const scope = createModule('scope', 122, 18);
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
  toast('▶ ' + song.name + ' — ' + song.bpm + ' BPM(原创示例曲)');
}

