/* 推子控件:竖向(2×6)/ 横向(8×4)。写 mod.state.v 并驱动 mod.cs。 */

import { el, clamp } from '../core/utils.js';
import { getCtx } from '../core/audio.js';
import { saveSoon } from '../core/save.js';

/** 竖向推子:点击轨道跳转 / 拖动 / 滚轮微调 / 双击回中 */
export function faderV(mod) {
  const ctx = getCtx();
  const wrap = el('div', 'fadervwrap', mod.body);
  wrap.dataset.ctl = '1';
  const track = el('div', 'ftrack', wrap);
  const handle = el('div', 'fhandle', track);
  const val = el('div', 'kval', wrap);
  const set = v => {
    v = clamp(Math.round(v * 100) / 100, 0, 10);
    mod.state.v = v;
    handle.style.top = ((10 - v) * 10) + '%';
    val.textContent = v.toFixed(1) + 'V';
    if (mod.cs) mod.cs.offset.setTargetAtTime(v, ctx.currentTime, 0.004);
    saveSoon();
  };
  mod.setKnob = set;
  track.addEventListener('pointerdown', e => {
    e.stopPropagation();
    const r = track.getBoundingClientRect();
    set((1 - (e.clientY - r.top) / r.height) * 10);
    const mv = ev => set((1 - (ev.clientY - r.top) / r.height) * 10);
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  });
  track.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); set(mod.state.v + (e.deltaY < 0 ? 0.1 : -0.1)); }, { passive: false });
  track.addEventListener('dblclick', e => { e.stopPropagation(); set(5); });
  set(mod.state.v);
}

/** 横向推子:左右拖动 */
export function faderH(mod) {
  const ctx = getCtx();
  const wrap = el('div', 'faderhwrap', mod.body);
  wrap.dataset.ctl = '1';
  const track = el('div', 'fhtrack', wrap);
  const handle = el('div', 'fhhandle', track);
  const val = el('div', 'kval', wrap);
  const set = v => {
    v = clamp(Math.round(v * 100) / 100, 0, 10);
    mod.state.v = v;
    handle.style.left = (v * 10) + '%';
    val.textContent = v.toFixed(1) + 'V';
    if (mod.cs) mod.cs.offset.setTargetAtTime(v, ctx.currentTime, 0.004);
    saveSoon();
  };
  mod.setKnob = set;
  track.addEventListener('pointerdown', e => {
    e.stopPropagation();
    const r = track.getBoundingClientRect();
    set((e.clientX - r.left) / r.width * 10);
    const mv = ev => set((ev.clientX - r.left) / r.width * 10);
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  });
  track.addEventListener('dblclick', e => { e.stopPropagation(); set(5); });
  set(mod.state.v);
}
