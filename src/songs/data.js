/* 内置示例歌曲(原创作品):
   每首 = 一个完整的多音轨模块补丁:时钟 → 5 条音序器轨道
   (底鼓 / 军鼓 / 踩镲 / 贝斯 / 吉他 / 主音)→ 混音 → 喇叭。
   鼓轨:旋钮值 = 力度(0 = 休止);乐器轨:旋钮值 = 音高伏特(1V/oct,0 = 休止)。 */

export const SONGS = [
  {
    id: 'star', name: '星爵放克 · Star Funk', bpm: 122,
    kick:  [8, 0, 0, 3, 0, 0, 6, 0],
    snare: [0, 0, 0, 0, 8, 0, 0, 4],
    hat:   [5, 2, 5, 2, 5, 2, 6, 3],
    bass:   { oct: -2, cut: 2.6, res: 1.2, sus: null, notes: [9, null, 9, 12, null, 7, 9, null] },
    guitar: { oct: 0, cut: 4.5, res: 3, sus: 1.6, notes: [12, 16, 19, 24, 19, 16, 12, 16] },
    lead:   { oct: 1, sus: 8, notes: [24, null, null, 22, null, 19, null, null] }
  },
  {
    id: 'nebula', name: '星云慢舞 · Nebula', bpm: 84,
    kick:  [8, 0, 0, 0, 0, 0, 3, 0],
    snare: [0, 0, 0, 0, 6, 0, 0, 0],
    hat:   [3, 0, 4, 0, 3, 0, 4, 2],
    bass:   { oct: -2, cut: 2, res: 0.8, sus: null, notes: [0, null, null, null, 7, null, null, null] },
    guitar: { oct: 0, cut: 5, res: 2, sus: 2.5, notes: [16, 19, 23, 28, 23, 19, 16, 19] },
    lead:   { oct: 1, sus: 8, notes: [28, null, 26, null, 23, null, null, null] }
  },
  {
    id: 'jump', name: '跃迁狂奔 · Jump Run', bpm: 150,
    kick:  [8, 0, 0, 0, 8, 0, 0, 0],
    snare: [0, 0, 0, 0, 8, 0, 0, 6],
    hat:   [2, 5, 2, 5, 2, 5, 2, 6],
    bass:   { oct: -2, cut: 3, res: 2, sus: null, notes: [4, 4, null, 4, 4, null, 2, null] },
    guitar: { oct: 0, cut: 4, res: 4, sus: 1.2, notes: [null, null, 7, null, null, null, 4, null] },
    lead:   { oct: 1, sus: 7, notes: [16, null, 14, 16, null, 19, 16, 14] }
  }
];
