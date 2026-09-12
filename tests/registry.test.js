import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DEFS, DEFS_ORDER, registerDef, setDefOrder, finalizeRegistry } from '../src/core/registry.js';
import { registerAllModules, MODULE_ORDER } from '../src/modules/index.js';

beforeEach(() => {
  for (const k of Object.keys(DEFS)) delete DEFS[k];
  DEFS_ORDER.length = 0;
});

test('registerAllModules:注册全部 51 个内置组件并排版接口', () => {
  registerAllModules();
  assert.equal(DEFS_ORDER.length, 51);
  assert.equal(Object.keys(DEFS).length, 51);
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

test('音频效果器与立体声喇叭:端口类型正确', () => {
  registerAllModules();
  assert.equal(DEFS.comp.portsById.IN.type, 'audio');
  assert.equal(DEFS.comp.portsById.THRESH.type, 'cv');
  assert.equal(DEFS.comp.portsById.RATIO.type, 'cv');
  assert.equal(DEFS.bquant.portsById.BITS.type, 'cv');
  assert.equal(DEFS.sred.portsById.RATE.type, 'cv');
  assert.deepEqual(DEFS.spk.ports.map(p => p.id), ['L', 'R']);
  assert.equal(DEFS.spk.portsById.L.type, 'audio');
});

test('新增组件:放大器 / 一分八 / 频谱仪', () => {
  registerAllModules();
  assert.equal(DEFS.amp.portsById.GAIN.type, 'cv');
  assert.equal(DEFS.mult8.ports.length, 9);          // IN + 8 出
  assert.equal(DEFS.mult8.portsById.O8.type, 'any');
  assert.equal(DEFS.spec.portsById.IN.type, 'any');
});

test('时钟与相位同步:clk / SYNC / DUTY / PUL 端口就位', () => {
  registerAllModules();
  assert.equal(DEFS.clk.portsById.OUT.type, 'gate');
  assert.equal(DEFS.clk.portsById.RST.type, 'gate');
  for (const id of ['vco', 'fm', 'lfo']) {
    assert.equal(DEFS[id].portsById.SYNC.type, 'gate', id + ' 应有 SYNC 同步口');
  }
  assert.equal(DEFS.vco.portsById.PUL.dir, 'out');
  assert.equal(DEFS.vco.portsById.DUTY.type, 'cv');
  assert.equal(DEFS.lfo.portsById.DUTY.type, 'cv');
});

test('FLOW:三个效果器都有信号来路(休眠判定可用)', async () => {
  registerAllModules();
  const { FLOW } = await import('../src/core/flow.js');
  for (const id of ['comp', 'bquant', 'sred']) {
    assert.deepEqual(FLOW[id].OUT, ['IN'], id + ' 的 OUT 应由 IN 馈入');
  }
});

test('registerDef + setDefOrder:动态注册不进入展示顺序表', () => {
  registerAllModules();
  registerDef({ id: 'composite#1', name: 'x', ports: [{ id: 'IN1', dir: 'in', name: 'IN1' }], w: 4, h: 4 });
  assert.ok(DEFS['composite#1']);
  assert.ok(!DEFS_ORDER.includes('composite#1'));
});
