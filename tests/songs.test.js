import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS } from '../src/songs/data.js';

test('歌曲数据:每首 8 步,鼓轨数值 0~8,音高为半音伏特或休止', () => {
  assert.ok(SONGS.length >= 3, '至少三首示例曲');
  for (const s of SONGS) {
    for (const track of ['kick', 'snare', 'hat']) {
      assert.equal(s[track].length, 8, s.id + '.' + track + ' 应为 8 步');
      for (const v of s[track]) assert.ok(v >= 0 && v <= 8, s.id + '.' + track + ' 力度 0~8');
    }
    assert.ok(s.bpm >= 60 && s.bpm <= 200, s.id + ' BPM 合理');
    for (const t of ['bass', 'guitar', 'lead']) {
      const spec = s[t];
      assert.equal(spec.notes.length, 8, s.id + '.' + t + ' 应为 8 步');
      for (const n of spec.notes) if (n != null) assert.ok(n >= 0 && n <= 36, s.id + '.' + t + ' 音高伏特 0~3 个八度');
    }
  }
});

test('歌曲 id 唯一', () => {
  const ids = SONGS.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length);
});
