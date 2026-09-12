/* 右键菜单:右键组合模块 = 解体还原;右键自制组件 = 载回工坊修改;
   右键接口 = 忽略(避免误触组合解体)。 */

import { state } from '../core/state.js';
import { firstGesture } from '../core/audio.js';
import { viewport } from '../core/view.js';
import { dissolveComposite } from '../core/composite.js';
import { editCustom } from '../workshop/designs.js';

export function initContextMenu() {
  viewport.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (e.target.closest && e.target.closest('.jack')) return;
    const mEl = e.target.closest && e.target.closest('.module');
    if (mEl) {
      const m = state.mods.get(+mEl.dataset.id);
      if (!m) return;
      if (m.def.composite) { firstGesture(); dissolveComposite(m); return; }
      if (m.def.custom) { editCustom(m); return; }
    }
  });
}
