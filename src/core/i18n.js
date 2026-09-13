/* i18n:界面语言(zh / en)。
   · LANG 启动时决定:优先本地存储偏好,否则按浏览器语言(非中文一律英文)
   · t(中, 英)行内取词;tr(标签)查模块面板小标签字典(未收录原样返回)
   · defName / defDesc / itemName 按语言取 def 与示例条目的显示名
   · setLang 写偏好后整页刷新:画布自动存档还原,新旧组件语言保持一致 */

import { EN_DESCS } from './i18n-descs.js';

const LANG_KEY = 'aethersynth.lang';

function resolveLang() {
  try {
    const s = localStorage.getItem(LANG_KEY);
    if (s === 'zh' || s === 'en') return s;
  } catch (e) {}
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'zh-CN';
  return /^zh/i.test(nav) ? 'zh' : 'en';
}

export const LANG = resolveLang();
export const isZh = () => LANG === 'zh';
export const t = (zh, en) => (LANG === 'zh' ? zh : en);

export function setLang(l) {
  if (l !== 'zh' && l !== 'en') return;
  try { localStorage.setItem(LANG_KEY, l); } catch (e) {}
  location.reload();
}

/* 模块面板小标签(旋钮 / 推子 label)字典 */
const LABELS = {
  '长度(步)': 'Steps', '门宽': 'Gate', '门宽 %': 'Gate %', '小节': 'Bars',
  '空占比': 'Duty', '阈值': 'Thresh', '速率': 'Rate', '深度': 'Depth',
  'BPM': 'BPM', '时间': 'Time', '音量': 'Level', '混响': 'Mix'
};
export const tr = s => (LANG === 'zh' ? s : (LABELS[s] ?? s));

/* 组件定义显示名 / 描述 */
export const defName = d => (LANG === 'zh' ? d.name : (d.en || d.name));
export const defDesc = d => (LANG === 'zh' ? d.desc : (EN_DESCS[d.id] ?? d.desc));

/* 示例 / 歌曲条目英文名(按 id) */
const ITEM_EN = {
  'star': 'Star Funk', 'nebula': 'Nebula Waltz', 'jump': 'Jump Run',
  'm-dawn': 'Classic Synth · Dawn Light (70 BPM)',
  'm-funk': 'Classic Synth · Funk Groove (115 BPM)',
  'm-rain': 'Classic Synth · Arp Rain (128 BPM)',
  'classic-teardown': 'Classic Synth Teardown · discrete build (120 BPM)',
  'fm-bell': 'FM Synthesis · 2-operator bells (100 BPM)',
  'chip-quest': 'Pixel Expedition · 8-bit long form (512 steps / 64 bars)',
  'kalinka-1': 'Open-Source 8-bit · Kalinka (pently, zlib)'
};
export const itemName = item =>
  LANG === 'zh' ? (item.label ?? item.name) : (ITEM_EN[item.id] ?? item.label ?? item.name);
