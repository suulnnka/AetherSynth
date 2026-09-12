/* AetherSynth · 网格模块减法合成器 —— 入口
   规则:组件本体零控件;旋钮/开关是独立组件;一切连接走 3.5mm 接口;
        画布为纯网格制 —— 组件尺寸与接口位置都以「格」为单位,严格对齐。
   电压约定:1 单位浮点 = 1V;音高 1V/oct;Gate 高 = +10V;旋钮 0~10V。

   装配顺序:组件定义注册 → 存档序列化挂接 → 工坊 / 侧栏 / 交互 /
   菜单栏初始化 → 存档恢复(失败则载入演示音色)→ 主循环。 */

import { worldEl, applyView, fitView } from './core/view.js';
import { setSerializer, LSKEY } from './core/save.js';
import { serialize, loadSaved } from './core/serialize.js';
import { getCtx, firstGesture } from './core/audio.js';
import { state } from './core/state.js';
import { createModule } from './core/module.js';
import { addCable } from './core/cables.js';
import { reflowActive } from './core/flow.js';
import { selMod } from './core/selection.js';
import { encapsulateSelected, dissolveComposite } from './core/composite.js';
import { registerAllModules } from './modules/index.js';
import { initStudio } from './workshop/studio.js';
import { designs, refreshMine, onDesignsChanged, placeAtCenter, registerDesign } from './workshop/designs.js';
import { mkCustomDef, newCustomKey } from './workshop/custom-def.js';
import { buildPalette } from './palette/index.js';
import { initPointer } from './interactions/pointer.js';
import { initKeyboard } from './interactions/keys.js';
import { initContextMenu } from './interactions/context.js';
import { initMenuBar } from './ui/menubar.js';
import { initHelp } from './ui/help.js';
import { applyStudioLang } from './workshop/studio.js';
import { t } from './core/i18n.js';
import { demoPatch } from './songs/demo.js';
import { updateStatus, startStatusLoop } from './ui/statusbar.js';
import { startRafLoop } from './core/loop.js';
import { initEngine } from './core/engine.js';

/* 错误收集(控制台可查 window.__errs) */
window.__errs = [];
window.addEventListener('error', e =>
  window.__errs.push(String(e.message) + ' @' + e.filename + ':' + e.lineno + ':' + e.colno));
window.addEventListener('unhandledrejection', e =>
  window.__errs.push('rej: ' + String(e.reason)));

boot();

function boot() {
  registerAllModules();
  setSerializer(serialize);

  initEngine();
  initStudio();
  buildPalette();
  refreshMine();
  onDesignsChanged(refreshMine);
  initPointer();
  initKeyboard();
  initContextMenu();
  initMenuBar();
  applyStudioLang();
  initHelp();

  worldEl.style.setProperty('--cellpx', state.cellPx + 'px');
  worldEl.style.setProperty('--k', 1);
  document.addEventListener('pointerdown', firstGesture, { capture: true });
  document.title = t('AetherSynth · 网格模块减法合成器', 'AetherSynth · Grid modular subtractive synthesizer');
  const hint = document.getElementById('sthint');
  if (hint) hint.textContent = t(
    '拖接口→接口 = 接线 · 从已接线的口拖出 = 拔线 · 点线缆 = 删除 · 工坊 = 设计自制组件 · 右键自制组件 = 重新编辑 · 拖空白 = 平移 · 滚轮 = 缩放 · Del = 删除组件 · Ctrl+D = 复制',
    'drag jack → jack = patch · drag from a patched jack = unplug · click a cable = delete · workshop = design custom modules · right-click a custom module = re-edit · drag empty space = pan · wheel = zoom · Del = delete · Ctrl+D = duplicate');
  window.addEventListener('beforeunload', () => {
    try { localStorage.setItem(LSKEY, JSON.stringify(serialize())); } catch (e) {}
  });
  if (!loadSaved()) demoPatch(); else applyView();
  updateStatus();
  startStatusLoop();
  startRafLoop();

  /* 控制台调试 / 自动化 API */
  window.SYNTH = {
    get ctx() { return getCtx(); },
    get mods() { return state.mods; },
    get cables() { return state.cables; },
    add: (t, x, y) => createModule(t, x, y),
    connect: (a, ap, b, bp) => addCable(a, ap, b, bp),
    /* 组件工坊:SYNTH.placeCustom(spec) 直接按规格放置面板组件 */
    placeCustom: spec => {
      if (!spec || !spec.cells || !spec.cells.length) return null;
      const key = newCustomKey();
      mkCustomDef(key, spec);
      registerDesign(key, spec);
      return placeAtCenter(key);
    },
    designs,
    reflowActive,
    sel: selMod,
    encapsulate: encapsulateSelected,
    dissolve: dissolveComposite,
    noteOn: n => { for (const m of state.mods.values()) if (m.def.id === 'keyboard') m.noteOn(n, 110); },
    noteOff: n => { for (const m of state.mods.values()) if (m.def.id === 'keyboard') m.noteOff(n); },
    stats: () => ({ modules: state.mods.size, cables: state.cables.size, audio: getCtx().state, rate: getCtx().sampleRate, cellPx: state.cellPx }),
    demo: demoPatch,
    fit: fitView
  };
}
