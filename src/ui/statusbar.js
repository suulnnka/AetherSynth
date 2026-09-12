/* 状态栏:电源状态 / 引擎信息,周期刷新 */

import { $ } from '../core/utils.js';
import { getCtx } from '../core/audio.js';
import { state } from '../core/state.js';
import { t } from '../core/i18n.js';

export function updateStatus() {
  const run = getCtx().state === 'running';
  const sp = $('#stpower');
  sp.textContent = run ? t('● 电源:运行中', '● Power: running') : t('● 电源:待机', '● Power: standby');
  sp.classList.toggle('on', run);
  $('#stinfo').textContent = t(
    `模块 ${state.mods.size} · 线缆 ${state.cables.size} · ${(getCtx().sampleRate / 1000).toFixed(1)} kHz · 格距 ${state.cellPx}px`,
    `${state.mods.size} modules · ${state.cables.size} cables · ${(getCtx().sampleRate / 1000).toFixed(1)} kHz · grid ${state.cellPx}px`);
}

export function startStatusLoop() { setInterval(updateStatus, 600); }
