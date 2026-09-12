/* 全局键盘:Del 删除选中 / Ctrl+D 复制 / Z·X 切八度 / 字符键弹琴 */

import { state } from '../core/state.js';
import { deleteMod, duplicateMod } from '../core/module.js';
import { hideHelp } from '../ui/help.js';

export const KEYMAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16, "'": 17 };

export function initKeyboard() {
  window.addEventListener('keydown', e => {
    if (e.target.matches('input,select,textarea')) return;
    if (e.key === 'Escape') { hideHelp(); return; }
    if (!document.getElementById('helpmodal').hidden) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.selSet.size) { e.preventDefault(); for (const id of [...state.selSet]) deleteMod(id); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      if (state.sel != null) duplicateMod(state.sel);
      return;
    }
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'z' || k === 'x') {
      for (const m of state.mods.values()) if (m.def.id === 'keyboard') m.shiftOct(k === 'z' ? -1 : 1);
      return;
    }
    if (k in KEYMAP) for (const m of state.mods.values()) if (m.def.id === 'keyboard') m.compNote(KEYMAP[k], true);
  });
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k in KEYMAP) for (const m of state.mods.values()) if (m.def.id === 'keyboard') m.compNote(KEYMAP[k], false);
  });
}
