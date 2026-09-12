/* 组件工坊 · UI 布局编辑器。
   ---------------------------------------------------------------------
   · 右侧面板是一张 cols × rows 的格网画布,元素(旋钮 / 推子 / 开关 /
     电压表)按格摆放,可拖拽移动(自动吸附格子)、可选中编辑属性
     (名称 / 宽高 / 样式 / 量程)。
   · 画布上的组件 / 接口可通过右键菜单「发送到工坊」进入这里:
     发送输入口 = 注入旋钮(把电压送进该口)、
     发送输出口 = 电压表(监视该口信号)、
     发送控制类组件(旋钮 / 推子 / 开关)= 镜像控制。
   · 「保存为新组件」把布局存入左侧「我的组件」;
     「放置组件」同时放置一个实例。放置后的组件:每个未绑定控件是
     一路 3.5mm 接口,绑定元素直接操控 / 监视画布上的源端口。 */

import { $, clamp } from '../core/utils.js';
import { t } from '../core/i18n.js';
import { state } from '../core/state.js';
import { firstGesture } from '../core/audio.js';
import { saveSoon } from '../core/save.js';
import { registerDesign, placeAtCenter } from './designs.js';
import { mkCustomDef, newCustomKey } from './custom-def.js';
import { makeCell, snapPlacement } from './layout.js';
import { toast } from '../ui/toast.js';

const ECS = 24;                       // 编辑器每格像素
const layout = { name: '我的面板', cols: 8, rows: 6, cells: [] };

/* 面板静态文案:按当前语言改写 index.html 里的工坊面板文字 */
export function applyStudioLang() {
  const add = { knob: ['＋旋钮', '+ Knob', t('添加旋钮元素(放置后 = 一路 CV 输出口)', 'Add a knob element (placed = one CV output)')],
    fader: ['＋推子', '+ Fader', t('添加推子元素(放置后 = 一路 CV 输出口)', 'Add a fader element (placed = one CV output)')],
    switch: ['＋开关', '+ Switch', t('添加开关元素(放置后 = 一路门输出口)', 'Add a switch element (placed = one gate output)')],
    meter: ['＋电压表', '+ Meter', t('添加电压表(放置后 = 一路信号输入口)', 'Add a meter (placed = one signal input)')] };
  document.querySelectorAll('.cpadd').forEach(b => {
    const [zh, en, ti] = add[b.dataset.add];
    b.textContent = t(zh, en); b.title = ti;
  });
  const put = (sel, txt) => { const e = document.querySelector(sel); if (e) e.textContent = txt; };
  put('.cplabel', t('元素属性', 'Element'));
  const sx = document.getElementById('cppropsx'); if (sx) sx.title = t('关闭', 'Close');
  const rowLabel = (crow, zh, en) => {
    const row = document.querySelector(crow);
    if (!row) return;
    for (const n of [...row.childNodes])
      if (n.nodeType === 3 && n.textContent.trim() === zh) { n.textContent = ' ' + en + ' '; break; }
  };
  rowLabel('#cpprops .crow:nth-of-type(2)', '名称', 'Name');
  rowLabel('#cpirange', '范围', 'Range');
  const styleSel = document.getElementById('cpistyle');
  if (styleSel) for (const o of styleSel.options)
    o.textContent = t({ dark: '深色', silver: '银色', neon: '霓虹', retro: '复古', minimal: '极简' }[o.value],
      { dark: 'Dark', silver: 'Silver', neon: 'Neon', retro: 'Retro', minimal: 'Minimal' }[o.value]);
  const sizebar = document.getElementById('cpsizebar');
  if (sizebar) {
    const n1 = sizebar.childNodes[0], n2 = [...sizebar.childNodes].find(n => n.nodeType === 3 && n.textContent.includes('列'));
    const n3 = [...sizebar.childNodes].find(n => n.nodeType === 3 && n.textContent.includes('行'));
    if (n1) n1.textContent = t('面板尺寸', 'Panel size ');
    if (n2) n2.textContent = t(' 列 × ', ' cols × ');
    if (n3) n3.textContent = t(' 行', ' rows');
  }
  const nm = document.getElementById('cpmname');
  const nmLabel = nm ? nm.previousSibling : null;
  if (nmLabel && nmLabel.nodeType === 3) nmLabel.textContent = t('面板名称 ', 'Panel name ');
  if (nm && nm.value === '我的面板') nm.value = t('我的面板', 'My Panel');
  const sv = document.getElementById('cpsave');
  if (sv) { sv.textContent = t('保存设计', 'Save design'); sv.title = t('把布局存入左侧「我的组件」', 'Save the layout under MINE on the left'); }
  const pl = document.getElementById('cpplace');
  if (pl) { pl.textContent = t('⬇ 放置组件', '⬇ Place module'); pl.title = t('保存并放置一个实例到画布', 'Save and place an instance on the canvas'); }
  const pr = document.getElementById('cppropsx');
  void pr;
}
let selId = null;

export function initStudio() {
  document.querySelectorAll('#cptoobar .cpadd').forEach(btn => btn.addEventListener('click', () => {
    firstGesture();
    addCell(btn.dataset.add);
  }));
  $('#cpcols').value = layout.cols;
  $('#cprows').value = layout.rows;
  $('#cpcols').addEventListener('change', () => {
    layout.cols = clamp(+$('#cpcols').value || 8, 2, 16);
    $('#cpcols').value = layout.cols;
    render();
  });
  $('#cprows').addEventListener('change', () => {
    layout.rows = clamp(+$('#cprows').value || 6, 2, 24);
    $('#cprows').value = layout.rows;
    render();
  });
  $('#cpsave').addEventListener('click', () => { firstGesture(); saveDesign(); });
  $('#cpplace').addEventListener('click', () => { firstGesture(); placeCurrent(); });
  wireInspector();
  render();
}

export function isStudioVisible() { return !$('#ctrlpanel').classList.contains('hidden'); }

export function toggleStudio() { $('#ctrlpanel').classList.toggle('hidden'); }

export function ensureStudioVisible() { $('#ctrlpanel').classList.remove('hidden'); }

/* ---------------- 添加元素 ---------------- */
function addCell(kind) {
  if (layout.cells.length >= 24) { toast('一个面板最多 24 个元素'); return; }
  const names = { knob: '旋钮', fader: '推子', switch: '开关', meter: '电压表' };
  const defaults = {
    knob: { w: 2, h: 2, value: 5 },
    fader: { w: 1, h: 3, value: 5 },
    switch: { w: 2, h: 1, value: false },
    meter: { w: 1, h: 3 }
  }[kind];
  const n = layout.cells.length + 1;
  const cell = makeCell(kind, { ...defaults, label: names[kind] + n });
  const spot = snapPlacement(layout.cells, cell, 0, 0, layout.cols, layout.rows);
  cell.col = spot.col; cell.row = spot.row;
  layout.cells.push(cell);
  select(cell.id);
  render();
}

/* ---------------- 布局画布渲染与拖拽 ---------------- */
function render() {
  const grid = $('#cpgrid');
  grid.style.gridTemplateColumns = `repeat(${layout.cols}, ${ECS}px)`;
  grid.style.gridAutoRows = ECS + 'px';
  grid.innerHTML = '';
  for (const c of layout.cells) {
    const t = document.createElement('div');
    t.className = 'cp-el' + (c.id === selId ? ' sel' : '');
    t.dataset.cell = c.id;
    t.style.gridColumn = (c.col + 1) + ' / span ' + c.w;
    t.style.gridRow = (c.row + 1) + ' / span ' + c.h;
    t.innerHTML = '<span class="cp-el-label">' + c.label + '</span>';
    if (c.bind) {
      const src = state.mods.get(c.bind.m);
      t.innerHTML += '<span class="cp-el-bind">' + (src ? src.def.name : '?') + '.' + c.bind.p + '</span>';
    }
    grid.appendChild(t);
    t.addEventListener('pointerdown', e => startDrag(e, c, t));
  }
  syncInspector();
}

function startDrag(e, cell, tile) {
  if (e.button !== 0) return;
  e.preventDefault();
  select(cell.id);
  const rect = $('#cpgrid').getBoundingClientRect();
  const ox = e.clientX - rect.left - cell.col * ECS;
  const oy = e.clientY - rect.top - cell.row * ECS;
  let moved = false;
  const mv = ev => {
    const nc = clamp(Math.round((ev.clientX - rect.left - ox) / ECS), 0, layout.cols - cell.w);
    const nr = clamp(Math.round((ev.clientY - rect.top - oy) / ECS), 0, layout.rows - cell.h);
    if (nc !== cell.col || nr !== cell.row) {
      cell.col = nc; cell.row = nr; moved = true;
      tile.style.gridColumn = (nc + 1) + ' / span ' + cell.w;
      tile.style.gridRow = (nr + 1) + ' / span ' + cell.h;
    }
  };
  const up = () => {
    window.removeEventListener('pointermove', mv);
    window.removeEventListener('pointerup', up);
    if (moved) { saveSoon(); syncInspector(); }
  };
  window.addEventListener('pointermove', mv);
  window.addEventListener('pointerup', up);
}

/* ---------------- 属性检查器 ---------------- */
function selected() { return layout.cells.find(c => c.id === selId) || null; }

function syncInspector() {
  const box = $('#cpprops');
  const c = selId ? layout.cells.find(x => x.id === selId) : null;
  box.classList.toggle('hidden', !c);
  if (!c) return;
  $('#cpilabel').value = c.label || '';
  $('#cpiw').value = c.w;
  $('#cpih').value = c.h;
  $('#cpistyle').value = c.style || 'dark';
  const ranged = c.kind === 'knob' || c.kind === 'fader';
  $('#cpirange').style.display = ranged ? 'flex' : 'none';
  if (ranged) { $('#cpimin').value = c.min ?? 0; $('#cpimax').value = c.max ?? 10; }
  const bind = $('#cpibind');
  if (c.bind) {
    const src = state.mods.get(c.bind.m);
    bind.textContent = '绑定:' + (src ? src.def.name : '?') + '.' + c.bind.p;
    bind.style.display = '';
  } else bind.style.display = 'none';
}

function wireInspector() {
  $('#cpilabel').addEventListener('input', () => {
    const c = selected(); if (!c) return;
    c.label = $('#cpilabel').value; render();
  });
  $('#cpiw').addEventListener('change', () => {
    const c = selected(); if (!c) return;
    c.w = clamp(+$('#cpiw').value || 1, 1, 4); render();
  });
  $('#cpih').addEventListener('change', () => {
    const c = selected(); if (!c) return;
    c.h = clamp(+$('#cpih').value || 1, 1, 4); render();
  });
  $('#cpistyle').addEventListener('change', () => {
    const c = selected(); if (!c) return;
    c.style = $('#cpistyle').value; render();
  });
  const applyRange = () => {
    const c = selected(); if (!c) return;
    let min = +$('#cpimin').value, max = +$('#cpimax').value;
    if (!isFinite(min)) min = 0;
    if (!isFinite(max)) max = 10;
    if (max <= min) max = min + 1;
    c.min = min; c.max = max; render();
  };
  $('#cpimin').addEventListener('change', applyRange);
  $('#cpimax').addEventListener('change', applyRange);
  $('#cppropsx').addEventListener('click', () => select(null));
}

function select(id) {
  selId = id;
  render();
}

/* ---------------- 保存 / 放置 ---------------- */
function currentSpec() {
  const name = $('#cpmname').value.trim() || '我的面板';
  return {
    name, cols: layout.cols, rows: layout.rows,
    cells: layout.cells.map(c => {
      const o = { id: c.id, kind: c.kind, label: c.label, col: c.col, row: c.row, w: c.w, h: c.h, style: c.style };
      if (c.kind === 'knob' || c.kind === 'fader') { o.min = c.min; o.max = c.max; o.value = c.value; }
      if (c.kind === 'switch') o.value = !!c.value;
      if (c.bind) o.bind = { ...c.bind };
      return o;
    })
  };
}

function saveDesign() {
  if (!layout.cells.length) { toast('先用「＋旋钮 / ＋推子…」添加元素,再保存'); return null; }
  const key = newCustomKey();
  const spec = currentSpec();
  mkCustomDef(key, spec);
  registerDesign(key, spec);
  toast('已保存「' + spec.name + '」到「我的组件」');
  return key;
}

function placeCurrent() {
  const key = saveDesign();
  if (!key) return;
  placeAtCenter(key);
  toast('已放置面板组件');
}

/* ---------------- 画布 → 工坊:发送绑定元素 ---------------- */

/** 发送输入口:注入旋钮(面板旋钮的电压直接送进该输入口) */
export function sendPortToWorkshop(mod, port, kind) {
  firstGesture();
  if (layout.cells.length >= 24) { toast('一个面板最多 24 个元素'); return; }
  const bind = { m: mod.id, p: port.id, mode: kind === 'meter' ? 'monitor' : 'inject' };
  const label = port.name;
  const cell = makeCell(kind, {
    label,
    bind,
    w: kind === 'meter' ? 1 : 2,
    h: kind === 'meter' ? 3 : 2,
    value: 5, min: 0, max: 10
  });
  const spot = snapPlacement(layout.cells, cell, 0, 0, layout.cols, layout.rows);
  cell.col = spot.col; cell.row = spot.row;
  layout.cells.push(cell);
  ensureStudioVisible();
  select(cell.id);
  render();
  toast('已发送到工坊:' + (kind === 'meter' ? '电压表(监视 ' : '注入旋钮(') + mod.def.name + '.' + port.name + ')');
}

/** 发送控制类组件:镜像控制(面板旋钮 = 画布上那只旋钮) */
export function sendControlToWorkshop(mod) {
  firstGesture();
  if (layout.cells.length >= 24) { toast('一个面板最多 24 个元素'); return; }
  const kindMap = { bigknob: 'knob', hfader: 'fader' };
  const kind = kindMap[mod.def.id] || mod.def.id;
  const mainPort = mod.def.ports[0];
  const cell = makeCell(kind, {
    label: mod.def.name,
    bind: { m: mod.id, p: mainPort.id, mode: 'mirror' },
    w: kind === 'switch' ? 2 : 2,
    h: kind === 'switch' ? 1 : 2,
    min: mod.def.id === 'biknob' ? -5 : 0,
    max: mod.def.id === 'biknob' ? 5 : 10,
    value: mod.state.v ?? (mod.state.on ?? 0)
  });
  const spot = snapPlacement(layout.cells, cell, 0, 0, layout.cols, layout.rows);
  cell.col = spot.col; cell.row = spot.row;
  layout.cells.push(cell);
  ensureStudioVisible();
  select(cell.id);
  render();
  toast('已发送到工坊:镜像控制「' + mod.def.name + '」');
}
