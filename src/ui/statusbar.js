/* 状态栏:电源状态 / 引擎信息,周期刷新 */

import { $ } from '../core/utils.js';
import { getCtx } from '../core/audio.js';
import { state } from '../core/state.js';

export function updateStatus() {
  const run = getCtx().state === 'running';
  const sp = $('#stpower');
  sp.textContent = run ? '● 电源:运行中' : '● 电源:待机';
  sp.classList.toggle('on', run);
  $('#stinfo').textContent =
    `模块 ${state.mods.size} · 线缆 ${state.cables.size} · ${(getCtx().sampleRate / 1000).toFixed(1)} kHz · 格距 ${state.cellPx}px`;
}

export function startStatusLoop() { setInterval(updateStatus, 600); }
