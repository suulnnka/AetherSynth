/* 采样率切换:换率必须重建 AudioContext —— 序列化当前补丁 →
   关旧引擎 → 新引擎上原样重建组件与连线。 */

import { audio, replaceCtx, getCtx } from './audio.js';
import { serialize, deserialize } from './serialize.js';
import { startPump } from './loop.js';
import { updateStatus } from '../ui/statusbar.js';
import { toast } from '../ui/toast.js';
import { RATE_KEY } from './save.js';

export function currentRate() { return audio.sampleRate; }

export function setSampleRate(rate) {
  if (!Number.isFinite(rate) || rate === audio.sampleRate) return;
  const snap = serialize();
  const wasRunning = getCtx().state === 'running';
  try { getCtx().close(); } catch (e) {}
  replaceCtx(rate);
  try { localStorage.setItem(RATE_KEY, String(rate)); } catch (e) {}
  startPump();
  deserialize(snap);
  if (wasRunning) getCtx().resume().then(updateStatus).catch(() => {});
  updateStatus();
  toast(getCtx().sampleRate === rate
    ? '采样率:' + (rate / 1000) + ' kHz'
    : '设备不支持 ' + (rate / 1000) + ' kHz,已用 ' + (getCtx().sampleRate / 1000) + ' kHz');
}

export function initEngine() {
  const saved = +(localStorage.getItem(RATE_KEY));
  if (saved) audio.sampleRate = saved;
  getCtx();
  startPump();
}
