/* 自制组件定义:工坊布局规格 → 画布上真正的组件。
   ---------------------------------------------------------------------
   规格 spec:{ name, cols, rows, cells:[...] }
   cells 每格:{ id, kind, label, col, row, w, h, style, min, max, value,
                bind: {m, p} | null }
   · 未绑定的旋钮 / 推子 / 开关 → 一路对外输出口(CV 或门)
   · 未绑定的电压表           → 一路对外输入口(显示接进来的信号)
   · 绑定了画布端口的元素      → 注入(入端口)/ 监视(出端口)/ 镜像(控制组件)
   元素按 col/row/w/h 铺在整格网格上,与画布网格严格对齐。 */

import { clamp } from '../core/utils.js';
import { state, nextId } from '../core/state.js';
import { getCtx } from '../core/audio.js';
import { registerDef, DEFS } from '../core/registry.js';
import { layoutDefPorts, BASE } from '../core/ports.js';
import { SINK_DEFS } from '../core/flow.js';
import { saveSoon } from '../core/save.js';
import { normalizeCells } from './layout.js';
import { CompactPanel, mkCell } from './panel.js';

export function newCustomKey() {
  let key;
  do { key = 'custom#' + nextId(); } while (DEFS[key]);
  return key;
}

/** 注册(或覆盖)一个自制面板组件定义;带电压表的登记为显示终端 */
export function mkCustomDef(key, spec) {
  const cols = clamp(spec.cols || 8, 2, 16);
  const cells = normalizeCells(spec.cells || [], cols, clamp(spec.rows || 6, 2, 24));
  const rows = Math.max(clamp(spec.rows || 6, 2, 24),
    ...cells.map(c => c.row + c.h), 1);
  const unboundOuts = cells.filter(c => c.kind !== 'meter' && !c.bind);
  const meters = cells.filter(c => c.kind === 'meter' && !c.bind);
  const top = 1 + (unboundOuts.length ? 2 : 1);
  const bot = meters.length ? 2 : 1;
  const ports = unboundOuts.map(c => ({
    id: 'P' + c.id, dir: 'out', name: c.label || 'OUT',
    type: c.kind === 'switch' ? 'gate' : 'cv',
    desc: (c.kind === 'switch' ? '开关门输出:+10V(开)/ 0V(关)'
      : (c.kind === 'fader' ? '推子' : '旋钮') + '电压输出') +
      ' ' + (c.min ?? 0) + ' ~ ' + (c.max ?? 10) + 'V'
  })).concat(meters.map(c => ({
    id: 'P' + c.id, dir: 'in', name: c.label || 'IN', type: 'any',
    desc: '电压表输入:接进来的信号电压显示在表上'
  })));
  const def = {
    id: key, name: spec.name || '自制组件', en: 'CUSTOM', cat: 'control',
    w: cols + 2, h: top + rows + bot,
    ports, custom: true, design: { ...spec, cells, cols, rows },
    // 整格外壳:标题行 1 格 + 泳道整格,内容区与画布网格严格对齐
    headerC: 1, laneTopC: unboundOuts.length ? 2 : 1, laneBotC: meters.length ? 2 : 1, footerC: meters.length ? 2 : 1,
    desc: '自制组件:控件即接口,右键 = 载回工坊修改。',
    state: () => ({ vals: {} }),
    build() {
      this._cells = {}; this._meters = [];
      const c0 = getCtx();
      for (const c of cells) {
        // 电压表:绑定 → 监视源输出口;未绑定 → 自己的输入口
        const monNode = c.bind ? (state.mods.get(c.bind.m)?.outs[c.bind.p]) : this.ins['P' + c.id];
        if (c.kind === 'meter') {
          if (monNode) this.mon('P' + c.id, monNode, 512);
          continue;
        }
        // 镜像绑定:无音频节点,驱动源组件的控件即可
        if (c.bind && c.bind.mode === 'mirror') continue;
        const cs = c0.createConstantSource();
        const v0 = this.state.vals[c.id] ?? c.value ?? (c.kind === 'switch' ? false : (c.min ?? 0));
        cs.offset.value = c.kind === 'switch' ? (v0 ? 10 : 0) : v0;
        if (c.bind) {
          // 注入类绑定:电压直接送进源组件的输入口
          const src = state.mods.get(c.bind.m);
          if (src && src.ins[c.bind.p]) cs.connect(src.ins[c.bind.p]);
        } else {
          cs.connect(this.outs['P' + c.id]);
        }
        cs.start();
        this['cs_' + c.id] = cs;
      }
    },
    ui() { uiCustomPanel(this); },
    dispose() {
      for (const c of cells)
        if (this['cs_' + c.id]) { try { this['cs_' + c.id].stop(); } catch (e) {} }
      for (const k in this.mons) { try { this.mons[k].an.disconnect(); } catch (e) {} }
    },
    setCellVal(id, v) {
      const c = cells.find(x => x.id === id);
      if (!c) return;
      if (c.kind === 'switch') v = !!v;
      else v = clamp(Math.round(v * 100) / 100, c.min ?? 0, c.max ?? 10);
      this.state.vals[id] = v;
      const h = this._cells && this._cells[id];
      if (h && h.set) h.set(v);
      // 镜像绑定:驱动源组件自己的控件(旋钮 setKnob / 开关 setSw)
      if (c.bind && c.bind.mode === 'mirror') {
        const src = state.mods.get(c.bind.m);
        if (src) { c.kind === 'switch' ? src.setSw(v) : src.setKnob(v); }
        return;
      }
      if (this['cs_' + id]) {
        const volt = c.kind === 'switch' ? (v ? 10 : 0) : v;
        this['cs_' + id].offset.setTargetAtTime(volt, getCtx().currentTime, 0.004);
      }
      saveSoon();
    },
    tick() {
      // 电压表(自有输入口 / 绑定监视)刷新
      for (const c of cells) {
        if (c.kind !== 'meter') continue;
        const h = this._cells && this._cells[c.id];
        if (!h) continue;
        if (c.bind) {
          const src = state.mods.get(c.bind.m);
          if (!src) continue;
          const mon = this.mons['_b' + c.id];
          if (mon) { mon.read(); h.setBar(Math.abs(mon.v)); }
        } else {
          const mon = this.mons['P' + c.id];
          if (mon) h.setBar(Math.abs(mon.v));
        }
      }
      // 镜像元素:源组件被别处改动时同步到面板
      for (const c of cells) {
        if (!c.bind || c.bind.mode !== 'mirror') continue;
        const src = state.mods.get(c.bind.m);
        if (!src) continue;
        const h = this._cells[c.id];
        if (!h) continue;
        const v = c.kind === 'switch' ? src.state.on : src.state.v;
        if (v !== undefined && h.get && h.get() !== v) h.set(v);
      }
    }
  };
  if (meters.length) SINK_DEFS[key] = 1; else delete SINK_DEFS[key];
  registerDef(def);
  layoutDefPorts(def);
  return def;
}

/** 自制组件实例的面板:按 col/row/w/h 铺在整格网格上 */
function uiCustomPanel(mod) {
  const design = mod.def.design;
  CompactPanel.applyTheme(mod.el, design.theme);
  for (const c of design.cells) {
    const { el: cellEl, handle } = mkCell(c,
      { change: v => mod.setCellVal(c.id, v) }, { removable: false, box: c.w * BASE });
    cellEl.dataset.ctl = '1';
    if (c.style) { cellEl.classList.add('cpx-scope'); cellEl.dataset.widget = c.style; }
    cellEl.style.gridColumn = `${c.col + 2} / span ${c.w}`;
    cellEl.style.gridRow = `${c.row + 1} / span ${c.h}`;
    mod.body.appendChild(cellEl);
    mod._cells[c.id] = handle;
    if (c.kind === 'meter') {
      mod._meters.push({ id: c.id, handle });
    } else {
      handle.set(mod.state.vals[c.id] ?? c.value ?? (c.kind === 'switch' ? 0 : (c.min ?? 0)));
    }
  }
}
