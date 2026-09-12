/* 音频引擎:AudioContext 单例(可整体重建以切换采样率)、手势解锁、
   电平监视器 Mon、共享噪声缓冲。
   注意:ctx 用 `export let` 导出 —— ES Module 活绑定,引擎重建后
   所有 `import { ctx }` 的模块自动看到新实例。 */

const AC = typeof window !== 'undefined'
  ? (window.AudioContext || window.webkitAudioContext)
  : null;

export const RATE_DEFAULT = 96000;

export const audio = {
  sampleRate: RATE_DEFAULT,
  noiseBuf: null,
  gestured: false
};

export let ctx = null;

export function makeCtx(rate) {
  if (!AC) throw new Error('AudioContext 不可用(非浏览器环境)');
  try { return new AC({ sampleRate: rate }); }
  catch (e) { return new AC(); }
}

/** 惰性获取引擎:首次调用时创建(Node 单测只 import 不调用,不会触屏) */
export function getCtx() {
  if (!ctx) ctx = makeCtx(audio.sampleRate);
  return ctx;
}

/** 引擎整体重建(采样率切换):旧实例由调用方负责 close */
export function replaceCtx(rate) {
  audio.sampleRate = rate;
  ctx = makeCtx(rate);
  audio.noiseBuf = null;
  return ctx;
}

/** 首次用户手势:解锁音频(浏览器自动播放策略) */
export function firstGesture() {
  if (audio.gestured) return;
  audio.gestured = true;
  try { getCtx().resume(); } catch (e) {}
}

/** 共享白噪声缓冲(军鼓 / 踩镲等用) */
export function noiseBuf() {
  const c = getCtx();
  if (!audio.noiseBuf) {
    audio.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = audio.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return audio.noiseBuf;
}

/** 输出口/输入口电平监视:tick 循环里 read(),v = 最新采样值 */
export class Mon {
  constructor(node, size) {
    const c = getCtx();
    this.an = c.createAnalyser();
    this.an.fftSize = size || 256;
    this.buf = new Float32Array(this.an.fftSize);
    this.v = 0;
    node.connect(this.an);
  }
  read() {
    this.an.getFloatTimeDomainData(this.buf);
    this.v = this.buf[this.buf.length - 1];
    return this.v;
  }
}
