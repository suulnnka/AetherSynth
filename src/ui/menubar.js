/* 顶栏菜单栏:文件 / 编辑 / 视图 / 选项 / 歌曲 / 帮助。
   · 点击菜单名展开下拉;悬停可切换;点击外部 / Esc 关闭(closeMenu)
   · 下拉每次打开时重建,勾选状态(✓)总是反映当前设置
   · 功能动作复用各层已有模块,这里只做装配 */

import { $ } from '../core/utils.js';
import { state } from '../core/state.js';
import { getCtx, firstGesture } from '../core/audio.js';
import { viewport, setCellSize, fitView, zoomAt } from '../core/view.js';
import { serialize, clearAll, deserialize } from '../core/serialize.js';
import { setSampleRate, currentRate } from '../core/engine.js';
import { encapsulateSelected } from '../core/composite.js';
import { duplicateMod, deleteModWithConfirm } from '../core/module.js';
import { saveSoon } from '../core/save.js';
import { demoPatch } from '../songs/demo.js';
import { SONGS } from '../songs/data.js';
import { loadSong } from '../songs/player.js';
import { toggleStudio, isStudioVisible } from '../workshop/studio.js';
import { openHelp } from './help.js';
import { confirmDialog } from './window.js';
import { toast } from './toast.js';
import { updateStatus } from './statusbar.js';

const CELL_SIZES = [[16, '细 16'], [20, '中 20'], [24, '宽 24'], [32, '特宽 32']];
const RATES = [[16000, '16 kHz'], [32000, '32 kHz'], [44100, '44.1 kHz'], [48000, '48 kHz'], [96000, '96 kHz']];

const zoomCenter = f => {
  const r = viewport.getBoundingClientRect();
  zoomAt(r.width / 2, r.height / 2, state.view.s * f);
};

const togglePower = () => {
  const c = getCtx();
  if (c.state === 'running') c.suspend(); else c.resume();
  updateStatus();
};

const deleteSelected = async () => {
  for (const id of [...state.selSet]) await deleteModWithConfirm(id);
};

const clearCanvas = async () => {
  const ok = await confirmDialog({
    title: '清空画布',
    message: '将移除画布上的所有组件和线缆,确定?',
    okLabel: '清空', danger: true
  });
  if (!ok) return;
  clearAll();
  saveSoon();
  toast('画布已清空');
};

const exportPatch = () => {
  const blob = new Blob([JSON.stringify(serialize(), null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gridmod-patch.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
};

const MENUS = [
  { label: '文件', items: [
    { label: '导入补丁…', action: () => $('#filein').click() },
    { label: '导出补丁', action: exportPatch },
    { sep: true },
    { label: '清空画布…', danger: true, action: clearCanvas }
  ]},
  { label: '编辑', items: [
    { label: '复制选中组件', hint: 'Ctrl+D', action: () => { if (state.sel != null) duplicateMod(state.sel); } },
    { label: '删除选中组件', hint: 'Del', action: deleteSelected },
    { sep: true },
    { label: '封装为组合', hint: '先 Shift 多选', action: () => { firstGesture(); encapsulateSelected(); } }
  ]},
  { label: '视图', items: [
    { label: '放大', action: () => zoomCenter(1.25) },
    { label: '缩小', action: () => zoomCenter(1 / 1.25) },
    { label: '适应视图', action: fitView },
    { sep: true },
    { label: '组件工坊', checked: () => isStudioVisible(), action: toggleStudio }
  ]},
  { label: '选项', items: [
    { group: '格距(每格像素)' },
    ...CELL_SIZES.map(([v, label]) => ({
      label, checked: () => state.cellPx === v,
      action: () => { setCellSize(v); fitView(); saveSoon(); }
    })),
    { sep: true },
    { group: '采样率(切换重建引擎)' },
    ...RATES.map(([v, label]) => ({
      label, checked: () => currentRate() === v,
      action: () => { firstGesture(); setSampleRate(v); }
    })),
    { sep: true },
    { label: '音频电源', checked: () => getCtx().state === 'running', action: togglePower }
  ]},
  { label: '歌曲', items: [
    { label: '演示音色', action: () => { firstGesture(); demoPatch(); } },
    { sep: true },
    ...SONGS.map(s => ({
      label: `${s.name} · ${s.bpm} BPM`,
      action: () => { firstGesture(); loadSong(s.id); }
    }))
  ]},
  { label: '帮助', items: [
    { label: '使用帮助', action: () => openHelp() }
  ]}
];

let openIndex = -1;      // 当前展开的菜单下标,-1 = 全部关闭
let dropEl = null;

export function hasOpenMenu() { return openIndex >= 0; }

export function closeMenu() {
  if (openIndex < 0) return false;
  openIndex = -1;
  if (dropEl) { dropEl.remove(); dropEl = null; }
  document.querySelectorAll('#menubar .mb-root.open').forEach(x => x.classList.remove('open'));
  return true;
}

function openDropdown(index) {
  closeMenu();
  openIndex = index;
  const root = document.querySelectorAll('#menubar .mb-root')[index];
  root.classList.add('open');
  dropEl = document.createElement('div');
  dropEl.className = 'mb-drop';
  for (const item of MENUS[index].items) {
    if (item.sep) {
      dropEl.appendChild(Object.assign(document.createElement('div'), { className: 'mb-sep' }));
      continue;
    }
    if (item.group) {
      const g = document.createElement('div');
      g.className = 'mb-group';
      g.textContent = item.group;
      dropEl.appendChild(g);
      continue;
    }
    const it = document.createElement('div');
    it.className = 'mb-item' + (item.danger ? ' danger' : '');
    const mark = document.createElement('span');
    mark.className = 'mb-check';
    mark.textContent = '✓';
    if (!item.checked || !item.checked()) mark.style.visibility = 'hidden';
    it.appendChild(mark);
    const label = document.createElement('span');
    label.textContent = item.label;
    it.appendChild(label);
    if (item.hint) {
      const hint = document.createElement('span');
      hint.className = 'mb-hint';
      hint.textContent = item.hint;
      it.appendChild(hint);
    }
    it.addEventListener('click', () => {
      closeMenu();
      item.action();
    });
    dropEl.appendChild(it);
  }
  // 定位到菜单名下方
  const r = root.getBoundingClientRect();
  dropEl.style.left = r.left + 'px';
  dropEl.style.top = r.bottom + 'px';
  document.body.appendChild(dropEl);
}

export function initMenuBar() {
  const bar = $('#menubar');
  MENUS.forEach((m, i) => {
    const root = document.createElement('div');
    root.className = 'mb-root';
    root.textContent = m.label;
    root.addEventListener('click', e => {
      e.stopPropagation();
      openIndex === i ? closeMenu() : openDropdown(i);
    });
    root.addEventListener('mouseenter', () => { if (openIndex >= 0 && openIndex !== i) openDropdown(i); });
    bar.appendChild(root);
  });
  // 点击菜单栏以外关闭
  document.addEventListener('pointerdown', e => {
    if (openIndex >= 0 && !e.target.closest('.mb-drop') && !e.target.closest('.mb-root')) closeMenu();
  });
  // 导入补丁:菜单触发文件选择框
  $('#filein').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        deserialize(JSON.parse(rd.result));
        fitView();
        toast('补丁已导入');
      } catch (err) { toast('导入失败:' + err.message); }
    };
    rd.readAsText(f);
    e.target.value = '';
  });
}
