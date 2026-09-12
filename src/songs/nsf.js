/* NSF 转谱示例:四轨完整还原一段 NES chiptrace 的 64 小节全曲(100 BPM)。
   ---------------------------------------------------------------------
   记谱全部存在钢琴卷帘里(音符可变长,故不用步进音序器):
     原曲本体为 16 小节循环;全曲按标准曲式编为 4 个乐段 × 16 小节,
     每轨 4 个卷帘各装一个乐段(卷帘容量 1~16 小节):
       乐段 1 引子 8 小节(贝斯+镲)→ 主题前半
       乐段 2 主题后半 → 主题前半
       乐段 3 Breakdown 8 小节(旋律休止)→ 旋律回归
       乐段 4 主题后半 → 末句重复 → 终止长音
   乐段切换的搭棚:
     时钟(8 分音符脉冲)→ 512 步音序器只当「乐段选择器」用:每乐段
     128 步依次输出 0 / 2.5 / 5 / 7.5V,送给 4 个选择器;段选器把 +10V
     只接在自己的通道上,于是任一时刻只有当前乐段的 4 个卷帘收到 PLAY 门。
     三条旋律轨各有 1 个选择器,把「当前乐段卷帘」的 CV 切给音色链
     (停着的卷帘 CV 保持旧值,不能直接并联;GATE 停止时归 0,可直接并联)。
   音色:GATE 直推 VCA(NES 无音量包络,门开即响),方波主音 / 方波
   和声 / 三角波,噪声镲直接由 GATE 触发。数据见 ./nsf-data.js。 */

import { firstGesture, getCtx } from '../core/audio.js';
import { createModule } from '../core/module.js';
import { addCable } from '../core/cables.js';
import { clearAll } from '../core/serialize.js';
import { fitView } from '../core/view.js';
import { toast } from '../ui/toast.js';
import { NSF_TRACKS } from './nsf-data.js';

const MIX_CH = ['A', 'B', 'C'];

export const NSF_DEMO = {
  id: 'nsf-1',
  name: 'NSF 转谱 · 四轨全曲(64 小节 / 100 BPM)',
  build: () => buildNsfSong()
};

export function buildNsfSong() {
  clearAll();
  firstGesture();
  const c0 = getCtx();
  if (c0.state !== 'running') c0.resume();

  /* ---- 乐段导引:时钟(8 分)→ 段选音序器(0/2.5/5/7.5V)---- */
  const STEP_V = [0, 2.5, 5, 7.5];
  const clk = createModule('clk', 0, 0, null, { bpm: 200, duty: 50 });
  const cond = createModule('seq', 7, 0, null, {
    steps: Array.from({ length: 512 }, (_, i) => STEP_V[Math.floor(i / 128)]),
    len: 512, gate: 1
  });
  const v10 = createModule('knob', 28, 1, null, { v: 10 });
  addCable(clk.id, 'OUT', cond.id, 'CLK');

  /* ---- 段选器 ×4:任一时刻只有当前乐段的卷帘拿到 PLAY 门 ---- */
  const play = [];
  for (let s = 0; s < 4; s++) {
    const sel = createModule('sel', 31 + s * 11, 0);
    addCable(v10.id, 'CV', sel.id, 'CH' + (s + 1));
    addCable(cond.id, 'CV', sel.id, 'SEL');
    play.push(sel);
  }

  /* ---- 四轨 × 4 乐段钢琴卷帘(行 = 乐段,列 = 轨)---- */
  const X = [0, 27, 54, 81], Y = [8, 25, 42, 59];
  const rolls = [[], [], [], []];          // rolls[轨][段]
  const KEYS = ['p1', 'p2', 'tri', 'noi'];
  for (let t = 0; t < 4; t++)
    for (let s = 0; s < 4; s++) {
      const r = createModule('roll', X[t], Y[s], null, {
        notes: NSF_TRACKS[KEYS[t]][s].map(([c, k, l, v]) => ({ c, k, l, v })),
        bpm: 100, bars: 16, gate: 80
      });
      addCable(play[s].id, 'OUT', r.id, 'PLAY');
      rolls[t].push(r);
    }

  /* ---- 旋律音色:方波主音 / 方波和声 / 三角波贝斯 ---- */
  const mix1 = createModule('mix', 114, 17);
  [['p1', 0, 'SQR', 8], ['p2', 1, 'SQR', 25], ['tri', 2, 'TRI', 42]]
    .forEach(([key, t, wave, y]) => {
      const sel = createModule('sel', 90, y);
      const vco = createModule('vco', 101, y);
      const vca = createModule('vca', 107, y);
      addCable(cond.id, 'CV', sel.id, 'SEL');
      for (let s = 0; s < 4; s++) {
        addCable(rolls[t][s].id, 'CV', sel.id, 'CH' + (s + 1));
        addCable(rolls[t][s].id, 'GATE', vca.id, 'GAIN');
      }
      addCable(sel.id, 'OUT', vco.id, 'VOCT');
      addCable(vco.id, wave, vca.id, 'IN');
      addCable(vca.id, 'OUT', mix1.id, MIX_CH[t]);
    });

  /* ---- 噪声镲:当前段卷帘的 GATE 直接触发 ---- */
  const hat = createModule('hat', 101, 59);
  for (let s = 0; s < 4; s++) addCable(rolls[3][s].id, 'GATE', hat.id, 'TRIG');

  /* ---- 母线:三轨先混,再与镲合并 → 喇叭 + 示波器 ---- */
  const mix2 = createModule('mix', 123, 17);
  const spk = createModule('spk', 132, 17);
  const scope = createModule('scope', 132, 24);
  addCable(mix1.id, 'OUT', mix2.id, 'A');
  addCable(hat.id, 'OUT', mix2.id, 'B');
  addCable(mix2.id, 'OUT', spk.id, 'L');
  addCable(mix2.id, 'OUT', spk.id, 'R');
  addCable(mix2.id, 'OUT', scope.id, 'IN');

  fitView();
  toast('NSF 转谱:四轨 × 4 乐段(每条卷帘 16 小节)钢琴卷帘,全曲 64 小节自动轮换,100 BPM');
}
