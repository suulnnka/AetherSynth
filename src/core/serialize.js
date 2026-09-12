/* 补丁序列化 / 反序列化:localStorage 自动保存 + JSON 导入导出。
   v4 格式:designs(自制组件设计,kind = 'panel' | 'macro')+ modules + cables。
   反序列化对旧版补丁保持兼容:未知字段忽略,旧版喇叭 IN 口自动拆成 L/R。 */

import { $ } from './utils.js';
import { state } from './state.js';
import { DEFS } from './registry.js';
import { createModule } from './module.js';
import { addCable, removeCable } from './cables.js';
import { setCellSize, applyView } from './view.js';
import { mkCustomDef } from '../workshop/custom-def.js';
import { mkCompositeDef } from './composite.js';
import { wireComposite } from './composite.js';
import { designs, refreshMine } from '../workshop/designs.js';
import { saveNow, LSKEY, readSaved } from './save.js';

export function serialize() {
  return {
    v: 4, cell: state.cellPx, uid: state.uid, view: { ...state.view },
    designs: designs.map(d => ({ key: d.key, kind: d.kind, spec: d.spec })),
    modules: [...state.mods.values()].map(m => ({ i: m.id, t: m.def.id, x: m.cx, y: m.cy, s: m.state })),
    cables: [...state.cables.values()].map(c => ({ a: [c.a.m, c.a.p], b: [c.b.m, c.b.p], c: c.color }))
  };
}

export function clearAll() {
  [...state.cables.values()].forEach(c => removeCable(c, { silent: true }));
  [...state.mods.keys()].forEach(deleteQuiet);
  state.sel = null;
}

// 清空画布期间逐个静默删除(无确认 / 无 toast)
function deleteQuiet(id) {
  const m = state.mods.get(id);
  if (!m) return;
  m.dispose();
  m.el.remove();
  state.mods.delete(id);
}

export function deserialize(data) {
  clearAll();
  setCellSize(24);   // 格距固定(不随补丁 / 菜单变化),布局以格为单位不受影响
  // 恢复自制组件设计(先于模块:模块按 key 引用这些定义)
  designs.length = 0;
  for (const d of (data.designs || [])) {
    if (!d || !d.key || !d.spec) continue;
    if (!d.spec.cells) continue;
    mkCustomDef(d.key, d.spec);
    designs.push({ key: d.key, spec: d.spec, kind: d.kind || 'panel' });
  }
  // id 防碰撞:uid 至少抬到已恢复模块 / 设计最大编号之上
  let maxId = 0;
  (data.modules || []).forEach(md => { if (md.i > maxId) maxId = md.i; });
  (data.designs || []).forEach(d => { const n = +String(d.key || '').split('#')[1]; if (n > maxId) maxId = n; });
  (data.modules || []).forEach(md => {
    const t = String(md.t || '');
    if (t.startsWith('composite#')) { const n = +t.split('#')[1]; if (n > maxId) maxId = n; }
  });
  state.uid = Math.max(data.uid || 1, maxId + 1);
  (data.modules || []).forEach(md => {
    if (md.t && String(md.t).startsWith('composite#') && !DEFS[md.t] && md.s && md.s.ports) {
      mkCompositeDef(md.t, md.s.ports, md.s.w || 8, md.s.h || 4);
    }
  });
  (data.modules || []).forEach(md => {
    if (!DEFS[md.t]) return;
    createModule(md.t, md.x, md.y, md.i, md.s);
  });
  (data.cables || []).forEach(cd => {
    if (addCable(cd.a[0], cd.a[1], cd.b[0], cd.b[1], cd.c, { quiet: true })) return;
    // 旧版补丁兼容:喇叭单声道 IN 口拆分为 L / R 双接线
    const m = state.mods.get(cd.b[0]);
    if (m && m.def.id === 'spk' && cd.b[1] === 'IN') {
      addCable(cd.a[0], cd.a[1], cd.b[0], 'L', cd.c);
      addCable(cd.a[0], cd.a[1], cd.b[0], 'R', cd.c);
    }
  });
  // 组合 / 宏盒子:重载后重建「对外接口 ↔ 内部成员端口」的节点路由,
  // 并恢复盒子 → 成员的父子关系(移动 / 删除联动、活跃度传导都依赖它)
  // 组合盒子:恢复父子关系与内部路由(移动 / 删除联动、活跃度传导都依赖它)
  for (const m of state.mods.values()) {
    if (m.def.composite) {
      m.childIds = (m.state.kids || []).slice();
      for (const kid of m.childIds) {
        const k = state.mods.get(kid);
        if (k) k.parent = m.id;
      }
      wireComposite(m);
    }
  }
  refreshMine();
  if (data.view) { Object.assign(state.view, data.view); applyView(); }
}

export function loadSaved() {
  try {
    const s = readSaved(LSKEY);
    if (!s) return false;
    deserialize(JSON.parse(s));
    return state.mods.size > 0;
  } catch (e) { return false; }
}

export { saveNow };
