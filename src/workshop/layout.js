/* 工坊布局模型:面板 = cols × rows 的格网,元素按格摆放(col/row/w/h)。
   纯函数集合,可在 Node 单测中直接运行。
   ---------------------------------------------------------------------
   元素(元素格):
     { id, kind: 'knob'|'fader'|'switch'|'meter', label,
       col, row, w, h,            // 格位置与尺寸(格)
       style,                     // 外观:dark|silver|neon|retro|minimal
       min, max, value,           // knob / fader 量程
       bind: null | { m, p } }    // 绑定画布端口(发送来的元素)
   绑定语义:
     · 输入口端口 → 旋钮注入(旋钮的电压送往该输入口)
     · 输出口端口 → 电压表(显示该口的信号)
     · 控制类组件 → 镜像控制(面板旋钮 = 画布上那只旋钮)
 */

import { clamp } from '../core/utils.js';

export const STYLES = ['dark', 'silver', 'neon', 'retro', 'minimal'];
export const STYLE_NAMES = { dark: '深色', silver: '银色', neon: '霓虹', retro: '复古', minimal: '极简' };
export const KIND_NAMES = { knob: '旋钮', fader: '推子', switch: '开关', meter: '电压表' };

let seq = 0;
export function resetSeq(n = 0) { seq = n; }
export function nextCellId() { return 'c' + (++seq); }

/** 新元素:kind + 绑定信息(可选) */
export function makeCell(kind, opts = {}) {
  const w = clamp(opts.w ?? 2, 1, 4), h = clamp(opts.h ?? 2, 1, 4);
  return {
    id: opts.id || nextCellId(),
    kind, label: opts.label || KIND_NAMES[kind],
    col: clamp(opts.col ?? 0, 0, 998), row: clamp(opts.row ?? 0, 0, 998),
    w, h,
    style: STYLES.includes(opts.style) ? opts.style : 'dark',
    min: opts.min ?? 0, max: opts.max ?? 10, value: opts.value ?? 5,
    bind: opts.bind || null
  };
}

/** 规格整理:补齐缺省位置 / 尺寸(旧版兼容),钳取到面板范围内。
    返回新的 cells 数组(不改动原数组)。 */
export function normalizeCells(cells, cols, rows) {
  return cells.map((c, i) => {
    const w = clamp(c.w ?? 2, 1, 4), h = clamp(c.h ?? 2, 1, 4);
    const col = clamp(c.col ?? (i * 2) % Math.max(1, cols - w + 1), 0, cols - w);
    const row = clamp(c.row ?? Math.floor(i / Math.max(1, Math.floor((cols - w + 1) / w))) * h, 0, rows - h);
    const out = { ...c, w, h, col, row };
    if (c.bind) out.bind = { ...c.bind };
    return out;
  });
}

/** 面板(放置后的组件)几何:全部整格。
    w = cols + 2(左右各 1 格空白);内容行数 = 最大元素底边;
    h = 标题 1 + 输出泳道 2(有面板输出时)+ 内容行数 + 底部 2 或 1。 */
export function panelGeometry(cells, cols, rows) {
  const unboundOuts = cells.filter(c => c.kind !== 'meter' && !c.bind);
  const boundMeters = cells.filter(c => c.kind === 'meter' && !c.bind);
  const rowEnd = Math.max(1, ...cells.map(c => c.row + c.h));
  const top = 1 + (unboundOuts.length ? 2 : 1);
  const bot = boundMeters.length ? 2 : 1;
  return { unboundOuts, boundMeters, rowEnd, top, bot, w: cols + 2, h: top + rowEnd + bot };
}

/** 移动元素到目标格(钳取在面板范围内) */
export function moveCell(cell, col, row, cols, rows) {
  cell.col = clamp(col, 0, cols - cell.w);
  cell.row = clamp(row, 0, rows - cell.h);
}

/** 目标格位是否与其它元素重叠 */
export function cellFree(cells, moved, col, row) {
  return !cells.some(c => c !== moved && c.id !== moved.id &&
    col < c.col + c.w && col + moved.w > c.col &&
    row < c.row + c.h && row + moved.h > c.row);
}

/** 拖拽落点:优先落到不重叠的最近位置(简单螺旋搜索) */
export function snapPlacement(cells, moved, col, row, cols, rows) {
  moveCell(moved, col, row, cols, rows);
  if (cellFree(cells, moved, moved.col, moved.row)) return { col: moved.col, row: moved.row };
  for (let r = 1; r < Math.max(rows, 8); r++) {
    for (let dc = -r; dc <= r; dc++) for (let dr = -r; dr <= r; dr++) {
      if (Math.abs(dc) !== r && Math.abs(dr) !== r) continue;
      const c2 = clamp(moved.col + dc, 0, cols - moved.w);
      const r2 = clamp(moved.row + dr, 0, rows - moved.h);
      if (cellFree(cells, moved, c2, r2)) { moved.col = c2; moved.row = r2; return { col: c2, row: r2 }; }
    }
  }
  return { col: moved.col, row: moved.row };
}
