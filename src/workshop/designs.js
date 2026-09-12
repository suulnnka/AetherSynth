/* 组件工坊 · 设计清单与放置。
   「我的组件」清单:工坊布局保存出的面板组件,可反复放置。 */

import { escHtml, $ } from '../core/utils.js';
import { state } from '../core/state.js';
import { DEFS } from '../core/registry.js';
import { createModule, deleteMod } from '../core/module.js';
import { selMod } from '../core/selection.js';
import { SINK_DEFS } from '../core/flow.js';
import { saveSoon } from '../core/save.js';
import { viewport } from '../core/view.js';
import { firstGesture } from '../core/audio.js';
import { mkCustomDef } from './custom-def.js';
import { confirmDialog } from '../ui/window.js';
import { toast } from '../ui/toast.js';
import { startPaletteDrag } from '../palette/index.js';
import { t } from '../core/i18n.js';

export const designs = [];               // [{ key, spec }]
const changeListeners = new Set();

export function onDesignsChanged(fn) { changeListeners.add(fn); }
function emitChanged() { for (const fn of changeListeners) fn(); }

export function registerDesign(key, spec) {
  const entry = { key, spec: JSON.parse(JSON.stringify(spec)) };
  const i = designs.findIndex(d => d.key === key);
  if (i >= 0) designs[i] = entry; else designs.push(entry);
  emitChanged();
}

export function removeDesign(key) {
  const i = designs.findIndex(d => d.key === key);
  if (i >= 0) designs.splice(i, 1);
  emitChanged();
}

/** 视口附近放置一个组件实例(vals: 控件初值) */
export function placeAtCenter(defKey, vals) {
  const d = DEFS[defKey];
  const r = viewport.getBoundingClientRect();
  const wx = (r.width / 2 - state.view.x) / state.view.s, wy = (r.height / 2 - state.view.y) / state.view.s;
  const cx = Math.max(0, Math.round(wx / state.cellPx) - Math.round(d.w / 2)) + (state.spawnN % 4) * 2;
  const cy = Math.max(0, Math.round(wy / state.cellPx) - Math.round(d.h / 2)) + (state.spawnN % 4) * 2;
  state.spawnN++;
  const m = createModule(defKey, cx, cy, null, vals ? { vals } : undefined);
  selMod(m.id);
  saveSoon();
  return m;
}

/** 我的组件条目点击:确保定义存在后放置 */
export function placeDesign(key) {
  const entry = designs.find(d => d.key === key);
  if (!DEFS[key]) {
    if (entry) mkCustomDef(key, entry.spec);
    else { toast('设计不存在'); return null; }
  }
  const d = DEFS[key];
  firstGesture();
  const vals = {};
  for (const c of (entry && entry.spec.cells) || []) if (c.value !== undefined) vals[c.id] = c.value;
  const m = createModule(key, 0, 0, null, vals ? { vals } : undefined);
  const r = viewport.getBoundingClientRect();
  const wx = (r.width / 2 - state.view.x) / state.view.s, wy = (r.height / 2 - state.view.y) / state.view.s;
  m.moveTo(
    Math.max(0, Math.round(wx / state.cellPx) - Math.round(d.w / 2)),
    Math.max(0, Math.round(wy / state.cellPx) - Math.round(d.h / 2)));
  selMod(m.id);
  toast('已放置:' + d.name);
  saveSoon();
  return m;
}

/** 删除设计:有实例时先经确认窗口,连同实例一起删除 */
export async function deleteDesignByKey(key, name) {
  const users = [...state.mods.values()].filter(m => m.def.id === key);
  if (users.length) {
    const ok = await confirmDialog({
      title: '删除设计',
      message: `「${name}」正被 ${users.length} 个组件使用,删除设计会连同删除它们。确定?`,
      okLabel: '删除', danger: true
    });
    if (!ok) return false;
  }
  users.forEach(m => deleteMod(m.id));
  delete DEFS[key];
  delete SINK_DEFS[key];
  removeDesign(key);
  saveSoon();
  toast('已删除设计:' + name);
  return true;
}

/** 反序列化时重建清单(定义由调用方先行注册) */
export function restoreDesigns(list) {
  designs.length = 0;
  for (const d of (list || [])) {
    if (!d || !d.key || !d.spec) continue;
    designs.push({ key: d.key, spec: d.spec });
  }
  emitChanged();
}

/** 左侧「我的组件」清单渲染(设计新增 / 删除时自动刷新) */
export function refreshMine() {
  const host = $('#palmine');
  host.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'pgroup g-mine';
  head.textContent = '我的组件 MINE';
  head.style.display = designs.length ? '' : 'none';
  host.appendChild(head);
  for (const d of designs) {
    const def = DEFS[d.key];
    const it = document.createElement('div');
    it.className = 'pitem g-mine';
    it.innerHTML = `<span>${escHtml(d.spec.name)} <small style="opacity:.55">CUSTOM</small></span>` +
      `<span class="psz">${def ? def.w + '×' + (Math.round(def.h * 10) / 10) + ' 格' : ''}</span>`;
    it.title = t('拖拽或点击放置「', 'Drag or click to place "') + d.spec.name + t('」· 右键删除该设计', '" · right-click to delete the design');
    it.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      firstGesture();
      if (!DEFS[d.key]) mkCustomDef(d.key, d.spec);
      const def = DEFS[d.key];
      const vals = {};
      for (const c of d.spec.cells) if (c.value !== undefined) vals[c.id] = c.value;
      startPaletteDrag(e, def, d.spec.name, (cx, cy) => {
        const m = createModule(d.key, cx, cy, null, Object.keys(vals).length ? { vals } : undefined);
        selMod(m.id);
        toast(t('已放置:', 'Placed: ') + d.spec.name);
        saveSoon();
      });
    });
    it.addEventListener('contextmenu', async e => {
      e.preventDefault(); e.stopPropagation();
      const users = [...state.mods.values()].filter(m => m.def.id === d.key);
      if (users.length) {
        const ok = await confirmDialog({
          title: '删除设计',
          message: `「${d.spec.name}」正被 ${users.length} 个组件使用,删除设计会连同删除它们。确定?`,
          okLabel: '删除', danger: true
        });
        if (!ok) return;
      }
      users.forEach(m => deleteMod(m.id));
      delete DEFS[d.key];
      delete SINK_DEFS[d.key];
      removeDesign(d.key);
      saveSoon();
      toast('已删除设计:' + d.spec.name);
    });
    host.appendChild(it);
  }
}
