import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DEFS, DEFS_ORDER, registerDef, setDefOrder, finalizeRegistry } from '../src/core/registry.js';
import { registerAllModules, MODULE_ORDER } from '../src/modules/index.js';

beforeEach(() => {
  for (const k of Object.keys(DEFS)) delete DEFS[k];
  DEFS_ORDER.length = 0;
});

test('registerAllModules:注册全部 44 个内置组件并排版接口', () => {
  registerAllModules();
  assert.equal(DEFS_ORDER.length, 44);
  assert.equal(Object.keys(DEFS).length, 44);
  for (const id of MODULE_ORDER) {
    const d = DEFS[id];
    assert.ok(d, '缺少组件:' + id);
    assert.ok(d.ports.length >= 1, id + ' 至少有一个接口');
    assert.ok(d.portsById, id + ' 完成接口排版');
    for (const p of d.ports) {
      assert.ok(['audio', 'cv', 'gate', 'any', 'midi'].includes(p.type), id + ':' + p.id + ' 类型合法');
      assert.equal(typeof p._x, 'number');
      assert.equal(typeof p._y, 'number');
    }
  }
});

test('PORT_TYPES:信号类型映射正确(MIDI / Gate / CV)', () => {
  registerAllModules();
  assert.equal(DEFS.keyboard.portsById.MIDI.type, 'midi');
  assert.equal(DEFS.keyboard.portsById.GATE.type, 'gate');
  assert.equal(DEFS.knob.portsById.CV.type, 'cv');
  assert.equal(DEFS.switch.portsById.GATE.type, 'gate');
  assert.equal(DEFS.vcf.portsById.IN.type, 'audio');
});

test('cvAll:标记的组件全部接口默认 CV', () => {
  registerAllModules();
  for (const p of DEFS.step6.ports) assert.equal(p.type, 'cv');
  for (const p of DEFS.sel.ports) assert.equal(p.type, 'cv');
});

test('registerDef + setDefOrder:动态注册不进入展示顺序表', () => {
  registerAllModules();
  registerDef({ id: 'composite#1', name: 'x', ports: [{ id: 'IN1', dir: 'in', name: 'IN1' }], w: 4, h: 4 });
  assert.ok(DEFS['composite#1']);
  assert.ok(!DEFS_ORDER.includes('composite#1'));
});
