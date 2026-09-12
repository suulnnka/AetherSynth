/* 通用小部件套件(Widget Kit):
   所有模块的内容区都由这套部件拼装,保证边距 / 字号 / 交互一致。 */

import { hint, screen } from './screen.js';
import { knob, knobBig } from './knob.js';
import { faderV, faderH } from './fader.js';
import { sw } from './switch.js';
import { pad } from './pad.js';
import { keys } from './keys.js';

export const kit = {
  hint,
  screen,
  knob,
  knobBig,
  faderV,
  faderH,
  sw,
  pad,
  keys
};
