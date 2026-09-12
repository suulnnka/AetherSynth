/* 主循环:双驱动 —— rAF(页面可见)+ ScriptProcessor 音频线程泵
   (页面隐藏但音频运行)。合成器的门限检测 / 音序器时钟 / 屏幕刷新
   不能因为标签页后台而停摆。 */

import { state } from './state.js';
import { getCtx } from './audio.js';

let _lastTick = 0;

export function tickAll() {
  const now = performance.now();
  if (now - _lastTick < 8) return;
  _lastTick = now;
  for (const m of state.mods.values()) {
    if (m._active === false) continue;
    for (const k in m.mons) m.mons[k].read();
  }
  for (const m of state.mods.values()) {
    if (m._active === false) continue;
    if (m.def.tick) { try { m.def.tick.call(m); } catch (e) {} }
  }
}

export function startRafLoop() { requestAnimationFrame(loop); }
function loop() { tickAll(); requestAnimationFrame(loop); }

/* 音频线程泵:页面隐藏时 rAF 停转,靠音频回调维持 tick */
let _pump = null, _pumpMute = null;
export function startPump() {
  const ctx = getCtx();
  try { if (_pump) { _pump.onaudioprocess = null; _pump.disconnect(); } } catch (e) {}
  try { if (_pumpMute) _pumpMute.disconnect(); } catch (e) {}
  _pump = ctx.createScriptProcessor(512, 1, 1);
  _pumpMute = ctx.createGain(); _pumpMute.gain.value = 0;
  _pump.connect(_pumpMute); _pumpMute.connect(ctx.destination);
  _pump.onaudioprocess = () => tickAll();
}
