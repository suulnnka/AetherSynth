/* 组件选中态:单选 / Shift 多选 */

import { state } from './state.js';

export function selMod(id, additive) {
  if (additive && id != null) {
    if (state.selSet.has(id)) state.selSet.delete(id);
    else { state.selSet.add(id); state.sel = id; }
  } else {
    state.selSet = new Set(id != null ? [id] : []);
    state.sel = id;
  }
  for (const m of state.mods.values())
    m.el.classList.toggle('selected', state.selSet.has(m.id));
}
