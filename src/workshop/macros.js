/* 宏组件:把画布上的一组组件抽象成一个可复用的新组件(类似编程里的函数)。
   ---------------------------------------------------------------------
   · 捕获   captureMacroSpec():纯函数,把选中的一组组件整理为宏规格
            (成员 / 内部接线 / 对外接口),可单测。
   · 定义   registerMacroDef():宏规格 → 组件定义(盒子 + 对外接口)。
   · 实例化 instantiateMacro():放置宏 = 生成盒子 + 按规格重建全部内部
            组件与连线(“引入了这一整组组件”)。
   · 递归   成员只允许普通组件:组合 / 宏实例不能被发送进宏草稿,
            定义一经创建不可更改 → 依赖关系是单向无环图,天然无递归。
   宏规格(JSON,随补丁保存):
     { name, kind: 'macro',
       members: [ { rid, t, dx, dy, s } ],          // 相对布局 + 状态
       wires:   [ { a: [rid, port], b: [rid, port], color } ],
       ports:   [ { id: 'E1', dir, name, type, rid, port } ],  // 对外接口
       w, h }                                      // 整格尺寸
 */

import { clamp } from '../core/utils.js';
import { state, nextId } from '../core/state.js';
import { DEFS, registerDef } from '../core/registry.js';
import { layoutDefPorts } from '../core/ports.js';
import { reflowActive } from '../core/flow.js';
import { toast } from '../ui/toast.js';
// 注:module / cables / view 依赖浏览器 DOM,统一在函数内动态导入,
//     使本文件的捕获逻辑可在 Node 单测中直接运行。

/** 纯函数:把成员组件(id 列表)按当前画布状态整理为宏规格。
    mods / cables 形如 state.mods / state.cables,元素只需提供
    { id, def:{id,name,w,h,ports}, cx, cy, state } / { a, b, color }。
    同时返回 boundary(原有对外接线,供“化简替换”时重连)。 */
export function captureMacroSpec(ids, mods, cables, name = '宏组件') {
  const inSet = new Set(ids);
  if (ids.length < 1) throw new Error('宏至少需要一个组件');
  // 稳定的成员编号:按位置排序(上→下、左→右)
  const list = ids.map(id => {
    const m = mods.get(id);
    if (!m) throw new Error('组件不存在:' + id);
    return m;
  }).sort((a, b) => (a.cy - b.cy) || (a.cx - b.cx) || (a.id - b.id));
  const ridOf = new Map(list.map((m, i) => [m.id, 'm' + (i + 1)]));

  const minX = Math.min(...list.map(m => m.cx));
  const minY = Math.min(...list.map(m => m.cy));
  const maxX = Math.max(...list.map(m => m.cx + m.def.w));
  const maxY = Math.max(...list.map(m => m.cy + m.def.h));

  const spec = {
    name, kind: 'macro',
    members: list.map(m => ({
      rid: ridOf.get(m.id), t: m.def.id,
      dx: m.cx - minX + 1, dy: m.cy - minY + 1,
      s: JSON.parse(JSON.stringify(m.state))
    })),
    wires: [], ports: []
  };
  spec.w = (maxX - minX) + 2;   // 成员包围盒四周各留 1 格空白
  spec.h = (maxY - minY) + 2;

  /* 内部接线:两端都在成员集合内 */
  const boundary = [];          // [{ far, dir, extId, color }] 供“化简替换”重连
  const extByKey = new Map();   // 成员端口 → 对外接口(一个成员端口只引出一个接口)
  let extN = 0;
  for (const c of cables.values()) {
    const aIn = inSet.has(c.a.m), bIn = inSet.has(c.b.m);
    if (aIn && bIn) {
      spec.wires.push({ a: [ridOf.get(c.a.m), c.a.p], b: [ridOf.get(c.b.m), c.b.p], color: c.color });
      continue;
    }
    if (aIn === bIn) continue;                  // 与宏无关的接线
    const member = aIn ? c.a : c.b;
    const far = aIn ? c.b : c.a;
    const key = member.m + ':' + member.p;
    const mObj = mods.get(member.m);
    const portDef = mObj.def.portsById[member.p];
    let ext = extByKey.get(key);
    if (!ext) {                                 // 一个成员端口引出一个对外接口
      ext = { id: 'E' + (++extN), rid: ridOf.get(member.m), port: member.p };
      extByKey.set(key, ext);
      spec.ports.push(ext);
    }
    boundary.push({ far: { m: far.m, p: far.p }, dir: portDef.dir, extId: ext.id, color: c.color });
  }
  // 接口的方向 / 名称 / 类型取自成员端口定义
  for (const ext of spec.ports) {
    const m = mods.get(ids.find(id => ridOf.get(id) === ext.rid));
    const p = m.def.portsById[ext.port];
    ext.dir = p.dir;
    ext.name = p.name;
    ext.type = p.type || 'audio';
  }
  return { spec, boundary };
}

/** 宏规格 → 盒子组件定义(盒子只承担接口与外观,内部由实例成员构成) */
export function registerMacroDef(key, spec) {
  const ports = spec.ports.map(p => ({
    id: p.id, dir: p.dir, name: p.name, type: p.type || 'audio',
    desc: (p.dir === 'out' ? '宏输出(来自内部组件)' : '宏输入(送往内部组件)')
  }));
  const flow = {};
  for (const p of ports) if (p.dir === 'out') flow[p.id] = ports.filter(q => q.dir === 'in').map(q => q.id);
  const def = {
    id: key, name: spec.name || '宏组件', en: 'MACRO', cat: 'process',
    w: Math.max(spec.w, 4), h: Math.max(spec.h, 4),
    ports, macro: true, spec: JSON.parse(JSON.stringify(spec)),
    flow,
    desc: '宏组件:封装了一组组件与接线的可复用模块,放置即展开内部结构。',
    state: () => ({ kids: [], maps: [] }),
    build() {},
    ui() { kitHint(this); }
  };
  registerDef(def);
  layoutDefPorts(def);
  return def;
}

function kitHint(mod) {
  const wrap = document.createElement('div');
  wrap.className = 'k-hint';
  const n = mod.def.spec.members.length;
  wrap.innerHTML = `<b>MACRO</b><span>${n} 个内部组件</span>`;
  mod.body.appendChild(wrap);
}

/** 展开宏实例:创建盒子 + 按规格重建全部内部组件 / 内部接线 / 接口路由。
    返回盒子。box.state.kidByRid / maps 记录子组件与路由,随补丁序列化。 */
export async function instantiateMacro(key, bx, by) {
  const [{ createModule }, { addCable }] = await Promise.all([
    import('../core/module.js'), import('../core/cables.js')]);
  const def = DEFS[key];
  const box = createModule(key, bx, by);
  box.childIds = [];
  box.state.kidByRid = {};
  const ridToId = new Map();
  for (let i = 0; i < def.spec.members.length; i++) {
    const md = def.spec.members[i];
    if (!DEFS[md.t]) { toast('宏内部组件缺少定义,已跳过'); continue; }
    const m = createModule(md.t, bx + md.dx, by + md.dy, null, JSON.parse(JSON.stringify(md.s)));
    m.parent = box.id;
    box.childIds.push(m.id);
    box.state.kids.push(m.id);
    box.state.kidByRid[md.rid] = m.id;
    ridToId.set(md.rid, m.id);
  }
  // 内部接线
  for (const w of def.spec.wires) {
    const a = ridToId.get(w.a[0]), b = ridToId.get(w.b[0]);
    if (a != null && b != null) addCable(a, w.a[1], b, w.b[1], w.color);
  }
  // 接口路由:盒子的对外接口口 ↔ 内部成员端口(节点直连,不出盒子)
  box.state.maps = def.spec.ports.map(p => ({ ext: p.id, rid: p.rid, p: p.port, dir: p.dir }));
  wireMacro(box);
  reflowActive();
  return box;
}

/** 宏盒子的对外接口 ↔ 内部成员端口 节点直连(重载后需重新执行) */
export function wireMacro(box) {
  for (const map of box.state.maps || []) {
    const kidId = box.state.kidByRid?.[map.rid];
    const kid = kidId != null ? state.mods.get(kidId) : null;
    if (!kid) continue;
    if (map.dir === 'out') { try { kid.outs[map.p].connect(box.outs[map.ext]); } catch (e) {} }
    else { try { box.ins[map.ext].connect(kid.ins[map.p]); } catch (e) {} }
  }
}

export function newMacroKey() {
  let key;
  do { key = 'macro#' + nextId(); } while (DEFS[key]);
  return key;
}

/** 在指定格位放置宏实例(落点计算由调用方完成,保持本文件可在 Node 运行) */
export async function placeMacroAt(key, cx, cy) {
  const box = await instantiateMacro(key, cx, cy);
  return box;
}
