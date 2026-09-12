/* 组件工坊 · 设计规格 → 真组件定义。
   端口 id = 'P' + 控件格 id;旋钮 / 推子 / 开关在上方输出泳道,
   电压表在下方输入泳道。规格中与布局相关的纯计算单独导出以便单测。 */

import { clamp } from '../core/utils.js';
import { nextId } from '../core/state.js';
import { getCtx } from '../core/audio.js';
import { registerDef, DEFS } from '../core/registry.js';
import { layoutDefPorts, BASE } from '../core/ports.js';
import { SINK_DEFS } from '../core/flow.js';
import { saveSoon } from '../core/save.js';
import { CompactPanel, mkCell } from './panel.js';

/** 纯计算:设计的端口 / 尺寸。返回 { outs, ins, ports, cols, span, rows, w, h } */
export function customLayout(spec) {
  const cells = (spec.cells || []).map(c => ({ ...c }));
  const outs = cells.filter(c => c.kind !== 'meter');
  const ins = cells.filter(c => c.kind === 'meter');
  const cols = clamp(spec.cols || 3, 1, 6), span = clamp(spec.span || 3, 2, 5);
  const rows = Math.max(1, Math.ceil(cells.length / cols));
  const top = 0.9 + (outs.length ? 2.0 : 0.3);   // SHELL.headerC + (laneC | padC)
  const bot = ins.length ? 2.0 : 0.3;
  const ports = outs.map(c => ({
    id: 'P' + c.id, dir: 'out', name: c.label || 'OUT',
    type: c.kind === 'switch' ? 'gate' : 'cv',
    desc: (c.kind === 'switch' ? '开关门输出:+10V(开)/ 0V(关)'
      : (c.kind === 'fader' ? '推子' : '旋钮') + '电压输出') +
      ' ' + (c.min ?? 0) + ' ~ ' + (c.max ?? 10) + 'V'
  })).concat(ins.map(c => ({
    id: 'P' + c.id, dir: 'in', name: c.label || 'IN', type: 'any',
    desc: '电压表输入:接进来的信号电压显示在表上'
  })));
  return {
    cells, outs, ins, ports, cols, span, rows, top, bot,
    // +1 / +0.2:内容区四边 0.35 格内边距 + 网格 gap 的余量
    w: Math.max(cols * span + 1, outs.length * 2 || 2, ins.length * 2 || 2),
    h: Math.round((top + rows * span + 0.2 + bot) * 100) / 100
  };
}

export function newCustomKey() {
  let key;
  do { key = 'custom#' + nextId(); } while (DEFS[key]);
  return key;
}

/** 注册(或覆盖)一个自制组件定义;带电压表的自动登记为显示终端 */
export function mkCustomDef(key, spec) {
  const layout = customLayout(spec);
  const cells = layout.cells;
  const def = {
    id: key, name: spec.name || '自制组件', en: 'CUSTOM', cat: 'control',
    w: layout.w, h: layout.h,
    ports: layout.ports, custom: true, design: { ...spec, cells: layout.cells, cols: layout.cols, span: layout.span },
    desc: '自制组件:控件即接口,右键 = 载回工坊修改。',
    state: () => ({ vals: {} }),
    build() {
      this._cells = {}; this._meters = [];
      const ctx = getCtx();
      for (const c of cells) {
        if (c.kind === 'meter') { this.mon('P' + c.id, this.ins['P' + c.id], 512); continue; }
        const cs = ctx.createConstantSource();
        const v0 = this.state.vals[c.id] ?? c.value ?? (c.kind === 'switch' ? false : (c.min ?? 0));
        cs.offset.value = c.kind === 'switch' ? (v0 ? 10 : 0) : v0;
        cs.connect(this.outs['P' + c.id]);
        cs.start();
        this['cs_' + c.id] = cs;
      }
    },
    ui() { uiCustomPanel(this); },
    dispose() {
      for (const c of cells)
        if (this['cs_' + c.id]) { try { this['cs_' + c.id].stop(); } catch (e) {} }
    },
    setCellVal(id, v) {
      const c = cells.find(x => x.id === id);
      if (!c) return;
      if (c.kind === 'switch') v = !!v;
      else v = clamp(Math.round(v * 100) / 100, c.min ?? 0, c.max ?? 10);
      this.state.vals[id] = v;
      const h = this._cells && this._cells[id];
      if (h && h.set) h.set(v);
      if (this['cs_' + id]) {
        // 开关输出门电压:开 = +10V,关 = 0V
        const volt = c.kind === 'switch' ? (v ? 10 : 0) : v;
        this['cs_' + id].offset.setTargetAtTime(volt, getCtx().currentTime, 0.004);
      }
      saveSoon();
    },
    tick() {
      for (const m of this._meters || []) {
        const mon = this.mons[m.port];
        if (mon) m.handle.setBar(Math.abs(mon.v));   // 半波显示:双极信号也能看到幅度
      }
    }
  };
  if (layout.ins.length) SINK_DEFS[key] = 1;   // 电压表 = 显示终端,喂它的链路保持活跃
  else delete SINK_DEFS[key];
  registerDef(def);
  layoutDefPorts(def);
  return def;
}

/** 自制组件实例的面板:按设计规格把控制格铺进内容区(控件即接口,不可增删) */
function uiCustomPanel(mod) {
  const design = mod.def.design;
  CompactPanel.applyTheme(mod.el, design.theme);
  const grid = document.createElement('div');
  grid.className = 'cpx-modgrid';
  grid.style.gridTemplateColumns = `repeat(${design.cols}, ${design.span * BASE}px)`;
  grid.style.gridAutoRows = (design.span * BASE) + 'px';
  for (const c of design.cells) {
    const { el: cellEl, handle } = mkCell(c,
      { change: v => mod.setCellVal(c.id, v) }, { removable: false, box: design.span * BASE });
    cellEl.dataset.ctl = '1';
    grid.appendChild(cellEl);
    mod._cells[c.id] = handle;
    if (c.kind === 'meter') mod._meters.push({ port: 'P' + c.id, handle });
    else handle.set(mod.state.vals[c.id] ?? c.value ?? (c.kind === 'switch' ? 0 : (c.min ?? 0)));
  }
  mod.body.appendChild(grid);
}
