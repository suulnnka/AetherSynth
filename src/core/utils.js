/* 基础工具:DOM 快捷方式与通用小函数(无任何项目内依赖,可被所有层引用) */

export const $ = s => document.querySelector(s);

/** 创建并挂载元素:el('div', 'a b', parent) */
export const el = (tag, cls, parent) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
};

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** HTML 转义(用于把用户输入的文本插进 innerHTML) */
export const escHtml = s =>
  String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
