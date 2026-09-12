/* 组件工坊 · 设计清单与放置。
   两种设计统一存放在 designs 清单(左侧「我的组件」):
   · kind: 'panel'  控制面板组件(CompactPanel 规格,旧版兼容)
   · kind: 'macro'  宏组件(画布子图抽象,放置时展开全部内部组件与接线)
   定义一经注册不再更改(每次保存产生新 key)→ 依赖天然无环,禁止递归。 */

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
import { instantiateMacro, placeMacroAt, registerMacroDef } from './macros.js';
import { confirmDialog } from '../ui/window.js';
import { toast } from '../ui/toast.js';

export const designs = [];               // [{ key, spec, kind }]
const changeListeners = new Set();

export function onDesignsChanged(fn) { changeListeners.add(fn); }
function emitChanged() { for (const fn of changeListeners) fn(); }

export function registerDesign(key, spec) {
  const entry = { key, spec: JSON.parse(JSON.stringify(spec)), kind: 'panel' };
  const i = designs.findIndex(d => d.key === key);
  if (i >= 0) designs[i] = entry; else designs.push(entry);
  emitChanged();
}

export function addMacroDesign(key, spec) {
  const entry = { key, spec: JSON.parse(JSON.stringify(spec)), kind: 'macro' };
  const i = designs.findIndex(d => d.key === key);
  if (i >= 0) designs[i] = entry; else designs.push(entry);
  emitChanged();
}

export function removeDesign(key) {
  const i = designs.findIndex(d => d.key === key);
  if (i >= 0) designs.splice(i, 1);
  emitChanged();
}

/** 视口附近放置一个组件实例(vals: 控件初值,面板组件用) */
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

/** 我的组件条目点击:放置(面板 → 单模块;宏 → 展开整组组件) */
export async function placeDesign(key) {
  const entry = designs.find(d => d.key === key);
  if (!DEFS[key]) {
    if (entry && entry.kind === 'macro') registerMacroDef(key, entry.spec);
    else if (entry) mkCustomDef(key, entry.spec);
    else { toast('设计不存在'); return null; }
  }
  const d = DEFS[key];
  firstGesture();
  if (d.macro) {
    const r = viewport.getBoundingClientRect();
    const wx = (r.width / 2 - state.view.x) / state.view.s, wy = (r.height / 2 - state.view.y) / state.view.s;
    const cx = Math.max(0, Math.round(wx / state.cellPx) - Math.round(d.w / 2));
    const cy = Math.max(0, Math.round(wy / state.cellPx) - Math.round(d.h / 2));
    const box = await placeMacroAt(key, cx, cy);
    toast('已放置宏组件「' + d.spec.name + '」:内部组件与接线一并展开');
    selMod(box.id);
    return box;
  }
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
    const kindTag = d.kind === 'macro' ? 'MACRO' : 'CUSTOM';
    const it = document.createElement('div');
    it.className = 'pitem g-mine';
    it.innerHTML = `<span>${escHtml(d.spec.name)} <small style="opacity:.55">${kindTag}</small></span>` +
      `<span class="psz">${def ? def.w + '×' + (Math.round(def.h * 10) / 10) + ' 格' : ''}</span>`;
    it.title = '点击放置「' + d.spec.name + '」· 右键删除该设计';
    it.addEventListener('click', () => {
      firstGesture();
      placeDesign(d.key);
    });
    it.addEventListener('contextmenu', async e => {
      e.preventDefault(); e.stopPropagation();
      const ok = await deleteDesignByKey(d.key, d.spec.name);
      void ok;
    });
    host.appendChild(it);
  }
}
