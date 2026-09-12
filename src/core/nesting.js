/* 组合 / 宏的嵌套深度防御:纯函数,可在 Node 单测中直接运行。 */

/** 组合 / 宏的最大嵌套层数(防御性上限,防止无限嵌套) */
export const MAX_NEST_DEPTH = 8;

/** 组件在组合层级中的深度(父链长度;普通组件 = 0)。
    用 seen 防御父链意外成环导致的死循环。
    mods 元素只需提供 { id, parent }(可传假对象)。 */
export function nestDepth(mods, id) {
  let d = 0;
  const seen = new Set([id]);
  let cur = mods.get(id);
  while (cur && cur.parent != null && !seen.has(cur.parent)) {
    d++;
    seen.add(cur.parent);
    cur = mods.get(cur.parent);
  }
  return d;
}

/** 检查把 ids 封装成一个新组合后,嵌套是否超过上限 */
export function nestDepthExceeded(mods, ids, max = MAX_NEST_DEPTH) {
  return ids.some(id => nestDepth(mods, id) + 1 > max);
}
