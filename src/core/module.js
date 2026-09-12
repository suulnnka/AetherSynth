/* 组件基类(Mod)与生命周期:创建 / 删除 / 复制。
   组件 = 外壳(标题行 + 输入输出泳道 + 内容区)+ 一组 3.5mm 接口 +
   定义提供的 build(音频节点)/ ui(内容区 DOM)/ tick / dispose。 */

import { el } from './utils.js';
import { state, nextId } from './state.js';
import { getCtx, Mon } from './audio.js';
import { DEFS } from './registry.js';
import { SHELL, BASE } from './ports.js';
import { addCable, removeCable, redrawCables } from './cables.js';
import { reflowActive } from './flow.js';
import { saveSoon } from './save.js';
import { worldEl } from './view.js';
import { selMod } from './selection.js';
import { showTip, hideTip } from '../ui/tooltip.js';
import { toast } from '../ui/toast.js';

export class Mod {
  constructor(def, cx, cy, id, modState) {
    const ctx = getCtx();
    this.def = def;
    this.id = id != null ? id : nextId();
    while (state.mods.has(this.id)) this.id = nextId();   // 存档恢复时的 id 碰撞兜底
    this.cx = cx; this.cy = cy;
    this.state = modState || (def.state ? def.state() : {});
    this.ins = {}; this.outs = {};
    this.mons = {}; this.prev = {}; this.bases = []; this._screens = [];

    const root = this.el = el('div', 'module cat-' + def.cat);
    root.dataset.id = this.id;
    root.style.left = (cx * state.cellPx) + 'px';
    root.style.top = (cy * state.cellPx) + 'px';
    root.style.width = (def.w * state.cellPx) + 'px';
    root.style.height = (def.h * state.cellPx) + 'px';

    // 外壳排版:标题行 + 上下泳道,余下给内容区
    const hasOut = def.ports.some(p => p.dir === 'out');
    const hasIn = def.ports.some(p => p.dir === 'in');
    this._top = SHELL.headerC + (hasOut ? SHELL.laneC : SHELL.padC);
    this._bot = hasIn ? SHELL.laneC : SHELL.padC;

    const head = el('div', 'mhead', root);
    const nm = el('div', 'mname', head);
    nm.textContent = def.name;
    el('small', '', nm).textContent = def.en;
    const mx = el('div', 'mx', head);
    mx.textContent = '✕'; mx.title = '删除组件';
    mx.addEventListener('pointerdown', e => e.stopPropagation());
    mx.addEventListener('click', e => { e.stopPropagation(); deleteMod(this.id); });
    // Eurorack 面板螺丝
    for (const pos of ['tl', 'tr', 'bl', 'br']) el('div', 'screw screw-' + pos, root);

    const bodyHost = el('div', 'mbody', root);
    bodyHost.style.top = `calc(var(--cellpx) * ${this._top})`;
    bodyHost.style.bottom = `calc(var(--cellpx) * ${this._bot})`;
    const scale = el('div', 'mscale', bodyHost);
    scale.style.width = ((def.w - 0.7) * BASE) + 'px';
    scale.style.height = ((def.h - this._top - this._bot) * BASE) + 'px';
    this.body = scale;

    for (const p of def.ports) this[p.dir === 'out' ? 'outs' : 'ins'][p.id] = ctx.createGain();

    worldEl.appendChild(root);
    // 把组件定义里的方法绑定为实例方法(类自身的方法优先)
    for (const k of Object.keys(def))
      if (typeof def[k] === 'function' && this[k] === undefined) this[k] = def[k].bind(this);
    if (def.build) def.build.call(this);
    this.addJacks();
    if (def.ui) def.ui.call(this);
    this.applyDefaults();
    state.mods.set(this.id, this);
    reflowActive();
  }

  addJacks() {
    for (const p of this.def.ports) {
      const j = el('div', 'jack ' + p.dir + ' t-' + p.type);
      j.dataset.mod = this.id; j.dataset.port = p.id; j.dataset.dir = p.dir;
      j.style.left = (p._x * state.cellPx) + 'px';
      j.style.top = (p._y * state.cellPx) + 'px';
      el('span', 'plabel', j).textContent = p.name;
      j.title = p.name;
      j.addEventListener('pointerenter', () => showTip(j));
      j.addEventListener('pointerleave', hideTip);
      j.addEventListener('dblclick', e => {
        e.stopPropagation();
        const cs = [...state.cables.values()].filter(c =>
          (c.a.m === this.id && c.a.p === p.id) || (c.b.m === this.id && c.b.p === p.id));
        cs.forEach(c => removeCable(c));
        if (cs.length) toast('拔掉了 ' + cs.length + ' 根线');
      });
      this.el.appendChild(j);
    }
  }

  /** 建立输出口/输入口的电平监视(def.build 里调用) */
  mon(port, node, size) {
    if (!this.mons[port]) this.mons[port] = new Mon(node || this.ins[port], size);
    return this.mons[port];
  }

  /** 输入口默认值登记:接线后输入被信号接管,默认值让位 */
  addBase(port, param, off, on) { this.bases.push({ port, param, off, on }); }

  hasCable(port) {
    for (const c of state.cables.values())
      if ((c.a.m === this.id && c.a.p === port) || (c.b.m === this.id && c.b.p === port)) return true;
    return false;
  }

  applyDefaults() {
    const conn = {};
    for (const c of state.cables.values()) {
      if (c.a.m === this.id) conn[c.a.p] = 1;
      else if (c.b.m === this.id) conn[c.b.p] = 1;
    }
    for (const b of this.bases) b.param.value = conn[b.port] ? b.on : b.off;
  }

  /** MIDI 消息沿 MIDI 线缆分发给下游模块(MIDI 口不走 Web Audio 节点) */
  emitMidi(port, msg) {
    for (const c of state.cables.values()) {
      if (c.midi && c.a.m === this.id && c.a.p === port) {
        const t = state.mods.get(c.b.m);
        if (t && t.midiIn) t.midiIn(msg);
      }
    }
  }

  /** 从本模块的波形输出口接线到目标模块(歌曲搭棚用) */
  waveOut(wave, targetId, inPort) {
    const map = { sine: 'SIN', triangle: 'TRI', sawtooth: 'SAW', square: 'SQR' };
    return addCable(this.id, map[wave] || 'SAW', targetId, inPort);
  }

  /** 未接线输入口使用默认电压;接了线返回监视到的实时电平 */
  volts(port, def) {
    return this.hasCable(port) ? (this.mons[port] ? this.mons[port].v : 0) : def;
  }

  /** 输入口电平的上升 / 下降沿检测(时钟、门用) */
  edge(port, th = 0.5) {
    const v = this.mons[port] ? this.mons[port].v : 0;
    const pv = this.prev[port] === undefined ? v : this.prev[port];
    this.prev[port] = v;
    if (pv < th && v >= th) return 1;
    if (pv >= th && v < th) return -1;
    return 0;
  }

  moveTo(cx, cy) {
    const dx = cx - this.cx, dy = cy - this.cy;
    this.cx = cx; this.cy = cy;
    this.el.style.left = (cx * state.cellPx) + 'px';
    this.el.style.top = (cy * state.cellPx) + 'px';
    if (this.childIds)   // 组合模块:整体平移内部子组件
      for (const kid of this.childIds) {
        const c = state.mods.get(kid);
        if (c) c.moveTo(c.cx + dx, c.cy + dy);
      }
    redrawCables();
  }

  /** 内容区 canvas 自适配格距与缩放(示波器 / 键盘等用) */
  fitScreen(key, cv) {
    const k = state.cellPx / BASE, dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 40, h = cv.clientHeight || 40;
    cv.width = Math.max(2, Math.round(w * k * dpr));
    cv.height = Math.max(2, Math.round(h * k * dpr));
    const c = cv.getContext('2d');
    c.setTransform(k * dpr, 0, 0, k * dpr, 0, 0);
    this[key] = { cv, c, w, h };
    if (!this._screens.find(s => s.key === key)) this._screens.push({ key, cv });
  }

  refitScreens() { this._screens.forEach(s => this.fitScreen(s.key, s.cv)); }

  dispose() {
    if (this.def.dispose) this.def.dispose.call(this);
    const kill = n => { try { n.disconnect(); } catch (e) {} };
    Object.values(this.ins).forEach(kill);
    Object.values(this.outs).forEach(kill);
  }
}

export function createModule(defId, cx, cy, id, modState) {
  return new Mod(DEFS[defId], cx, cy, id, modState);
}

export function deleteMod(id) {
  const m = state.mods.get(id);
  if (!m) return;
  if (m.def.composite && m.childIds && m.childIds.length &&
      !confirm('删除组合模块会连同内部 ' + m.childIds.length + ' 个组件一起删除,确定?')) return;
  if (m.childIds && m.childIds.length) {   // 组合模块:连带删除内部所有组件
    for (const kid of [...m.childIds]) deleteMod(kid);
    m.childIds = [];
  }
  if (m.parent) {                          // 从父组合的成员表摘除
    const p = state.mods.get(m.parent);
    if (p && p.childIds) p.childIds = p.childIds.filter(x => x !== id);
  }
  [...state.cables.values()].filter(c =>
    c.a.m === id || c.b.m === id).forEach(c => removeCable(c, { silent: true }));
  m.dispose();
  m.el.remove();
  state.mods.delete(id);
  reflowActive();
  if (state.sel === id) state.sel = null;
  toast('已删除:' + m.def.name);
  saveSoon();
}

export function duplicateMod(id) {
  const m = state.mods.get(id);
  if (!m) return;
  if (m.def.composite) { toast('组合模块请用 封装 / 解体 管理'); return; }
  const n = createModule(m.def.id, m.cx + 2, m.cy + 2, null, JSON.parse(JSON.stringify(m.state)));
  if (n.setKnob && m.setKnob) n.setKnob(m.state.v);
  if (n.setSw && m.setSw) n.setSw(m.state.on);
  if (n.setCellVal && m.setCellVal)   // 自制组件:按格恢复控件值
    for (const [cid, v] of Object.entries(m.state.vals || {})) n.setCellVal(cid, v);
  selMod(n.id);
  saveSoon();
}
