/* 空间与谐波效果:失真 / 合唱 / 混响 / 声像。
   纯 WebAudio 节点链(无控制率 tick),旋钮 onChange 直改参数;
   def 自带 flow(输出口被下游拉活时,IN 来路一并激活)。 */

import { clamp } from '../core/utils.js';
import { ctx } from '../core/audio.js';
import { kit } from '../kit/index.js';
import { saveSoon } from '../core/save.js';

/** 失真传递曲线:tanh 软削顶,k 越大谐波越密,输出归一到 ±1(可单测) */
export function mkDriveCurve(k) {
  const n = 257, curve = new Float32Array(n), norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1) * 2 - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  return curve;
}

/** 合成混响脉冲响应:立体声指数衰减白噪声(可单测长度) */
export function mkReverbIR(seconds, decay = 2.6) {
  const rate = ctx.sampleRate, len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export const fx = {
  /* ---- 失真:WaveShaper 软削顶 + 音色低通 ---- */
  drive: {
    id: 'drive', name: '失真', en: 'DRIVE', cat: 'process', w: 4, h: 6,
    desc: '过驱动失真:tanh 软削顶产生谐波,DRIVE 控制增益(1~20),TONE 低通柔化毛刺。加厚单薄音色、做法兹主音的标配。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '失真输出' },
      { id: 'IN', dir: 'in', name: 'IN', desc: '音频输入' }
    ],
    flow: { OUT: ['IN'] },
    state: () => ({ drive: 4, tone: 6000 }),
    build() {
      this.sh = ctx.createWaveShaper();
      this.sh.oversample = '2x';
      this.sh.curve = mkDriveCurve(this.state.drive);
      this.tone = ctx.createBiquadFilter();
      this.tone.type = 'lowpass'; this.tone.frequency.value = this.state.tone;
      this.ins.IN.connect(this.sh); this.sh.connect(this.tone); this.tone.connect(this.outs.OUT);
    },
    ui() {
      kit.knob(this, { key: 'drive', label: 'DRIVE', min: 1, max: 20, value: this.state.drive, unit: '',
        onChange: v => { this.sh.curve = mkDriveCurve(v); } });
      kit.knob(this, { key: 'tone', label: 'TONE', min: 400, max: 12000, value: this.state.tone, unit: 'Hz',
        onChange: v => this.tone.frequency.setTargetAtTime(v, ctx.currentTime, 0.02) });
      kit.hint('tanh 软削顶', this);
    },
    dispose() {}
  },

  /* ---- 合唱:双调制延迟分左右,立体声加宽 ---- */
  chorus: {
    id: 'chorus', name: '合唱', en: 'CHORUS', cat: 'process', w: 4, h: 7,
    desc: '立体声合唱:两路 20ms 级延迟由正交 LFO 调制,左右反相摆动产生漂移感与声场加宽;MIX 控制湿度。polysynth 甜味来源。',
    ports: [
      { id: 'L', dir: 'out', name: 'L', desc: '左声道输出' },
      { id: 'R', dir: 'out', name: 'R', desc: '右声道输出' },
      { id: 'IN', dir: 'in', name: 'IN', desc: '音频输入' }
    ],
    flow: { L: ['IN'], R: ['IN'] },
    state: () => ({ rate: 0.8, mix: 0.5 }),
    build() {
      const mk = (base, depth) => {
        const dl = ctx.createDelay(0.1); dl.delayTime.value = base;
        const lfo = ctx.createOscillator(); lfo.frequency.value = this.state.rate;
        const g = ctx.createGain(); g.gain.value = depth;
        lfo.connect(g); g.connect(dl.delayTime); lfo.start();
        const wet = ctx.createGain(); wet.gain.value = this.state.mix;
        this.ins.IN.connect(dl); dl.connect(wet);
        return { dl, lfo, wet };
      };
      this.ch1 = mk(0.020, 0.004);      // 左:摆向 +
      this.ch2 = mk(0.017, -0.004);     // 右:反相摆动
      this.dry = ctx.createGain(); this.dry.gain.value = 0.8;
      this.ins.IN.connect(this.dry);
      this.dry.connect(this.outs.L); this.dry.connect(this.outs.R);
      this.ch1.wet.connect(this.outs.L); this.ch2.wet.connect(this.outs.R);
    },
    ui() {
      kit.knob(this, { key: 'rate', label: 'RATE', min: 0.1, max: 6, value: this.state.rate, unit: 'Hz',
        onChange: v => {
          this.ch1.lfo.frequency.setTargetAtTime(v, ctx.currentTime, 0.02);
          this.ch2.lfo.frequency.setTargetAtTime(v * 0.83, ctx.currentTime, 0.02);
        } });
      kit.knob(this, { key: 'mix', label: 'MIX', min: 0, max: 1, value: this.state.mix, unit: '',
        onChange: v => {
          this.ch1.wet.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
          this.ch2.wet.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
        } });
      kit.hint('双 LFO 左右反相', this);
    },
    dispose() {
      try { this.ch1.lfo.stop(); this.ch2.lfo.stop(); } catch (e) {}
    }
  },

  /* ---- 混响:Convolver + 合成立体声脉冲响应 ---- */
  reverb: {
    id: 'reverb', name: '混响', en: 'REVERB', cat: 'process', w: 4, h: 6,
    desc: '卷积混响:内部合成指数衰减的立体声脉冲响应,SIZE 改变空间大小(0.3~6s,重建 IR),MIX 干湿比。给干音色一个"房间"。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '干湿混合输出' },
      { id: 'IN', dir: 'in', name: 'IN', desc: '音频输入' }
    ],
    flow: { OUT: ['IN'] },
    state: () => ({ size: 2.2, mix: 0.35 }),
    build() {
      this.dry = ctx.createGain(); this.wet = ctx.createGain();
      this.cv = ctx.createConvolver();
      this.cv.buffer = mkReverbIR(this.state.size);
      this.ins.IN.connect(this.dry); this.dry.connect(this.outs.OUT);
      this.ins.IN.connect(this.cv); this.cv.connect(this.wet); this.wet.connect(this.outs.OUT);
      this.dry.gain.value = 1 - this.state.mix * 0.5;
      this.wet.gain.value = this.state.mix;
    },
    ui() {
      kit.knob(this, { key: 'size', label: 'SIZE', min: 0.3, max: 6, value: this.state.size, unit: 's',
        onChange: v => {   // 重建 IR 节流:停 300ms 不再变化才生成
          clearTimeout(this._irT);
          this._irT = setTimeout(() => { this.cv.buffer = mkReverbIR(v); }, 300);
        } });
      kit.knob(this, { key: 'mix', label: 'MIX', min: 0, max: 1, value: this.state.mix, unit: '',
        onChange: v => {
          this.wet.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
          this.dry.gain.setTargetAtTime(1 - v * 0.5, ctx.currentTime, 0.02);
        } });
      kit.hint('合成 IR 卷积', this);
    },
    dispose() { clearTimeout(this._irT); }
  },

  /* ---- 声像:立体声定位 ---- */
  pan: {
    id: 'pan', name: '声像', en: 'PAN', cat: 'process', w: 3, h: 6,
    desc: '立体声声像:PAN 旋钮 −1(全左)~ +1(全右)定位输入信号,分 L / R 两路输出接喇叭。',
    ports: [
      { id: 'L', dir: 'out', name: 'L', desc: '左声道' },
      { id: 'R', dir: 'out', name: 'R', desc: '右声道' },
      { id: 'IN', dir: 'in', name: 'IN', desc: '音频输入' }
    ],
    flow: { L: ['IN'], R: ['IN'] },
    state: () => ({ pan: 0 }),
    build() {
      this.sp = ctx.createStereoPanner();
      this.sp.pan.value = this.state.pan;
      this.split = ctx.createChannelSplitter(2);
      this.ins.IN.connect(this.sp); this.sp.connect(this.split);
      this.split.connect(this.outs.L, 0); this.split.connect(this.outs.R, 1);
    },
    ui() {
      kit.knob(this, { key: 'pan', label: 'PAN', min: -1, max: 1, value: this.state.pan, unit: '',
        onChange: v => this.sp.pan.setTargetAtTime(clamp(v, -1, 1), ctx.currentTime, 0.02) });
      kit.hint('L ◂▸ R', this);
    },
    dispose() {}
  }
};
