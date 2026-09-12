/* 右键菜单:在光标处弹出菜单,选择「发送到工坊」等操作。
   · 接口(3.5mm 孔):输入口可发送为「注入旋钮」,输出口可发送为「电压表」
   · 控制类组件(旋钮 / 推子 / 开关…):发送为「镜像控制」元素
   · 组合模块:菜单提供「解体组合」
   · 宏组件实例:不可发送(禁止递归) */

import { state } from '../core/state.js';
import { t } from '../core/i18n.js';
import { firstGesture } from '../core/audio.js';
import { viewport } from '../core/view.js';
import { showMenu } from '../ui/contextmenu.js';
import { dissolveComposite } from '../core/composite.js';
import { sendPortToWorkshop, sendControlToWorkshop } from '../workshop/studio.js';

const CTRL_KINDS = ['knob', 'bigknob', 'fader', 'hfader', 'switch'];

export function initContextMenu() {
  viewport.addEventListener('contextmenu', e => {
    e.preventDefault();
    firstGesture();

    // 接口:输入口 → 注入旋钮;输出口 → 电压表
    const j = e.target.closest && e.target.closest('.jack');
    if (j) {
      const m = state.mods.get(+j.dataset.mod);
      if (!m) return;
      const port = m.def.portsById[j.dataset.port];
      const items = [];
      if (port.dir === 'in') {
        items.push({ label: t('发送到工坊:旋钮(注入 ', 'Send to workshop: knob (inject ') + port.name + ')', action: () => sendPortToWorkshop(m, port, 'knob') });
        items.push({ label: t('发送到工坊:电压表', 'Send to workshop: meter'), action: () => sendPortToWorkshop(m, port, 'meter') });
      } else {
        items.push({ label: t('发送到工坊:电压表(监视 ', 'Send to workshop: meter (watch ') + port.name + ')', action: () => sendPortToWorkshop(m, port, 'meter') });
      }
      showMenu(e.clientX, e.clientY, items);
      return;
    }

    const mEl = e.target.closest && e.target.closest('.module');
    if (!mEl) return;
    const m = state.mods.get(+mEl.dataset.id);
    if (!m) return;

    const items = [];
    if (m.def.composite) {
      items.push({ label: t('解体组合', 'Dissolve composite'), action: () => dissolveComposite(m) });
      showMenu(e.clientX, e.clientY, items);
      return;
    }
    if (m.def.macro) {
      items.push({ label: t('宏组件实例(不可再嵌套,禁止递归)', 'Macro instance (no further nesting, recursion disabled)'), action: null });
      showMenu(e.clientX, e.clientY, items);
      return;
    }
    // 控制类组件:镜像发送
    if (CTRL_KINDS.includes(m.def.id)) {
      items.push({ label: t('发送到工坊:镜像控制', 'Send to workshop: mirror control'), action: () => sendControlToWorkshop(m) });
      showMenu(e.clientX, e.clientY, items);
    }
  });
}
