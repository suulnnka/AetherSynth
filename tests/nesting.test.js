import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nestDepth, nestDepthExceeded, MAX_NEST_DEPTH } from '../src/core/nesting.js';

/** 造一个只有 id / parent 的假模块表(层级检测只需这两个字段) */
function fakeMods(pairs) {
  const mods = new Map();
  for (const [id, parent] of pairs) mods.set(id, { id, parent });
  return mods;
}

test('nestDepth:普通组件深度为 0', () => {
  const mods = fakeMods([[1, null]]);
  assert.equal(nestDepth(mods, 1), 0);
});

test('nestDepth:父链长度决定层级', () => {
  const mods = fakeMods([
    [1, null],      // 最外层组合
    [2, 1],         // 一层组合里的组件
    [3, 1],
    [4, 3],         // 嵌套组合里的组件(两层)
  ]);
  assert.equal(nestDepth(mods, 1), 0);
  assert.equal(nestDepth(mods, 2), 1);
  assert.equal(nestDepth(mods, 4), 2);
});

test('nestDepth:父链意外成环时不死循环(防御)', () => {
  const mods = fakeMods([[1, 2], [2, 1]]);   // 互相成环的坏数据
  assert.ok(nestDepth(mods, 1) < 10);
});

test('嵌套上限:封装检查按“新组合层级 = 选中最大深度 + 1”判定', () => {
  const mods = fakeMods([[1, null], [2, 1], [3, 2]]);
  // 选中深度 0 的组件 → 新组合在第 1 层,未超限
  assert.equal(nestDepthExceeded(mods, [1]), false);
  // 选中深度 2(嵌套两层组合内)的组件 → 新组合将到第 3 层,上限 2 时超限
  assert.equal(nestDepthExceeded(mods, [3], 2), true);
  assert.equal(nestDepthExceeded(mods, [3], 3), false);
});

test('极限深度:链条到达上限时拒绝继续封装', () => {
  // 搭一条深度 0..MAX 的组合链
  const mods = new Map();
  mods.set(0, { id: 0, parent: null });
  for (let i = 1; i <= MAX_NEST_DEPTH; i++) mods.set(i, { id: i, parent: i - 1 });
  // 深度 MAX 的组件再封装会到 MAX+1 层 → 超限;深度 MAX-1 的恰好到顶
  assert.equal(nestDepthExceeded(mods, [MAX_NEST_DEPTH]), true);
  assert.equal(nestDepthExceeded(mods, [MAX_NEST_DEPTH - 1]), false);
});

test('MAX_NEST_DEPTH 默认为 8', () => {
  assert.equal(MAX_NEST_DEPTH, 8);
});
