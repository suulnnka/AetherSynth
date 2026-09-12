/* 演示音色:减法合成经典链
   键盘 → 振荡器 → 滤波器 → 压控放大 → 喇叭,包络控音量、旋钮控滤波、
   LFO 加颤音;并用一个工坊自制的两旋钮「颤音台」展示组件工坊。 */

import { createModule } from '../core/module.js';
import { addCable } from '../core/cables.js';
import { clearAll } from '../core/serialize.js';
import { setCellSize, fitView } from '../core/view.js';
import { DEFS } from '../core/registry.js';
import { mkCustomDef } from '../workshop/custom-def.js';
import { registerDesign } from '../workshop/designs.js';
import { toast } from '../ui/toast.js';
import { t } from '../core/i18n.js';

const DEMO_SPEC = {
  name: '颤音台', seq: 2, cols: 2, span: 3,
  theme: { bg: { type: 'gradient', angle: 160, stops: ['#fddb92', '#d1fdff'] }, widget: 'light', accent: '#e25822', text: '#4a3a28' },
  cells: [
    { id: 'rate', kind: 'knob', label: '速率', min: 0, max: 10, value: 0.8 },
    { id: 'depth', kind: 'knob', label: '深度', min: 0, max: 10, value: 2 }
  ]
};

export function demoPatch() {
  clearAll();
  setCellSize(24);
  const kb = createModule('keyboard', 2, 22);
  const kc = createModule('knob', 2, 16), kr = createModule('knob', 6, 16);
  const vco = createModule('vco', 4, 11), vcf = createModule('vcf', 16, 11);
  const env = createModule('adsr', 28, 11), lfo = createModule('lfo', 42, 11);
  // 顺便展示「组件工坊」:一个两旋钮的自制调制台(设计同时存入「我的组件」)
  if (!DEFS['custom#demo']) mkCustomDef('custom#demo', DEMO_SPEC);
  registerDesign('custom#demo', DEMO_SPEC);
  const modt = createModule('custom#demo', 42, 17);
  const vca = createModule('vca', 16, 4), spk = createModule('spk', 26, 4), scope = createModule('scope', 34, 3);
  const xy = createModule('xy', 52, 11);
  // 顺便展示压限器:插在滤波器与压控放大之间
  const cmp = createModule('comp', 26, 22);
  kc.setKnob(5); kr.setKnob(1.5);
  addCable(kb.id, 'GATE', env.id, 'GATE');
  addCable(kb.id, 'VOCT', vco.id, 'VOCT');
  addCable(kb.id, 'VEL', vca.id, 'GAIN');
  addCable(vco.id, 'SAW', vcf.id, 'IN');
  addCable(kc.id, 'CV', vcf.id, 'CUTOFF');
  addCable(kr.id, 'CV', vcf.id, 'RESO');
  addCable(env.id, 'ENV', vca.id, 'GAIN');
  addCable(vcf.id, 'LP', cmp.id, 'IN');
  addCable(cmp.id, 'OUT', vca.id, 'IN');
  addCable(vca.id, 'OUT', spk.id, 'L');
  addCable(vca.id, 'OUT', spk.id, 'R');
  addCable(vca.id, 'OUT', scope.id, 'IN');
  addCable(modt.id, 'Prate', lfo.id, 'RATE');
  addCable(lfo.id, 'SIN', vco.id, 'FM');
  addCable(vco.id, 'SIN', xy.id, 'X');
  addCable(vco.id, 'TRI', xy.id, 'Y');
  fitView();
  toast(t('演示音色:点电源,按 A W S E D… 演奏', 'Demo patch: switch the power on and play with A W S E D…'));
}
