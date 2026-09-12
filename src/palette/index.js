/* 左侧组件栏:按分类列出全部内置组件,点击放置到视口中央;
   「我的组件」段(工坊设计)由 designs.js 渲染进 #palmine 容器。 */

import { el, $ } from '../core/utils.js';
import { state } from '../core/state.js';
import { DEFS, DEFS_ORDER } from '../core/registry.js';
import { createModule } from '../core/module.js';
import { selMod } from '../core/selection.js';
import { viewport } from '../core/view.js';
import { firstGesture } from '../core/audio.js';
import { saveSoon } from '../core/save.js';
import { toast } from '../ui/toast.js';
import { t, isZh, defName, defDesc } from '../core/i18n.js';

const GROUPS = [['control', t('控制 CONTROL', 'CONTROL')], ['source', t('信号源 SOURCE', 'SOURCE')],
  ['process', t('处理 PROCESS', 'PROCESS')], ['logic', t('逻辑 LOGIC', 'LOGIC')], ['output', t('输出 OUTPUT', 'OUTPUT')]];

export function buildPalette() {
  const pal = $('#palette');
  for (const [g, label] of GROUPS) {
    const h = el('div', 'pgroup g-' + g, pal);
    h.textContent = label;
    for (const tid of DEFS_ORDER) {
      const d = DEFS[tid];
      if (d.cat !== g) continue;
      const it = el('div', 'pitem g-' + g, pal);
      const nm = defName(d);
      it.innerHTML = `<span>${nm}${isZh() ? ` <small style="opacity:.55">${d.en}</small>` : ''}</span><span class="psz">${d.w}×${d.h} ${t('格', 'cells')}</span>`;
      it.title = defDesc(d);
      it.addEventListener('click', () => {
        firstGesture();
        const r = viewport.getBoundingClientRect();
        const wx = (r.width / 2 - state.view.x) / state.view.s, wy = (r.height / 2 - state.view.y) / state.view.s;
        const cx = Math.max(0, Math.round(wx / state.cellPx) - Math.round(d.w / 2)) + (state.spawnN % 4) * 2;
        const cy = Math.max(0, Math.round(wy / state.cellPx) - Math.round(d.h / 2)) + (state.spawnN % 4) * 2;
        state.spawnN++;
        const m = createModule(tid, cx, cy);
        selMod(m.id);
        toast(t('已添加:', 'Added: ') + nm + t(' — 接口悬停可看说明', ' — hover the jacks for port info'));
        saveSoon();
      });
    }
  }
}
