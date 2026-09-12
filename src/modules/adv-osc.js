/* 高级振荡器:波表 / 物理建模 / 调谐噪声。
   · wt      波表振荡器:5 张内置波表连续形变(双振荡器交叉淡化),SYNC 硬同步
   · phys    物理建模:拨弦(延迟环)/ 管乐(噪声共振峰)/ 弓弦(共振锯齿)/ 鼓膜
   · noiseo  调谐噪声:白噪声经共振带通,中心频率 1V/oct 跟随音高,音色可调 */

import { clamp } from '../core/utils.js';
import { state } from '../core/state.js';
import { ctx, getCtx, noiseBuf } from '../core/audio.js';
import { kit } from '../kit/index.js';

/** 谐波幅度表 → PeriodicWave(基波 + 泛音,自动归一化) */
function makeWave(c0, amps) {
  const n = amps.length + 1;
  const real = new Float32Array(n), imag = new Float32Array(n);
  amps.forEach((a, i) => { imag[i + 1] = a; });
  return c0.createPeriodicWave(real, imag);
}

/* 波表组:每张表 = 谐波幅度数组(基波起) */
const WT_TABLES = [
  [1],                                              // 正弦
  [1, 0.55],                                        // 柔和
  [1, 0.6, 0.3, 0.55],                              // 管风琴
  [1, 0.2, 0.45, 0.1, 0.35, 0.05, 0.2],             // 簧片
  [1, 0.75, 0.55, 0.4, 0.3, 0.22, 0.15, 0.1]        // 尖亮
];
const WT_NAMES = ['正弦', '柔和', '管风琴', '簧片', '尖亮'];

export const advOsc = {

  wt: {
    id: 'wt', name: '波表振荡器', en: 'WAVETABLE', cat: 'source', w: 10, h: 6,
    desc: '波表振荡器:' + WT_TABLES.length + ' 张内置波表(' + WT_NAMES.join(' / ') + ')连续形变。POS 0~10V 扫描波表位置,双振荡器交叉淡化,支持 SYNC 相位硬同步。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '波表输出' },
      { id: 'VOCT', dir: 'in', name: 'V/OCT', desc: '音高 1V/oct(默认 0V = C4)' },
      { id: 'POS', dir: 'in', name: 'POS', desc: '波表位置 0~10V(未接线用面板旋钮)' },
      { id: 'SYNC', dir: 'in', name: 'SYNC', desc: '时钟同步:上升沿把波形相位归零' }
    ],
    state: () => ({ v: 5 }),
    build() {
      this.oscs = []; this._spawn = [];
      this._pw = WT_TABLES.map(t => makeWave(getCtx(), t));
      const p = ctx.createGain(); p.gain.value = 1200; this.ins.VOCT.connect(p);
      const gA = this._gA = ctx.createGain(); const gB = this._gB = ctx.createGain();
      gA.connect(this.outs.OUT); gB.connect(this.outs.OUT);
      this._iA = 0; this._iB = Math.min(1, WT_TABLES.length - 1); this._lastFrac = -1;
      this._spawn.push(() => {
        const o = ctx.createOscillator();
        o.setPeriodicWave(this._pw[this._iA]);
        p.connect(o.detune); o.connect(gA); o.start();
        this.oscs.push(o); this._oA = o;
      });
      this._spawn.push(() => {
        const o = ctx.createOscillator();
        o.setPeriodicWave(this._pw[this._iB]);
        p.connect(o.detune); o.connect(gB); o.start();
        this.oscs.push(o); this._oB = o;
      });
      this._spawn.forEach(sp => sp());
      this.mon('SYNC'); this.mon('POS');
      this.setPos(this.state.v ?? 5);
      kit.hint('POS: 波表位置', this);
    },
    setPos(p) {
      p = clamp(p, 0, 10);
      this.state.v = p;
      const f = p / 10 * (WT_TABLES.length - 1);
      const iA = Math.min(Math.floor(f), WT_TABLES.length - 2);
      const iB = Math.min(iA + 1, WT_TABLES.length - 1);
      const frac = f - iA;
      if (iA !== this._iA || iB !== this._iB) {
        this._oA.setPeriodicWave(this._pw[iA]);
        this._oB.setPeriodicWave(this._pw[iB]);
        this._iA = iA; this._iB = iB;
      }
      if (Math.abs(frac - this._lastFrac) > 0.01) {   // 变化才更新,避免刷爆参数时间线
        this._lastFrac = frac;
        this._gA.gain.setTargetAtTime(1 - frac, ctx.currentTime, 0.01);
        this._gB.gain.setTargetAtTime(frac, ctx.currentTime, 0.01);
      }
    },
    tick() {
      if (this.edge('SYNC') === 1) this.restartPhase();   // 硬同步:相位归零
      this.setPos(this.volts('POS', this.state.v));
    },
    dispose() { this.oscs.forEach(o => { try { o.stop(); } catch (e) {} }); }
  },

  /* 物理建模:四种乐器的简易模型
     拨弦 = 噪声激励 → 弦延迟环(卡尔普斯-斯特朗);管乐 = 噪声 → 共振峰带通;
     弓弦 = 锯齿 → 高Q共振;鼓膜 = 音高衰减正弦 + 噪声敲击 */
  phys: {
    id: 'phys', name: '物理建模', en: 'PHYS MODEL', cat: 'source', w: 10, h: 6,
    desc: '简易物理建模音源,四种乐器:拨弦(弦振延迟环)/ 管乐(噪声+共振峰)/ 弓弦(锯齿+共振)/ 鼓膜(音高衰减)。TRIG 上升沿激发,管乐 / 弓弦高电平持续;VOCT 定音高,DAMP 控阻尼。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '建模乐器输出' },
      { id: 'TRIG', dir: 'in', name: 'TRIG', desc: '触发 / 门:上升沿激发(拨弦、鼓膜);高电平持续(管乐、弓弦)' },
      { id: 'VOCT', dir: 'in', name: 'V/OCT', desc: '音高 1V/oct(默认 0V = C4)' },
      { id: 'DAMP', dir: 'in', name: 'DAMP', desc: '阻尼 0~10V:越高衰减越快、音色越暗(默认 5)' }
    ],
    state: () => ({ voice: 0, damp: 5 }),
    build() {
      const c0 = getCtx();
      this.outA = c0.createGain(); this.outA.gain.value = 0.9;
      this.outA.connect(this.outs.OUT);
      this.mon('TRIG'); this.mon('VOCT'); this.mon('DAMP');
      this._nodes = []; this._onRise = null; this._onFall = null;
      this._pitch = null; this._tone = null;
      this._builtModel = -1;
      this.rebuild();
    },
    /** 按音色重建内部结构(换音色时清理旧节点) */
    rebuild() {
      const model = Math.round(clamp(this.state.voice ?? 0, 0, 3));
      if (this._builtModel === model && this._nodes && this._nodes.length) return;
      for (const n of (this._nodes || [])) {
        try { if (n.stop) n.stop(); } catch (e) {}
        try { n.disconnect(); } catch (e) {}
      }
      this._nodes = [];
      this._onRise = null; this._onFall = null; this._pitch = null; this._tone = null;
      const c0 = getCtx();
      const keep = n => { this._nodes.push(n); return n; };
      this._builtModel = model;

      if (model === 0) {
        // 拨弦:噪声激励 → 弦延迟环(延迟时间 = 1/音高,阻尼控衰减与亮度)
        const tap = c0.createGain(); tap.gain.value = 0.6; tap.connect(this.outA);
        const dly = c0.createDelay(0.05); dly.delayTime.value = 1 / 261.6;
        const lp = c0.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5500;
        const fb = c0.createGain(); fb.gain.value = 0.93;
        dly.connect(lp); lp.connect(fb); fb.connect(dly);
        dly.connect(tap);
        keep(tap); keep(dly); keep(lp); keep(fb);
        this._pitch = f => { try { dly.delayTime.setTargetAtTime(clamp(1 / f, 0.0005, 0.05), c0.currentTime, 0.003); } catch (e) {} };
        this._tone = d2 => {
          try {
            lp.frequency.setTargetAtTime(clamp(9000 - d2 * 700, 500, 9000), c0.currentTime, 0.02);
            fb.gain.setTargetAtTime(clamp(0.985 - d2 * 0.012, 0.5, 0.985), c0.currentTime, 0.02);
          } catch (e) {}
        };
        this._onRise = () => {
          const src = c0.createBufferSource(); src.buffer = noiseBuf();
          const g = c0.createGain();
          g.gain.setValueAtTime(0.9, c0.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, c0.currentTime + 0.01);
          src.connect(g); g.connect(dly);
          src.start(); src.stop(c0.currentTime + 0.03);
        };
      } else if (model === 1) {
        // 管乐:循环噪声 → 共振峰带通,门控持续
        const gW = c0.createGain(); gW.gain.value = 0; gW.connect(this.outA);
        const bp = c0.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 3;
        const nz = c0.createBufferSource(); nz.buffer = noiseBuf(); nz.loop = true;
        nz.connect(bp); bp.connect(gW); nz.start();
        keep(nz); keep(bp); keep(gW);
        this._pitch = f => { try { bp.frequency.setTargetAtTime(clamp(f * 2, 30, 12000), c0.currentTime, 0.02); } catch (e) {} };
        this._tone = d2 => { try { bp.Q.setTargetAtTime(clamp(6 - d2 * 0.4, 1, 6), c0.currentTime, 0.02); } catch (e) {} };
        this._onRise = () => { gW.gain.setTargetAtTime(0.5, c0.currentTime, 0.03); };
        this._onFall = () => { gW.gain.setTargetAtTime(0, c0.currentTime, 0.05); };
      } else if (model === 2) {
        // 弓弦:锯齿 → 高Q共振带通,门控持续
        const gB = c0.createGain(); gB.gain.value = 0; gB.connect(this.outA);
        const osc = c0.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 261.6;
        const bp = c0.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 8;
        osc.connect(bp); bp.connect(gB); osc.start();
        keep(osc); keep(bp); keep(gB);
        this._pitch = f => {
          try {
            osc.frequency.setTargetAtTime(f, c0.currentTime, 0.01);
            bp.frequency.setTargetAtTime(clamp(f * 2, 30, 12000), c0.currentTime, 0.01);
          } catch (e) {}
        };
        this._tone = d2 => { try { bp.Q.setTargetAtTime(clamp(12 - d2, 2, 12), c0.currentTime, 0.02); } catch (e) {} };
        this._onRise = () => { gB.gain.setTargetAtTime(0.8, c0.currentTime, 0.02); };
        this._onFall = () => { gB.gain.setTargetAtTime(0, c0.currentTime, 0.06); };
      } else {
        // 鼓膜:音高衰减正弦 + 噪声敲击(上升沿一次性激发)
        this._onRise = () => {
          const t = c0.currentTime;
          const tune = Math.pow(2, clamp(this.volts('VOCT', 0), -4, 4));
          const o = c0.createOscillator(); o.type = 'sine';
          o.frequency.setValueAtTime(Math.max(30, 160 * tune), t);
          o.frequency.exponentialRampToValueAtTime(Math.max(30, 55 * tune), t + 0.3);
          const g = c0.createGain();
          g.gain.setValueAtTime(0.9, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
          o.connect(g); g.connect(this.outA);
          o.start(t); o.stop(t + 0.5);
          const nz = c0.createBufferSource(); nz.buffer = noiseBuf();
          const hp = c0.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 900;
          const ng = c0.createGain();
          ng.gain.setValueAtTime(0.4, t);
          ng.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
          nz.connect(hp); hp.connect(ng); ng.connect(this.outA);
          nz.start(t); nz.stop(t + 0.1);
        };
      }
    },
    tick() {
      const e = this.edge('TRIG');
      if (e === 1 && this._onRise) this._onRise();
      if (e === -1 && this._onFall) this._onFall();
      // 音高 / 阻尼变化时才更新(避免刷爆音频参数时间线)
      const f = 261.6256 * Math.pow(2, clamp(this.volts('VOCT', 0), -4, 4));
      const d = clamp(this.volts('DAMP', 5), 0, 10);
      if (this._pitch && (this._lastF === undefined || Math.abs(f - this._lastF) > 0.01)) { this._lastF = f; this._pitch(f); }
      if (this._tone && (this._lastD === undefined || d !== this._lastD)) { this._lastD = d; this._tone(d); }
    },
    dispose() {
      for (const n of (this._nodes || [])) {
        try { if (n.stop) n.stop(); } catch (e) {}
        try { n.disconnect(); } catch (e) {}
      }
    }
  },

  /* 噪声振荡器:白噪声经共振带通,中心频率 1V/oct 跟随音高,音色可调 */
  noiseo: {
    id: 'noiseo', name: '噪声振荡器', en: 'NOISE OSC', cat: 'source', w: 8, h: 6,
    desc: '调谐噪声源:白噪声经共振带通,中心频率按 1V/oct 跟随音高。COLOR 开越大越亮越尖,可做风声、镲片、科幻音效。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '噪声输出' },
      { id: 'VOCT', dir: 'in', name: 'V/OCT', desc: '中心频率 1V/oct(默认 0V = C4)' },
      { id: 'COLOR', dir: 'in', name: 'COLOR', desc: '音色 0~10V:中心频率倍率与带宽(默认 5)' }
    ],
    state: () => ({ color: 5 }),
    build() {
      this.nz = ctx.createBufferSource(); this.nz.buffer = noiseBuf(); this.nz.loop = true;
      this.bp = ctx.createBiquadFilter(); this.bp.type = 'bandpass';
      this.bp.frequency.value = 261.6; this.bp.Q.value = 3.5;
      const g = ctx.createGain(); g.gain.value = 2.5;
      this.nz.connect(this.bp); this.bp.connect(g); g.connect(this.outs.OUT);
      this.nz.start();
      this.mon('VOCT'); this.mon('COLOR');
      this._f = -1; this._lastQ = -1;
    },
    tick() {
      const f = clamp(261.6256 * Math.pow(2, this.volts('VOCT', 0)), 20, 18000);
      const v = clamp(this.volts('COLOR', 5), 0, 10);
      const t = ctx.currentTime;
      if (this._f === -1 || Math.abs(f - this._f) > 0.5) {   // 变化才更新参数时间线
        this._f = f;
        this.bp.frequency.setTargetAtTime(clamp(f * (0.5 + v * 0.45), 20, 18000), t, 0.02);
      }
      const q = clamp(8 - v * 0.6, 1.5, 8);
      if (this._lastQ === -1 || Math.abs(q - this._lastQ) > 0.05) {
        this._lastQ = q;
        this.bp.Q.setTargetAtTime(q, t, 0.02);
      }
    },
    dispose() { try { this.nz.stop(); } catch (e) {} }
  }
};
