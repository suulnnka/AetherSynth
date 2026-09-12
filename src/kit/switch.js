/* 开关控件:点击切换,开 = +10V,关 = 0V。写 mod.state.on,驱动 mod.cs。 */

import { el } from '../core/utils.js';
import { getCtx } from '../core/audio.js';
import { saveSoon } from '../core/save.js';

export function sw(mod) {
  const ctx = getCtx();
  const wrap = el('div', 'swwrap', mod.body);
  wrap.dataset.ctl = '1';
  const pad = el('div', 'swpad', wrap);
  el('div', 'swled', pad);
  const val = el('div', 'swval', wrap);
  const set = on => {
    mod.state.on = on;
    pad.classList.toggle('on', on);
    val.textContent = on ? 'ON +10V' : 'OFF 0V';
    if (mod.cs) mod.cs.offset.setTargetAtTime(on ? 10 : 0, ctx.currentTime, 0.004);
    saveSoon();
  };
  mod.setSw = set;
  pad.addEventListener('pointerdown', e => { e.stopPropagation(); set(!mod.state.on); });
  set(mod.state.on);
}
