/* 组合模块(嵌套抽象):
   多选 ≥2 个组件(Shift+点选)→ 工具栏「封装」:边界线缆被剪断,
   改接到组合模块面板上的新 3.5mm 口;组合可再参与封装(无限嵌套),
   右键组合 = 解体还原。 */

import { state, nextId } from './state.js';
import { registerDef } from './registry.js';


import { layoutDefPorts } from './ports.js';
import { createModule, deleteMod } from './module.js';
import { addCable, removeCable, findCable } from './cables.js';
import { reflowActive } from './flow.js';
import { saveSoon } from './save.js';
import { selMod } from './selection.js';
import { toast } from '../ui/toast.js';
import { confirmDialog } from '../ui/window.js';
import { MAX_NEST_DEPTH, nestDepthExceeded } from './nesting.js';

export function mkCompositeDef(key, ports, w, h) {
  const ins = ports.filter(p => p.dir === 'in').map(p => p.id);
  const flow = {};
  ports.forEach(p => { if (p.dir === 'out') flow[p.id] = ins.slice(); });
  const def = {
    id: key, name: '组合模块', en: 'COMPOSITE', cat: 'process', w, h,
    composite: true, ports, flow,
    desc: '封装的子系统:内部组件照常运行,通过面板上的 3.5mm 口与外界连接。右键 = 解体还原。',
    build() {}
  };
  registerDef(def);
  layoutDefPorts(def);
  return def;
}

/** 组合外壳的 EXT 口直连内部子组件的对应口 */
/** 组合盒子:对外接口口 ↔ 内部成员端口 节点直连(重载后需重新执行) */
export function wireComposite(mod) {
  for (const map of (mod.state.maps || [])) {
    const inner = state.mods.get(map.m);
    if (!inner) continue;
    if (map.dir === 'in') {
      try { mod.ins[map.ext].connect(inner.ins[map.p]); } catch (e) {}
    } else {
      try { inner.outs[map.p].connect(mod.outs[map.ext]); } catch (e) {}
    }
  }
}

export function encapsulateSelected() {
  if (state.selSet.size < 2) { toast('先按住 Shift 点选 ≥2 个组件,再点「封装」'); return; }
  const ids = [...state.selSet];
  // 嵌套深度防御:封装后的新组合不能超过最大层数
  if (nestDepthExceeded(state.mods, ids)) {
    toast('组合嵌套最多 ' + MAX_NEST_DEPTH + ' 层,无法继续封装');
    return;
  }
  const inSet = new Set(ids);
  const parents = new Set(ids.map(id => state.mods.get(id).parent || null));
  if (parents.size > 1) { toast('请选择同一层级的组件'); return; }
  const parent = [...parents][0] || null;
  const cutIn = [], cutOut = [];
  for (const c of state.cables.values()) {
    if (c.midi) continue;                       // MIDI 线保持原样跨边界
    const aIn = inSet.has(c.a.m), bIn = inSet.has(c.b.m);
    if (aIn === bIn) continue;
    if (bIn) cutIn.push({ am: c.a.m, ap: c.a.p, bm: c.b.m, bp: c.b.p, color: c.color });
    else cutOut.push({ am: c.a.m, ap: c.a.p, bm: c.b.m, bp: c.b.p, color: c.color });
  }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const id of ids) {
    const m = state.mods.get(id);
    x0 = Math.min(x0, m.cx); y0 = Math.min(y0, m.cy);
    x1 = Math.max(x1, m.cx + m.def.w); y1 = Math.max(y1, m.cy + m.def.h);
  }
  const bx = x0 - 1, by = y0 - 1, bw = (x1 - x0) + 2, bh = (y1 - y0) + 2;
  const ports = [], maps = [];
  cutIn.forEach((cu, i) => {
    const t = state.mods.get(cu.am).def.portsById[cu.ap].type;
    ports.push({ id: 'IN' + (i + 1), dir: 'in', name: 'IN' + (i + 1), type: t, desc: '来自 ' + state.mods.get(cu.am).def.name });
    maps.push({ ext: 'IN' + (i + 1), dir: 'in', m: cu.bm, p: cu.bp, extM: cu.am, extP: cu.ap });
  });
  cutOut.forEach((cu, i) => {
    const t = state.mods.get(cu.am).def.portsById[cu.ap].type;
    ports.push({ id: 'OUT' + (i + 1), dir: 'out', name: 'OUT' + (i + 1), type: t, desc: '送往 ' + state.mods.get(cu.bm).def.name + '·' + cu.bp });
    maps.push({ ext: 'OUT' + (i + 1), dir: 'out', m: cu.am, p: cu.ap, extM: cu.bm, extP: cu.bp });
  });
  const key = 'composite#' + nextId();
  mkCompositeDef(key, ports, bw, bh);
  const comp = createModule(key, bx, by);
  comp.state = { composite: true, w: bw, h: bh, ports, maps, kids: ids.slice() };
  comp.childIds = ids.slice();
  comp.parent = parent;
  ids.forEach(id => { const m = state.mods.get(id); if (m) m.parent = comp.id; });
  wireComposite(comp);
  cutIn.forEach((cu, i) => {
    const orig = findCable(cu.am, cu.ap, cu.bm, cu.bp);
    if (orig) removeCable(orig, { silent: true });
    addCable(cu.am, cu.ap, comp.id, 'IN' + (i + 1), cu.color);
  });
  cutOut.forEach((cu, i) => {
    const orig = findCable(cu.am, cu.ap, cu.bm, cu.bp);
    if (orig) removeCable(orig, { silent: true });
    addCable(comp.id, 'OUT' + (i + 1), cu.bm, cu.bp, cu.color);
  });
  selMod(null);
  reflowActive();
  saveSoon();
  toast('已封装为组合模块(右键组合 = 解体还原)');
}

/** 解体组合(面向用户交互:先经确认窗口;SYNTH.dissolve 同样返回 Promise) */
export async function dissolveComposite(comp) {
  if (!comp || !comp.def || !comp.def.composite) return;
  if (comp.childIds && comp.childIds.length) {
    const ok = await confirmDialog({
      title: '解体组合',
      message: `组合内的 ${comp.childIds.length} 个组件将恢复为独立组件,边界线缆自动重连,确定解体?`,
      okLabel: '解体'
    });
    if (!ok) return;
  }
  for (const map of (comp.state.maps || [])) {
    if (state.mods.has(map.extM) && state.mods.has(map.m))
      addCable(map.extM, map.extP, map.m, map.p);
  }
  for (const kid of comp.childIds || []) {
    const k = state.mods.get(kid);
    if (k) k.parent = comp.parent || null;
  }
  comp.childIds = [];
  deleteMod(comp.id);
  reflowActive();
  saveSoon();
  toast('组合已解体为原组件');
}
