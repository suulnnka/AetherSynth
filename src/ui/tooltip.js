/* 接口悬停提示(tooltip):显示口名 / 方向 / 信号类型 / 说明 */

import { $, clamp } from '../core/utils.js';
import { state } from '../core/state.js';
import { TYPE_NAMES } from '../core/registry.js';

const tip = () => $('#tooltip');

export function showTip(jEl) {
  const m = state.mods.get(+jEl.dataset.mod);
  if (!m) return;
  const p = m.def.portsById[jEl.dataset.port];
  const t = tip();
  t.innerHTML = `<b>⏺ ${p.name}</b> · 3.5mm ${p.dir === 'out' ? '输出' : '输入'} · ${TYPE_NAMES[p.type] || ''}<br>${p.desc || ''}`;
  t.hidden = false;
  const r = jEl.getBoundingClientRect();
  const tw = t.offsetWidth, th = t.offsetHeight;
  t.style.left = clamp(r.left + r.width / 2 - tw / 2, 6, innerWidth - tw - 6) + 'px';
  t.style.top = (p.dir === 'out' ? r.bottom + 6 : r.top - th - 6) + 'px';
}

export function hideTip() { tip().hidden = true; }
