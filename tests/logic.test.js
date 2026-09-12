import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOGIC_TH, lgNot, lgAnd, lgOr, lgXor, srNext, tffNext, logic
} from '../src/modules/logic.js';

test('logic:阈值常量为 0.5V', () => {
  assert.equal(LOGIC_TH, 0.5);
});

test('非门:反相真值表', () => {
  assert.equal(lgNot(false), true);
  assert.equal(lgNot(true), false);
});

test('与门:A、B 同时为高才输出高', () => {
  assert.equal(lgAnd(false, false), false);
  assert.equal(lgAnd(true, false), false);
  assert.equal(lgAnd(false, true), false);
  assert.equal(lgAnd(true, true), true);
});

test('或门:任一为高即输出高', () => {
  assert.equal(lgOr(false, false), false);
  assert.equal(lgOr(true, false), true);
  assert.equal(lgOr(false, true), true);
  assert.equal(lgOr(true, true), true);
});

test('异或门:恰有一个为高才输出高', () => {
  assert.equal(lgXor(false, false), false);
  assert.equal(lgXor(true, false), true);
  assert.equal(lgXor(false, true), true);
  assert.equal(lgXor(true, true), false);
});

test('SR锁存器:置位保持、复位清除、RESET 优先', () => {
  assert.equal(srNext(false, true, false), true);    // S 上升 → 置位
  assert.equal(srNext(true, false, false), true);    // 无沿 → 保持
  assert.equal(srNext(false, false, false), false);  // 无沿 → 保持
  assert.equal(srNext(true, false, true), false);    // R 上升 → 复位
  assert.equal(srNext(true, true, true), false);     // S、R 同拍 → RESET 优先
});

test('T触发器:仅上升沿翻转,级联为二分频', () => {
  assert.equal(tffNext(false, true), true);
  assert.equal(tffNext(true, false), true);     // 无沿保持
  assert.equal(tffNext(true, true), false);
  assert.equal(tffNext(false, false), false);
  // 连续时钟:每 2 拍输出一个完整周期
  let s = false;
  const clks = [true, false, false, false, true, false, false, false];
  for (const rise of clks) s = tffNext(s, rise);
  assert.equal(s, false);   // 2 个上升沿 → 翻转两次 → 回到初值
});

test('logic:全部 def 结构完整(接口、flow、分类)', () => {
  const ids = Object.keys(logic);
  assert.deepEqual(ids.sort(), ['and', 'cmp', 'not', 'or', 'srl', 'tff', 'xor'].sort());
  for (const def of Object.values(logic)) {
    assert.equal(def.cat, 'logic');
    const out = def.ports.find(p => p.id === 'OUT');
    assert.ok(out && out.dir === 'out', def.id + ' 缺 OUT 口');
    assert.deepEqual(Object.keys(def.flow), ['OUT']);
    assert.ok(def.state && def.build && def.tick && def.dispose, def.id + ' 缺生命周期');
  }
});
