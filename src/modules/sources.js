/* 信号源组件:振荡器 / FM / 低频振荡 / 噪声 / 麦克风
   vco / fm / lfo 均支持 SYNC 时钟同步(上升沿相位归零);
   vco 的 PUL 与 lfo 的 SQR 空占比(占空比)可调。 */

import { clamp } from '../core/utils.js';
import { ctx } from '../core/audio.js';
import { kit } from '../kit/index.js';

export const sources = {
  vco: {
    id: 'vco', name: '振荡器', en: 'VCO', cat: 'source', w: 10, h: 6,
    desc: '压控振荡器,五种波形同时输出,相位可由 SYNC 时钟硬同步。0V = C4(261.6Hz),1V/oct;FM 为线性调频(10V ≈ ±40Hz);PUL 脉冲波空占比由 DUTY 控制。',
    ports: [
      { id: 'SIN', dir: 'out', name: 'SIN', desc: '正弦波' },
      { id: 'TRI', dir: 'out', name: 'TRI', desc: '三角波' },
      { id: 'SAW', dir: 'out', name: 'SAW', desc: '锯齿波' },
      { id: 'SQR', dir: 'out', name: 'SQR', desc: '方波(50% 空占比)' },
      { id: 'PUL', dir: 'out', name: 'PUL', desc: '脉冲波(空占比 5%~95% 可调)' },
      { id: 'VOCT', dir: 'in', name: 'V/OCT', desc: '音高 1V/oct(默认 0V = C4)' },
      { id: 'FM', dir: 'in', name: 'FM', desc: '线性调频 ±40Hz @10V' },
      { id: 'DUTY', dir: 'in', name: 'DUTY', desc: 'PUL 空占比 0~10V → 5%~95%(默认 50%)' },
      { id: 'SYNC', dir: 'in', name: 'SYNC', desc: '时钟同步:上升沿把波形相位归零(硬同步)' }
    ],
    build() {
      this.oscs = []; this._spawn = [];
      const p = ctx.createGain(); p.gain.value = 1200; this.ins.VOCT.connect(p);
      const f = ctx.createGain(); f.gain.value = 40; this.ins.FM.connect(f);
      const mk = (type, out) => this._spawn.push(() => {
        const o = ctx.createOscillator();
        o.type = type; o.frequency.value = 261.6256;
        p.connect(o.detune); f.connect(o.frequency);
        o.connect(this.outs[out]); o.start();
        this.oscs.push(o);
      });
      for (const [type, out] of [['sine', 'SIN'], ['triangle', 'TRI'], ['sawtooth', 'SAW'], ['square', 'SQR']]) mk(type, out);
      // 脉冲波:锯齿波经比较器(波形成形)得到,阈值即空占比,支持 CV 调制
      this.pws = ctx.createWaveShaper();
      this._spawn.push(() => {
        const saw = ctx.createOscillator();
        saw.type = 'sawtooth'; saw.frequency.value = 261.6256;
        p.connect(saw.detune); f.connect(saw.frequency);
        saw.connect(this.pws); this.pws.connect(this.outs.PUL);
        saw.start();
        this.oscs.push(saw);
      });
      this._spawn.forEach(sp => sp());
      this.mon('SYNC'); this.mon('DUTY');
      this._duty = -1;
      this.setDuty(50);
      kit.hint('0V = C4 · 1V/OCT · PUL 空占比可调', this);
    },
    /** 空占比:锯齿阈值整形,d 变化超过 1% 才重建曲线 */
    setDuty(d) {
      d = clamp(Math.round(d), 5, 95);
      if (d === this._duty) return;
      this._duty = d;
      this.state.duty = d;
      const k = 2 * d / 100 - 1;                        // 高电平占比 = (k+1)/2
      const N = 2048, curve = new Float32Array(N);
      for (let i = 0; i < N; i++) curve[i] = ((i / (N - 1)) * 2 - 1) < k ? 1 : -1;
      this.pws.curve = curve;
    },
    tick() {
      if (this.edge('SYNC') === 1) this.restartPhase(); // 硬同步:相位归零
      this.setDuty(this.volts('DUTY', 50));
    },
    dispose() { this.oscs.forEach(o => { try { o.stop(); } catch (e) {} }); }
  },

  fm: {
    id: 'fm', name: 'FM振荡器', en: 'FM PAIR 2-OP', cat: 'source', w: 8, h: 6,
    desc: '双算子 FM:正弦调制器以 RATIO 频率比对载波调频,相位可由 SYNC 硬同步。INDEX 越大音色越亮越金属;把包络 / 另一振荡器接进 INDEX 可做铜管、钟声、泛音扫描。M.OUT 可级联出第三算子。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '载波输出(已调频)' },
      { id: 'M', dir: 'out', name: 'M.OUT', desc: '调制器正弦输出(可接到别的 FM 模块级联)' },
      { id: 'VOCT', dir: 'in', name: 'V/OCT', desc: '音高 1V/oct,载波与调制器同步(0V = C4)' },
      { id: 'RATIO', dir: 'in', name: 'RATIO', desc: '调制比:1V = ×2(0V = 1:1;负电压降比例)' },
      { id: 'INDEX', dir: 'in', name: 'INDEX', desc: '调制指数 0~10V → 频偏 0~1200Hz(未接 = 0,纯正弦)' },
      { id: 'SYNC', dir: 'in', name: 'SYNC', desc: '时钟同步:上升沿把载波与调制器相位同时归零' }
    ],
    build() {
      this.oscs = []; this._spawn = [];
      const p = ctx.createGain(); p.gain.value = 1200; this.ins.VOCT.connect(p);
      const r = ctx.createGain(); r.gain.value = 1200; this.ins.RATIO.connect(r);
      const ix = ctx.createGain(); ix.gain.value = 120; this.ins.INDEX.connect(ix);
      this._spawn.push(() => {                            // 载波
        const car = ctx.createOscillator(); car.type = 'sine';
        car.frequency.value = 261.6256;
        p.connect(car.detune); ix.connect(car.frequency);
        car.connect(this.outs.OUT); car.start();
        this.car = car; this.oscs.push(car);
      });
      this._spawn.push(() => {                            // 调制器
        const mod = ctx.createOscillator(); mod.type = 'sine';
        mod.frequency.value = 261.6256;
        p.connect(mod.detune); r.connect(mod.detune);
        mod.connect(this.outs.M); mod.start();
        this.mod = mod; this.oscs.push(mod);
      });
      this._spawn.forEach(sp => sp());
      this.mon('SYNC');
      kit.hint('RATIO 1V=×2 · INDEX 10V=1200Hz', this);
    },
    tick() {
      if (this.edge('SYNC') === 1) this.restartPhase();   // 载波 + 调制器同时归零
    },
    dispose() { try { this.car.stop(); this.mod.stop(); } catch (e) {} }
  },

  lfo: {
    id: 'lfo', name: '低频振荡', en: 'LFO', cat: 'source', w: 10, h: 6,
    desc: '低频振荡器,相位可由 SYNC 时钟硬同步。RATE:1V = +1Hz(未接线时 2Hz);SQR 为脉冲波,空占比由 DUTY 控制,可当节奏门控时钟。',
    ports: [
      { id: 'SIN', dir: 'out', name: 'SIN', desc: '正弦 ±1' },
      { id: 'TRI', dir: 'out', name: 'TRI', desc: '三角 ±1' },
      { id: 'SQR', dir: 'out', name: 'SQR', desc: '脉冲 ±1(空占比 5%~95% 可调,可当时钟)' },
      { id: 'SAW', dir: 'out', name: 'SAW', desc: '锯齿 ±1' },
      { id: 'RATE', dir: 'in', name: 'RATE', desc: '频率:1V = +1Hz(默认 2Hz)' },
      { id: 'DUTY', dir: 'in', name: 'DUTY', desc: 'SQR 空占比 0~10V → 5%~95%(默认 50%)' },
      { id: 'SYNC', dir: 'in', name: 'SYNC', desc: '时钟同步:上升沿把波形相位归零' }
    ],
    build() {
      this.oscs = []; this._spawn = [];
      const r = ctx.createGain(); r.gain.value = 1; this.ins.RATE.connect(r);
      const mk = (type, out) => this._spawn.push(() => {
        const o = ctx.createOscillator();
        o.type = type; o.frequency.value = 2;
        r.connect(o.frequency);
        this.addBase('RATE', o.frequency, 2, 0.05);
        o.connect(this.outs[out]); o.start();
        this.oscs.push(o);
      });
      for (const [type, out] of [['sine', 'SIN'], ['triangle', 'TRI'], ['sawtooth', 'SAW']]) mk(type, out);
      // SQR:锯齿经比较器整形为脉冲,空占比可调
      this.pws = ctx.createWaveShaper();
      this._spawn.push(() => {
        const saw = ctx.createOscillator();
        saw.type = 'sawtooth'; saw.frequency.value = 2;
        r.connect(saw.frequency);
        this.addBase('RATE', saw.frequency, 2, 0.05);
        saw.connect(this.pws); this.pws.connect(this.outs.SQR);
        saw.start();
        this.oscs.push(saw);
      });
      this._spawn.forEach(sp => sp());
      this.mon('SYNC'); this.mon('DUTY');
      this._duty = -1;
      this.setDuty(50);
      kit.hint('RATE: 1V = +1Hz · SQR 空占比可调', this);
    },
    setDuty(d) {
      d = clamp(Math.round(d), 5, 95);
      if (d === this._duty) return;
      this._duty = d;
      this.state.duty = d;
      const k = 2 * d / 100 - 1;
      const N = 2048, curve = new Float32Array(N);
      for (let i = 0; i < N; i++) curve[i] = ((i / (N - 1)) * 2 - 1) < k ? 1 : -1;
      this.pws.curve = curve;
    },
    tick() {
      if (this.edge('SYNC') === 1) this.restartPhase();   // 硬同步:相位归零
      this.setDuty(this.volts('DUTY', 50));
    },
    dispose() { this.oscs.forEach(o => { try { o.stop(); } catch (e) {} }); }
  },

  noise: {
    id: 'noise', name: '噪声', en: 'NOISE', cat: 'source', w: 4, h: 4,
    desc: '白噪声与粉噪声发生器。',
    ports: [
      { id: 'WHITE', dir: 'out', name: 'WHITE', desc: '白噪声' },
      { id: 'PINK', dir: 'out', name: 'PINK', desc: '粉噪声(低通近似)' }
    ],
    build() {
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.src = ctx.createBufferSource();
      this.src.buffer = buf; this.src.loop = true;
      this.src.connect(this.outs.WHITE);
      const f1 = ctx.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.value = 400; f1.Q.value = 0.4;
      const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 130; f2.Q.value = 0.4;
      const g = ctx.createGain(); g.gain.value = 2.4;
      this.src.connect(f1); f1.connect(f2); f2.connect(g); g.connect(this.outs.PINK);
      this.src.start();
    },
    dispose() { try { this.src.stop(); } catch (e) {} }
  },

  mic: {
    id: 'mic', name: '麦克风', en: 'MIC', cat: 'source', w: 4, h: 5,
    desc: '电脑麦克风。组件放入画布时请求系统授权,声音从 OUT 口输出。',
    ports: [{ id: 'OUT', dir: 'out', name: 'OUT', desc: '麦克风信号' }],
    state: () => ({ st: 'wait' }),
    build() {
      kit.screen(this, 'scr');
      const self = this;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.state.st = 'no'; return;
      }
      navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      }).then(stream => {
        self.stream = stream;
        self.srcNode = ctx.createMediaStreamSource(stream);
        self.srcNode.connect(self.outs.OUT);
        self.state.st = 'ok';
      }).catch(() => { self.state.st = 'deny'; });
    },
    tick() {
      const s = this.scr; if (!s) return;
      const { c, w: W, h: H } = s;
      c.fillStyle = '#0b0d10'; c.fillRect(0, 0, W, H);
      c.font = '10px monospace'; c.textAlign = 'center';
      const map = { wait: ['授权中…', '#ffd24d'], ok: ['MIC LIVE ●', '#7dffb0'], deny: ['已拒绝授权', '#ff5d5d'], no: ['不支持', '#ff5d5d'] };
      const [t, col] = map[this.state.st] || ['—', '#888'];
      c.fillStyle = col;
      c.fillText(t, W / 2, H / 2 + 3);
      c.textAlign = 'left';
    },
    dispose() {
      if (this.stream) this.stream.getTracks().forEach(t => t.stop());
      if (this.srcNode) { try { this.srcNode.disconnect(); } catch (e) {} }
    }
  }
};
