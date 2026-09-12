/* 旋钮类控件:旋钮 / 大旋钮。步进(steps)自动吸附并画刻度点;
   note 模式按半音音名显示。写 mod.state.v 并驱动 mod.cs 恒压源。 */

import { el, clamp } from '../core/utils.js';
import { getCtx } from '../core/audio.js';
import { saveSoon } from '../core/save.js';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function knob(mod, o = {}) {
  const ctx = getCtx();
  const min = o.min ?? 0, max = o.max ?? 10, span = max - min;
  const steps = o.steps || null;
  const quant = v => {
    v = clamp(v, min, max);
    if (!steps) return Math.round(v * 100) / 100;
    let best = steps[0];
    for (const s of steps) if (Math.abs(s - v) < Math.abs(best - v)) best = s;
    return best;
  };
  const fmt = v => o.note
    ? NOTES[Math.round(clamp(v, 0, 1) * 12) % 12] + ' · ' + v.toFixed(2) + 'V'
    : v.toFixed(1) + 'V';
  const wrap = el('div', 'knobwrap', mod.body);
  wrap.dataset.ctl = '1';
  const k = el('div', 'knob', wrap);
  if (steps) {   // 段位刻度点(反转抵消旋钮旋转,保持固定)
    const ring = el('div', 'kticks', k);
    steps.forEach(s => {
      const t = el('div', 'ktick', ring);
      t.style.transform = `rotate(${(s - min) / span * 270 - 135}deg) translateY(calc(-12px * var(--k)))`;
    });
  }
  el('div', 'kptr', k);
  const val = el('div', 'kval', wrap);
  const set = v => {
    v = quant(v);
    mod.state.v = v;
    k.style.setProperty('--a', ((v - min) / span * 270 - 135) + 'deg');
    val.textContent = fmt(v);
    if (mod.cs) mod.cs.offset.setTargetAtTime(v, ctx.currentTime, 0.004);
    saveSoon();
  };
  mod.setKnob = set;
  k.addEventListener('pointerdown', e => {
    e.stopPropagation();
    const kd = { y: e.clientY, v: mod.state.v };
    const mv = ev => set(kd.v + (kd.y - ev.clientY) * span * (ev.shiftKey ? 0.0008 : 0.0045));
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  });
  k.addEventListener('wheel', e => {
    e.preventDefault(); e.stopPropagation();
    if (steps) {
      const i = steps.findIndex(s => Math.abs(s - mod.state.v) < 1e-6);
      set(steps[clamp(i + (e.deltaY < 0 ? 1 : -1), 0, steps.length - 1)]);
    } else set(mod.state.v + (e.deltaY < 0 ? span * 0.01 : -span * 0.01));
  }, { passive: false });
  k.addEventListener('dblclick', e => { e.stopPropagation(); set(steps ? steps[(steps.length / 2) | 0] : (min + max) / 2); });
  set(mod.state.v);
}

/** 大旋钮(4×5):行程更长,调节更细 */
export function knobBig(mod) {
  const ctx = getCtx();
  const wrap = el('div', 'knobwrap', mod.body);
  wrap.dataset.ctl = '1';
  const k = el('div', 'knob knob-lg', wrap);
  el('div', 'kptr', k);
  const val = el('div', 'kval', wrap);
  const set = v => {
    v = clamp(Math.round(v * 100) / 100, 0, 10);
    mod.state.v = v;
    k.style.setProperty('--a', (v * 27 - 135) + 'deg');
    val.textContent = v.toFixed(2) + 'V';
    if (mod.cs) mod.cs.offset.setTargetAtTime(v, ctx.currentTime, 0.004);
    saveSoon();
  };
  mod.setKnob = set;
  k.addEventListener('pointerdown', e => {
    e.stopPropagation();
    const kd = { y: e.clientY, v: mod.state.v };
    const mv = ev => set(kd.v + (kd.y - ev.clientY) * (ev.shiftKey ? 0.004 : 0.02));
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  });
  k.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); set(mod.state.v + (e.deltaY < 0 ? 0.05 : -0.05)); }, { passive: false });
  k.addEventListener('dblclick', e => { e.stopPropagation(); set(5); });
  set(mod.state.v);
}
