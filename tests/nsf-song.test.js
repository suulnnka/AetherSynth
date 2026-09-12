import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NSF_TRACKS } from '../src/songs/nsf-data.js';
import { ROLL_KEYS } from '../src/modules/sequencer.js';

/* 「NSF 转谱」全曲数据约束:每轨 4 个乐段(每条卷帘 16 小节 = 256 格),
   音符落在乐段内、键域在卷帘范围内、力度 1~10。 */
test('NSF 转谱:四轨 × 4 乐段,音符格位 / 键域 / 力度合法', () => {
  assert.deepEqual(Object.keys(NSF_TRACKS), ['p1', 'p2', 'tri', 'noi']);
  for (const [key, movs] of Object.entries(NSF_TRACKS)) {
    assert.equal(movs.length, 4, key + ' 应为 4 个乐段');
    for (const [mi, notes] of movs.entries()) {
      for (const [c, k, l, v] of notes) {
        assert.ok(c >= 0 && c < 256, `${key}[${mi}] 起始格 ${c} 应在乐段内`);
        assert.ok(k >= 0 && k < ROLL_KEYS, `${key}[${mi}] 键位 ${k} 应在卷帘键域`);
        assert.ok(l >= 1 && c + l <= 256, `${key}[${mi}] 音符越出乐段尾`);
        assert.ok(v >= 1 && v <= 10, `${key}[${mi}] 力度 ${v} 应为 1~10`);
      }
    }
  }
});

test('NSF 转谱:全曲结构与编排意图', () => {
  // 方波主音:引子(乐段 1 前半)与 Breakdown(乐段 3 前半)应休止
  for (const mi of [0, 2])
    assert.ok(NSF_TRACKS.p1[mi].every(n => n[0] >= 128), `p1 乐段 ${mi + 1} 前半应休止`);
  // 贝斯 / 镲:引子与 Breakdown 前半应持续演奏
  for (const key of ['tri', 'noi'])
    for (const mi of [0, 2])
      assert.ok(NSF_TRACKS[key][mi].some(n => n[0] < 128), `${key} 乐段 ${mi + 1} 前半应有声`);
  // 末乐段以终止长音收束(最后一音长 ≥ 2 小节且落在终止小节)
  for (const key of ['p1', 'p2', 'tri']) {
    const last = NSF_TRACKS[key][3].at(-1);
    assert.ok(last[0] >= 192 && last[2] >= 32, key + ' 末乐段应以长音收束');
  }
  // 音符长度并非等长(卷帘存在的意义)
  for (const [key, movs] of Object.entries(NSF_TRACKS)) {
    const lens = new Set(movs.flat().map(n => n[2]));
    assert.ok(lens.size >= 3, key + ' 音符长度应多于一种');
  }
});
