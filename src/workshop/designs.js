/* 组件工坊 · 设计清单与放置:设计注册 / 画布放置 / 再编辑 / 更新。
   设计(designs)持久化在补丁 JSON 里;放置后的组件通过 def key 引用定义。 */

import { $, escHtml } from '../core/utils.js';
import { state } from '../core/state.js';
import { DEFS } from '../core/registry.js';
import { createModule, deleteMod } from '../core/module.js';
import { addCable } from '../core/cables.js';
import { SINK_DEFS } from '../core/flow.js';
import { saveSoon } from '../core/save.js';
import { viewport } from '../core/view.js';
import { firstGesture } from '../core/audio.js';
import { mkCustomDef, newCustomKey } from './custom-def.js';
import { loadDesignIntoStudio, setPlaceMode, ensureStudioVisible, isEditMode } from './studio.js';
import { confirmDialog } from '../ui/window.js';
import { toast } from '../ui/toast.js';

export const designs = [];          // [{ key, spec }]
let studioEditId = null;            // 非 null = 正在修改画布上的这个自制组件
let placedSnap = null, placedKey = null;
const changeListeners = new Set();

export function onDesignsChanged(fn) { changeListeners.add(fn); }
function emitChanged() { for (const fn of changeListeners) fn(); }

/** 结构快照(不含各格当前值):判断设计是否变化,不变则复用同一组件定义 */
function specSnap(spec) {
  return JSON.stringify({ ...spec, cells: spec.cells.map(c => { const { value, ...rest } = c; return rest; }) });
}

export function registerDesign(key, spec) {
  const entry = { key, spec: JSON.parse(JSON.stringify(spec)) };
  const i = designs.findIndex(d => d.key === key);
  if (i >= 0) designs[i] = entry; else designs.push(entry);
  emitChanged();
}

export function removeDesign(key) {
  const i = designs.findIndex(d => d.key === key);
  if (i >= 0) designs.splice(i, 1);
  if (placedKey === key) { placedSnap = null; placedKey = null; }
  emitChanged();
}

/** 视口中央放置一个组件(自动错位),返回实例 */
export function placeAtCenter(defKey, vals) {
  const d = DEFS[defKey];
  const r = viewport.getBoundingClientRect();
  const wx = (r.width / 2 - state.view.x) / state.view.s, wy = (r.height / 2 - state.view.y) / state.view.s;
  const cx = Math.max(0, Math.round(wx / state.cellPx) - Math.round(d.w / 2)) + (state.spawnN % 4) * 2;
  const cy = Math.max(0, Math.round(wy / state.cellPx) - Math.round(d.h / 2)) + (state.spawnN % 4) * 2;
  state.spawnN++;
  const m = createModule(defKey, cx, cy, null, vals ? { vals } : undefined);
  saveSoon();
  return m;
}

/** 工坊当前设计 → 画布上的新组件(结构未变时复用同一 def) */
export function placeFromStudio(panel) {
  const spec = panel.spec();
  if (!spec.cells.length) { toast('先用「＋旋钮 / ＋推子…」添加控件,再放置'); return null; }
  const snap = specSnap(spec);
  let key = snap === placedSnap ? placedKey : null;
  if (!key || !DEFS[key]) {
    key = newCustomKey();
    mkCustomDef(key, spec);
    registerDesign(key, spec);
    placedSnap = snap; placedKey = key;
  }
  const vals = {};
  for (const c of spec.cells) if (c.value !== undefined) vals[c.id] = c.value;
  const m = placeAtCenter(key, vals);
  toast('已放置「' + spec.name + '」:控件 = 真实 3.5mm 接口;设计存入「我的组件」');
  return m;
}

/** 右键自制组件 = 载回工坊修改 */
export function editCustom(mod) {
  firstGesture();
  studioEditId = mod.id;
  placedSnap = null;
  loadDesignIntoStudio(mod.def.design, mod.state.vals);
  setPlaceMode(true);
  ensureStudioVisible();
  toast('正在修改「' + mod.def.name + '」,改完点「更新组件」');
}

/** 「更新组件」:原位重建并恢复仍存在的接线 */
export function updateEdited(panel) {
  const mod = state.mods.get(studioEditId);
  if (!mod || !mod.def.custom) {
    studioEditId = null;
    setPlaceMode(false);
    return placeFromStudio(panel);
  }
  const spec = panel.spec();
  if (!spec.cells.length) { toast('至少保留一个控件'); return null; }
  const oldKey = mod.def.id;
  const oldConns = [...state.cables.values()].map(c => {
    if (c.a.m === mod.id) return { out: true, p: c.a.p, far: { m: c.b.m, p: c.b.p }, color: c.color };
    if (c.b.m === mod.id) return { out: false, p: c.b.p, far: { m: c.a.m, p: c.a.p }, color: c.color };
    return null;
  }).filter(Boolean);
  const cx = mod.cx, cy = mod.cy, id = mod.id, vals = { ...mod.state.vals };
  studioEditId = null;
  setPlaceMode(false);
  deleteMod(id);                                    // 连带静默移除旧接线
  const key = newCustomKey();
  mkCustomDef(key, spec);
  registerDesign(key, spec);
  const oldStillUsed = [...state.mods.values()].some(m => m.def.id === oldKey);
  if (!oldStillUsed) removeDesign(oldKey);          // 旧设计没有别的实例时才从清单移除
  const m = createModule(key, cx, cy, id, { vals });
  for (const oc of oldConns) {
    if (!m.def.portsById[oc.p]) continue;           // 控件已被删掉,对应接线随之舍弃
    if (oc.out) addCable(m.id, oc.p, oc.far.m, oc.far.p, oc.color);
    else addCable(oc.far.m, oc.far.p, m.id, oc.p, oc.color);
  }
  saveSoon();
  toast('已更新「' + spec.name + '」(被删除控件的接线已移除)');
  return m;
}

export function exitEditMode() { studioEditId = null; setPlaceMode(false); }

/** 反序列化后调用:放置快照失效,避免指向已被替换的定义 */
export function resetPlacedSnapshot() { placedSnap = null; placedKey = null; }

/** 「放置组件 / 更新组件」按钮 */
export function initPlaceButton(getPanel) {
  $('#cpplace').addEventListener('click', () => {
    firstGesture();
    const panel = getPanel();
    if (isEditMode()) updateEdited(panel);
    else placeFromStudio(panel);
  });
}

/* ---------------- 左侧「我的组件」:设计清单 ---------------- */
export function refreshMine() {
  const host = document.getElementById('palmine');
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
    it.title = '点击放置「' + d.spec.name + '」· 右键删除该设计';
    it.addEventListener('click', () => {
      firstGesture();
      if (!DEFS[d.key]) mkCustomDef(d.key, d.spec);
      placeAtCenter(d.key);
      toast('已放置:' + d.spec.name);
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
