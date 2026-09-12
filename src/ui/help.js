/* 帮助弹窗 */

import { $ } from '../core/utils.js';

const helpModal = () => $('#helpmodal');

export function hideHelp() { helpModal().hidden = true; }

export function initHelp() {
  $('#help').addEventListener('click', () => helpModal().hidden = !helpModal().hidden);
  $('#helpclose').addEventListener('click', hideHelp);
  helpModal().addEventListener('click', e => { if (e.target === helpModal()) hideHelp(); });
}
