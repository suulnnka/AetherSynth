/* 通用窗口组件:未来所有弹窗 / 浮动面板需求的统一实现。
   ---------------------------------------------------------------------
   · AppWindow      通用窗口:标题栏(可拖动)+ 内容区 + 可选按钮排;
                    支持模态(带遮罩)与非模态、点击遮罩关闭、Esc 关闭
                    最上层窗口、多窗口层叠(z-index 管理)。
   · confirmDialog  Promise 化确认框(替代原生 confirm)。
   · alertDialog    Promise 化警告框(替代原生 alert)。
   · hasOpenWindow / closeTopWindow  供全局键盘等查询与驱动。

   用法:
     const win = new AppWindow({
       title: '标题', content: Element|string, width: 420,
       modal: true,          // 带遮罩
       dismissable: true,    // 点击遮罩关闭
       actions: [            // 底部按钮(可省)
         { label: '取消', onClick: () => win.close() },
         { label: '确定', primary: true, onClick: () => win.close() }
       ],
       onClose: () => {}     // 窗口关闭回调
     });
     win.open();  win.close();  win.toggle();
   ===================================================================== */

import { el } from '../core/utils.js';

/** 打开中的窗口栈(栈顶 = 最上层);z 值从 121 起递增
    (tooltip 100、toast 500,toast 永远在窗口之上) */
const openStack = [];
let zTop = 120;

export function hasOpenWindow() { return openStack.length > 0; }

/** 关闭最上层窗口;有窗口被关闭返回 true */
export function closeTopWindow() {
  const w = openStack[openStack.length - 1];
  if (!w) return false;
  w.close();
  return true;
}

export class AppWindow {
  /**
   * opts: { title, content, width = 420, modal = true, dismissable = true,
   *         actions = null, onClose = null }
   * actions: [{ label, primary?, danger?, onClick? }]
   */
  constructor(opts = {}) {
    this.opts = Object.assign({
      title: '', content: null, width: 420,
      modal: true, dismissable: true, actions: null, onClose: null
    }, opts);
    this.isOpen = false;
    this._backdrop = null;
    this._build();
  }

  _build() {
    const o = this.opts;
    const root = this.el = el('section', 'gw');
    root.setAttribute('role', 'dialog');
    root.setAttribute('tabindex', '-1');
    root.style.width = typeof o.width === 'number' ? o.width + 'px' : o.width;

    const bar = this._bar = el('header', 'gw-tbar', root);
    this._titleEl = el('span', 'gw-title', bar);
    this._titleEl.textContent = o.title;
    const x = el('button', 'tbtn gw-x', bar);
    x.textContent = '✕'; x.title = '关闭';
    x.addEventListener('click', e => { e.stopPropagation(); this.close(); });

    const body = this._body = el('div', 'gw-body', root);
    if (o.content != null) {
      if (typeof o.content === 'string') body.innerHTML = o.content;
      else { o.content.hidden = false; body.appendChild(o.content); }
    }

    if (o.actions && o.actions.length) {
      const foot = el('footer', 'gw-foot', root);
      for (const a of o.actions) {
        const btn = el('button', 'tbtn' + (a.primary ? ' primary' : '') + (a.danger ? ' warn' : ''), foot);
        btn.textContent = a.label;
        if (a.primary) btn.dataset.autofocus = '1';
        btn.addEventListener('click', () => { if (a.onClick) a.onClick(); });
      }
    }

    // 标题栏拖动(✕ 按钮除外)
    bar.addEventListener('pointerdown', e => {
      if (e.target.closest('.gw-x')) return;
      this.bringToFront();
      const r = this.el.getBoundingClientRect();
      const ox = e.clientX - r.left, oy = e.clientY - r.top;
      const move = ev => {
        this.el.style.left = clampPx(ev.clientX - ox, innerWidth - r.width) + 'px';
        this.el.style.top = clampPx(ev.clientY - oy, innerHeight - 32) + 'px';
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      e.preventDefault();
    });
    root.addEventListener('pointerdown', () => this.bringToFront());
  }

  open() {
    if (this.isOpen) return this.bringToFront();
    this.isOpen = true;
    if (this.opts.modal) {
      this._backdrop = el('div', 'gw-backdrop', document.body);
      if (this.opts.dismissable)
        this._backdrop.addEventListener('pointerdown', () => this.close());
    }
    document.body.appendChild(this.el);
    // 首次打开居中(保留上次拖动的位置)
    if (!this.el.style.left) {
      const r = this.el.getBoundingClientRect();
      this.el.style.left = Math.max(8, (innerWidth - r.width) / 2) + 'px';
      this.el.style.top = Math.max(8, (innerHeight - r.height) / 2.4) + 'px';
    }
    openStack.push(this);
    this.bringToFront();
    const focusEl = this.el.querySelector('[data-autofocus]') || this.el;
    focusEl.focus({ preventScroll: true });
    return this;
  }

  close() {
    if (!this.isOpen) return this;
    this.isOpen = false;
    const i = openStack.indexOf(this);
    if (i >= 0) openStack.splice(i, 1);
    this.el.remove();
    if (this._backdrop) { this._backdrop.remove(); this._backdrop = null; }
    if (this.opts.onClose) this.opts.onClose();
    return this;
  }

  toggle() { return this.isOpen ? this.close() : this.open(); }

  bringToFront() {
    const z = ++zTop;
    this.el.style.zIndex = z;
    if (this._backdrop) this._backdrop.style.zIndex = z;
  }

  setTitle(t) { this._titleEl.textContent = t; return this; }
}

const clampPx = (v, max) => Math.max(8 - 60, Math.min(v, max - 8));

/* ---------------- Promise 化对话框 ---------------- */

/** 确认框:resolve(true = 确定 / false = 取消或关闭) */
export function confirmDialog({ title = '确认', message = '', okLabel = '确定', cancelLabel = '取消', danger = false } = {}) {
  return new Promise(resolve => {
    const msg = el('div', 'gw-message');
    msg.textContent = message;
    let win;
    win = new AppWindow({
      title, content: msg, width: 380, modal: true, dismissable: false,
      onClose: () => resolve(false),          // Esc / ✕ 一律视为取消
      actions: [
        { label: cancelLabel, onClick: () => win.close() },
        { label: okLabel, primary: true, danger, onClick: () => { win.opts.onClose = null; win.close(); resolve(true); } }
      ]
    });
    win.open();
  });
}

/** 警告框:关闭后 resolve */
export function alertDialog({ title = '提示', message = '', okLabel = '确定' } = {}) {
  return new Promise(resolve => {
    const msg = el('div', 'gw-message');
    msg.textContent = message;
    const win = new AppWindow({
      title, content: msg, width: 380, modal: true, dismissable: false,
      onClose: resolve,
      actions: [{ label: okLabel, primary: true, onClick: () => win.close() }]
    });
    win.open();
  });
}
