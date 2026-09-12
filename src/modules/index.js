/* 组件定义总装:把各类组件注册进注册表,并固定侧栏展示顺序。
   新增组件:在对应分类文件里加 def(或新建分类文件并在此注册)。 */

import { registerDef, setDefOrder, finalizeRegistry } from '../core/registry.js';
import { controls } from './controls.js';
import { keyboard } from './keyboard.js';
import { seq, roll } from './sequencer.js';
import { sources } from './sources.js';
import { advOsc } from './adv-osc.js';
import { clock } from './clock.js';
import { minimoog } from './minimoog.js';
import { drums } from './drums.js';
import { processors } from './processors.js';
import { effects } from './effects.js';
import { math } from './math.js';
import { logic } from './logic.js';
import { fx } from './fx.js';
import { cvmod } from './cvmod.js';
import { outputs } from './outputs.js';

// 每一项都是「组」(多个 def 的扁平映射);单文件单组件也要包一层
const GROUPS = {
  controls, keyboard: { keyboard }, sequencer: { seq, roll }, sources, advOsc, clock: { clock }, drums,
  processors, effects, math, logic, fx, cvmod, outputs, minimoog: { minimoog }
};

export const MODULE_ORDER = [
  'minimoog', 'knob', 'bigknob', 'fader', 'hfader', 'touch', 'biknob', 'step6', 'step10', 'step4', 'chrom', 'switch', 'keyboard', 'seq', 'roll',
  'vco', 'wt', 'phys', 'noiseo', 'fm', 'lfo', 'noise', 'mic', 'envf', 'clk', 'kick', 'snare', 'hat',
  'vcf', 'vca', 'amp', 'adsr', 'delay', 'atten', 'mult', 'mult8', 'quant', 'sh', 'mix', 'midicv', 'ringmod', 'fmod', 'glide',
  'comp', 'bquant', 'sred', 'drive', 'chorus', 'reverb', 'pan',
  'add', 'sub', 'mul', 'div', 'avg', 'round', 'floor', 'ceil', 'sel',
  'not', 'and', 'or', 'xor', 'cmp', 'srl', 'tff',
  'spk', 'spec', 'scope', 'xy', 'rec', 'crec'
];

export function registerAllModules() {
  for (const group of Object.values(GROUPS))
    for (const def of Object.values(group)) registerDef(def);
  setDefOrder(MODULE_ORDER);
  finalizeRegistry();
}
