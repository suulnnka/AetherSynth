import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KALINKA_TRACKS } from '../src/songs/kalinka-data.js';
import { ROLL_KEYS } from '../src/modules/sequencer.js';

/* 「Kalinka」开源音序(pinobatch/pently,zlib;原曲 I. Larionov 民歌,公有领域):
   每轨 4 个乐段(每条卷帘 16 小节 = 256 格),音符落在乐段内、键域在卷帘
   范围内、力度 1~10。 */
test('Kalinka 音序:四轨 × 4 乐段,音符格位 / 键域 / 力度合法', () => {
  assert.deepEqual(Object.keys(KALINKA_TRACKS), ['p1', 'p2', 'tri', 'noi']);
  for (const [key, movs] of Object.entries(KALINKA_TRACKS)) {
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

test('Kalinka 音序:全曲结构与编排意图', () => {
  const inRange = (ns, a, b) => ns.filter(n => n[0] >= a && n[0] < b);
  // 引子(乐段 1 开头 2 小节):三声部长音 + 单个军鼓收尾
  for (const key of ['p1', 'p2', 'tri']) {
    const intro = inRange(KALINKA_TRACKS[key][0], 0, 32);
    assert.ok(intro.length >= 3, key + ' 引子应有三声部长音');
    assert.ok(intro[0][2] >= 8, key + ' 引子首音应为长音');
  }
  assert.deepEqual(inRange(KALINKA_TRACKS.noi[0], 0, 32).map(n => n[0]), [28],
    '引子噪声轨应只有第 2 小节末的军鼓');
  // 引子回声(乐段 1 末尾 2 小节)与引子同材料:p1 键位一致
  assert.deepEqual(inRange(KALINKA_TRACKS.p1[0], 224, 256),
    inRange(KALINKA_TRACKS.p1[0], 0, 32).map(([c, k, l, v]) => [c + 224, k, l, v]),
    '引子回声应是引子的原位重现');
  // Breakdown(乐段 3 前半):和弦声部休止,贝斯 / 鼓持续
  for (const key of ['p2', 'tri', 'noi'])
    assert.ok(inRange(KALINKA_TRACKS[key][2], 0, 128).length >= 32, key + ' Breakdown 应持续演奏');
  assert.equal(inRange(KALINKA_TRACKS.p1[2], 0, 128).length, 0, 'Breakdown 旋律应休止');
  // 主题 A 段:方波和声贝斯与三角波同节奏、相差一个八度
  const p2A = inRange(KALINKA_TRACKS.p2[0], 32, 160), triA = inRange(KALINKA_TRACKS.tri[0], 32, 160);
  assert.equal(p2A.length, triA.length, 'A 段两轨贝斯音数应一致');
  assert.deepEqual(p2A.map(n => n[0]), triA.map(n => n[0]), 'A 段两轨贝斯应同节奏');
  assert.deepEqual(p2A.map(n => n[1]), triA.map(n => n[1] + 12), 'A 段方波贝斯应比三角波高八度');
  // 主题最高音 = 源曲 c''(卷帘顶格 C6)
  assert.ok(KALINKA_TRACKS.p1.flat().some(n => n[1] === 48), '主旋律应触及 C6');
  // 末乐段以终止长音收束(三声部最后一音落在末小节、长 1 小节),鼓先行停止
  for (const key of ['p1', 'p2', 'tri']) {
    const last = KALINKA_TRACKS[key][3].at(-1);
    assert.ok(last[0] >= 240 && last[2] >= 16, key + ' 末乐段应以长音收束');
  }
  assert.ok(KALINKA_TRACKS.noi[3].every(n => n[0] + n[2] <= 196), '末乐段鼓应让位给终句长音');
  // 音符长度并非等长(卷帘存在的意义)
  for (const [key, movs] of Object.entries(KALINKA_TRACKS)) {
    const lens = new Set(movs.flat().map(n => n[2]));
    assert.ok(lens.size >= 3, key + ' 音符长度应多于一种');
  }
});
