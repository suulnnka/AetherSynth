/* 控制类组件:旋钮 / 推子 / 触控板 / 开关等独立参数组件。
   本体无控件(工坊自制组件除外),旋钮本身就是组件,输出 0~+10V。 */

import { ctx } from '../core/audio.js';
import { kit } from '../kit/index.js';

/* 独立 CV 源的通用 build:一路恒压源 → CV 输出口 */
function cvSource() {
  this.cs = ctx.createConstantSource();
  this.cs.offset.value = this.state.v;
  this.cs.connect(this.outs.CV);
  this.cs.start();
}
function cvDispose() { try { this.cs.stop(); } catch (e) {} }

export const controls = {
  knob: {
    id: 'knob', name: '旋钮', en: 'KNOB', cat: 'control', w: 2, h: 5,
    desc: '独立的参数组件:输出 0~+10V。上下拖动调节,Shift 微调,双击复位到 5V,滚轮微调。',
    ports: [{ id: 'CV', dir: 'out', name: 'CV', desc: '0 ~ +10V 控制电压' }],
    state: () => ({ v: 5 }),
    build: cvSource,
    ui() { kit.knob(this); },
    dispose: cvDispose
  },

  bigknob: {
    id: 'bigknob', name: '大旋钮', en: 'BIG KNOB', cat: 'control', w: 4, h: 5,
    desc: '大尺寸旋钮:行程分辨率比小旋钮更高,适合精细调谐。输出 0~+10V。',
    ports: [{ id: 'CV', dir: 'out', name: 'CV', desc: '0 ~ +10V 控制电压' }],
    state: () => ({ v: 5 }),
    build: cvSource,
    ui() { kit.knobBig(this); },
    dispose: cvDispose
  },

  fader: {
    id: 'fader', name: '推子', en: 'FADER', cat: 'control', w: 2, h: 6,
    desc: '竖向推子:点击轨道跳转 / 上下拖动 / 滚轮微调 / 双击回中。输出 0~+10V。',
    ports: [{ id: 'CV', dir: 'out', name: 'CV', desc: '0 ~ +10V 控制电压' }],
    state: () => ({ v: 5 }),
    build: cvSource,
    ui() { kit.faderV(this); },
    dispose: cvDispose
  },

  hfader: {
    id: 'hfader', name: '横推子', en: 'H-FADER', cat: 'control', w: 8, h: 4,
    desc: '横向推子:宽扁外形,适合当混音台电平 / 交叉推子。输出 0~+10V。',
    ports: [{ id: 'CV', dir: 'out', name: 'CV', desc: '0 ~ +10V 控制电压' }],
    state: () => ({ v: 5 }),
    build: cvSource,
    ui() { kit.faderH(this); },
    dispose: cvDispose
  },

  touch: {
    id: 'touch', name: '触控板', en: 'TOUCHPAD', cat: 'control', w: 8, h: 8,
    desc: 'XY 触控板:一次拖动同时输出两路电压(X 水平 / Y 垂直),双击回中。适合同时扫滤波与指数。',
    ports: [
      { id: 'X', dir: 'out', name: 'X', desc: '水平轴 0~+10V' },
      { id: 'Y', dir: 'out', name: 'Y', desc: '垂直轴 0~+10V' }
    ],
    state: () => ({ x: 5, y: 5 }),
    build() {
      this.csX = ctx.createConstantSource(); this.csY = ctx.createConstantSource();
      this.csX.offset.value = this.state.x; this.csY.offset.value = this.state.y;
      this.csX.connect(this.outs.X); this.csY.connect(this.outs.Y);
      this.csX.start(); this.csY.start();
    },
    ui() { kit.pad(this); },
    dispose() { try { this.csX.stop(); this.csY.stop(); } catch (e) {} }
  },

  biknob: {
    id: 'biknob', name: '双极旋钮', en: 'BI-KNOB', cat: 'control', w: 2, h: 5,
    desc: '双极电压源:-5V ~ +5V。典型用法:接到 V/OCT 当八度偏移(-2V = 低两个八度),或做 DC 偏置。',
    ports: [{ id: 'CV', dir: 'out', name: 'CV', desc: '-5 ~ +5V 控制电压' }],
    state: () => ({ v: 0 }),
    build() {
      this.cs = ctx.createConstantSource();
      this.cs.offset.value = this.state.v;
      this.cs.connect(this.outs.CV);
      this.cs.start();
    },
    ui() { kit.knob(this, { min: -5, max: 5 }); },
    dispose: cvDispose
  },

  step6: {
    id: 'step6', name: '六段旋钮', en: 'STEP · 6', cat: 'control', w: 2, h: 5, cvAll: true,
    desc: '步进旋钮:0~5V,每 1V 一段共 6 档(0/1/2/3/4/5V)。拖动自动吸附档位,滚轮换档。',
    ports: [{ id: 'CV', dir: 'out', name: 'CV', desc: '六档:0 / 1 / 2 / 3 / 4 / 5V' }],
    state: () => ({ v: 0 }),
    build: cvSource,
    ui() { kit.knob(this, { steps: [0, 1, 2, 3, 4, 5] }); },
    dispose: cvDispose
  },

  step10: {
    id: 'step10', name: '十段旋钮', en: 'STEP · 10', cat: 'control', w: 2, h: 5, cvAll: true,
    desc: '步进旋钮:0~10V,每 1V 一段共 10 档。拖动自动吸附档位,滚轮换档。',
    ports: [{ id: 'CV', dir: 'out', name: 'CV', desc: '十档:0 ~ 10V 每 1V 一档' }],
    state: () => ({ v: 0 }),
    build: cvSource,
    ui() { kit.knob(this, { steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }); },
    dispose: cvDispose
  },

  step4: {
    id: 'step4', name: '四段旋钮', en: 'STEP · 4', cat: 'control', w: 2, h: 5, cvAll: true,
    desc: '四档旋钮:0 / 2.5 / 5 / 7.5V——正好对应选择器 SELECT ×4 的四档,是它的配套输入设备。',
    ports: [{ id: 'CV', dir: 'out', name: 'CV', desc: '四档:0 / 2.5 / 5 / 7.5V' }],
    state: () => ({ v: 0 }),
    build: cvSource,
    ui() { kit.knob(this, { steps: [0, 2.5, 5, 7.5] }); },
    dispose: cvDispose
  },

  chrom: {
    id: 'chrom', name: '半音旋钮', en: 'CHROM · 12', cat: 'control', w: 2, h: 5, cvAll: true,
    desc: '半音旋钮:0~1V,每半音(1/12V)一档,13 个位置(C4~C5)。接振荡器 V/OCT 直接选音高,屏幕显示音名。',
    ports: [{ id: 'CV', dir: 'out', name: 'CV', desc: '半音电压:0 ~ 1V,每档 1/12V' }],
    state: () => ({ v: 0 }),
    build: cvSource,
    ui() { kit.knob(this, { min: 0, max: 1, steps: Array.from({ length: 13 }, (_, i) => i / 12), note: true }); },
    dispose: cvDispose
  },

  switch: {
    id: 'switch', name: '开关', en: 'SWITCH', cat: 'control', w: 2, h: 5,
    desc: '独立的门限组件:点击切换,开 = +10V,关 = 0V。',
    ports: [{ id: 'GATE', dir: 'out', name: 'GATE', desc: '+10V(开)/ 0V(关)' }],
    state: () => ({ on: false }),
    build() {
      this.cs = ctx.createConstantSource();
      this.cs.offset.value = this.state.on ? 10 : 0;
      this.cs.connect(this.outs.GATE);
      this.cs.start();
    },
    ui() { kit.sw(this); },
    dispose() { try { this.cs.stop(); } catch (e) {} }
  }
};
