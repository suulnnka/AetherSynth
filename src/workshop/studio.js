/* 组件工坊 · 面板宿主:实例化 CompactPanel,接线「＋控件」工具栏、
   控件属性检查器、外观与尺寸设置。放置 / 更新按钮的语义(放置 or
   更新画布上的组件)由 designs.js 决定,这里只负责设计台本身。 */

import { $, clamp } from '../core/utils.js';
import { state } from '../core/state.js';
import { firstGesture } from '../core/audio.js';
import { saveSoon } from '../core/save.js';
import { CompactPanel } from './panel.js';
import { toast } from '../ui/toast.js';

let panel = null;
let editMode = false;

export function studioPanel() { return panel; }
export function isStudioVisible() { return panel && !$('#ctrlpanel').classList.contains('hidden'); }

export function initStudio() {
  panel = new CompactPanel(document.getElementById('ctrlhost'), {
    name: '我的组件', cols: 3, span: 3, cell: state.cellPx,
    onChange: () => saveSoon(),
    onCellSelect: id => syncInspector(id)
  });
  panel.onResize = syncStudioMetrics;
  syncStudioMetrics();

  $('#ctrlbtn').addEventListener('click', toggleStudio);

  // ＋控件:往设计里添加一个控制格
  document.querySelectorAll('#cptoobar .cpadd').forEach(btn => btn.addEventListener('click', () => {
    firstGesture();
    if (panel.cellIds().length >= 16) { toast('一个组件最多 16 个控件'); return; }
    const n = panel.cellIds().length + 1;
    const seed = {
      knob: { kind: 'knob', label: '旋钮' + n, min: 0, max: 10, value: 5 },
      fader: { kind: 'fader', label: '推子' + n, min: 0, max: 10, value: 5 },
      switch: { kind: 'switch', label: '开关' + n, value: false },
      meter: { kind: 'meter', label: '电压表' + n }
    }[btn.dataset.add];
    panel.selectCell(panel.addCell(seed));
  }));

  // 控件属性检查器
  $('#cpilabel').addEventListener('input', () => {
    if (panel.selId) panel.updateCell(panel.selId, { label: $('#cpilabel').value });
  });
  const applyRange = () => {
    if (!panel.selId) return;
    let min = +$('#cpimin').value, max = +$('#cpimax').value;
    if (!isFinite(min)) min = 0;
    if (!isFinite(max)) max = 10;
    if (max <= min) max = min + 1;
    panel.updateCell(panel.selId, { min, max });
  };
  $('#cpimin').addEventListener('change', applyRange);
  $('#cpimax').addEventListener('change', applyRange);
  $('#cpinote').addEventListener('change', e => {
    if (!panel.selId) return;
    if (e.target.checked) panel.updateCell(panel.selId, {
      note: true, min: 0, max: 1, steps: Array.from({ length: 13 }, (_, i) => i / 12)
    });
    else panel.updateCell(panel.selId, { note: false, steps: undefined });
    syncInspector(panel.selId);
  });
  $('#cpinspectx').addEventListener('click', () => panel.selectCell(null));

  // 外观与尺寸
  $('#cpthemebtn').addEventListener('click', () => {
    $('#cptheme').classList.toggle('hidden');
    syncThemeControls(panel.getTheme());
  });
  [['cpbgtype', 'change'], ['cpbgc', 'input'], ['cpangle', 'input'], ['cpg1', 'input'],
   ['cpg2', 'input'], ['cpg3', 'input'], ['cpg4', 'input'], ['cpimgurl', 'change'],
   ['cpwidget', 'change'], ['cpaccent', 'input'], ['cptext', 'input'],
   ['cpcols', 'change'], ['cpspan', 'change']]
    .forEach(([id, ev]) => document.getElementById(id)
      .addEventListener(ev, () => {
        if (id === 'cpcols' || id === 'cpspan') applyPanelSizeFromControls();
        else applyPanelThemeFromControls();
      }));
  document.getElementById('cpimgfile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { $('#cpimgurl').value = rd.result; applyPanelThemeFromControls(); };
    rd.readAsDataURL(f);
    e.target.value = '';
  });
}

export function toggleStudio() {
  const el = $('#ctrlpanel');
  el.classList.toggle('hidden');
  $('#ctrlbtn').classList.toggle('on', !el.classList.contains('hidden'));
  if (!el.classList.contains('hidden') && panel) panel.tick();
}

export function ensureStudioVisible() {
  if ($('#ctrlpanel').classList.contains('hidden')) toggleStudio();
}

/** 面板 / 预览随格距与设计尺寸变化 */
export function syncStudioMetrics() {
  if (!panel) return;
  panel.setMetrics({ cell: state.cellPx });
  const wpx = panel.cols * panel.span * state.cellPx + 18;
  $('#ctrlpanel').style.width = wpx + 'px';
  $('#ctrlpanel').style.flexBasis = wpx + 'px';
}

/* ---------------- 控件属性检查器 ---------------- */
export function syncInspector(id) {
  const box = $('#cpinspect');
  const cfg = id ? panel.cellCfg(id) : null;
  box.classList.toggle('hidden', !cfg);
  if (!cfg) return;
  $('#cpilabel').value = cfg.label || '';
  const ranged = cfg.kind === 'knob' || cfg.kind === 'fader';
  $('#cpirange').style.display = ranged ? 'flex' : 'none';
  $('#cpinotel').style.display = cfg.kind === 'knob' ? '' : 'none';
  if (ranged) { $('#cpimin').value = cfg.min ?? 0; $('#cpimax').value = cfg.max ?? 10; }
  if (cfg.kind === 'knob') $('#cpinote').checked = !!cfg.note;
}

/* ---------------- 外观与尺寸设置 ---------------- */
function currentPanelThemeFromControls() {
  const type = $('#cpbgtype').value;
  let bg;
  if (type === 'gradient') {
    bg = { type: 'gradient', angle: +$('#cpangle').value,
           stops: [$('#cpg1').value, $('#cpg2').value, $('#cpg3').value, $('#cpg4').value] };
  } else if (type === 'image') {
    const url = $('#cpimgurl').value.trim();
    bg = url ? { type: 'image', image: url } : { type: 'solid', color: '#f7f8fa' };
  } else {
    bg = { type: 'solid', color: $('#cpbgc').value };
  }
  return { bg, widget: $('#cpwidget').value, accent: $('#cpaccent').value, text: $('#cptext').value };
}

export function syncThemeControls(t) {
  const bg = t.bg || {};
  const setV = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
  const setT = (id, cls, on) => { const e = document.getElementById(id); if (e) e.classList.toggle(cls, on); };
  setV('cpbgtype', bg.type || 'solid');
  setV('cpbgc', bg.color || '#f7f8fa');
  setV('cpangle', bg.angle != null ? bg.angle : 135);
  const st = bg.stops || ['#a1c4fd', '#c2e9fb', '#e2d4ac', '#d9c493'];
  ['cpg1', 'cpg2', 'cpg3', 'cpg4'].forEach((id, i) => setV(id, st[i] || st[st.length - 1]));
  setV('cpimgurl', bg.image || '');
  setV('cpwidget', t.widget || 'dark');
  setV('cpaccent', t.accent || '#ffb01f');
  setV('cptext', t.text || '#2b3138');
  setT('cpbgsolid', 'hidden', bg.type !== 'solid');
  setT('cpbggrad', 'hidden', bg.type !== 'gradient');
  setT('cpbgimg', 'hidden', bg.type !== 'image');
  setV('cpcols', panel.cols);
  setV('cpspan', panel.span);
}

function applyPanelThemeFromControls() {
  panel.setTheme(currentPanelThemeFromControls());
  saveSoon();
}

function applyPanelSizeFromControls() {
  panel.setMetrics({ span: clamp(+$('#cpspan').value || 3, 2, 5), cols: clamp(+$('#cpcols').value || 3, 1, 6) });
  syncStudioMetrics();
  saveSoon();
}

/* ---------------- 放置 / 更新模式(designs.js 调用) ---------------- */
export function setPlaceMode(editing) {
  editMode = editing;
  $('#cpplace').textContent = editing ? '⬆ 更新组件' : '⬇ 放置组件';
}

export function isEditMode() { return editMode; }

/** 载入一个设计到面板(进入修改) */
export function loadDesignIntoStudio(spec, vals) {
  panel.loadSpec(JSON.parse(JSON.stringify(spec)), vals);
  syncThemeControls(panel.getTheme());
}
