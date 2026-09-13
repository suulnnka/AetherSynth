/* 组件定义注册表:所有内置与动态(组合 / 工坊自制)组件都登记在这里。
   DEFS_ORDER 决定左侧组件栏的分组顺序;finalizeRegistry() 在全部内置
   组件注册完后统一赋信号类型并排版接口。 */

import { layoutDefPorts } from './ports.js';

export const DEFS = {};       // defId → 组件定义
export const DEFS_ORDER = []; // 侧栏展示顺序(动态组件不入此表)

/** 接口信号类型表('模块:接口' → 类型);cvAll = 全部口默认 CV */
export const PORT_TYPES = {
  'knob:CV': 'cv', 'bigknob:CV': 'cv', 'fader:CV': 'cv', 'hfader:CV': 'cv',
  'touch:X': 'cv', 'touch:Y': 'cv',
  'biknob:CV': 'cv',
  'kick:TRIG': 'gate', 'kick:TUNE': 'cv',
  'snare:TRIG': 'gate', 'snare:TUNE': 'cv',
  'hat:TRIG': 'gate',
  'keyboard:MIDI': 'midi', 'seq:MIDI': 'midi', 'midicv:MIDI': 'midi', 'classic-synth:MIDI': 'midi',
  'midicv:VOCT': 'cv', 'midicv:GATE': 'gate', 'midicv:VEL': 'cv',
  'switch:GATE': 'gate',
  'keyboard:VOCT': 'cv', 'keyboard:GATE': 'gate', 'keyboard:VEL': 'cv',
  'seq:CV': 'cv', 'seq:GATE': 'gate', 'seq:CLK': 'gate', 'seq:RST': 'gate',
  'vco:VOCT': 'cv', 'vco:FM': 'cv',
  'fm:VOCT': 'cv', 'fm:RATIO': 'cv', 'fm:INDEX': 'cv',
  'fmod:DEPTH': 'cv',
  'lfo:RATE': 'cv', 'lfo:SIN': 'cv', 'lfo:TRI': 'cv', 'lfo:SQR': 'gate', 'lfo:SAW': 'cv',
  'vcf:CUTOFF': 'cv', 'vcf:RESO': 'cv',
  'vca:GAIN': 'cv',
  'adsr:GATE': 'gate', 'adsr:A': 'cv', 'adsr:D': 'cv', 'adsr:S': 'cv', 'adsr:R': 'cv', 'adsr:ENV': 'cv',
  'delay:TIME': 'cv', 'delay:FB': 'cv', 'delay:MIX': 'cv',
  'quant:CV': 'cv', 'quant:OUT': 'cv',
  'sh:IN': 'any', 'sh:TRIG': 'gate', 'sh:OUT': 'cv',
  'rec:REC': 'gate', 'rec:PLAY': 'gate', 'rec:LOOP': 'cv',
  'atten:IN': 'any', 'atten:OUT': 'any',
  'mult:IN': 'any', 'mult:O1': 'any', 'mult:O2': 'any', 'mult:O3': 'any', 'mult:O4': 'any',
  'scope:IN': 'any',
  'xy:X': 'any', 'xy:Y': 'any',
  'comp:THRESH': 'cv', 'comp:RATIO': 'cv', 'comp:ATK': 'cv', 'comp:REL': 'cv',
  'bquant:BITS': 'cv',
  'sred:RATE': 'cv',
  'spk:L': 'audio', 'spk:R': 'audio',
  'clk:OUT': 'gate', 'clk:RST': 'gate',
  'vco:SYNC': 'gate', 'fm:SYNC': 'gate', 'lfo:SYNC': 'gate',
  'vco:DUTY': 'cv', 'lfo:DUTY': 'cv',
  'wt:OUT': 'audio', 'wt:VOCT': 'cv', 'wt:POS': 'cv', 'wt:SYNC': 'gate',
  'phys:OUT': 'audio', 'phys:TRIG': 'gate', 'phys:VOCT': 'cv', 'phys:DAMP': 'cv',
  'noiseo:OUT': 'audio', 'noiseo:VOCT': 'cv', 'noiseo:COLOR': 'cv',
  'classic-synth:GATE': 'gate', 'classic-synth:V/OCT': 'cv',
  'amp:GAIN': 'cv',
  'mult8:IN': 'any', 'mult8:O1': 'any', 'mult8:O2': 'any', 'mult8:O3': 'any',
  'mult8:O4': 'any', 'mult8:O5': 'any', 'mult8:O6': 'any', 'mult8:O7': 'any', 'mult8:O8': 'any',
  'spec:IN': 'any'
};

/** 线缆 / 接口按信号类型着色(Reaktor Blocks / VCV Rack 惯例) */
export const TYPE_COLORS = { audio: '#d64545', cv: '#3a76d0', gate: '#2f9e63', any: '#7d8a96', midi: '#a94fd0' };
export const TYPE_NAMES = { audio: '音频', cv: 'CV 电压', gate: '门 / 时钟', any: '任意信号', midi: 'MIDI 信号' };

export function registerDef(def) {
  DEFS[def.id] = def;
  return def;
}

export function setDefOrder(ids) {
  DEFS_ORDER.length = 0;
  DEFS_ORDER.push(...ids);
}

/** 全部内置组件注册完后调用一次:补默认信号类型 + 排版接口 */
export function finalizeRegistry() {
  for (const tid of DEFS_ORDER) {
    const d = DEFS[tid];
    d.ports.forEach(p => { p.type = PORT_TYPES[tid + ':' + p.id] || (d.cvAll ? 'cv' : 'audio'); });
    layoutDefPorts(d);
  }
}
