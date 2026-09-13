/* 经典合成器 CLASSIC SYNTH —— 经典单音模拟合成器架构的组件。
   ---------------------------------------------------------------------
   信号链(与原版一致):3 振荡器 + 噪声 → 混音器 → 24dB 低通滤波器
   → 响度包络 → 输出;滤波包络经 CONTOUR 调制滤波器;OSC3 可切为
   LFO 作调制源;GLIDE 滑音。双包络均为 ADSR。
   外观:控制器 / 振荡器组 / 混音器 / 滤波器 / 双包络滑条 / 键盘。 */

import { clamp } from '../core/utils.js';
import { ctx, getCtx, noiseBuf } from '../core/audio.js';
import { kit } from '../kit/index.js';
import { saveSoon } from '../core/save.js';

const WAVE_LABELS = ['三角', '锯齿', '方波'];
const WAVE_TYPES = ['triangle', 'sawtooth', 'square'];
const OSC3_MODES = ['键盘', 'LFO'];

export const classicSynth = {
  id: 'classic-synth', name: '经典合成器', en: 'CLASSIC SYNTH', cat: 'source', w: 30, h: 18,
  desc: '经典单音合成器:三振荡器 + 噪声 → 混音器 → 24dB 低通(EMPHASIS 共振 / CONTOUR 包络调制)→ 双 ADSR(滤波 / 响度)→ 输出;OSC3 可切 LFO 作调制源,GLIDE 滑音。内置键盘:电脑键 A W S E D… 演奏,支持外部 GATE / V-OCT。',
  ports: [
    { id: 'OUT', dir: 'out', name: 'OUT', desc: '合成器输出(单声道)' },
    { id: 'MIDI', dir: 'in', name: 'MIDI', desc: 'MIDI 音符输入:可直接接 MIDI键盘 / 音序器的 MIDI 口' },
    { id: 'GATE', dir: 'in', name: 'GATE', desc: '外部门输入:≥0.5V 触发音符(如音序器 GATE,音高取内置键盘最后音符)' },
    { id: 'V/OCT', dir: 'in', name: 'V/OCT', desc: '外部音高 1V/oct(叠加在内置键盘之上)' }
  ],
  state: () => ({
    tune: 0, glide: 0, modmix: 3, oscmod: 3,
    w1: 1, w2: 1, w3: 1, d2: 0, d3: 0, o3mode: 0,
    v1: 5, v2: 5, v3: 5, vnz: 3, nzmode: 1,
    cutoff: 7, emph: 3, contour: 6,
    fA: 2, fD: 5, fS: 6, fR: 4,
    lA: 1, lD: 4, lS: 8, lR: 4, vol: 7
  }),
  build() {
    const c0 = getCtx();
    this.held = []; this._keys = new Map(); this._gateOn = false; this._freq = 261.6256;
    // 输出链:放大包络 → 音量 → OUT
    this.envA = c0.createGain(); this.envA.gain.value = 0;
    this.loudG = c0.createGain(); this.loudG.gain.value = this.state.vol / 10 * 1.2;
    this.envA.connect(this.loudG); this.loudG.connect(this.outs.OUT);
    // 24dB 低通:两级 biquad;包络经 CONTOUR 量调制两级的 detune(音分)
    this.f1 = c0.createBiquadFilter(); this.f1.type = 'lowpass';
    this.f2 = c0.createBiquadFilter(); this.f2.type = 'lowpass';
    this.setCut(this.state.cutoff);
    this.setEmph(this.state.emph);
    this.f1.connect(this.f2); this.f2.connect(this.envA);
    this.envF = c0.createGain(); this.envF.gain.value = 0;
    this.cG = c0.createGain(); this.cG.gain.value = this.state.contour / 10 * 3600;
    this.envF.connect(this.cG);
    this.cG.connect(this.f1.detune); this.cG.connect(this.f2.detune);
    // 混音总线
    this.mix = c0.createGain(); this.mix.connect(this.f1);
    // 三振荡器(锯齿起步,波形可换;各自带混音电平)
    this.oscs = [1, 2, 3].map(idx => {
      const o = c0.createOscillator();
      o.type = WAVE_TYPES[this.state['w' + idx]] || 'sawtooth';
      const g = c0.createGain(); g.gain.value = this.state['v' + idx] / 10;
      o.connect(g); g.connect(this.mix);
      o.frequency.value = 261.6256;
      o.start();
      this['g' + idx] = g;
      return o;
    });
    // 噪声:白噪声源,粉噪声用低通近似,COLOR 开关切换
    this.nzSrc = c0.createBufferSource(); this.nzSrc.buffer = noiseBuf(); this.nzSrc.loop = true;
    this.nzLP = c0.createBiquadFilter(); this.nzLP.type = 'lowpass';
    this.nzLP.frequency.value = this.state.nzmode ? 12000 : 450;
    this.nzG = c0.createGain(); this.nzG.gain.value = this.state.vnz / 10;
    this.nzSrc.connect(this.nzLP); this.nzLP.connect(this.nzG); this.nzG.connect(this.mix);
    this.nzSrc.start();
    // 调制:OSC3(LFO 模式)与噪声按 MOD MIX 平衡,深度由 OSC MOD 决定 → 振荡器音分
    this.gL = c0.createGain(); this.gL.gain.value = 1 - this.state.modmix / 10;
    this.gN = c0.createGain(); this.gN.gain.value = this.state.modmix / 10;
    this.modD = c0.createGain(); this.modD.gain.value = this.state.oscmod * 30;
    this.oscs[2].connect(this.gL); this.gL.connect(this.modD);
    this.nzSrc.connect(this.gN); this.gN.connect(this.modD);
    this.modD.connect(this.oscs[0].detune);
    this.modD.connect(this.oscs[1].detune);
    this.modD.connect(this.oscs[2].detune);
    this.mon('GATE'); this.mon('V/OCT');
  },
  /* MIDI 口不走 Web Audio 节点,无需 mon */
  /* 音符 */
  /** MIDI 输入:直接接 MIDI键盘 / 音序器的 MIDI 口 */
  midiIn(msg) {
    if (msg.type === 'noteon') this.noteOn(msg.note, msg.vel ?? 100);
    else if (msg.type === 'noteoff') this.noteOff(msg.note);
  },
  noteOn(n, vel = 100) {
    const f = 440 * Math.pow(2, (n - 69) / 12);
    this.held = this.held.filter(x => x.n !== n);
    this.held.push({ n, f, vel: clamp(vel, 1, 127) / 127 });
    this.gateOn(f);
  },
  noteOff(n) {
    this.held = this.held.filter(x => x.n !== n);
    if (this.held.length) this.gateOn(this.held[this.held.length - 1].f);  // 单音:最后音符优先
    else this.gateOff();
  },
  compNote(off, down) {
    const n = clamp(60 + off, 48, 84);
    if (down) this.noteOn(n, 100); else this.noteOff(n);
  },
  gateOn(freq) {
    this._gateOn = true;
    this._freq = freq;
    const t = ctx.currentTime;
    const gl = clamp(this.state.glide, 0, 10) / 3;
    const setF = (o, mult) => o.frequency.setTargetAtTime(clamp(freq * mult, 10, 12000), t, gl > 0.001 ? gl / 3 : 0.001);
    setF(this.oscs[0], 1);
    setF(this.oscs[1], Math.pow(2, this.state.d2 / 12));
    setF(this.oscs[2], this.state.o3mode ? 1 : Math.pow(2, this.state.d3 / 12));
    if (this.state.o3mode) this.oscs[2].frequency.setTargetAtTime(this.lfoFreq(), t, 0.02);
    this.envTrig(this.envA, t, this.state.lA, this.state.lD, this.state.lS, this.state.lR, 1);
    this.envTrig(this.envF, t, this.state.fA, this.state.fD, this.state.fS, this.state.fR, 1);
  },
  gateOff() {
    const t = ctx.currentTime;
    this.envRel(this.envA, t, this.state.lR);
    this.envRel(this.envF, t, this.state.fR);
  },
  envTrig(g, t, A, D, S, R, peak) {
    const at = Math.max(0.003, A / 10 * 1.5), dt = Math.max(0.003, D / 10 * 2);
    const sus = clamp(S / 10, 0, 1);
    const gg = g.gain;
    if (gg.cancelAndHoldAtTime) gg.cancelAndHoldAtTime(t); else gg.cancelScheduledValues(t);
    gg.setValueAtTime(gg.value, t);
    gg.linearRampToValueAtTime(peak, t + at);
    gg.linearRampToValueAtTime(peak * (S / 10), t + at + dt);
  },
  envRel(g, t, R) {
    const rr = Math.max(0.003, R / 10 * 2);
    const gg = g.gain;
    if (gg.cancelAndHoldAtTime) gg.cancelAndHoldAtTime(t); else gg.cancelScheduledValues(t);
    gg.setValueAtTime(gg.value, t);
    gg.linearRampToValueAtTime(0, t + rr);
  },
  lfoFreq() {
    // LFO 模式下 OSC3 的低频:由失谐旋钮扫描
    return clamp(0.2 * Math.pow(2, (this.state.d3 + 5) / 2), 0.02, 40);
  },
  /* 面板参数 → 引擎 */
  applyParam(key, v) {
    const t = ctx.currentTime;
    switch (key) {
      case 'tune': {
        const base = this._freq * Math.pow(2, v / 12);
        this.oscs[0].frequency.setTargetAtTime(base, t, 0.01);
        this.oscs[1].frequency.setTargetAtTime(base * Math.pow(2, this.state.d2 / 12), t, 0.01);
        if (!this.state.o3mode) this.oscs[2].frequency.setTargetAtTime(base * Math.pow(2, this.state.d3 / 12), t, 0.01);
        break;
      }
      case 'glide': break;
      case 'modmix':
        this.gL.gain.setTargetAtTime(1 - v / 10, t, 0.01);
        this.gN.gain.setTargetAtTime(v / 10, t, 0.01);
        break;
      case 'oscmod':
        this.modD.gain.setTargetAtTime(v * 30, t, 0.01);
        break;
      case 'w1': this.oscs[0].type = WAVE_TYPES[v] || this.oscs[0].type; break;
      case 'w2': this.oscs[1].type = WAVE_TYPES[v] || this.oscs[1].type; break;
      case 'w3': this.oscs[2].type = WAVE_TYPES[v] || this.oscs[2].type; break;
      case 'd2': this.oscs[1].frequency.setTargetAtTime(this._freq * Math.pow(2, v / 12), t, 0.01); break;
      case 'd3':
        if (!this.state.o3mode) this.oscs[2].frequency.setTargetAtTime(this._freq * Math.pow(2, v / 12), t, 0.01);
        break;
      case 'o3mode':
        if (v) this.oscs[2].frequency.setTargetAtTime(this.lfoFreq(), t, 0.01);
        else this.oscs[2].frequency.setTargetAtTime(this._freq * Math.pow(2, this.state.d3 / 12), t, 0.01);
        break;
      case 'v1': this.g1.gain.setTargetAtTime(v / 10, t, 0.01); break;
      case 'v2': this.g2.gain.setTargetAtTime(v / 10, t, 0.01); break;
      case 'v3': this.g3.gain.setTargetAtTime(v / 10, t, 0.01); break;
      case 'vnz': this.nzG.gain.setTargetAtTime(v / 10, t, 0.01); break;
      case 'nzmode':
        this.nzLP.frequency.setTargetAtTime(v ? 12000 : 450, t, 0.02);
        break;
      case 'cutoff': this.setCut(v); break;
      case 'emph': this.setEmph(v); break;
      case 'contour': this.cG.gain.value = v / 10 * 3600; break;
      case 'vol': this.loudG.gain.setTargetAtTime(v / 10 * 1.2, t, 0.01); break;
    }
    saveSoon();
  },
  setCut(v) {
    const f = clamp(20 * Math.pow(2, v), 20, 20000);
    this.f1.frequency.setTargetAtTime(f, ctx.currentTime, 0.01);
    this.f2.frequency.setTargetAtTime(f, ctx.currentTime, 0.01);
  },
  setEmph(v) {
    const q = 0.5 + clamp(v, 0, 10) * 1.6;
    this.f1.Q.setTargetAtTime(q, ctx.currentTime, 0.01);
    this.f2.Q.setTargetAtTime(q, ctx.currentTime, 0.01);
  },
  ui() { uiClassicSynth(this); },
  tick() {
    // 外部 GATE / V-OCT
    const e = this.edge('GATE');
    if (e === 1) this.gateOn(261.6256 * Math.pow(2, this.volts('V/OCT', 0) + this.state.tune / 12));
    else if (e === -1) this.gateOff();
    if (this._gateOn) {
      const f = 261.6256 * Math.pow(2, this.volts('V/OCT', 0) + this.state.tune / 12);
      if (Math.abs(f - this._freq) > 0.05) {
        this._freq = f;
        const t = ctx.currentTime;
        this.oscs.forEach((o, i) => {
          const mult = i === 1 ? Math.pow(2, this.state.d2 / 12) : 1;
          o.frequency.setTargetAtTime(clamp(f * mult, 10, 12000), t, 0.01);
        });
      }
    }
  }
};

/** 面板:分区 + 控件 + 键盘 */
function uiClassicSynth(mod) {
  const body = mod.body;
  body.style.cssText += ';display:flex;flex-direction:column;gap:5px;padding:2px 3px;overflow:hidden';
  const group = (title, children) => {
    const g = document.createElement('div');
    g.style.cssText = 'border:1px solid rgba(127,127,127,.35);border-radius:5px;padding:2px 5px 3px;flex:1;min-width:0';
    const t = document.createElement('div');
    t.textContent = title;
    t.style.cssText = 'font-size:8px;font-weight:700;letter-spacing:1px;opacity:.6;margin-bottom:2px;white-space:nowrap';
    g.appendChild(t);
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;gap:3px;align-items:flex-start;justify-content:space-evenly';
    children.forEach(c => r.appendChild(c));
    g.appendChild(r);
    return g;
  };
  const kn = (key, label, min, max, o2 = {}) => {
    const w = document.createElement('div');
    w.style.cssText = 'width:46px;text-align:center';
    kit.knob(mod, { parent: w, key, label, min, max, value: mod.state[key], ...o2,
      onChange: v => mod.applyParam(key, v) });
    return w;
  };

  // 第一行:控制器 | 振荡器组 | 混音器
  const row1 = document.createElement('div');
  row1.style.cssText = 'display:flex;gap:4px';
  row1.append(
    group('控制器', [
      kn('tune', 'TUNE', -5, 5, { unit: ' 半音' }),
      kn('glide', 'GLIDE', 0, 10, { unit: '' }),
      kn('modmix', 'MOD MIX', 0, 10),
      kn('oscmod', 'OSC MOD', 0, 10)
    ]),
    group('振荡器组', [
      kn('w1', 'VCO1 波形', 0, 2, { steps: [0, 1, 2], labels: WAVE_LABELS }),
      kn('d2', 'VCO2 失谐', -5, 5, { unit: ' 半音' }), kn('w2', 'VCO2 波形', 0, 2, { steps: [0, 1, 2], labels: WAVE_LABELS }),
      kn('d3', 'VCO3 失谐', -5, 5, { unit: ' 半音' }), kn('w3', 'VCO3 波形', 0, 2, { steps: [0, 1, 2], labels: WAVE_LABELS }),
      kn('o3mode', 'OSC3 模式', 0, 1, { steps: [0, 1], labels: OSC3_MODES })
    ]),
    group('混音器', [kn('v1', 'VCO1', 0, 10), kn('v2', 'VCO2', 0, 10), kn('v3', 'VCO3', 0, 10), kn('vnz', '噪声', 0, 10)])
  );
  // 第二行:噪声 | 滤波器 | 滤波包络 | 响度包络 | 音量
  const row2 = document.createElement('div');
  row2.style.cssText = 'display:flex;gap:4px';
  const nzWrap = document.createElement('div');
  nzWrap.style.cssText = 'width:46px;text-align:center';
  nzWrap.innerHTML = '<div style="font-size:8px;opacity:.6">COLOR</div>';
  const nzBtn = document.createElement('button');
  nzBtn.className = 'tbtn';
  nzBtn.style.cssText = 'font-size:10px;padding:4px 6px';
  nzBtn.textContent = mod.state.nzmode ? '白' : '粉';
  nzBtn.addEventListener('click', () => {
    mod.state.nzmode = mod.state.nzmode ? 0 : 1;
    nzBtn.textContent = mod.state.nzmode ? '白' : '粉';
    mod.applyParam('nzmode', mod.state.nzmode);
  });
  nzWrap.appendChild(nzBtn);
  const slider = (key, label) => mod._mkSlider(key, label);
  row2.append(
    group('噪声', [nzWrap]),
    group('滤波器', [kn('cutoff', 'CUTOFF', 0, 10), kn('emph', 'EMPH', 0, 10), kn('contour', 'CONTOUR', 0, 10)]),
    group('滤波包络', ['fA', 'fD', 'fS', 'fR'].map(k => slider(k, k[1].toUpperCase()))),
    group('响度包络', ['lA', 'lD', 'lS', 'lR'].map(k => slider(k, k[1].toUpperCase()))),
    group('音量', [kn('vol', 'VOL', 0, 10)])
  );
  // 键盘区
  const keyHost = document.createElement('div');
  keyHost.style.cssText = 'flex:0 0 118px;min-height:0';
  body.append(row1, row2, keyHost);
  const realBody = mod.body;
  mod.body = keyHost;
  kit.keys(mod);
  mod.body = realBody;
}

/** 滑条(响度 / 滤波包络的 A D S R) */
classicSynth._mkSlider = function (key, label) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:26px;height:100%;display:flex;flex-direction:column;align-items:center;gap:2px';
  const track = document.createElement('div');
  track.style.cssText = 'position:relative;flex:1;width:12px;border-radius:6px;background:linear-gradient(90deg,#b9c0ca,#f2f4f7 45%,#b9c0ca);box-shadow:inset 0 0 0 1px #9aa3ae;cursor:ns-resize';
  const fill = document.createElement('div');
  fill.style.cssText = 'position:absolute;left:3px;right:3px;bottom:0;background:#d99000;border-radius:2px';
  const handle = document.createElement('div');
  handle.style.cssText = 'position:absolute;left:50%;width:20px;height:10px;margin-left:-10px;transform:translateY(50%);border-radius:3px;background:linear-gradient(180deg,#fdfdfe,#c6ccd5);box-shadow:0 1px 3px rgba(30,40,60,.4),inset 0 0 0 1px #9aa3ae';
  track.append(fill, handle);
  const lab = document.createElement('span');
  lab.textContent = label;
  lab.style.cssText = 'font-size:8px;color:var(--dim)';
  wrap.append(track, lab);
  const draw = v => {
    const pct = clamp(v, 0, 10) * 10;
    fill.style.height = pct + '%';
    handle.style.bottom = 'calc(' + pct + '% - 5px)';
  };
  const set = v => {
    v = clamp(Math.round(v * 10) / 10, 0, 10);
    this.state[key] = v;
    draw(v);
    saveSoon();
  };
  track.addEventListener('pointerdown', e => {
    e.stopPropagation();
    const r = track.getBoundingClientRect();
    const apply = ev => set((1 - (ev.clientY - r.top) / r.height) * 10);
    apply(e);
    const mv = ev => apply(ev);
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  });
  draw(this.state[key]);
  return wrap;
};
