/* 顶栏工具条:电源 / 演示音色 / 格距 / 采样率 / 缩放 / 封装 /
   导入导出 / 清空 */

import { $ } from '../core/utils.js';
import { getCtx, firstGesture } from '../core/audio.js';
import { state } from '../core/state.js';
import { setCellSize, fitView, zoomAt, viewport } from '../core/view.js';
import { serialize, clearAll, deserialize } from '../core/serialize.js';
import { saveSoon } from '../core/save.js';
import { setSampleRate, currentRate } from '../core/engine.js';
import { encapsulateSelected } from '../core/composite.js';
import { demoPatch } from '../songs/demo.js';
import { toast } from './toast.js';
import { updateStatus } from './statusbar.js';

export function initToolbar() {
  $('#power').addEventListener('click', () => {
    if (getCtx().state === 'running') getCtx().suspend(); else getCtx().resume();
    updateStatus();
  });
  $('#demo').addEventListener('click', () => { firstGesture(); demoPatch(); });
  $('#cellsel').addEventListener('change', e => { setCellSize(+e.target.value); fitView(); saveSoon(); });
  $('#ratesel').value = String(currentRate());
  $('#ratesel').addEventListener('change', e => { firstGesture(); setSampleRate(+e.target.value); });
  $('#zoomin').addEventListener('click', () => { const r = viewport.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, state.view.s * 1.25); });
  $('#zoomout').addEventListener('click', () => { const r = viewport.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, state.view.s / 1.25); });
  $('#zoomfit').addEventListener('click', fitView);
  $('#groupbtn').addEventListener('click', () => { firstGesture(); encapsulateSelected(); });
  $('#clear').addEventListener('click', () => {
    if (!confirm('清空画布上的所有组件和线缆?')) return;
    clearAll();
    saveSoon();
    toast('画布已清空');
  });
  $('#export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(serialize(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gridmod-patch.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  });
  $('#importb').addEventListener('click', () => $('#filein').click());
  $('#filein').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        deserialize(JSON.parse(rd.result));
        fitView(); toast('补丁已导入');
      } catch (err) { toast('导入失败:' + err.message); }
    };
    rd.readAsText(f);
    e.target.value = '';
  });
}
