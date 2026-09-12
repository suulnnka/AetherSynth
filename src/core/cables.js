/* 线缆:创建 / 删除 / 绘制(SVG 贝塞尔)。一根线缆 = 一条 3.5mm 线,
   音频 / CV / Gate / MIDI 走同样的线;MIDI 线不走 Web Audio 节点。 */

import { state, nextId } from './state.js';
import { TYPE_COLORS } from './registry.js';
import { reflowActive } from './flow.js';
import { saveSoon } from './save.js';
import { cablesSvg } from './view.js';
import { toast } from '../ui/toast.js';

const svgNS = 'http://www.w3.org/2000/svg';

export const CABLE_COLORS = ['#e05252', '#3a86c8', '#e09a12', '#2f9e63', '#8a4bb8', '#d96f2a', '#12949e', '#c74e93'];

export function nextColor() { return CABLE_COLORS[state.colorIdx++ % CABLE_COLORS.length]; }

export function mkPath(cls, color, width) {
  const p = document.createElementNS(svgNS, 'path');
  p.setAttribute('class', cls);
  p.setAttribute('stroke', color);
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke-width', width);
  cablesSvg.appendChild(p);
  return p;
}

/** 接口的画布坐标(格 → 像素) */
export function jackPos(a) {
  const m = state.mods.get(a.m);
  if (!m) return { x: 0, y: 0 };
  const p = m.def.portsById[a.p];
  return { x: (m.cx + p._x) * state.cellPx, y: (m.cy + p._y) * state.cellPx };
}

export function cableD(p0, p1) {
  const mid = (p0.y + p1.y) / 2;
  return `M ${p0.x} ${p0.y} C ${p0.x} ${mid}, ${p1.x} ${mid}, ${p1.x} ${p1.y}`;
}

export function drawCable(c) {
  const d = cableD(jackPos(c.a), jackPos(c.b));
  c.hit.setAttribute('d', d);
  c.wire.setAttribute('d', d);
}
export function redrawCables() { for (const c of state.cables.values()) drawCable(c); }

export function findCable(am, ap, bm, bp) {
  for (const c of state.cables.values())
    if (c.a.m === am && c.a.p === ap && c.b.m === bm && c.b.p === bp) return c;
  return null;
}

/** 输出口 → 输入口 接线(方向自动纠正);重复接线返回已有线缆 */
export function addCable(am, ap, bm, bp, color) {
  let A = state.mods.get(am), B = state.mods.get(bm);
  if (!A || !B) return null;
  let pa = A.def.portsById[ap], pb = B.def.portsById[bp];
  if (!pa || !pb) return null;
  if (pa.dir === 'in' && pb.dir === 'out') {
    [A, B] = [B, A]; [pa, pb] = [pb, pa]; [am, bm] = [bm, am]; [ap, bp] = [bp, ap];
  }
  if (pa.dir !== 'out' || pb.dir !== 'in') { toast('只能「输出口 → 输入口」接线'); return null; }
  for (const c of state.cables.values())
    if (c.a.m === am && c.a.p === ap && c.b.m === bm && c.b.p === bp) return c;
  const c = {
    id: nextId(),
    // 线缆颜色跟随源接口的信号类型(VCV Rack 惯例)
    color: color || TYPE_COLORS[pa.type] || nextColor(),
    a: { m: am, p: ap }, b: { m: bm, p: bp },
    midi: pa.type === 'midi'
  };
  if (!c.midi) {
    c.aNode = A.outs[ap]; c.bNode = B.ins[bp];
    if (!c.aNode || !c.bNode) return null;
    c.aNode.connect(c.bNode);
  }
  c.hit = mkPath('hit', 'rgba(0,0,0,0)', 14);
  c.hit.dataset.c = c.id;
  c.wire = mkPath('wire', c.color, 3.2);
  state.cables.set(c.id, c);
  drawCable(c);
  A.applyDefaults(); B.applyDefaults();
  reflowActive();
  saveSoon();
  return c;
}

export function removeCable(c, opts) {
  if (!c.midi) { try { c.aNode.disconnect(c.bNode); } catch (e) {} }
  c.hit.remove(); c.wire.remove();
  state.cables.delete(c.id);
  const A = state.mods.get(c.a.m), B = state.mods.get(c.b.m);
  if (A) A.applyDefaults();
  if (B) B.applyDefaults();
  reflowActive();
  if (!opts || !opts.silent) saveSoon();
}
