import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { computeActive, SINK_DEFS } from '../src/core/flow.js';
import { state, resetState } from '../src/core/state.js';

/** 造一个假组件:def 只需要 id / ports / flow */
function fakeMod(id, defId, ports, flow) {
  return {
    id, def: { id: defId, ports: ports.map(([pid, dir]) => ({ id: pid, dir })), ...(flow ? { flow } : {}) }
  };
}

beforeEach(() => resetState());

test('只有通到显示终端的链路才活跃', () => {
  // vco → vcf → vca → spk 全活;旁路 lfo 休眠
  state.mods.set(1, fakeMod(1, 'vco', [['SIN', 'out'], ['VOCT', 'in']]));
  state.mods.set(2, fakeMod(2, 'vcf', [['LP', 'out'], ['IN', 'in'], ['CUTOFF', 'in']]));
  state.mods.set(3, fakeMod(3, 'vca', [['OUT', 'out'], ['IN', 'in']]));
  state.mods.set(4, fakeMod(4, 'spk', [['IN', 'in']]));
  state.mods.set(5, fakeMod(5, 'lfo', [['SIN', 'out']]));
  // 线缆:b 是输入侧
  const cable = (am, ap, bm, bp) => state.cables.set(Math.random(), { a: { m: am, p: ap }, b: { m: bm, p: bp } });
  cable(1, 'SIN', 2, 'IN');
  cable(2, 'LP', 3, 'IN');
  cable(3, 'OUT', 4, 'IN');

  const act = computeActive(state.mods, state.cables);
  assert.ok(act.has(1) && act.has(2) && act.has(3) && act.has(4), '主链路活跃');
  assert.ok(!act.has(5), '未接入的 LFO 休眠');
});

test('调制口拉活:接到活跃滤波器 CUTOFF 的旋钮也活跃', () => {
  state.mods.set(1, fakeMod(1, 'vcf', [['LP', 'out'], ['IN', 'in'], ['CUTOFF', 'in']]));
  state.mods.set(2, fakeMod(2, 'spk', [['IN', 'in']]));
  state.mods.set(3, fakeMod(3, 'knob', [['CV', 'out']]));
  state.cables.set(1, { a: { m: 1, p: 'LP' }, b: { m: 2, p: 'IN' } });
  state.cables.set(2, { a: { m: 3, p: 'CV' }, b: { m: 1, p: 'CUTOFF' } });

  const act = computeActive(state.mods, state.cables);
  assert.ok(act.has(3), '旋钮经 FLOW 馈入关系被拉活');
});

test('SINK_DEFS 里的动态键(自制电压表组件)也作为归宿', () => {
  SINK_DEFS['custom#9'] = 1;
  try {
    state.mods.set(9, fakeMod(9, 'custom#9', [['IN', 'in']]));
    state.mods.set(10, fakeMod(10, 'vco', [['SIN', 'out']]));
    state.cables.set(1, { a: { m: 10, p: 'SIN' }, b: { m: 9, p: 'IN' } });
    const act = computeActive(state.mods, state.cables);
    assert.ok(act.has(9) && act.has(10));
  } finally {
    delete SINK_DEFS['custom#9'];
  }
});

test('自带信号源的输出口不需要 FLOW(旋钮接喇叭即活)', () => {
  state.mods.set(1, fakeMod(1, 'knob', [['CV', 'out']]));
  state.mods.set(2, fakeMod(2, 'scope', [['IN', 'in']]));
  state.cables.set(1, { a: { m: 1, p: 'CV' }, b: { m: 2, p: 'IN' } });
  const act = computeActive(state.mods, state.cables);
  assert.ok(act.has(1) && act.has(2));
});
