/* 底部浮动提示(toast) */

import { $ } from '../core/utils.js';

let toastT;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false; t.style.opacity = 1;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.hidden = true, 300); }, 2200);
}
