import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, escHtml } from '../src/core/utils.js';

test('clamp:数值落在区间内', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
});

test('clamp:边界值保持原样', () => {
  assert.equal(clamp(0, 0, 10), 0);
  assert.equal(clamp(10, 0, 10), 10);
});

test('escHtml:转义 HTML 特殊字符', () => {
  assert.equal(escHtml('<a b="c">&'), '&lt;a b=&quot;c&quot;&gt;&amp;');
});

test('escHtml:普通文本不变', () => {
  assert.equal(escHtml('颤音台 1'), '颤音台 1');
});
