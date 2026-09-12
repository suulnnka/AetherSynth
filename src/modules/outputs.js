/* 输出 / 显示终端组件:喇叭 / 示波器 / XY 示波器 / 录音机。
   这些组件是活跃度计算的种子:接进它们的链路才会被模拟。 */

import { clamp } from '../core/utils.js';
import { ctx } from '../core/audio.js';
import { kit } from '../kit/index.js';

export const outputs = {
  spk: {
    id: 'spk', name: '喇叭', en: 'SPEAKER', cat: 'output', w: 4, h: 5,
    desc: '立体声监听:L / R 双声道输入,各自带 20Hz 高通防直流;屏幕显示双声道电平与削波。只接 L 时右声道静音。',
    ports: [
      { id: 'L', dir: 'in', name: 'L', desc: '左声道输入(音频)' },
      { id: 'R', dir: 'in', name: 'R', desc: '右声道输入(音频)' }
    ],
    build() {
      // 合并为真正的立体声输出:L → 声道 0,R → 声道 1
      this.merger = ctx.createChannelMerger(2);
      this.merger.connect(ctx.destination);
      const mkSide = (port, ch) => {
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 20;
        const g = ctx.createGain(); g.gain.value = 0.8;
        this.ins[port].connect(hp); hp.connect(g); g.connect(this.merger, 0, ch);
        this.mon(port, hp);
      };
      mkSide('L', 0); mkSide('R', 1);
      this._pkL = 0; this._pkR = 0; this._clip = 0;
      kit.screen(this, 'scr');
    },
    tick() {
      const mL = this.mons.L, mR = this.mons.R, s = this.scr;
      if (!s || !mL || !mR) return;
      let pkL = 0, pkR = 0;
      for (let i = 0; i < mL.buf.length; i += 4) pkL = Math.max(pkL, Math.abs(mL.buf[i]));
      for (let i = 0; i < mR.buf.length; i += 4) pkR = Math.max(pkR, Math.abs(mR.buf[i]));
      this._pkL = Math.max(this._pkL * 0.92, pkL);
      this._pkR = Math.max(this._pkR * 0.92, pkR);
      if (pkL > 0.99 || pkR > 0.99) this._clip = 8;
      const { c, w: W, h: H } = s;
      c.fillStyle = '#0b0d10'; c.fillRect(0, 0, W, H);
      const bw = (W - 16) / 2;
      const bar = (x0, pk, label) => {
        const bh = clamp(pk, 0, 1) * (H - 18);
        c.fillStyle = pk > 0.85 ? '#ffd24d' : '#7dffb0';
        c.fillRect(x0, H - 8 - bh, bw, bh);
        c.fillStyle = '#8899aa'; c.font = '8px monospace'; c.textAlign = 'center';
        c.fillText(label, x0 + bw / 2, H - 2);
        c.textAlign = 'left';
      };
      bar(4, this._pkL, 'L');
      bar(8 + bw, this._pkR, 'R');
      if (this._clip > 0) {
        c.fillStyle = '#ff5d5d';
        c.beginPath(); c.arc(W - 7, 8, 3.5, 0, 7); c.fill();
        this._clip--;
      }
    }
  },

  scope: {
    id: 'scope', name: '示波器', en: 'SCOPE', cat: 'output', w: 8, h: 6,
    desc: '触发同步示波器 + 电压表。看波形、看 CV 电压都靠它。',
    ports: [{ id: 'IN', dir: 'in', name: 'IN', desc: '任意信号输入' }],
    build() {
      this.mon('IN', this.ins.IN, 2048);
      this._scale = 2;
      kit.screen(this, 'scr');
    },
    tick() {
      const m = this.mons.IN, s = this.scr;
      if (!m || !s) return;
      const { c, w: W, h: H } = s;
      c.fillStyle = '#0b0d10'; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(255,255,255,.08)';
      c.beginPath(); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.stroke();
      let peak = 0.001;
      for (let i = 0; i < m.buf.length; i += 8) peak = Math.max(peak, Math.abs(m.buf[i]));
      const target = Math.max(1.2, peak * 1.25);
      this._scale += (target - this._scale) * 0.08;
      let tr = 0;
      for (let i = 1; i < m.buf.length / 2; i++) if (m.buf[i - 1] <= 0 && m.buf[i] > 0) { tr = i; break; }
      const N = 1024;
      c.strokeStyle = '#6effb0'; c.lineWidth = 1.4; c.beginPath();
      for (let i = 0; i < N; i++) {
        const v = m.buf[tr + i] || 0;
        const y = H / 2 - clamp(v / this._scale, -1, 1) * (H / 2 - 6);
        const x = 4 + (i / (N - 1)) * (W - 8);
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
      c.fillStyle = '#9fe8c0'; c.font = '10px monospace';
      c.fillText(m.v.toFixed(2) + ' V', 6, 12);
    }
  },

  xy: {
    id: 'xy', name: 'XY示波器', en: 'XY SCOPE', cat: 'output', w: 8, h: 6,
    desc: '矢量示波器(李萨如图形):X 与 Y 两路信号互相垂直偏转,可看相位差、频率比与旋转轨迹。带余辉,光点为最新采样。',
    ports: [
      { id: 'X', dir: 'in', name: 'X', desc: '水平偏转输入(任意信号)' },
      { id: 'Y', dir: 'in', name: 'Y', desc: '垂直偏转输入(任意信号)' }
    ],
    build() {
      this.mon('X', this.ins.X, 2048);
      this.mon('Y', this.ins.Y, 2048);
      this._s = 2;
      kit.screen(this, 'scr');
    },
    tick() {
      const mx = this.mons.X, my = this.mons.Y, s = this.scr;
      if (!mx || !my || !s) return;
      const { c, w: W, h: H } = s;
      // 余辉:半透明覆盖代替清屏,轨迹慢慢熄灭
      c.fillStyle = 'rgba(11,13,16,.10)';
      c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(120,220,160,.10)';
      c.beginPath();
      c.moveTo(0, H / 2); c.lineTo(W, H / 2);
      c.moveTo(W / 2, 0); c.lineTo(W / 2, H);
      c.stroke();
      // 自适应缩放
      let pk = 0.001;
      for (let i = 0; i < mx.buf.length; i += 8) {
        const a = Math.abs(mx.buf[i]), b = Math.abs(my.buf[i]);
        if (a > pk) pk = a;
        if (b > pk) pk = b;
      }
      const target = Math.max(1.2, pk * 1.15);
      this._s += (target - this._s) * 0.06;
      // 画最近的配对采样(X,Y 同一时刻)成轨迹
      const N = 900, off = mx.buf.length - N;
      c.strokeStyle = '#8dffb4'; c.lineWidth = 1.1; c.globalAlpha = .8; c.beginPath();
      for (let i = 0; i < N; i++) {
        const vx = mx.buf[off + i] || 0, vy = my.buf[off + i] || 0;
        const px = W / 2 + clamp(vx / this._s, -1, 1) * (W / 2 - 6);
        const py = H / 2 - clamp(vy / this._s, -1, 1) * (H / 2 - 6);
        i ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.stroke();
      // 光束点 = 最新采样位置
      const lx = mx.buf[mx.buf.length - 1] || 0, ly = my.buf[my.buf.length - 1] || 0;
      c.globalAlpha = 1; c.fillStyle = '#d9ffe9';
      c.beginPath();
      c.arc(W / 2 + clamp(lx / this._s, -1, 1) * (W / 2 - 6),
        H / 2 - clamp(ly / this._s, -1, 1) * (H / 2 - 6), 2.2, 0, 7);
      c.fill();
      c.fillStyle = '#9fe8c0'; c.font = '9px monospace';
      c.fillText('X ' + mx.v.toFixed(2) + 'V  Y ' + my.v.toFixed(2) + 'V', 5, 10);
    }
  },

  rec: {
    id: 'rec', name: '录音机', en: 'PCM RECORDER', cat: 'output', w: 8, h: 7,
    desc: 'PCM 采样录音机(最长 60 秒)。REC 门高电平录音,PLAY 门播放,LOOP ≥0.5V 循环(未接线默认循环)。',
    ports: [
      { id: 'OUT', dir: 'out', name: 'OUT', desc: '回放输出' },
      { id: 'IN', dir: 'in', name: 'IN', desc: '录音信号输入' },
      { id: 'REC', dir: 'in', name: 'REC', desc: '录音门(≥0.5V 录音)' },
      { id: 'PLAY', dir: 'in', name: 'PLAY', desc: '播放门(≥0.5V 播放)' },
      { id: 'LOOP', dir: 'in', name: 'LOOP', desc: '循环(默认循环,接 0V 关闭)' }
    ],
    build() {
      this.chunks = []; this.len = 0; this.buffer = null; this.cols = null;
      this.recording = false; this.srcNode = null; this.recT = 0;
      this.sp = ctx.createScriptProcessor(4096, 1, 1);
      this.ins.IN.connect(this.sp);
      this.mute = ctx.createGain(); this.mute.gain.value = 0;
      this.sp.connect(this.mute); this.mute.connect(ctx.destination);
      const self = this;
      this.sp.onaudioprocess = e => {
        if (!self.recording) return;
        if (self.len < ctx.sampleRate * 60) {
          self.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
          self.len += e.inputBuffer.length;
        }
      };
      this.mon('REC'); this.mon('PLAY');
      kit.screen(this, 'scr');
    },
    startRec() {
      this.stopPlay();
      this.chunks = []; this.len = 0;
      this.recording = true; this.recT = ctx.currentTime;
    },
    stopRec() {
      if (!this.recording) return;
      this.recording = false;
      if (this.len < 2) { this.buffer = null; return; }
      const buf = ctx.createBuffer(1, this.len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let o = 0;
      for (const ch of this.chunks) { d.set(ch, o); o += ch.length; }
      this.buffer = buf;
      const COLS = 480;
      this.cols = new Float32Array(COLS * 2);
      const step = Math.max(1, Math.floor(this.len / COLS));
      for (let x = 0; x < COLS; x++) {
        let mn = 1, mx = -1;
        const s0 = x * step, s1 = Math.min(this.len, s0 + step);
        for (let i = s0; i < s1; i += 3) { const v = d[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
        this.cols[x * 2] = mn; this.cols[x * 2 + 1] = mx;
      }
    },
    startPlay() {
      if (!this.buffer) return;
      this.stopPlay();
      const s = ctx.createBufferSource();
      s.buffer = this.buffer;
      s.loop = this.volts('LOOP', 10) >= 0.5;
      s.connect(this.outs.OUT);
      s.start();
      this.srcNode = s;
    },
    stopPlay() {
      if (this.srcNode) {
        try { this.srcNode.stop(); } catch (e) {}
        try { this.srcNode.disconnect(); } catch (e) {}
        this.srcNode = null;
      }
    },
    tick() {
      const re = this.edge('REC'), pe = this.edge('PLAY');
      if (re === 1) this.startRec();
      else if (re === -1) this.stopRec();
      if (pe === 1) this.startPlay();
      else if (pe === -1) this.stopPlay();
      const s = this.scr; if (!s) return;
      const { c, w: W, h: H } = s;
      c.fillStyle = '#0b0d10'; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(255,255,255,.07)';
      c.beginPath(); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.stroke();
      c.strokeStyle = '#5dffe1'; c.lineWidth = 1; c.beginPath();
      if (this.recording && this.chunks.length) {
        const d = this.chunks[this.chunks.length - 1];
        for (let i = 0; i < d.length; i += 16) {
          const x = (i / d.length) * W, y = H / 2 - d[i] * (H / 2 - 6);
          i ? c.lineTo(x, y) : c.moveTo(x, y);
        }
      } else if (this.cols) {
        for (let x = 0; x < this.cols.length / 2; x++) {
          const px = (x / (this.cols.length / 2)) * W;
          c.moveTo(px, H / 2 - this.cols[x * 2 + 1] * (H / 2 - 6));
          c.lineTo(px, H / 2 - this.cols[x * 2] * (H / 2 - 6));
        }
      } else { c.moveTo(0, H / 2); c.lineTo(W, H / 2); }
      c.stroke();
      let st, col;
      if (this.recording) { st = '● REC ' + (ctx.currentTime - this.recT).toFixed(1) + 's'; col = '#ff5d5d'; }
      else if (this.srcNode) { st = '▶ PLAY' + (this.srcNode.loop ? ' ∞' : ''); col = '#7dffb0'; }
      else st = this.buffer ? 'READY ' + (this.len / ctx.sampleRate).toFixed(1) + 's' : 'EMPTY';
      c.fillStyle = col || '#889';
      c.font = '10px monospace';
      c.fillText(st, 5, 11);
    },
    dispose() {
      this.sp.onaudioprocess = null;
      try { this.sp.disconnect(); this.mute.disconnect(); } catch (e) {}
      this.stopPlay();
    }
  }
};
