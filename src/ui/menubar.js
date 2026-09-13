/* 顶栏菜单栏:文件 / 编辑 / 视图 / 选项 / 歌曲 / 帮助。
   · 点击菜单名展开下拉;悬停可切换;点击外部 / Esc 关闭(closeMenu)
   · 下拉每次打开时重建,勾选状态(✓)总是反映当前设置
   · 功能动作复用各层已有模块,这里只做装配 */

import { $ } from '../core/utils.js';
import { state } from '../core/state.js';
import { getCtx, firstGesture } from '../core/audio.js';
import { viewport, fitView, zoomAt } from '../core/view.js';
import { serialize, clearAll, deserialize } from '../core/serialize.js';
import { setSampleRate, currentRate } from '../core/engine.js';
import { encapsulateSelected } from '../core/composite.js';
import { duplicateMod, deleteModWithConfirm } from '../core/module.js';
import { saveSoon } from '../core/save.js';
import { demoPatch } from '../songs/demo.js';
import { CLASSIC_PIECES } from '../songs/classic-synth-songs.js';
import { TEARDOWN_DEMO } from '../songs/classic-teardown.js';
import { FM_DEMO } from '../songs/fm.js';
import { CHIP_DEMO } from '../songs/chip.js';
import { KALINKA_DEMO } from '../songs/kalinka.js';
import { SONGS } from '../songs/data.js';
import { loadSong } from '../songs/player.js';
import { toggleStudio, isStudioVisible } from '../workshop/studio.js';
import { t, setLang, isZh, itemName } from '../core/i18n.js';
import { openHelp } from './help.js';
import { confirmDialog } from './window.js';
import { toast } from './toast.js';
import { updateStatus } from './statusbar.js';

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
    title: t('清空画布', 'Clear Canvas'),
    message: t('将移除画布上的所有组件和线缆,确定?',
               'This will remove all modules and cables on the canvas. Continue?'),
    okLabel: t('清空', 'Clear'), danger: true
  });
  if (!ok) return;
  clearAll();
  saveSoon();
  toast(t('画布已清空', 'Canvas cleared'));
};

const exportPatch = () => {
  const blob = new Blob([JSON.stringify(serialize(), null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'aethersynth-config.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
};

const MENUS = [
  { label: t('文件', 'File'), items: [
    { label: t('导入画布…', 'Import patch…'), hint: t('从文件恢复', 'from a file'), action: () => $('#filein').click() },
    { label: t('导出画布', 'Export patch'), hint: t('存为文件', 'save to file'), action: exportPatch },
    { sep: true },
    { label: t('清空画布…', 'Clear canvas…'), danger: true, action: clearCanvas }
  ]},
  { label: t('编辑', 'Edit'), items: [
    { label: t('复制选中组件', 'Duplicate selection'), hint: 'Ctrl+D', action: () => { if (state.sel != null) duplicateMod(state.sel); } },
    { label: t('删除选中组件', 'Delete selection'), hint: 'Del', action: deleteSelected },
    { sep: true },
    { label: t('封装为组合', 'Encapsulate as composite'), hint: t('先 Shift 多选', 'Shift-select first'), action: () => { firstGesture(); encapsulateSelected(); } }
  ]},
  { label: t('视图', 'View'), items: [
    { label: t('放大', 'Zoom in'), action: () => zoomCenter(1.25) },
    { label: t('缩小', 'Zoom out'), action: () => zoomCenter(1 / 1.25) },
    { label: t('适应视图', 'Fit view'), action: fitView },
    { sep: true },
    { label: t('组件工坊', 'Component workshop'), checked: () => isStudioVisible(), action: toggleStudio }
  ]},
  { label: t('选项', 'Options'), items: [
    { group: t('采样率(切换重建引擎)', 'Sample rate (switching rebuilds the engine)') },
    ...RATES.map(([v, label]) => ({
      label, checked: () => currentRate() === v,
      action: () => { firstGesture(); setSampleRate(v); }
    })),
    { sep: true },
    { label: t('音频电源', 'Audio power'), checked: () => getCtx().state === 'running', action: togglePower }
  ]},
  { label: t('歌曲', 'Songs'), items: [
    { label: t('演示音色', 'Demo patch'), action: () => { firstGesture(); demoPatch(); } },
    { sep: true },
    ...SONGS.map(s => ({
      label: `${itemName(s)} · ${s.bpm} BPM`,
      action: () => { firstGesture(); loadSong(s.id); }
    })),
    { sep: true },
    ...CLASSIC_PIECES.map(p => ({
      label: itemName(p),
      action: () => { firstGesture(); p.build(); }
    })),
    { label: itemName(TEARDOWN_DEMO), action: () => { firstGesture(); TEARDOWN_DEMO.build(); } },
    { label: itemName(FM_DEMO), action: () => { firstGesture(); FM_DEMO.build(); } },
    { label: itemName(CHIP_DEMO), action: () => { firstGesture(); CHIP_DEMO.build(); } },
    { label: itemName(KALINKA_DEMO), action: () => { firstGesture(); KALINKA_DEMO.build(); } }
  ]},
  { label: t('语言', 'Language'), items: [
    { label: '中文(简体)', checked: () => isZh(), action: () => setLang('zh') },
    { label: 'English', checked: () => !isZh(), action: () => setLang('en') }
  ]},
  { label: t('帮助', 'Help'), items: [
    { label: t('使用帮助', 'User guide'), action: () => openHelp() }
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
  // 右上角 GitHub 图标:新标签页打开本仓库
  const gh = document.createElement('a');
  gh.className = 'mb-gh';
  gh.href = 'https://github.com/suulnnka/AetherSynth';
  gh.target = '_blank';
  gh.rel = 'noopener';
  gh.title = t('GitHub 仓库', 'GitHub repository');
  gh.innerHTML =
    '<svg viewBox="0 0 16 16" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2-.82-.6.17-1.25.26-2 .26s-1.4-.09-2-.26c-1.53.6-2.2.82-2.2.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>';
  bar.appendChild(gh);
  // 点击菜单栏以外关闭
  document.addEventListener('pointerdown', e => {
    if (openIndex >= 0 && !e.target.closest('.mb-drop') && !e.target.closest('.mb-root')) closeMenu();
  });
  // 导入配置:菜单触发文件选择框
  $('#filein').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        deserialize(JSON.parse(rd.result));
        fitView();
        toast(t('画布已导入', 'Patch imported'));
      } catch (err) { toast(t('导入失败:', 'Import failed: ') + err.message); }
    };
    rd.readAsText(f);
    e.target.value = '';
  });
}
