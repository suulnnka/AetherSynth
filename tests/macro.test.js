import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureMacroSpec } from '../src/workshop/macros.js';

/** 构造假组件 / 假接线(无需 DOM 与音频) */
function mod(id, defId, cx, cy, w, h, ports) {
  const portsById = {};
  const plist = ports.map(([pid, dir, type]) => {
    const p = { id: pid, dir, name: pid, type: type || 'audio' };
    portsById[pid] = p;
    return p;
  });
  return { id, cx, cy, state: { v: 3 },
    def: { id: defId, name: defId.toUpperCase(), w, h, ports: plist, portsById } };
}

function build() {
  const mods = new Map();
  mods.set(1, mod(1, 'knob', 4, 4, 2, 5, [['CV', 'out']]));
  mods.set(2, mod(2, 'vcf', 8, 4, 8, 5, [['LP', 'out'], ['IN', 'in'], ['CUTOFF', 'in']]));
  mods.set(3, mod(3, 'vco', 0, 2, 8, 6, [['SIN', 'out']]));
  mods.set(9, mod(9, 'spk', 20, 4, 4, 5, [['IN', 'in']]));
  const cables = new Map();
  return { mods, cables };
}

test('captureMacroSpec:内部接线入 wires,边界接线引出对外接口', () => {
  const { mods, cables } = build();
  cables.set(1, { a: { m: 1, p: 'CV' }, b: { m: 2, p: 'IN' }, color: '#3a86c8' });   // 内部
  cables.set(2, { a: { m: 3, p: 'SIN' }, b: { m: 2, p: 'IN' }, color: '#111111' });  // 边界入
  cables.set(3, { a: { m: 2, p: 'LP' }, b: { m: 9, p: 'IN' }, color: '#222222' });   // 边界出
  const { spec, boundary } = captureMacroSpec([1, 2], mods, cables, '滤波通道');

  assert.equal(spec.name, '滤波通道');
  assert.equal(spec.members.length, 2);
  assert.deepEqual(spec.members.map(m => m.rid), ['m1', 'm2']);   // 按位置排序
  assert.equal(spec.wires.length, 1);
  assert.deepEqual(spec.wires[0].a, ['m1', 'CV']);
  assert.deepEqual(spec.wires[0].b, ['m2', 'IN']);
  // 边界接线 → 两个对外接口:IN(入)与 LP(出);knob.CV 未接线 → 不引出
  assert.equal(spec.ports.length, 2);
  const pin = spec.ports.find(p => p.dir === 'in');
  const pout = spec.ports.find(p => p.dir === 'out');
  assert.equal(pin.port, 'IN');
  assert.equal(pout.port, 'LP');
  assert.equal(boundary.length, 2);
  // 整格尺寸:包围盒 (4..16, 4..9) + 四周各 1 格
  assert.equal(spec.w, 14);
  assert.equal(spec.h, 7);
  for (const m of spec.members) {
    assert.ok(Number.isInteger(m.dx) && m.dx >= 1);
    assert.ok(Number.isInteger(m.dy) && m.dy >= 1);
  }
});

test('captureMacroSpec:与宏无关的接线不受影响,状态深拷贝', () => {
  const { mods, cables } = build();
  cables.set(1, { a: { m: 1, p: 'CV' }, b: { m: 9, p: 'IN' }, color: '#fff' });  // 边界出
  const { spec, boundary } = captureMacroSpec([1], mods, cables);
  assert.equal(spec.members.length, 1);
  assert.equal(spec.wires.length, 0);
  assert.equal(spec.ports.length, 1);
  assert.equal(spec.ports[0].dir, 'out');
  assert.equal(boundary[0].far.m, 9);
  assert.equal(spec.members[0].s.v, 3);
});

test('captureMacroSpec:成员尺寸整格(w / h 为整数)', () => {
  const { mods, cables } = build();
  cables.set(1, { a: { m: 1, p: 'CV' }, b: { m: 2, p: 'IN' }, color: '#fff' });
  const { spec } = captureMacroSpec([1, 2], mods, cables);
  assert.ok(Number.isInteger(spec.w) && Number.isInteger(spec.h));
});
