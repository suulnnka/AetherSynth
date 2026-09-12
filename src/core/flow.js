/* 活跃度优化:只有能把信号送到喇叭(或显示终端)的组件才被模拟。
   computeActive() 是纯函数(可单测);reflowActive() 把结果应用到 DOM。 */

import { state } from './state.js';

/** FLOW[组件][输出口] = 馈入它的输入口数组(信号真正的来路);
    不在表里的输出口 = 信号源(本身产生信号);没列为馈入口的输入口 = 调制口。
    从喇叭反向 BFS:输入口有信号 → 拉喂它的输出口 → 拉馈入它的输入口 → …… */
export const FLOW = {
  vco: { SIN: ['VOCT', 'FM'], TRI: ['VOCT', 'FM'], SAW: ['VOCT', 'FM'], SQR: ['VOCT', 'FM'] },
  fm: { OUT: ['VOCT', 'RATIO', 'INDEX'], M: ['VOCT', 'RATIO'] },
  lfo: { SIN: ['RATE'], TRI: ['RATE'], SQR: ['RATE'], SAW: ['RATE'] },
  kick: { OUT: ['TRIG'] },
  snare: { OUT: ['TRIG'] },
  hat: { OUT: ['TRIG'] },
  vcf: { LP: ['IN'], HP: ['IN'], BP: ['IN'] },
  vca: { OUT: ['IN'] },
  adsr: { ENV: ['GATE'] },
  delay: { OUT: ['IN'] },
  fmod: { OUT: ['IN'] },
  atten: { OUT: ['IN'] },
  mult: { O1: ['IN'], O2: ['IN'], O3: ['IN'], O4: ['IN'] },
  mult8: { O1: ['IN'], O2: ['IN'], O3: ['IN'], O4: ['IN'], O5: ['IN'], O6: ['IN'], O7: ['IN'], O8: ['IN'] },
  quant: { OUT: ['CV'] },
  sh: { OUT: ['TRIG'] },
  mix: { OUT: ['A', 'B', 'C'] },
  midicv: { VOCT: ['MIDI'], GATE: ['MIDI'], VEL: ['MIDI'] },
  seq: { CV: ['CLK'], GATE: ['CLK'], MIDI: ['CLK'] },
  roll: { CV: ['PLAY'], GATE: ['PLAY'] },
  rec: { OUT: ['IN'] },
  crec: { OUT: ['IN'] },
  comp: { OUT: ['IN'] },
  bquant: { OUT: ['IN'] },
  sred: { OUT: ['IN'] }
};

/** 显示 / 录音终端也算信号归宿(否则示波器永远休眠;录音机要能先录后接)。
    自制组件(工坊)带电压表输入口时会动态登记到这里。 */
export const SINK_DEFS = { spk: 1, scope: 1, xy: 1, rec: 1, crec: 1, spec: 1 };

/** 纯计算:返回活跃组件 id 集合。mods/cables 形如 state.mods/state.cables,
    元素只需提供 { id, def:{id, ports, flow} }(单测可传假对象)。 */
export function computeActive(mods, cables) {
  const liveIn = new Set(), liveOut = new Set(), act = new Set();
  const q = [];
  const activate = mid => {
    if (act.has(mid)) return;
    act.add(mid);
    const m = mods.get(mid);
    if (m) for (const p of m.def.ports) if (p.dir === 'in') pushIn(mid, p.id);   // 调制口一起拉活
  };
  const pushIn = (mid, pid) => {
    const k = mid + ':' + pid;
    if (liveIn.has(k)) return;
    liveIn.add(k); q.push([mid, pid]);
    activate(mid);
  };
  const pushOut = (mid, pid) => {
    const k = mid + ':' + pid;
    if (liveOut.has(k)) return;
    liveOut.add(k);
    activate(mid);
    const m = mods.get(mid);
    const feeders = (FLOW[m ? m.def.id : ''] || {})[pid] || [];
    for (const f of feeders) pushIn(mid, f);   // 输出口活了 → 它的信号来路也活
  };
  // 种子:显示 / 录音终端的输入口(喇叭永远是归宿)
  for (const m of mods.values())
    if (SINK_DEFS[m.def.id])
      for (const p of m.def.ports) if (p.dir === 'in') pushIn(m.id, p.id);
  while (q.length) {
    const [mid, pid] = q.shift();
    // 线缆:谁在喂这个输入口
    for (const c of cables.values())
      if (c.b.m === mid && c.b.p === pid) pushOut(c.a.m, c.a.p);
    // 本模块中把这个输入口当馈入口的输出口
    const m = mods.get(mid);
    const flow = (m && m.def.flow) || FLOW[m ? m.def.id : ''] || {};
    for (const o in flow) if (flow[o].includes(pid)) pushOut(mid, o);
  }
  // 宏 / 组合盒激活时,内部成员组件一并激活(它们的节点路由不经过线缆图)
  let grew = true;
  while (grew) {
    grew = false;
    for (const m of mods.values()) {
      if (!act.has(m.id) || !m.childIds || !m.childIds.length) continue;
      for (const kid of m.childIds)
        if (!act.has(kid)) { act.add(kid); grew = true; }
    }
  }
  return act;
}

/** 重算活跃度并同步到组件 DOM(休眠变暗) */
export function reflowActive() {
  const act = computeActive(state.mods, state.cables);
  for (const m of state.mods.values()) {
    m._active = act.has(m.id);
    m.el.classList.toggle('inactive', !act.has(m.id));
  }
}
