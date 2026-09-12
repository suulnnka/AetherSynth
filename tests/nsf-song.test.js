import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NSF_TRACKS } from '../src/songs/nsf-data.js';
import { ROLL_KEYS } from '../src/modules/sequencer.js';

/* 「NSF 转谱」数据约束:每轨 4 段(卷帘单实例上限 4 小节 = 64 格),
   音符落在段内、键域在卷帘范围内、力度 1~10。 */
test('NSF 转谱:四轨 × 4 段,音符格位 / 键域 / 力度合法', () => {
  assert.deepEqual(Object.keys(NSF_TRACKS), ['p1', 'p2', 'tri', 'noi']);
  for (const [key, secs] of Object.entries(NSF_TRACKS)) {
    assert.equal(secs.length, 4, key + ' 应为 4 段');
    for (const [si, notes] of secs.entries()) {
      for (const [c, k, l, v] of notes) {
        assert.ok(c >= 0 && c < 64, `${key}[${si}] 起始格 ${c} 应在段内`);
        assert.ok(k >= 0 && k < ROLL_KEYS, `${key}[${si}] 键位 ${k} 应在卷帘键域`);
        assert.ok(l >= 1 && c + l <= 64, `${key}[${si}] 音符越出段尾`);
        assert.ok(v >= 1 && v <= 10, `${key}[${si}] 力度 ${v} 应为 1~10`);
      }
    }
  }
});

test('NSF 转谱:每轨都有足量音符,长度并非等长(卷帘存在的意义)', () => {
  for (const [key, secs] of Object.entries(NSF_TRACKS)) {
    const all = secs.flat();
    assert.ok(all.length >= 100, key + ' 每循环至少 100 音');
    assert.ok(new Set(all.map(n => n[2])).size >= 3, key + ' 音符长度应多于一种');
  }
});
