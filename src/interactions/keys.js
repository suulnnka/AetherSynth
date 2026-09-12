/* 全局键盘:Del 删除选中 / Ctrl+D 复制 / Z·X 切八度 / 字符键弹琴;
   Esc 优先关闭最上层窗口,其次关闭菜单,最后取消选中;
   有窗口或菜单打开时屏蔽画布快捷键 */

import { state } from '../core/state.js';
import { deleteMod, deleteModWithConfirm } from '../core/module.js';
import { selMod } from '../core/selection.js';
import { hasOpenWindow, closeTopWindow } from '../ui/window.js';
import { hasOpenMenu, closeMenu } from '../ui/menubar.js';

export const KEYMAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16, "'": 17 };

export function initKeyboard() {
  window.addEventListener('keydown', async e => {
    if (e.target instanceof Element && e.target.matches('input,select,textarea')) return;
    if (e.key === 'Escape') {
      if (closeTopWindow()) return;
      if (closeMenu()) return;
      selMod(null);
      return;
    }
    if (hasOpenWindow() || hasOpenMenu()) return;   // 有弹窗 / 菜单打开时不触发画布快捷键
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.selSet.size) {
        e.preventDefault();
        for (const id of [...state.selSet]) await deleteModWithConfirm(id);
      }
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
    if (k in KEYMAP) for (const m of state.mods.values()) if (m.compNote) m.compNote(KEYMAP[k], true);
  });
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k in KEYMAP) for (const m of state.mods.values()) if (m.compNote) m.compNote(KEYMAP[k], false);
  });
}
