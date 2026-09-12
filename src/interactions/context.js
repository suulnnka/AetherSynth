/* 右键菜单:右键普通组件 = 发送到工坊收集;右键组合模块 = 解体还原;
   右键宏组件 = 提示;右键接口 = 忽略(避免误触组合解体)。 */

import { state } from '../core/state.js';
import { firstGesture } from '../core/audio.js';
import { viewport } from '../core/view.js';
import { dissolveComposite } from '../core/composite.js';
import { sendToWorkshop } from '../workshop/studio.js';
import { toast } from '../ui/toast.js';

export function initContextMenu() {
  viewport.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (e.target.closest && e.target.closest('.jack')) return;
    const mEl = e.target.closest && e.target.closest('.module');
    if (mEl) {
      const m = state.mods.get(+mEl.dataset.id);
      if (!m) return;
      if (m.def.composite) { firstGesture(); dissolveComposite(m); return; }
      if (m.def.macro) { toast('宏组件:放置新实例请用左侧「我的组件」'); return; }
      firstGesture();
      sendToWorkshop(m);
      return;
    }
  });
}
