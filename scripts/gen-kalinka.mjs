/* 离线转谱脚本:把 pinobatch/pently(audio/pino-a53.pently,zlib 许可证)
   中的「RHDE Kalinka」按 Pently 记谱语义展开为钢琴卷帘数据,并把生成的
   src/songs/kalinka-data.js 打到 stdout。
   运行:node scripts/gen-kalinka.mjs */

const SEMI = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11, h: 11 };   // 音名 → 半音
const LETTER = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6, h: 6 };   // 音名 → 级位
const SCALE16 = 16;                 // 每小节 16 格(16 分音符,与卷帘一致)
const GLOBAL_XPOSE = 12;            // 全曲 +12,适配卷帘 C2~C6 键域
const NOTE_RE = /^([cdefgabh])(bb|--|eses|b|-|es|##|\+\+|isis|x|s|\+|is)?('{1,4}|,{1,4})?(\d+)?(\.{1,2})?$/;

const accidental = a => ['bb', '--', 'eses'].includes(a) ? -2
  : ['b', '-', 'es'].includes(a) ? -1
  : ['x', '##', '++', 'isis'].includes(a) ? 2
  : ['s', '#', '+', 'is'].includes(a) ? 1 : 0;
const rowsOf = (n, dot) => Math.round(SCALE16 / n * (dot === '..' ? 1.75 : dot ? 1.5 : 1));

/* ---- Pently 记谱 token → 事件 [{at, pitch|drum, rows}] ----
   ENxx / MPx / @inst 琶音、颤音、换音色记号与 | 小节线不占时值,跳过
   (转谱约定:琶音简化为单音);w = 延音线,把行数并入前一个音;r/p = 休止;
   时值缺省沿用前面的(durations stick 语义),首个缺省 = 1 拍 = 4 格。 */
function parseEvents(tokens, { relative = false } = {}) {
  const out = [];
  let row = 0, dur = 4, refStep = 4 * 7 + LETTER.f;      // relative 参考:f(中音 C 下方)
  for (const tok of tokens) {
    if (/^(EN|MP|@|\|)/.test(tok) || tok === 'relative' || tok === 'absolute' || tok === 'fallthrough') continue;
    const drum = tok.match(/^(kick|snare|clhat|ohat|kickohat|snareohat)(\d+)?(\.{1,2})?$/);
    const rest = tok.match(/^([rp])(\d+)?(\.{1,2})?$/);
    const tie = tok.match(/^(w)(\d+)?(\.{1,2})?$/);
    const note = tok.match(NOTE_RE);
    if (drum || rest || tie) {
      const m = drum || rest || tie;
      const n = +(m[2] ?? 0), dot = m[3];
      if (n) dur = rowsOf(n, dot);                         // 缺省沿用 sticky 时值
      if (tie) { out[out.length - 1].rows += dur; row += dur; }
      else if (drum) { out.push({ at: row, drum: drum[1], rows: dur }); row += dur; }
      else row += dur;                                     // 休止
    } else if (note) {
      const [, name, acc = '', oct = '', num, dot] = note;
      if (num) dur = rowsOf(+num, dot);
      const accSemi = accidental(acc);
      let pitch;
      if (relative) {            // LilyPond 式:按音名级位取离参考最近的八度,再按 ' / , 整体升降
        const l = LETTER[name];
        let step = null;
        for (let o = 1; o <= 7; o++)
          if (step === null || Math.abs(o * 7 + l - refStep) < Math.abs(step - refStep)) step = o * 7 + l;
        pitch = Math.floor(step / 7) * 12 + SEMI[name] + accSemi;
        if (oct) pitch += 12 * oct.length * (oct[0] === "'" ? 1 : -1);
        refStep = step + (oct ? 7 * oct.length * (oct[0] === "'" ? 1 : -1) : 0);
      } else {
        pitch = 48 + SEMI[name] + accSemi; // absolute:c..h = 中音 C 下方八度,c' = 中音 C
        if (oct) pitch += 12 * oct.length * (oct[0] === "'" ? 1 : -1);
      }
      out.push({ at: row, pitch, rows: dur });
      row += dur;
    } else throw new Error('无法解析: ' + tok);
  }
  return out;
}

/* ---- 乐谱(与 pino-a53.pently 的 rhde_kalinka 逐行对应) ---- */
const intro      = parseEvents("eb'2 db'2 c'2. r4".split(' '));
const introdrum  = parseEvents('r1 r2. snare4'.split(' '));
const bassA      = parseEvents("c8 c' c bb c c' c c' e e' e e' f f' ab ab'".split(' '));
const partA      = parseEvents("g8 bb g bb ENM c'' EN0 g bb g e e g bb f f ab c'".split(' '));
const drum       = parseEvents('kick8 clhat snare clhat kick clhat16 clhat snare8 clhat kick8 clhat snare clhat kick clhat snare16 clhat snareohat8'.split(' '));
const drumfill   = parseEvents('snareohat16 snare snare snare'.split(' '));
const bassB      = parseEvents("f8 f' f f' f f' f eb' c c' c c' db db' db db'".split(' '));
const chordsB    = parseEvents('EN055 c2 w4. bb,8 g2 ab'.split(' '));
const ending_p1  = parseEvents('ENOF ab8 w1 bb c1'.split(' '), { relative: true });
const ending_p2  = parseEvents("c'8 w1 f2 g ab1".split(' '), { relative: true });
const ending_tri = parseEvents("db'8 w1 eb ab,".split(' '), { relative: true });

/* ---- 分发:pulse = 写谱音高 + play 移调;triangle 天然低八度;
   noise 只保留节奏(k = 48)。行数即 16 分音符格,音高换算成卷帘键位
   k(MIDI − 36,C2 = 0),全曲再 +12 半音适配 C2~C6 键域。 ---- */
const VELOCITY = { p1: 10, p2: 9, tri: 10, noi: 9 };

function movement(mvt) {
  const t = { p1: [], p2: [], tri: [], noi: [] };
  const at = (evts, ch, xpose, base) => {
    for (const e of evts) {
      const c = base + e.at;
      const midi = ch === 'tri' ? e.pitch - 12 + xpose : e.pitch + xpose;
      const k = ch === 'noi' ? 48 : midi + GLOBAL_XPOSE - 36;
      if (k < 0 || k > 48) throw new Error(`键位越界 k=${k} @${c} (${ch})`);
      t[ch].push([c, k, e.rows, VELOCITY[ch]]);
    }
  };
  const A = base => {                       // 主题 8 小节:2 小节乐型 ×4
    for (const r of [0, 32, 64, 96]) {
      at(partA, 'p1', 0, base + r);
      at(bassA, 'p2', -12, base + r);
      at(bassA, 'tri', -12, base + r);
      at(drum, 'noi', 0, base + r);
    }
  };
  const B = (base, melody = true) => {      // 副歌 4 小节:2 小节乐型 ×2(breakdown 时和弦休止)
    for (const r of [0, 32]) {
      if (melody) at(chordsB, 'p1', 0, base + r);
      at(bassB, 'p2', -12, base + r);
      at(bassB, 'tri', -12, base + r);
      at(drum, 'noi', 0, base + r);
    }
  };
  const Intro = base => {                    // 引子:三声部(Eb→Db→C 长音)+ 军鼓尾
    at(intro, 'tri', 12, base);
    at(intro, 'p1', -5, base);
    at(intro, 'p2', 4, base);
    at(introdrum, 'noi', 0, base);
  };
  if (mvt === 1) { Intro(0); A(32); B(160); Intro(224); }
  if (mvt === 2) { B(0); A(64); B(192); }
  if (mvt === 3) { B(0, false); B(64, false); A(128); }
  if (mvt === 4) {
    A(0); B(128);
    at(drumfill, 'noi', 0, 192);
    at(ending_p1, 'p1', 0, 206);
    at(ending_p2, 'p2', 0, 206);
    at(ending_tri, 'tri', 0, 206);
  }
  for (const ch of Object.keys(t)) {
    t[ch].sort((a, b) => a[0] - b[0]);
    for (const [c, k, l] of t[ch])
      if (!(c >= 0 && c < 256 && l >= 1 && c + l <= 256 && k >= 0 && k < 49))
        throw new Error(`越界: ${ch} [${c},${k},${l}]`);
  }
  return t;
}

const KEYS = ['p1', 'p2', 'tri', 'noi'];
const MOVES = [1, 2, 3, 4].map(movement);
const data = Object.fromEntries(KEYS.map(k => [k, MOVES.map(m => m[k])]));

/* ---- 输出 ---- */
const fmt = notes => '[\n    ' + notes.map(([c, k, l, v]) => `[${c},${k},${l},${v}]`).join(',') + '\n  ]';
const body = KEYS.map(key =>
  `  ${key}:  [\n` + data[key].map(fmt).join(',\n') + '\n  ]').join(',\n');

console.log(`/* 「Kalinka」开源音序数据(由 Pently 乐谱离线转谱生成,纯数据可单测,
   转谱脚本见 scripts/gen-kalinka.mjs)。
   ---------------------------------------------------------------------
   出处:「RHDE Kalinka」,选自 pinobatch/pently —— Damian Yerrick 的开源
   NES 音乐引擎及其示例乐谱 audio/pino-a53.pently(zlib 许可证,
   https://github.com/pinobatch/pently)。原曲为 I. Larionov 作曲的俄罗斯
   民歌(1860 年代,公有领域),NES 编配:D. Yerrick(随乐谱以 zlib 发布)。
   转谱方式:按 Pently 记谱语义逐行展开 —— 4/4、140 BPM、scale 16(最小
   单位 = 16 分音符,与卷帘网格一一对应)、durations stick(时值粘连)、
   w = 延音线;脉冲通道写谱 c' = C4,三角波通道天然低八度;play 命令的
   up / down 按半音移调。改编约定:
     · 为适配卷帘 C2~C6 键域,全曲整体移高八度(+12 半音);
     · 乐谱中的琶音记号(ENM / EN055,NES 逐帧和弦音色)卷帘无对应
       功能,简化为单音;
     · 源曲全曲 17 小节,未超出演示的 64 小节音序器范围,无需截断;
       四个乐段的结构编排见 ./kalinka.js。
   每轨 4 条卷帘(每条 16 小节),音符 [格, 键(C2=0), 长度格, 力度]。 */

export const KALINKA_TRACKS = {
${body}
};
`);
