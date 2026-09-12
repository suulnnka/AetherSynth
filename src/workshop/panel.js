/* CompactPanel · 组件工坊设计面板(可独立复用)
   ---------------------------------------------------------------------
   一个自足的 UI 组件:把任意数量的"控制格"排成紧凑网格,每格可以是
   旋钮 / 推子 / 开关 / 电压表。定位是"个性化新组件的设计面板":
   面板上的控件可选中、可改属性、可增删;设计结果通过 spec() 导出,
   宿主(AetherSynth)把 spec 实例化为画布上真正的组件。
   支持外观主题:背景(纯色 / 多级渐变 / 图片)+ 输入控件多种风格。

   用法:
     const panel = new CompactPanel(hostEl, {
       name: '我的组件', cols: 3, span: 3, cell: 24, seq: 0,
       editable: true,                // 画布实例上放只读面板时传 false
       theme: { bg: {...}, widget, accent, text },
       onChange: () => {},            // 规格 / 外观变化(值拖动也算)
       onCellSelect: id => {}         // 选中某个控制格(null = 取消)
     });
     panel.addCell({ kind:'knob'|'fader'|'switch'|'meter', label, min, max, steps, note, value })
     panel.updateCell(id, patch) / selectCell(id|null) / cellCfg(id)
     panel.setCellValue(id, v) / cellIds() / clear() / tick()
     panel.setMetrics({ cell, span, cols }) / setTheme(t) / getTheme()
     panel.spec() -> { name, seq, cols, span, theme, cells:[...] }
     panel.loadSpec(spec, vals)

     // 单格独立渲染(画布上的自制组件实例复用同一套外观):
     const { el, handle } = mkCell(cfg,
       { change: v => {}, remove: () => {} }, { removable: false, box: 72 });
   ===================================================================== */

import { CPX_CSS } from './panel-styles.js';

export { mkCell };

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

let styleInjected = false;
function injectStyle() {
  if (styleInjected) return;
  const s = document.createElement('style');
  s.id = 'cpx-style';
  s.textContent = CPX_CSS;
  document.head.appendChild(s);
  styleInjected = true;
}

/** 渲染单个控制格。cfg:{ id,kind,label,min,max,steps,note,value }
    cb:{ change(v), remove() }  opts:{ removable, box }
    返回 { el, handle };handle.set(v) 编程设值(不触发 cb),meter 用 setBar(v)。 */
function mkCell(cfg, cb, opts = {}) {
  const kind = cfg.kind || 'knob';
  const cellEl = document.createElement('div');
  cellEl.className = 'cpx-cell';
  cellEl.style.setProperty('--cpx-box', (opts.box || 72) + 'px');
  const label = document.createElement('div');
  label.className = 'cpx-label';
  label.textContent = cfg.label || '';
  cellEl.appendChild(label);
  const handle = {};

  if (kind === 'knob') {
    const min = cfg.min ?? 0, max = cfg.max ?? 10, span = max - min;
    const steps = cfg.steps || null;
    const quant = v => {
      v = Math.min(max, Math.max(min, v));
      if (!steps) return Math.round(v * 100) / 100;
      let best = steps[0];
      for (const s of steps) if (Math.abs(s - v) < Math.abs(best - v)) best = s;
      return best;
    };
    const fmt = v => cfg.note
      ? (NOTE_NAMES[Math.round(Math.min(1, Math.max(0, v))) % 12] + ' · ' + v.toFixed(2) + 'V')
      : v.toFixed(1) + 'V';
    const kn = document.createElement('div');
    kn.className = 'cpx-knob';
    const ptr = document.createElement('div');
    ptr.className = 'cpx-kptr';
    kn.append(ptr);
    const val = document.createElement('div');
    val.className = 'cpx-val';
    cellEl.append(kn, val);
    let cur = cfg.value ?? min;
    const render = v => {
      kn.style.setProperty('--a', ((v - min) / span * 270 - 135) + 'deg');
      val.textContent = fmt(v);
    };
    handle.set = v => { v = quant(v); cur = v; render(v); };
    handle.get = () => cur;
    kn.addEventListener('pointerdown', e => {
      e.stopPropagation();
      const sy = e.clientY, sv = cur;
      const mv = ev => { const v = quant(sv + (sy - ev.clientY) * span * (ev.shiftKey ? 0.0008 : 0.006)); cur = v; render(v); if (cb.change) cb.change(v); };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    });
    kn.addEventListener('wheel', e => {
      e.preventDefault(); e.stopPropagation();
      let v;
      if (steps) {
        const i = steps.findIndex(s => Math.abs(s - cur) < 1e-6);
        v = steps[Math.min(steps.length - 1, Math.max(0, i + (e.deltaY < 0 ? 1 : -1)))];
      } else v = cur + (e.deltaY < 0 ? span * 0.01 : -span * 0.01);
      v = quant(v); cur = v; render(v); if (cb.change) cb.change(v);
    }, { passive: false });
    kn.addEventListener('dblclick', e => {
      e.stopPropagation();
      const v = steps ? steps[(steps.length / 2) | 0] : (min + max) / 2;
      cur = v; render(v); if (cb.change) cb.change(v);
    });
    render(cur);
  }

  else if (kind === 'fader') {
    const min = cfg.min ?? 0, max = cfg.max ?? 10, span = max - min;
    const track = document.createElement('div');
    track.className = 'cpx-fader';
    const handleEl = document.createElement('div');
    handleEl.className = 'cpx-fhandle';
    track.appendChild(handleEl);
    const val = document.createElement('div');
    val.className = 'cpx-val';
    cellEl.append(track, val);
    let cur = cfg.value ?? min;
    const render = v => {
      handleEl.style.top = ((1 - (v - min) / span) * 100) + '%';
      val.textContent = v.toFixed(1) + 'V';
    };
    handle.set = v => { v = Math.min(max, Math.max(min, Math.round(v * 100) / 100)); cur = v; render(v); };
    handle.get = () => cur;
    const apply = ev => {
      const r = track.getBoundingClientRect();
      const v = Math.min(max, Math.max(min, Math.round((1 - (ev.clientY - r.top) / r.height) * span * 100) / 100));
      cur = v; render(v); if (cb.change) cb.change(v);
    };
    track.addEventListener('pointerdown', e => {
      e.stopPropagation();
      apply(e);
      const mv = ev => apply(ev);
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    });
    render(cur);
  }

  else if (kind === 'switch') {
    const sw = document.createElement('div');
    sw.className = 'cpx-sw' + (cfg.value ? ' on' : '');
    const dot = document.createElement('div');
    dot.className = 'cpx-swdot';
    sw.appendChild(dot);
    const val = document.createElement('div');
    val.className = 'cpx-val';
    cellEl.append(sw, val);
    let cur = !!cfg.value;
    const render = on => { sw.classList.toggle('on', on); val.textContent = on ? 'ON' : 'OFF'; };
    handle.set = v => { cur = !!v; render(cur); };
    handle.get = () => cur;
    sw.addEventListener('pointerdown', e => {
      e.stopPropagation();
      cur = !cur; render(cur); if (cb.change) cb.change(cur);
    });
    render(cur);
  }

  else {   // meter 电压表
    const meter = document.createElement('div');
    meter.className = 'cpx-meter';
    const bar = document.createElement('div');
    bar.className = 'cpx-mbar';
    meter.appendChild(bar);
    const val = document.createElement('div');
    val.className = 'cpx-val';
    val.textContent = '0.00V';
    cellEl.append(meter, val);
    handle.setBar = v => {
      bar.style.height = Math.min(100, Math.max(0, v * 10)) + '%';
      val.textContent = (+v).toFixed(2) + 'V';
    };
  }

  if (opts.removable && cb.remove) {
    const x = document.createElement('div');
    x.className = 'cpx-x';
    x.textContent = '✕';
    x.title = '从设计中移除';
    x.addEventListener('click', e => { e.stopPropagation(); cb.remove(); });
    cellEl.appendChild(x);
  }
  return { el: cellEl, handle };
}

export class CompactPanel {  constructor(container, opts = {}) {
    injectStyle();
    this.opts = Object.assign({ editable: true }, opts);
    this.cells = new Map();
    this.seq = opts.seq || 0;
    this.selId = null;
    this.theme = null;
    // 网格度量:cell = 主画布格距(px);span = 每个控制格占据的格数;cols = 每行控制格数
    this.cell = opts.cell || 24;
    this.span = opts.span || 3;
    this.cols = opts.cols || 3;
    this.rootEl = container;
    container.classList.add('cpx-root', 'cpx-scope');
    container.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'cpx-head';
    const tag = document.createElement('span');
    tag.className = 'cpx-nametag';
    tag.textContent = '组件名';
    this.nameEl = document.createElement('input');
    this.nameEl.className = 'cpx-name';
    this.nameEl.value = opts.name || '我的组件';
    this.nameEl.title = '设计名称,放置后显示为组件标题';
    this.nameEl.addEventListener('input', () => this._emit());
    head.append(tag, this.nameEl);
    this.gridEl = document.createElement('div');
    this.gridEl.className = 'cpx-grid';
    const empty = document.createElement('div');
    empty.className = 'cpx-empty';
    empty.textContent = '空设计 · 用上方「＋旋钮 / ＋推子 / ＋开关 / ＋电压表」添加控件\n点选控件可改名、定量程;「放置组件」一键变成画布上的新组件';
    this.gridEl.appendChild(empty);
    this.emptyEl = empty;
    container.append(head, this.gridEl);
    this.setTheme(opts.theme);
    this.setMetrics({ cell: this.cell, span: this.span, cols: this.cols });
  }

  name() { return this.nameEl.value.trim() || '我的组件'; }

  nextId() { return 'c' + (++this.seq); }

  /** 控制格 = span×span 个主画布格;面板宽 = cols 个控制格。该尺寸即放置后组件的内容区占位。 */
  setMetrics(m) {
    if (m.cell != null) this.cell = m.cell;
    if (m.span != null) this.span = m.span;
    if (m.cols != null) this.cols = Math.max(1, m.cols | 0);
    const box = this.span * this.cell;
    this.gridEl.style.gridTemplateColumns = `repeat(${this.cols}, ${box}px)`;
    this.gridEl.style.gridAutoRows = box + 'px';
    for (const c of this.cells.values())
      c.el.style.setProperty('--cpx-box', box + 'px');
    // 重入保护:宿主在 onResize 里再次调用 setMetrics 不会死循环
    if (this.onResize && !this._inResize) {
      this._inResize = true;
      try { this.onResize({ width: this.cols * box, span: this.span, cols: this.cols }); }
      finally { this._inResize = false; }
    }
    return { cols: this.cols, span: this.span, cell: this.cell };
  }

  /* ---------------- 外观主题 ---------------- */
  setTheme(theme) {
    const t = theme || {};
      const bg = t.bg || { type: 'solid', color: '#f7f8fa' };
    this.theme = {
      bg,
      widget: t.widget || 'dark',
      accent: t.accent || '#ffb01f',
      text: t.text || '#2b3138'
    };
    CompactPanel.applyTheme(this.rootEl, this.theme);
    this._emit();
    return this.getTheme();
  }

  getTheme() { return JSON.parse(JSON.stringify(this.theme)); }

  /** 把外观主题应用到任意元素(画布上的自制组件实例) */
  static applyTheme(el, theme) {
    const t = theme || {};
    el.classList.add('cpx-scope');
    el.dataset.widget = t.widget || 'dark';
    el.style.setProperty('--cpx-accent', t.accent || '#ffb01f');
    el.style.setProperty('--cpx-text', t.text || '#2b3138');
    const b = t.bg || { type: 'solid' };
    const st = el.style;
    ['backgroundImage', 'backgroundColor', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat']
      .forEach(k => st[k] = '');
    if (b.type === 'image' && b.image) {
      st.backgroundImage = 'url("' + b.image + '")';
      st.backgroundSize = 'cover';
      st.backgroundPosition = 'center';
      st.backgroundRepeat = 'no-repeat';
    } else if (b.type === 'gradient') {
      const stops = (b.stops && b.stops.length ? b.stops : ['#ffffff', '#dddddd']).join(',');
      st.backgroundImage = 'linear-gradient(' + (b.angle || 135) + 'deg, ' + stops + ')';
    } else if (b.color) {
      st.backgroundColor = b.color;
    }
  }

  _refreshEmpty() {
    if (this.emptyEl) this.emptyEl.style.display = this.cells.size ? 'none' : 'block';
  }
  _emit() { if (this.opts.onChange) this.opts.onChange(); }

  /* ---------------- 控制格管理 ---------------- */
  addCell(cfg) {
    if (!cfg) return null;
    if (!cfg.id) cfg.id = this.nextId();
    if (this.cells.has(cfg.id)) this.removeCell(cfg.id);
    const id = cfg.id;
    const { el: cellEl, handle } = mkCell(cfg, {
      change: () => this._emit(),
      remove: () => this.removeCell(id)
    }, { removable: this.opts.editable, box: this.span * this.cell });
    if (this.opts.editable) {
      cellEl.addEventListener('pointerdown', () => this.selectCell(id), true);
    }
    const cell = { cfg, el: cellEl, handle };
    this.cells.set(id, cell);
    this.gridEl.appendChild(cellEl);
    this._refreshEmpty();
    this._emit();
    return id;
  }

  selectCell(id) {
    if (id && !this.cells.has(id)) id = null;
    if (this.selId === id) return;
    if (this.selId) {
      const prev = this.cells.get(this.selId);
      if (prev) prev.el.classList.remove('sel');
    }
    this.selId = id;
    if (id) this.cells.get(id).el.classList.add('sel');
    if (this.opts.onCellSelect) this.opts.onCellSelect(id);
  }

  cellCfg(id) {
    const c = this.cells.get(id);
    return c ? { ...c.cfg, value: c.handle.get ? c.handle.get() : undefined } : null;
  }

  /** 修改控件属性:原位重建该格,保留当前值与选中态 */
  updateCell(id, patch) {
    const c = this.cells.get(id);
    if (!c) return;
    const cur = c.handle.get ? c.handle.get() : undefined;
    Object.assign(c.cfg, patch);
    const wasSel = this.selId === id;
    c.el.remove();
    const { el: cellEl, handle } = mkCell(c.cfg, {
      change: () => this._emit(),
      remove: () => this.removeCell(id)
    }, { removable: this.opts.editable, box: this.span * this.cell });
    if (this.opts.editable) cellEl.addEventListener('pointerdown', () => this.selectCell(id), true);
    if (cur !== undefined) handle.set(cur);
    c.el = cellEl; c.handle = handle;
    if (wasSel) cellEl.classList.add('sel');
    this.gridEl.appendChild(cellEl);
    this._refreshEmpty();
    this._emit();
  }

  hasCell(id) { return this.cells.has(id); }
  cellIds() { return [...this.cells.keys()]; }
  setCellValue(id, v) { const c = this.cells.get(id); if (c && c.handle.set) c.handle.set(v); }

  removeCell(id) {
    const c = this.cells.get(id);
    if (!c) return;
    this.cells.delete(id);
    c.el.remove();
    if (this.selId === id) this.selectCell(null);
    this._refreshEmpty();
    this._emit();
  }

  clear() {
    for (const id of [...this.cells.keys()]) this.removeCell(id);
    this.seq = 0;
  }

  tick() {
    for (const c of this.cells.values()) {
      if (c.cfg.kind !== 'meter' || !c.cfg.poll) continue;
      c.handle.setBar(Math.abs(c.cfg.poll() || 0));   // 半波显示:双极信号也能看到幅度
    }
  }

  /* ---------------- 设计规格导入 / 导出 ---------------- */
  spec() {
    return {
      name: this.name(),
      seq: this.seq,
      cols: this.cols,
      span: this.span,
      theme: this.getTheme(),
      cells: [...this.cells.values()].map(c => {
        const o = { id: c.cfg.id, kind: c.cfg.kind, label: c.cfg.label };
        for (const k of ['min', 'max', 'steps', 'note']) if (c.cfg[k] !== undefined) o[k] = c.cfg[k];
        if (c.cfg.kind !== 'meter' && c.handle.get) o.value = c.handle.get();
        return o;
      })
    };
  }

  /** vals: { cellId: 初始值 };缺省用 spec 内置值 */
  loadSpec(spec, vals) {
    this.clear();
    this.nameEl.value = (spec && spec.name) || '我的组件';
    this.setMetrics({ cols: (spec && spec.cols) || 3, span: (spec && spec.span) || 3 });
    this.seq = (spec && spec.seq) || ((spec && spec.cells ? spec.cells.length : 0));
    if (spec && spec.theme) this.setTheme(spec.theme);
    for (const cd of ((spec && spec.cells) || [])) {
      const v = vals && vals[cd.id] !== undefined ? vals[cd.id] : cd.value;
      this.addCell({ ...cd, value: v });
    }
  }
}

