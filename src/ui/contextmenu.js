/* 右键菜单组件:在任意位置弹出菜单,供各处复用。
   ---------------------------------------------------------------------
   showMenu(x, y, items)   在视口坐标处弹出菜单
     items: [{ label, action, danger?, checked? } | { sep: true }]
   hideMenu()              关闭菜单
   isMenuOpen()            菜单是否打开
   点击菜单项 / 菜单外 / Esc → 关闭。 */

let el = null;

export function isMenuOpen() { return !!el; }

export function hideMenu() {
  if (el) { el.remove(); el = null; }
}

/** 在 (x, y) 处弹出菜单;items 为空则不显示 */
export function showMenu(x, y, items) {
  hideMenu();
  if (!items || !items.length) return;
  el = document.createElement('div');
  el.className = 'ctxmenu';
  for (const item of items) {
    if (item.sep) {
      const s = document.createElement('div');
      s.className = 'cm-sep';
      el.appendChild(s);
      continue;
    }
    const it = document.createElement('div');
    it.className = 'cm-item' + (item.danger ? ' danger' : '');
    const mark = document.createElement('span');
    mark.className = 'cm-mark';
    mark.textContent = item.checked ? '✓' : '';
    it.appendChild(mark);
    const label = document.createElement('span');
    label.textContent = item.label;
    it.appendChild(label);
    it.addEventListener('click', () => {
      hideMenu();
      if (item.action) item.action();
    });
    el.appendChild(it);
  }
  document.body.appendChild(el);
  // 防止溢出屏幕
  const r = el.getBoundingClientRect();
  el.style.left = Math.min(x, innerWidth - r.width - 6) + 'px';
  el.style.top = Math.min(y, innerHeight - r.height - 6) + 'px';
  // 点击其他地方关闭(捕获阶段,先于页面其它处理)
  document.addEventListener('pointerdown', function onDown(e) {
    if (el && !el.contains(e.target)) { hideMenu(); }
    document.removeEventListener('pointerdown', onDown, true);
  }, true);
  window.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { hideMenu(); window.removeEventListener('keydown', onKey); }
  });
}
