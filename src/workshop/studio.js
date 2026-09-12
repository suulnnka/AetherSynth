/* 组件工坊面板:宏草稿。
   在画布上右键组件 → 发送到这里收集;命名后「保存为新组件」:
   画布上这组组件会化简成一个宏组件,同时定义存入左侧「我的组件」,
   之后可随时放置新实例(相当于引入这一整组组件)。 */

import { $ } from '../core/utils.js';
import { state } from '../core/state.js';
import { firstGesture } from '../core/audio.js';
import { addCable } from '../core/cables.js';
import { reflowActive } from '../core/flow.js';
import { saveSoon } from '../core/save.js';
import { captureMacroSpec, newMacroKey, registerMacroDef, instantiateMacro } from './macros.js';
import { addMacroDesign } from './designs.js';
import { toast } from '../ui/toast.js';

const draft = [];   // 收集进草稿的组件 id

export function initStudio() {
  $('#cpmsave').addEventListener('click', () => { firstGesture(); saveMacroDraft().catch(e => toast('保存失败:' + e.message)); });
  renderDraft();
}

export function isStudioVisible() { return !$('#ctrlpanel').classList.contains('hidden'); }

export function toggleStudio() {
  $('#ctrlpanel').classList.toggle('hidden');
}

export function ensureStudioVisible() { $('#ctrlpanel').classList.remove('hidden'); }

/** 右键画布组件:发送到宏草稿(组合 / 宏不能嵌套,禁止递归) */
export function sendToWorkshop(mod) {
  firstGesture();
  if (mod.def.composite || mod.def.macro) { toast('组合 / 宏组件不能发送进宏(禁止递归)'); return; }
  if (mod.parent) { toast('组合内部的组件不能直接发送,请先解体组合'); return; }
  if (draft.includes(mod.id)) { toast('已在宏草稿中'); return; }
  draft.push(mod.id);
  ensureStudioVisible();
  renderDraft();
  toast('已发送到工坊(共 ' + draft.length + ' 个组件)');
}

function renderDraft() {
  const list = $('#cpmlist');
  if (!list) return;
  list.innerHTML = '';
  const alive = [];
  for (const id of draft) {
    const m = state.mods.get(id);
    if (!m) continue;                       // 已被删除的自动剔除
    alive.push(id);
    const it = document.createElement('div');
    it.className = 'cpm-item';
    it.innerHTML = `<span>${m.def.name}</span><span class="cpm-x" title="移出草稿">✕</span>`;
    it.querySelector('.cpm-x').addEventListener('click', () => {
      const i = draft.indexOf(id);
      if (i >= 0) draft.splice(i, 1);
      renderDraft();
    });
    list.appendChild(it);
  }
  draft.length = 0;
  draft.push(...alive);
  $('#cpmcount').textContent = draft.length ? '(' + draft.length + ')' : '';
  $('#cpmempty').style.display = draft.length ? 'none' : '';
  $('#cpmsave').style.opacity = draft.length ? 1 : 0.5;
}

/** 保存为新组件:捕获规格 → 注册定义 → 画布上化简为宏实例(外部接线原样重连) */
async function saveMacroDraft() {
  if (!draft.length) { toast('草稿是空的:先在画布上右键组件发送到这里'); return; }
  const mods = draft.map(id => state.mods.get(id)).filter(Boolean);
  if (mods.length !== draft.length) { toast('草稿中有组件已被删除'); renderDraft(); return; }
  for (const m of mods)
    if (m.def.composite || m.def.macro || m.parent) { toast('组合 / 宏不能嵌套(禁止递归)'); return; }

  const name = $('#cpmname').value.trim() || '宏组件';
  const minX = Math.min(...mods.map(m => m.cx));
  const minY = Math.min(...mods.map(m => m.cy));

  // 1) 捕获规格(内部接线 / 对外接口),并记录边界接线(化简替换后重连)
  const { spec, boundary } = captureMacroSpec(draft.slice(), state.mods, state.cables, name);
  spec.name = name;

  // 2) 注册定义并移除原成员(静默,接线已记录在案)
  const key = newMacroKey();
  registerMacroDef(key, spec);
  addMacroDesign(key, spec);
  for (const id of draft) removeQuiet(id);

  // 3) 在原位置放置宏实例(展开内部组件),并重连边界接线
  const box = await instantiateMacro(key, minX - 1, minY - 1);
  for (const b of boundary) {
    if (b.dir === 'in') addCable(b.far.m, b.far.p, box.id, b.extId, b.color);
    else addCable(box.id, b.extId, b.far.m, b.far.p, b.color);
  }
  draft.length = 0;
  renderDraft();
  saveSoon();
  toast('已保存宏组件「' + name + '」并存入「我的组件」');
}

/** 静默移除一个组件(保存流程专用:接线由边界重连方案处理) */
function removeQuiet(id) {
  const m = state.mods.get(id);
  if (!m) return;
  [...state.cables.values()].filter(c => c.a.m === id || c.b.m === id).forEach(c => {
    if (!c.midi) { try { c.aNode.disconnect(c.bNode); } catch (e) {} }
    c.hit.remove(); c.wire.remove();
    state.cables.delete(c.id);
  });
  m.dispose();
  m.el.remove();
  state.mods.delete(id);
  reflowActive();
}
