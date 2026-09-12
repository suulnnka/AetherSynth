/* 帮助窗口:内容在 index.html 的 #helpcontent,由通用窗口组件承载 */

import { $ } from '../core/utils.js';
import { AppWindow } from './window.js';

let win = null;

export function initHelp() {
  win = new AppWindow({
    title: '使用帮助',
    content: $('#helpcontent'),
    width: 'min(680px, 92vw)'
  });
}

/** 菜单「帮助 → 使用帮助」 */
export function openHelp() { if (win) win.open(); }
