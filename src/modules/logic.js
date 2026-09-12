/* 逻辑电路:把 CV 电压当作逻辑电平(≥0.5V = 高;输出高 = +10V / 低 = 0V)。
   ---------------------------------------------------------------------
   mkGate 工厂统一「输入监视 → 真值函数 → 输出 + 状态灯」骨架;def 自带
   flow(输出口被下游拉活时,输入来路一并激活)。以后扩展新门只需:
   一个纯真值函数 + mkGate 一条记录。 */

import { ctx } from '../core/audio.js';
import { kit } from '../kit/index.js';
import { saveSoon } from '../core/save.js';
import { el } from '../core/utils.js';

/** 逻辑阈值:输入电压 ≥ 0.5V 记为高电平(与全系统 edge() 门限一致) */
export const LOGIC_TH = 0.5;

/* ---- 纯真值函数(可单测),入参为布尔 ---- */
export const lgNot = a => !a;
export const lgAnd = (a, b) => a && b;
export const lgOr = (a, b) => a || b;
export const lgXor = (a, b) => a !== b;
/** SR 锁存器下一态:RESET 优先(S、R 同拍上升时输出低) */
export const srNext = (on, sRise, rRise) => rRise ? false : (sRise ? true : on);
/** T 触发器下一态:时钟上升沿翻转,其余时刻保持(二分频) */
export const tffNext = (on, clkRise) => clkRise ? !on : on;

/* ---- 骨架:状态灯 UI + 输出写频 ---- */
function ledUI(mod, host) {
  const wrap = el('div', 'gateui', host);
  wrap.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-height:0';
  const led = el('div', 'gled', wrap);
  led.style.cssText = 'width:13px;height:13px;border-radius:50%;background:#20242b;border:1px solid rgba(127,127,127,.4);transition:background .05s';
  const val = el('div', 'gval', wrap);
  val.style.cssText = 'font-size:9px;letter-spacing:1px;opacity:.65;font-family:monospace';
  mod._ui = { led, val };
  paintLed(mod);
}
function paintLed(mod) {
  if (!mod._ui) return;
  const on = mod.state.on;
  mod._ui.led.style.background = on ? '#7dffb0' : '#20242b';
  mod._ui.led.style.boxShadow = on ? '0 0 8px rgba(125,255,176,.8)' : 'none';
  mod._ui.val.textContent = on ? 'HIGH +10V' : 'LOW 0V';
}
/** 把布尔电平写到 OUT 恒压源(状态变化才动参数与 DOM) */
function setOut(mod, on) {
  if (on === mod.state.on) return;
  mod.state.on = on;
  mod.cs.offset.setTargetAtTime(on ? 10 : 0, ctx.currentTime, 0.004);
  paintLed(mod);
}
/** 通用 build:输出恒压源 + 监视全部输入口 */
function gateBuild() {
  this.cs = ctx.createConstantSource();
  this.cs.offset.value = this.state.on ? 10 : 0;
  this.cs.connect(this.outs.OUT);
  this.cs.start();
  this._ins.forEach(p => this.mon(p));
  ledUI(this, this.body);
}
function gateDispose() { try { this.cs.stop(); } catch (e) {} }
/** 读入入口电平并运行真值函数(未接线 = 低电平) */
function evalGate(mod) {
  return mod._fn(...mod._ins.map(p => mod.volts(p, 0) >= LOGIC_TH));
}

/** 门工厂:ins = 输入口名数组,fn = 布尔真值函数 */
function mkGate(id, name, en, ins, fn, truth) {
  return {
    id, name, en, cat: 'logic', w: 3, h: 5,
    desc: `逻辑门(≥0.5V = 高):输出 = ${truth}。高 = +10V / 低 = 0V。`,
    ports: [
      ...ins.map(p => ({ id: p, dir: 'in', name: p, desc: '逻辑输入:≥0.5V = 高' })),
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '高 = +10V,低 = 0V' }
    ],
    flow: { OUT: ins.slice() },        // 输出口被下游拉活时,输入来路一并激活
    state: () => ({ on: false }),
    build() { this._ins = ins; this._fn = fn; gateBuild.call(this); },
    tick() { setOut(this, evalGate(this)); },
    dispose: gateDispose
  };
}

export const logic = {
  not: mkGate('not', '非门', 'NOT GATE', ['A'], lgNot, 'A 为低时输出高(反相)'),
  and: mkGate('and', '与门', 'AND GATE', ['A', 'B'], lgAnd, 'A、B 同时为高才输出高'),
  or: mkGate('or', '或门', 'OR GATE', ['A', 'B'], lgOr, 'A、B 任一为高即输出高'),
  xor: mkGate('xor', '异或门', 'XOR GATE', ['A', 'B'], lgXor, 'A、B 恰有一个为高才输出高'),

  cmp: {
    id: 'cmp', name: '比较器', en: 'COMPARATOR', cat: 'logic', w: 3, h: 6,
    desc: '比较器:IN 高于阈值旋钮(0~10V)输出高(+10V),否则低。把连续信号(LFO / 包络 / 音频峰值)整形成方栅栏或门限触发。',
    ports: [
      { id: 'IN', dir: 'in', name: 'IN', desc: '任意信号输入' },
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '高 = +10V,低 = 0V' }
    ],
    flow: { OUT: ['IN'] },
    state: () => ({ on: false, th: 2.5 }),
    build() {
      this._ins = ['IN'];
      this._fn = v => v;
      gateBuild.call(this);
    },
    tick() { setOut(this, this.volts('IN', 0) >= this.state.th); },
    ui() {
      // gateBuild 已建状态灯,这里只补阈值旋钮(放进同一容器)
      kit.knob(this, { parent: this._ui.led.parentNode, key: 'th', label: '阈值', min: 0, max: 10, value: this.state.th, unit: 'V' });
    },
    dispose: gateDispose
  },

  srl: {
    id: 'srl', name: 'SR锁存器', en: 'SR LATCH', cat: 'logic', w: 3, h: 5,
    desc: '置位 / 复位锁存:SET 上升沿输出变高并保持,RESET 上升沿变低并保持(同拍同时上升 RESET 优先)。最简单的记忆单元:一拍触发,长久保持。',
    ports: [
      { id: 'S', dir: 'in', name: 'S', desc: '置位:上升沿 → 输出高并保持' },
      { id: 'R', dir: 'in', name: 'R', desc: '复位:上升沿 → 输出低(优先)' },
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '高 = +10V,低 = 0V' }
    ],
    flow: { OUT: ['S', 'R'] },
    state: () => ({ on: false }),
    build() {
      this._ins = ['S'];
      this._fn = () => false;
      gateBuild.call(this);
      this.mon('R');
    },
    tick() {
      const s = this.edge('S') === 1, r = this.edge('R') === 1;
      setOut(this, srNext(this.state.on, s, r));
    },
    dispose: gateDispose
  },

  tff: {
    id: 'tff', name: '二分频器', en: 'T FLIP-FLOP', cat: 'logic', w: 3, h: 5,
    desc: 'T 触发器(时钟二分频):CLK 上升沿翻转输出并保持。方波时钟进来,频率减半出去;级联可得 ÷4 ÷8…,也可当 1 位节拍计数器。',
    ports: [
      { id: 'CLK', dir: 'in', name: 'CLK', desc: '时钟:上升沿翻转输出' },
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '高 = +10V,低 = 0V' }
    ],
    flow: { OUT: ['CLK'] },
    state: () => ({ on: false }),
    build() {
      this._ins = ['CLK'];
      this._fn = () => false;
      gateBuild.call(this);
    },
    tick() { setOut(this, tffNext(this.state.on, this.edge('CLK') === 1)); },
    dispose: gateDispose
  }
};
