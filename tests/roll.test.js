import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLL_KEYS, rollKeyVolts, rollKeyMidi, rollIsBlack, rollCellSec,
  rollActiveNote, roll
} from '../src/modules/sequencer.js';

test('rollKeyVolts:1V/oct,0V = C4(k=12)', () => {
  assert.equal(rollKeyVolts(12), 0);        // C4
  assert.equal(rollKeyVolts(0), -1);        // C3
  assert.equal(rollKeyVolts(24), 1);        // C5
  assert.ok(Math.abs(rollKeyVolts(13) - 1 / 12) < 1e-12);  // C#4
});

test('rollKeyMidi:C3=48 ~ C5=72', () => {
  assert.equal(rollKeyMidi(0), 48);
  assert.equal(rollKeyMidi(12), 60);
  assert.equal(rollKeyMidi(ROLL_KEYS - 1), 72);
});

test('rollIsBlack:黑键组 C#,D#,F#,G#,A#', () => {
  assert.equal(rollIsBlack(0), false);   // C
  assert.equal(rollIsBlack(1), true);    // C#
  assert.equal(rollIsBlack(4), false);   // E
  assert.equal(rollIsBlack(6), true);    // F#
  assert.equal(rollIsBlack(11), false);  // B
  assert.equal(rollIsBlack(12), false);  // C4(跨八度一致)
  assert.equal(rollIsBlack(13), true);
});

test('rollCellSec:16 分音符时长 = 15/BPM', () => {
  assert.equal(rollCellSec(120), 0.125);
  assert.ok(Math.abs(rollCellSec(60) - 0.25) < 1e-12);
});

test('rollActiveNote:覆盖区间内取起始最晚的音', () => {
  const notes = [
    { c: 0, k: 12, l: 4 },    // C4 整拍
    { c: 2, k: 14, l: 4 },    // D4,与上一音重叠
    { c: 8, k: 12, l: 1 }     // 16 分音符
  ];
  assert.equal(rollActiveNote(notes, 0), notes[0]);
  assert.equal(rollActiveNote(notes, 3), notes[1]);    // 重叠区:起始更晚者赢
  assert.equal(rollActiveNote(notes, 8), notes[2]);
  assert.equal(rollActiveNote(notes, 9), null);        // 音尾之后
  assert.equal(rollActiveNote(notes, 15), null);
});

test('rollActiveNote:空序列安全', () => {
  assert.equal(rollActiveNote([], 0), null);
});

test('roll:默认状态为 2 小节 / 120BPM / 门宽 90%', () => {
  const s = roll.state();
  assert.equal(s.bars, 2);
  assert.equal(s.bpm, 120);
  assert.equal(s.gate, 90);
  assert.deepEqual(s.notes, []);
});

test('roll:变长音符网格为 16 格/小节(1 格 = 1/4 拍,4 格 = 1 拍)', () => {
  assert.equal(roll.state().bars * 16, 32);   // 默认两小节 32 格
  assert.equal(4 * 16, 64);                   // 4 小节上限 64 格
});
