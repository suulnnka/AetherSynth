/* 时钟组件:按 BPM 输出脉冲(门电平),空占比可调,RST 上升沿把相位
   归零。OUT 接音序器 CLK 驱动节奏,接振荡器 / LFO 的 SYNC 口做硬同步。
   电平沿用 setValueAtTime 提前排程,采样级精度,不受帧率抖动影响。 */

import { clamp } from '../core/utils.js';
import { ctx } from '../core/audio.js';
import { kit } from '../kit/index.js';

export const clock = {
  id: 'clk', name: '时钟', en: 'CLOCK', cat: 'source', w: 6, h: 5,
  desc: '节拍时钟:按 BPM 输出脉冲,空占比(高电平占比)可调;RST 上升沿把相位归零。OUT 接音序器 CLK 驱动节奏,接振荡器 / LFO 的 SYNC 做相位硬同步。',
  ports: [
    { id: 'OUT', dir: 'out', name: 'OUT', desc: '时钟脉冲:+10V(高电平)/ 0V(低电平)' },
    { id: 'RST', dir: 'in', name: 'RST', desc: '复位:上升沿把相位归零并立即输出高电平' }
  ],
  state: () => ({ bpm: 120, duty: 50 }),
  build() {
    this.out = ctx.createConstantSource(); this.out.offset.value = 0;
    this.out.connect(this.outs.OUT); this.out.start();
    this.mon('RST');
    this._tNext = ctx.currentTime + 0.05;   // 下一次电平沿时刻
    this._nextHigh = true;                  // 该沿是否为上升沿
    const row = kit.row(this);
    kit.knob(this, { parent: row, key: 'bpm', label: 'BPM', min: 10, max: 300, value: 120, unit: '' });
    kit.knob(this, { parent: row, key: 'duty', label: '空占比', min: 10, max: 90, value: 50, unit: ' %' });
  },
  tick() {
    const t = ctx.currentTime;
    const bpm = clamp(this.state.bpm ?? 120, 1, 500);
    const period = Math.max(0.005, 60 / bpm);
    const hi = period * clamp((this.state.duty ?? 50) / 100, 0.05, 0.95);
    if (this.edge('RST') === 1) {           // 复位:相位归零,立即升起
      this._tNext = t;
      this._nextHigh = true;
    }
    // 提前排程未来 30ms 内的电平沿(限制单帧排程次数防 BPM 突变卡帧)
    let guard = 0;
    while (this._tNext < t + 0.03 && guard++ < 64) {
      const at = Math.max(this._tNext, t);
      this.out.offset.setValueAtTime(this._nextHigh ? 10 : 0, at);
      this._tNext = at + (this._nextHigh ? hi : period - hi);
      this._nextHigh = !this._nextHigh;
    }
  },
  dispose() { try { this.out.stop(); } catch (e) {} }
};
