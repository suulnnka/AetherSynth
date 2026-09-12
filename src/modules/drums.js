/* 鼓机组:TRIG 口的电压变化触发打击,电压大小 = 力度(0 = 休止)。
   典型喂法:音序器 CV → TRIG。 */

import { clamp } from '../core/utils.js';
import { ctx, noiseBuf } from '../core/audio.js';

export const drums = {
  kick: {
    id: 'kick', name: '底鼓', en: 'KICK', cat: 'source', w: 6, h: 5,
    desc: '合成底鼓:TRIG 电压跳变触发,电压大小 = 力度,带音高峰值下落。TUNE 移调(10V = +1 倍频程)。喂法:音序器 CV → TRIG。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '鼓声输出' },
      { id: 'TRIG', dir: 'in', name: 'TRIG', desc: '触发 + 力度(电压 >0.2V 触发,10V = 最响)' },
      { id: 'TUNE', dir: 'in', name: 'TUNE', desc: '音高:10V = +1 倍频程' }
    ],
    build() {
      this.outA = ctx.createGain(); this.outA.connect(this.outs.OUT);
      this.mon('TRIG'); this.mon('TUNE'); this._prev = 0;
    },
    tick() {
      const v = this.volts('TRIG', 0);
      if (v > 0.2 && Math.abs(v - this._prev) > 0.05) {
        const t = ctx.currentTime, vel = clamp(v / 10, 0, 1);
        const tune = Math.pow(2, this.volts('TUNE', 0) / 10);
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(165 * tune, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(28, 46 * tune), t + 0.11);
        const g = ctx.createGain();
        g.gain.setValueAtTime(vel * 1.7, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
        o.connect(g); g.connect(this.outA);
        o.start(t); o.stop(t + 0.45);
      }
      this._prev = v;
    }
  },

  snare: {
    id: 'snare', name: '军鼓', en: 'SNARE', cat: 'source', w: 6, h: 5,
    desc: '合成军鼓:噪声 + 鼓身音。TRIG 电压跳变触发,电压大小 = 力度。喂法:音序器 CV → TRIG。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '鼓声输出' },
      { id: 'TRIG', dir: 'in', name: 'TRIG', desc: '触发 + 力度(电压 >0.2V 触发,10V = 最响)' },
      { id: 'TUNE', dir: 'in', name: 'TUNE', desc: '鼓身音高:10V = +1 倍频程' }
    ],
    build() {
      this.outA = ctx.createGain(); this.outA.connect(this.outs.OUT);
      this.mon('TRIG'); this.mon('TUNE'); this._prev = 0;
    },
    tick() {
      const v = this.volts('TRIG', 0);
      if (v > 0.2 && Math.abs(v - this._prev) > 0.05) {
        const t = ctx.currentTime, vel = clamp(v / 10, 0, 1);
        const tune = Math.pow(2, this.volts('TUNE', 0) / 10);
        const nz = ctx.createBufferSource(); nz.buffer = noiseBuf();
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900 * tune; bp.Q.value = 0.9;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(vel * 1.15, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
        nz.connect(bp); bp.connect(ng); ng.connect(this.outA);
        nz.start(t); nz.stop(t + 0.2);
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 190 * tune;
        const og = ctx.createGain();
        og.gain.setValueAtTime(vel * 0.6, t);
        og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.connect(og); og.connect(this.outA);
        o.start(t); o.stop(t + 0.12);
      }
      this._prev = v;
    }
  },

  hat: {
    id: 'hat', name: '踩镲', en: 'HI-HAT', cat: 'source', w: 6, h: 5,
    desc: '合成踩镲:高通金属噪声。TRIG 电压跳变触发,电压大小 = 力度。喂法:音序器 CV → TRIG。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '鼓声输出' },
      { id: 'TRIG', dir: 'in', name: 'TRIG', desc: '触发 + 力度(电压 >0.2V 触发,10V = 最响)' }
    ],
    build() {
      this.outA = ctx.createGain(); this.outA.connect(this.outs.OUT);
      this.mon('TRIG'); this._prev = 0;
    },
    tick() {
      const v = this.volts('TRIG', 0);
      if (v > 0.2 && Math.abs(v - this._prev) > 0.05) {
        const t = ctx.currentTime, vel = clamp(v / 10, 0, 1);
        const nz = ctx.createBufferSource(); nz.buffer = noiseBuf();
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7200;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vel * 0.75, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
        nz.connect(hp); hp.connect(g); g.connect(this.outA);
        nz.start(t); nz.stop(t + 0.08);
      }
      this._prev = v;
    }
  }
};
