import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutDefPorts, SHELL, BASE } from '../src/core/ports.js';

test('layoutDefPorts:单输出接口落在网格中心线上', () => {
  const def = { w: 2, h: 5, ports: [{ id: 'CV', dir: 'out', name: 'CV' }] };
  layoutDefPorts(def);
  const p = def.ports[0];
  assert.equal(p.type, 'audio');                 // 未声明的口默认音频
  assert.equal(def.portsById.CV, p);
  assert.equal(p._x, 1);                          // 2/2 - 0 = 1(水平居中)
  assert.equal(p._y, SHELL.jackOutC);             // 输出泳道
});

test('layoutDefPorts:多接口按 2 格间距对称展开', () => {
  const def = {
    w: 8, h: 6,
    ports: [
      { id: 'A', dir: 'out', name: 'A' },
      { id: 'B', dir: 'out', name: 'B' },
      { id: 'C', dir: 'out', name: 'C' },
      { id: 'IN', dir: 'in', name: 'IN' }
    ]
  };
  layoutDefPorts(def);
  const xs = def.ports.filter(p => p.dir === 'out').map(p => p._x);
  assert.deepEqual(xs, [2, 4, 6]);
  assert.equal(xs[2] - xs[0], 4);                 // 相邻口 2 格
  // 输入口在底部泳道
  const pin = def.portsById.IN;
  assert.equal(pin._y, 6 - SHELL.jackInFromBottomC);
});

test('layoutDefPorts:索引包含全部接口', () => {
  const def = {
    w: 4, h: 4,
    ports: [{ id: 'O', dir: 'out', name: 'O' }, { id: 'I', dir: 'in', name: 'I' }]
  };
  layoutDefPorts(def);
  assert.deepEqual(Object.keys(def.portsById).sort(), ['I', 'O']);
});

test('BASE 设计像素为 24,外壳常量与文档一致', () => {
  assert.equal(BASE, 24);
  assert.equal(SHELL.headerC, 0.9);
  assert.equal(SHELL.laneC, 2.0);
  assert.equal(SHELL.padC, 0.3);
});
