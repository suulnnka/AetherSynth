/* 左侧组件栏:按分类列出全部内置组件。
   · 点击 = 放到视口中央(原行为)
   · 按住拖拽 = 鬼影(模块尺寸虚线框)实时跟随鼠标,松手落到画布网格上
   「我的组件」段(工坊设计)由 designs.js 渲染进 #palmine 容器。 */

import { el, $ } from '../core/utils.js';
import { state } from '../core/state.js';
import { DEFS, DEFS_ORDER } from '../core/registry.js';
import { createModule } from '../core/module.js';
import { selMod } from '../core/selection.js';
import { viewport, screenToWorld } from '../core/view.js';
import { firstGesture } from '../core/audio.js';
import { saveSoon } from '../core/save.js';
import { hideTip } from '../ui/tooltip.js';
import { toast } from '../ui/toast.js';
import { t, isZh, defName, defDesc } from '../core/i18n.js';

const GROUPS = [['control', t('控制 CONTROL', 'CONTROL')], ['source', t('信号源 SOURCE', 'SOURCE')],
  ['process', t('处理 PROCESS', 'PROCESS')], ['logic', t('逻辑 LOGIC', 'LOGIC')], ['output', t('输出 OUTPUT', 'OUTPUT')]];

export function buildPalette() {
  const pal = $('#palette');
  for (const [g, label] of GROUPS) {
    const h = el('div', 'pgroup g-' + g, pal);
    h.textContent = label;
    for (const tid of DEFS_ORDER) {
      const d = DEFS[tid];
      if (d.cat !== g) continue;
      const it = el('div', 'pitem g-' + g, pal);
      const nm = defName(d);
      it.innerHTML = `<span>${nm}${isZh() ? ` <small style="opacity:.55">${d.en}</small>` : ''}</span><span class="psz">${d.w}×${d.h} ${t('格', 'cells')}</span>`;
      it.title = defDesc(d);
      it.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        e.preventDefault();
        startPaletteDrag(e, d, nm, (cx, cy) => place(tid, cx, cy));
      });
    }
  }
}

/** 拖拽放置(可复用):鬼影跟随鼠标,落到画布按格吸附;原地松手 = 视口中央。
   size: {w, h}(格);label: 鬼影文字;place(cx, cy): 实际放置回调 */
export function startPaletteDrag(e0, size, label, place) {
  let ghost = null, dragging = false;
  const sx = e0.clientX, sy = e0.clientY;
  const over = ev => {
    const r = viewport.getBoundingClientRect();
    return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
  };
  const centerPlace = () => {
    const r = viewport.getBoundingClientRect();
    const wx = (r.width / 2 - state.view.x) / state.view.s, wy = (r.height / 2 - state.view.y) / state.view.s;
    const cx = Math.max(0, Math.round(wx / state.cellPx) - Math.round(size.w / 2)) + (state.spawnN % 4) * 2;
    const cy = Math.max(0, Math.round(wy / state.cellPx) - Math.round(size.h / 2)) + (state.spawnN % 4) * 2;
    state.spawnN++;
    place(cx, cy);
  };
  const move = ev => {
    if (!dragging) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;   // 位移阈值:点击 vs 拖拽
      dragging = true;
      ghost = el('div', 'pal-ghost', document.body);
      ghost.style.width = size.w * state.cellPx * state.view.s + 'px'; // 按当前缩放显示真实占位
      ghost.style.height = size.h * state.cellPx * state.view.s + 'px';
      ghost.textContent = `${label} · ${size.w}×${size.h}`;
    }
    ghost.style.left = ev.clientX + 'px';                              // 鬼影跟随鼠标
    ghost.style.top = ev.clientY + 'px';
    ghost.classList.toggle('ok', over(ev));                            // 画布上 = 绿色可放
    hideTip();
  };
  const up = ev => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    if (ghost) { ghost.remove(); ghost = null; }
    if (dragging && over(ev)) {                                        // 落到画布 = 放在松手处
      firstGesture();
      const w = screenToWorld(ev);
      place(
        Math.max(0, Math.round(w.x / state.cellPx) - Math.round(size.w / 2)),
        Math.max(0, Math.round(w.y / state.cellPx) - Math.round(size.h / 2)));
    } else if (!dragging) centerPlace();                               // 原地松手 = 视口中央
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function place(tid, cx, cy) {
  const m = createModule(tid, cx, cy);
  selMod(m.id);
  toast(t('已添加:', 'Added: ') + defName(DEFS[tid]) + t(' — 接口悬停可看说明', ' — hover the jacks for port info'));
  saveSoon();
}
