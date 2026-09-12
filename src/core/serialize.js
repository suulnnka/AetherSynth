/* 补丁序列化 / 反序列化:localStorage 自动保存 + JSON 导入导出。
   v3 格式:studio(工坊在制设计)+ designs(自制组件设计)+ modules + cables;
   反序列化对旧 v2 补丁(含 cells / panelTheme 字段)保持兼容:忽略未知字段。 */

import { $ } from './utils.js';
import { state } from './state.js';
import { DEFS } from './registry.js';
import { createModule } from './module.js';
import { addCable, removeCable } from './cables.js';
import { setCellSize, applyView } from './view.js';
import { mkCustomDef } from '../workshop/custom-def.js';
import { designs, removeDesign, exitEditMode, refreshMine, resetPlacedSnapshot } from '../workshop/designs.js';
import { studioPanel, syncThemeControls, syncStudioMetrics, setPlaceMode } from '../workshop/studio.js';
import { saveNow, LSKEY } from './save.js';

export function serialize() {
  return {
    v: 3, cell: state.cellPx, uid: state.uid, view: { ...state.view },
    studio: studioPanel() ? studioPanel().spec() : null,
    designs: designs.map(d => ({ key: d.key, spec: d.spec })),
    modules: [...state.mods.values()].map(m => ({ i: m.id, t: m.def.id, x: m.cx, y: m.cy, s: m.state })),
    cables: [...state.cables.values()].map(c => ({ a: [c.a.m, c.a.p], b: [c.b.m, c.b.p], c: c.color }))
  };
}

export function clearAll() {
  [...state.cables.values()].forEach(c => removeCable(c, { silent: true }));
  [...state.mods.keys()].forEach(deleteModSilent);
  state.sel = null;
}

// clearAll 期间逐个删除会反复 toast,这里静默删除
function deleteModSilent(id) {
  const m = state.mods.get(id);
  if (m) m.el.remove();
  m.dispose();
  state.mods.delete(id);
}

export function deserialize(data) {
  clearAll();
  // 兼容旧版 mm 补丁:6mm≈24px,4/5/8mm 就近映射
  const cell = data.cell || { 4: 16, 5: 20, 6: 24, 8: 32 }[data.cellMM] || 24;
  setCellSize(cell);
  // 恢复自制组件设计(先于模块:模块按 key 引用这些定义)
  designs.length = 0;
  exitEditMode();
  resetPlacedSnapshot();
  for (const d of (data.designs || [])) {
    if (!d || !d.key || !d.spec || !d.spec.cells) continue;
    mkCustomDef(d.key, d.spec);
    designs.push({ key: d.key, spec: d.spec });
  }
  // id 防碰撞:uid 至少抬到已恢复模块 / 设计最大编号之上
  let maxId = 0;
  (data.modules || []).forEach(md => { if (md.i > maxId) maxId = md.i; });
  (data.designs || []).forEach(d => { const n = +String(d.key || '').split('#')[1]; if (n > maxId) maxId = n; });
  state.uid = Math.max(data.uid || 1, maxId + 1);
  (data.modules || []).forEach(md => {
    if (!DEFS[md.t]) return;
    createModule(md.t, md.x, md.y, md.i, md.s);
  });
  (data.cables || []).forEach(cd => {
    if (addCable(cd.a[0], cd.a[1], cd.b[0], cd.b[1], cd.c)) return;
    // 旧版补丁兼容:喇叭单声道 IN 口拆分为 L / R 双接线
    const m = state.mods.get(cd.b[0]);
    if (m && m.def.id === 'spk' && cd.b[1] === 'IN') {
      addCable(cd.a[0], cd.a[1], cd.b[0], 'L', cd.c);
      addCable(cd.a[0], cd.a[1], cd.b[0], 'R', cd.c);
    }
  });
  // 恢复工坊在制设计与外观
  if (studioPanel()) {
    studioPanel().clear();
    if (data.studio) studioPanel().loadSpec(data.studio);
    syncThemeControls(studioPanel().getTheme());
  }
  setPlaceMode(false);
  syncStudioMetrics();
  refreshMine();
  if (data.view) { Object.assign(state.view, data.view); applyView(); }
}

export function loadSaved() {
  try {
    const s = localStorage.getItem(LSKEY);
    if (!s) return false;
    deserialize(JSON.parse(s));
    return state.mods.size > 0;
  } catch (e) { return false; }
}

export { saveNow };
