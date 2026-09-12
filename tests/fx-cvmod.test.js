import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkDriveCurve } from '../src/modules/fx.js';
import { fx } from '../src/modules/fx.js';
import { cvmod } from '../src/modules/cvmod.js';

test('drive:曲线软削顶、归一化、单调', () => {
  const c = mkDriveCurve(8);
  assert.equal(c.length, 257);
  assert.equal(c[0], -1);            // 负满幅
  assert.equal(c[128], 0);           // 零点过中心
  assert.ok(Math.abs(c[256] - 1) < 1e-9);   // 正满幅归一
  assert.ok(c[200] > 0.8 && c[200] < 1);    // 软削顶:接近但不超过 1
  for (let i = 1; i < c.length; i++) assert.ok(c[i] >= c[i - 1]);   // 单调
});

test('fx/cvmod:接口与 flow 结构完整', () => {
  for (const def of [...Object.values(fx), ...Object.values(cvmod)]) {
    const outs = def.ports.filter(p => p.dir === 'out').map(p => p.id);
    assert.ok(outs.length >= 1, def.id + ' 缺输出口');
    assert.deepEqual(Object.keys(def.flow), outs, def.id + ' flow 与输出口不一致');
    for (const o of outs) for (const f of def.flow[o]) assert.ok(def.ports.some(p => p.id === f), def.id + ' flow 引用不存在的口');
    assert.ok(def.build && def.dispose, def.id + ' 缺生命周期');
  }
});

test('cvmod:envf 归类为信号源,glide/ringmod 为处理', () => {
  assert.equal(cvmod.envf.cat, 'source');
  assert.equal(cvmod.glide.cat, 'process');
  assert.equal(cvmod.ringmod.cat, 'process');
});

test('fx:全部为 process 类(效果挂处理区)', () => {
  for (const def of Object.values(fx)) assert.equal(def.cat, 'process');
});
