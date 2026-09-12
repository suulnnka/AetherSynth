/* 钢琴键盘(含电脑键提示)。点击琴键调 mod.noteOn/noteOff。 */

import { el } from '../core/utils.js';

export function keys(mod) {
  const self = mod;
  const wrap = el('div', 'kbwrap', mod.body);
  wrap.dataset.ctl = '1';
  const hint = el('div', 'kbhint', wrap);
  hint.textContent = '电脑键:A W S E D F T G Y H U J K O L P ;(Z / X 切八度) · MIDI:待接入';
  mod._hint = hint;
  const keys = el('div', 'kbkeys', wrap);
  const WHITE = [0, 2, 4, 5, 7, 9, 11];
  const wNotes = [];
  for (let n = 48; n <= 72; n++) if (WHITE.includes(n % 12)) wNotes.push(n);
  const kw = 100 / wNotes.length;
  const bind = (k, n) => {
    self._keys.set(n, k);
    k.addEventListener('pointerdown', e => {
      e.stopPropagation();
      const r = k.getBoundingClientRect();
      const vel = 40 + Math.round(87 * Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)));
      self.noteOn(n, vel);
      const up = () => { self.noteOff(n); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointerup', up);
    });
  };
  wNotes.forEach((n, i) => {
    const k = el('div', 'wkey', keys);
    k.style.left = (i * kw) + '%'; k.style.width = kw + '%';
    bind(k, n);
  });
  wNotes.forEach((n, i) => {
    const bn = n + 1;
    if (bn > 72 || !WHITE.includes(bn % 12)) return;
    const k = el('div', 'bkey', keys);
    k.style.left = ((i + 1) * kw - kw * 0.3) + '%'; k.style.width = (kw * 0.6) + '%';
    bind(k, bn);
  });
}
