/* 组件定义总装:把各类组件注册进注册表,并固定侧栏展示顺序。
   新增组件:在对应分类文件里加 def(或新建分类文件并在此注册)。 */

import { registerDef, setDefOrder, finalizeRegistry } from '../core/registry.js';
import { controls } from './controls.js';
import { keyboard } from './keyboard.js';
import { seq } from './sequencer.js';
import { sources } from './sources.js';
import { clock } from './clock.js';
import { drums } from './drums.js';
import { processors } from './processors.js';
import { effects } from './effects.js';
import { math } from './math.js';
import { outputs } from './outputs.js';

// 每一项都是「组」(多个 def 的扁平映射);单文件单组件也要包一层
const GROUPS = {
  controls, keyboard: { keyboard }, sequencer: { seq }, sources, clock: { clock }, drums,
  processors, effects, math, outputs
};

export const MODULE_ORDER = [
  'knob', 'bigknob', 'fader', 'hfader', 'touch', 'biknob', 'step6', 'step10', 'step4', 'chrom', 'switch', 'keyboard', 'seq',
  'vco', 'fm', 'lfo', 'noise', 'mic', 'clk', 'kick', 'snare', 'hat',
  'vcf', 'vca', 'amp', 'adsr', 'delay', 'atten', 'mult', 'mult8', 'quant', 'sh', 'mix', 'midicv',
  'comp', 'bquant', 'sred',
  'add', 'sub', 'mul', 'div', 'avg', 'round', 'floor', 'ceil', 'sel',
  'spk', 'spec', 'scope', 'xy', 'rec'
];

export function registerAllModules() {
  for (const group of Object.values(GROUPS))
    for (const def of Object.values(group)) registerDef(def);
  setDefOrder(MODULE_ORDER);
  finalizeRegistry();
}
