/* 数字运算组件(把 CV 当数字):
   帧率采样输入 → JS 计算 → 恒定源输出,与量化器同款控制率方案。 */

import { clamp } from '../core/utils.js';
import { ctx } from '../core/audio.js';

function mkMathDef(id, name, en, desc, fn, opts = {}) {
  const ins = opts.ports || [
    { id: 'A', dir: 'in', name: 'A', desc: '输入 A' },
    { id: 'B', dir: 'in', name: 'B', desc: '输入 B' }
  ];
  return {
    id, name, en, cat: 'process', w: opts.w || 4, h: 5, cvAll: true,
    desc,
    ports: [{ id: 'OUT', dir: 'out', name: 'OUT', desc: '运算结果' }, ...ins],
    build() {
      this.cs = ctx.createConstantSource(); this.cs.offset.value = 0;
      this.cs.connect(this.outs.OUT); this.cs.start();
      ins.forEach(p => this.mon(p.id));
      this._last = null;
    },
    tick() {
      const r = fn(...ins.map(p => this.volts(p.id, 0)));
      const v = Number.isFinite(r) ? clamp(r, -1e4, 1e4) : 0;
      if (this._last === null || Math.abs(v - this._last) > 1e-6) {
        this._last = v;
        this.cs.offset.value = v;
      }
    },
    dispose() { try { this.cs.stop(); } catch (e) {} }
  };
}

export const math = {
  add: mkMathDef('add', '加法器', 'ADD', '输出 = A + B。', (a, b) => a + b),
  sub: mkMathDef('sub', '减法器', 'SUB', '输出 = A − B。', (a, b) => a - b),
  mul: mkMathDef('mul', '乘法器', 'MUL', '输出 = A × B(可用 LFO × 包络 做 AM 调制)。', (a, b) => a * b),
  div: mkMathDef('div', '除法器', 'DIV', '输出 = A ÷ B,除零保护:|B| < 0.01 时输出 0。', (a, b) => (Math.abs(b) < 0.01 ? 0 : a / b)),
  avg: mkMathDef('avg', '平均器', 'AVG', '数字混合:输出 = (A + B) ÷ 2。平均而不是相加,不会翻倍。', (a, b) => (a + b) / 2),
  round: mkMathDef('round', '四舍五入', 'ROUND', '输出 = round(IN):就近取整(2.4 → 2,2.6 → 3)。', v => Math.round(v),
    { w: 4, ports: [{ id: 'IN', dir: 'in', name: 'IN', desc: '数字输入' }] }),
  floor: mkMathDef('floor', '下取整', 'FLOOR', '输出 = floor(IN):向负无穷取整(2.7 → 2,−0.2 → −1)。', v => Math.floor(v),
    { w: 4, ports: [{ id: 'IN', dir: 'in', name: 'IN', desc: '数字输入' }] }),
  ceil: mkMathDef('ceil', '上取整', 'CEIL', '输出 = ceil(IN):向正无穷取整(2.1 → 3,−0.2 → 0)。', v => Math.ceil(v),
    { w: 4, ports: [{ id: 'IN', dir: 'in', name: 'IN', desc: '数字输入' }] })
};

/* CV 受控多路选择器:SEL 电压决定输出哪一路 */
math.sel = {
  id: 'sel', name: '选择器', en: 'SELECT ×4', cat: 'process', w: 10, h: 5, cvAll: true,
  desc: '数字选择器:SEL 电压决定输出哪一路(0~2.5V = CH1,2.5~5 = CH2,5~7.5 = CH3,7.5~10 = CH4)。配合音序器可换旋律。',
  ports: [
    { id: 'OUT', dir: 'out', name: 'OUT', desc: '被选中通路的值' },
    { id: 'SEL', dir: 'in', name: 'SEL', desc: '选择电压:每 2.5V 一档' },
    { id: 'CH1', dir: 'in', name: 'CH1', desc: '通路 1(SEL 0~2.5V)' },
    { id: 'CH2', dir: 'in', name: 'CH2', desc: '通路 2(SEL 2.5~5V)' },
    { id: 'CH3', dir: 'in', name: 'CH3', desc: '通路 3(SEL 5~7.5V)' },
    { id: 'CH4', dir: 'in', name: 'CH4', desc: '通路 4(SEL 7.5~10V)' }
  ],
  build() {
    this.cs = ctx.createConstantSource(); this.cs.offset.value = 0;
    this.cs.connect(this.outs.OUT); this.cs.start();
    ['SEL', 'CH1', 'CH2', 'CH3', 'CH4'].forEach(p => this.mon(p));
    this._last = null;
  },
  tick() {
    const sel = clamp(this.volts('SEL', 0), 0, 10);
    const idx = Math.min(3, Math.floor(sel / 2.5));
    const v = this.volts('CH' + (idx + 1), 0);
    if (this._last === null || Math.abs(v - this._last) > 1e-6 || idx !== this._idx) {
      this._last = v; this._idx = idx;
      this.cs.offset.value = clamp(v, -1e4, 1e4);
    }
  },
  dispose() { try { this.cs.stop(); } catch (e) {} }
};
