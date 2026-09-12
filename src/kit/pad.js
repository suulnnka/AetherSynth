/* XY 触控板(8×8):一路拖动同时输出两路电压。写 mod.state.x/y,驱动 mod.csX/csY。 */

import { el, clamp } from '../core/utils.js';
import { getCtx } from '../core/audio.js';
import { saveSoon } from '../core/save.js';

export function pad(mod) {
  const ctx = getCtx();
  const wrap = el('div', 'padwrap', mod.body);
  wrap.dataset.ctl = '1';
  const area = el('div', 'padarea', wrap);
  const dot = el('div', 'padhandle', area);
  const val = el('div', 'padval', wrap);
  const draw = (x, y) => {
    dot.style.left = (x * 10) + '%';
    dot.style.top = ((10 - y) * 10) + '%';
    val.innerHTML = `<span>X ${x.toFixed(1)}V</span><span>Y ${y.toFixed(1)}V</span>`;
  };
  const set = (x, y) => {
    x = clamp(Math.round(x * 100) / 100, 0, 10);
    y = clamp(Math.round(y * 100) / 100, 0, 10);
    mod.state.x = x; mod.state.y = y;
    draw(x, y);
    const t = ctx.currentTime;
    if (mod.csX) mod.csX.offset.setTargetAtTime(x, t, 0.004);
    if (mod.csY) mod.csY.offset.setTargetAtTime(y, t, 0.004);
    saveSoon();
  };
  mod.setXY = set;
  area.addEventListener('pointerdown', e => {
    e.stopPropagation();
    const r = area.getBoundingClientRect();
    set((e.clientX - r.left) / r.width * 10, (1 - (e.clientY - r.top) / r.height) * 10);
    const mv = ev => set((ev.clientX - r.left) / r.width * 10, (1 - (ev.clientY - r.top) / r.height) * 10);
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  });
  area.addEventListener('dblclick', e => { e.stopPropagation(); set(5, 5); });
  set(mod.state.x, mod.state.y);
}
