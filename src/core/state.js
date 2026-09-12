/* 全局可变应用状态:画布上的组件 / 线缆 / 视图 / 交互光标。
   集中放在一处,其余模块只读引用;重置函数供测试使用。 */

export const state = {
  mods: new Map(),        // id → Mod 实例
  cables: new Map(),      // id → 线缆记录 { a:{m,p}, b:{m,p}, color, midi, aNode, bNode, hit, wire }
  cellPx: 24,             // 每格的屏幕像素(格距)
  view: { x: 60, y: 60, s: 1 },
  // 交互光标
  drag: null,             // { type: 'move'|'pan'|'cable', ... }
  sel: null,              // 最后选中的组件 id
  selSet: new Set(),      // 多选集合(Shift 点选)
  spawnN: 0,              // 新组件落点错位计数
  // id / 颜色 发生器
  uid: 1,
  colorIdx: 0
};

export const nextId = () => state.uid++;

/** 测试辅助:恢复到空白初始状态 */
export function resetState() {
  state.mods.clear();
  state.cables.clear();
  state.cellPx = 24;
  state.view = { x: 60, y: 60, s: 1 };
  state.drag = null;
  state.sel = null;
  state.selSet = new Set();
  state.spawnN = 0;
  state.uid = 1;
  state.colorIdx = 0;
}
