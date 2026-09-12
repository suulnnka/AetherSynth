/* 画布指针交互:接口拖线 / 已接线口拔线换位 / 组件移动 / 空白平移 /
   点线缆删除 / 点选与 Shift 多选 */

import { state } from '../core/state.js';
import { firstGesture } from '../core/audio.js';
import { addCable, nextColor, removeCable, mkPath, cableD, jackPos } from '../core/cables.js';
import { selMod } from '../core/selection.js';
import { viewport, screenToWorld, applyView, zoomAt } from '../core/view.js';
import { saveSoon } from '../core/save.js';
import { showTip, hideTip } from '../ui/tooltip.js';
import { toast } from '../ui/toast.js';

export function initPointer() {
  viewport.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    firstGesture();
    hideTip();
    const j = e.target.closest('.jack');
    if (j) { selMod(+j.dataset.mod); startCable(j, e); e.preventDefault(); return; }
    if (e.target.closest('[data-ctl]')) return;
    const mEl = e.target.closest('.module');
    if (mEl) {
      const m = state.mods.get(+mEl.dataset.id);
      selMod(m.id, e.shiftKey);
      const w0 = screenToWorld(e);
      state.drag = { type: 'move', id: m.id, ox: w0.x - m.cx * state.cellPx, oy: w0.y - m.cy * state.cellPx, moved: false };
      e.preventDefault();
      return;
    }
    state.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: state.view.x, vy: state.view.y, moved: false };
    viewport.style.cursor = 'grabbing';
  });

  window.addEventListener('pointermove', e => {
    if (!state.drag) {
      const j = e.target.closest && e.target.closest('.jack');
      if (j) showTip(j); else hideTip();
      return;
    }
    if (state.drag.type === 'pan') {
      state.view.x = state.drag.vx + e.clientX - state.drag.sx;
      state.view.y = state.drag.vy + e.clientY - state.drag.sy;
      if (Math.hypot(e.clientX - state.drag.sx, e.clientY - state.drag.sy) > 4) state.drag.moved = true;
      applyView();
    } else if (state.drag.type === 'move') {
      const m = state.mods.get(state.drag.id);
      if (!m) return;
      const w = screenToWorld(e);
      state.drag.moved = true;
      const ncx = Math.round((w.x - state.drag.ox) / state.cellPx);
      const ncy = Math.round((w.y - state.drag.oy) / state.cellPx);
      if (ncx !== m.cx || ncy !== m.cy) m.moveTo(ncx, ncy);
    } else if (state.drag.type === 'cable') {
      if (state.drag.pending && Math.hypot(e.clientX - state.drag.sx, e.clientY - state.drag.sy) > 4) {
        // 从已接线的口拖出 = 把最近的一根线拔下来
        const list = [...state.cables.values()].filter(c =>
          (c.a.m === state.drag.pending.m && c.a.p === state.drag.pending.p) ||
          (c.b.m === state.drag.pending.m && c.b.p === state.drag.pending.p));
        const c = list[list.length - 1];
        if (c) {
          state.drag.color = c.color;
          state.drag.fixed = (c.a.m === state.drag.pending.m && c.a.p === state.drag.pending.p)
            ? { m: c.b.m, p: c.b.p } : { m: c.a.m, p: c.a.p };
          removeCable(c, { silent: true });
        }
        state.drag.pending = null;
      }
      showTemp(state.drag, e);
      document.querySelectorAll('.jack.droptgt').forEach(x => x.classList.remove('droptgt'));
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const j = t && t.closest && t.closest('.jack');
      if (j) j.classList.add('droptgt');
    }
  });

  window.addEventListener('pointerup', e => {
    if (!state.drag) return;
    const d = state.drag; state.drag = null;
    if (d.type === 'pan') {
      viewport.style.cursor = 'default';
      if (!d.moved) {
        const t = document.elementFromPoint(e.clientX, e.clientY);
        const hit = t && t.closest && t.closest('path.hit');
        if (hit && state.cables.get(+hit.dataset.c)) { removeCable(state.cables.get(+hit.dataset.c)); toast('已删除线缆'); }
        else selMod(null);
      }
    } else if (d.type === 'move') {
      if (d.moved) saveSoon();
    } else if (d.type === 'cable') {
      hideTemp(d);
      document.querySelectorAll('.jack.droptgt').forEach(x => x.classList.remove('droptgt'));
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const j = t && t.closest && t.closest('.jack');
      if (j) {
        const other = { m: +j.dataset.mod, p: j.dataset.port };
        const src = d.fixed || d.from;
        const c = addCable(src.m, src.p, other.m, other.p, d.color);
        if (c) toast('已连接 3.5mm 线缆');
      } else if (d.pending) saveSoon();
    }
  });

  // 触摸板 / 滚轮:双指滑动(普通滚轮)平移;Ctrl+滚轮(触摸板捏合)以指针为中心缩放
  viewport.addEventListener('wheel', e => {
    e.preventDefault();
    const r = viewport.getBoundingClientRect();
    if (e.ctrlKey) {
      zoomAt(e.clientX - r.left, e.clientY - r.top, state.view.s * Math.exp(-e.deltaY * 0.01));
      return;
    }
    const k = e.deltaMode === 1 ? 16 : 1;   // 行模式增量(部分鼠标)换算成像素
    state.view.x -= e.deltaX * k;
    state.view.y -= e.deltaY * k;
    applyView();
  }, { passive: false });
}

function startCable(jEl, e) {
  state.drag = {
    type: 'cable',
    pending: { m: +jEl.dataset.mod, p: jEl.dataset.port },
    from: { m: +jEl.dataset.mod, p: jEl.dataset.port },
    fixed: null, color: nextColor(),
    sx: e.clientX, sy: e.clientY
  };
  showTemp(state.drag, e);
}

function showTemp(d, e) {
  if (!d._hit) { d._hit = mkPath('hit', 'rgba(0,0,0,0)', 14); d._wire = mkPath('wire', d.color, 3.2); d._wire.setAttribute('stroke-dasharray', '7 5'); }
  const p0 = d.fixed ? jackPos(d.fixed) : jackPos(d.from);
  const p1 = screenToWorld(e);
  const dd = cableD(p0, p1);
  d._hit.setAttribute('d', dd); d._wire.setAttribute('d', dd);
}

function hideTemp(d) {
  if (d._hit) { d._hit.remove(); d._wire.remove(); d._hit = d._wire = null; }
}
