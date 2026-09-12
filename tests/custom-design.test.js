import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { customLayout, newCustomKey } from '../src/workshop/custom-def.js';
import { DEFS } from '../src/core/registry.js';
import { state, resetState } from '../src/core/state.js';

beforeEach(() => resetState());

test('customLayout:控件 → 端口的类型映射(旋钮/推子=CV,开关=Gate,电压表=输入)', () => {
  const spec = {
    name: '测试台', cols: 2, span: 3,
    cells: [
      { id: 'c1', kind: 'knob', label: '音量', min: 0, max: 8, value: 5 },
      { id: 'c2', kind: 'switch', label: '静音', value: false },
      { id: 'c3', kind: 'meter', label: '电平' }
    ]
  };
  const L = customLayout(spec);
  const byId = Object.fromEntries(L.ports.map(p => [p.id, p]));
  assert.equal(byId.Pc1.dir, 'out');
  assert.equal(byId.Pc1.type, 'cv');
  assert.equal(byId.Pc2.type, 'gate');           // 开关 = 门输出
  assert.equal(byId.Pc3.dir, 'in');              // 电压表 = 输入口
  assert.equal(byId.Pc3.type, 'any');
  assert.equal(L.outs.length, 2);
  assert.equal(L.ins.length, 1);
});

test('customLayout:尺寸 = 内容网格 + 外壳泳道 + 内边距', () => {
  const L = customLayout({
    cols: 3, span: 3,
    cells: [
      { id: 'a', kind: 'knob' }, { id: 'b', kind: 'knob' }, { id: 'c', kind: 'switch' },
      { id: 'd', kind: 'fader' }
    ]
  });
  // 4 个控件 3 列 → 2 行;宽 = 3列×3跨 + 1 格内边距
  assert.equal(L.rows, 2);
  assert.equal(L.w, 10);
  // 高 = 标题 0.9 + 输出泳道 2 + 2行×3 + 0.2 余量 + 输入泳道 2(有电压表才…此设计无电压表 → pad 0.3)
  assert.equal(L.h, Math.round((0.9 + 2 + 6 + 0.2 + 0.3) * 100) / 100);
});

test('customLayout:端口数撑大模块宽度(接口 2 格间距)', () => {
  const cells = Array.from({ length: 6 }, (_, i) => ({ id: 'c' + i, kind: 'knob' }));
  const L = customLayout({ cols: 1, span: 2, cells });
  assert.equal(L.outs.length, 6);
  assert.ok(L.w >= L.outs.length * 2, '宽度足够排开 6 个输出口');
});

test('customLayout:跨距/列数被夹取到合法范围', () => {
  const L = customLayout({ cols: 99, span: 99, cells: [{ id: 'x', kind: 'knob' }] });
  assert.equal(L.cols, 6);
  assert.equal(L.span, 5);
});

test('newCustomKey:不与已注册定义冲突', () => {
  DEFS['custom#1'] = { id: 'custom#1' };
  state.uid = 1;
  const key = newCustomKey();
  assert.ok(!DEFS[key]);
  assert.match(key, /^custom#\d+$/);
});
