/* 屏幕与提示文字 */

import { el } from '../core/utils.js';

/** 居中提示文字 */
export function hint(text, mod) {
  const h = el('div', 'k-hint', mod.body);
  h.textContent = text;
  return h;
}

/** 显示屏:canvas 自动适配格距与缩放 */
export function screen(mod, key) {
  const cv = el('canvas', 'screen', mod.body);
  mod.fitScreen(key, cv);
  return mod[key];
}
