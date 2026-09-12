import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCells, panelGeometry, makeCell } from '../src/workshop/layout.js';
import { mkCustomDef, newCustomKey } from '../src/workshop/custom-def.js';
import { DEFS } from '../src/core/registry.js';
import { state, resetState } from '../src/core/state.js';

beforeEach(() => resetState());

test('normalizeCells:补齐缺省的列 / 行 / 尺寸并钳取到面板范围', () => {
  const cells = normalizeCells([
    { id: 'a', kind: 'knob' },                      // 无位置 → 自动排布
    { id: 'b', kind: 'knob', col: 50, row: 0, w: 2 }, // 超出 → 钳取
  ], 4, 6);
  assert.equal(cells[0].w, 2);
  assert.equal(cells[0].col, 0);
  assert.equal(cells[1].col, 4 - 2);                // 钳取到最右列
  assert.ok(cells.every(c => c.col >= 0 && c.col + c.w <= 4));
  assert.ok(cells.every(c => c.row >= 0 && c.row + c.h <= 6));
});

test('makeCell:默认值与绑定字段', () => {
  const c = makeCell('knob', { label: '音量', bind: { m: 7, p: 'CUTOFF' } });
  assert.equal(c.kind, 'knob');
  assert.equal(c.w, 2);
  assert.deepEqual(c.bind, { m: 7, p: 'CUTOFF' });
});

test('panelGeometry:整格外壳(有输出 → 顶部泳道 2 格;有电压表 → 底部泳道 2 格)', () => {
  const cells = normalizeCells([
    { id: 'a', kind: 'knob', col: 0, row: 0, w: 2, h: 2 },
    { id: 'b', kind: 'meter', col: 2, row: 0, w: 1, h: 2 },
  ], 4, 4);
  const g = panelGeometry(cells, 4, 4);
  assert.equal(g.w, 6);            // cols + 2 侧边空白
  assert.equal(g.top, 3);          // 标题 1 + 输出泳道 2
  assert.equal(g.bot, 2);          // 有电压表 → 底部泳道 2
  assert.equal(g.h, 3 + 2 + 2);    // 内容 2 行
  assert.ok(Number.isInteger(g.w) && Number.isInteger(g.h));
});

test('mkCustomDef:端口派生(控件→输出口,电压表→输入口,绑定元素无端口)', () => {
  const key = newCustomKey();
  mkCustomDef(key, {
    name: '测试台', cols: 6, rows: 4,
    cells: [
      { id: 'c1', kind: 'knob', label: '音量', col: 0, row: 0, w: 2, h: 2 },
      { id: 'c2', kind: 'meter', label: '电平', col: 2, row: 0, w: 1, h: 2,
        bind: { m: 99, p: 'SIN' } },
      { id: 'c3', kind: 'knob', label: '注入', col: 3, row: 0, w: 2, h: 2,
        bind: { m: 99, p: 'CUTOFF' } }
    ]
  });
  const d = DEFS[key];
  assert.equal(d.w, 8);            // cols 6 + 2
  // 只有未绑定的控件引出端口:c1 旋钮 → CV 输出口;
  // c2 电压表与 c3 旋钮都是绑定元素 → 不占对外端口
  assert.deepEqual(d.ports.map(p => p.id + ':' + p.dir), ['Pc1:out']);
  assert.equal(d.portsById.Pc1.type, 'cv');
});
