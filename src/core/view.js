/* 画布视图:平移 / 缩放 / 格距。DOM 元素在模块加载时获取
   (index.html 以 type="module" 延迟加载,DOM 已就绪)。
   格距变化通过 onCellSize() 回调通知上层(如工坊面板度量),避免反向依赖。 */

import { $, clamp } from './utils.js';
import { state } from './state.js';
import { redrawCables } from './cables.js';
import { BASE } from './ports.js';

export const viewport = $('#viewport');
export const worldEl = $('#world');
export const cablesSvg = $('#cables');

export function applyView() {
  worldEl.style.transform = `translate(${state.view.x}px,${state.view.y}px) scale(${state.view.s})`;
  const zv = $('#zoomval');
  if (zv) zv.textContent = Math.round(state.view.s * 100) + '%';
}

export function screenToWorld(e) {
  const r = viewport.getBoundingClientRect();
  return { x: (e.clientX - r.left - state.view.x) / state.view.s, y: (e.clientY - r.top - state.view.y) / state.view.s };
}

export function zoomAt(mx, my, ns) {
  ns = clamp(ns, 0.25, 3);
  state.view.x = mx - (mx - state.view.x) * ns / state.view.s;
  state.view.y = my - (my - state.view.y) * ns / state.view.s;
  state.view.s = ns;
  applyView();
}

/** 缩放到全部组件可见 */
export function fitView() {
  const r = viewport.getBoundingClientRect();
  if (!state.mods.size) { state.view.x = 40; state.view.y = 40; state.view.s = 1; applyView(); return; }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const m of state.mods.values()) {
    x0 = Math.min(x0, m.cx * state.cellPx); y0 = Math.min(y0, m.cy * state.cellPx);
    x1 = Math.max(x1, (m.cx + m.def.w) * state.cellPx);
    y1 = Math.max(y1, (m.cy + m.def.h) * state.cellPx);
  }
  const pad = 50;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const s = clamp(Math.min(r.width / (x1 - x0), r.height / (y1 - y0)), 0.25, 1.6);
  state.view.s = s;
  state.view.x = (r.width - (x1 - x0) * s) / 2 - x0 * s;
  state.view.y = (r.height - (y1 - y0) * s) / 2 - y0 * s;
  applyView();
}

/** 切换格距:所有组件 / 接口 / 线缆按新格距重排 */
export function setCellSize(px) {
  state.cellPx = px;
  const k = state.cellPx / BASE;
  worldEl.style.setProperty('--cellpx', state.cellPx + 'px');
  worldEl.style.setProperty('--k', k);
  for (const m of state.mods.values()) {
    m.el.style.width = (m.def.w * state.cellPx) + 'px';
    m.el.style.height = (m.def.h * state.cellPx) + 'px';
    m.moveTo(m.cx, m.cy);
    m.refitScreens();
  }
  redrawCables();
}

