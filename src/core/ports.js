/* 组件外壳排版与接口定位(纯函数,无 DOM / 音频依赖,可单测)。

   每个模块的纵向结构固定为四段,所有模块复用同一套规则:
   ┌────────────────────────┐
   │ 标题行  0.9 格          │ 名称 + 删除
   │ 输出泳道 2.0 格         │ 输出接口行(第 2 格线)+ 下方标签带
   │ 内容区  余下全部        │ 各模块的屏幕 / 旋钮 / 琴键……
   │ 输入泳道 2.0 格         │ 上方标签带 + 输入接口行(倒数第 1 格线)
   └────────────────────────┘
   接口水平 2 格间距、垂直取整格线 → 接口永远落在网格交点上。 */

/** 内容设计基准:每格 24 设计像素,随格距(--cellpx)整体缩放 */
export const BASE = 24;

export const SHELL = { headerC: 0.9, laneC: 2.0, padC: 0.3, jackOutC: 2, jackInFromBottomC: 1 };

/** 给 def.ports 计算网格坐标 _x/_y,并建立 portsById 索引(原地修改 def) */
export function layoutDefPorts(d) {
  d.portsById = {};
  const byDir = { out: [], in: [] };
  d.ports.forEach(p => {
    byDir[p.dir].push(p);
    d.portsById[p.id] = p;
    if (!p.type) p.type = 'audio';
  });
  for (const dir of ['out', 'in']) {
    const n = byDir[dir].length;
    byDir[dir].forEach((p, i) => {
      p._x = d.w / 2 - (n - 1) + 2 * i;
      p._y = dir === 'out' ? SHELL.jackOutC : d.h - SHELL.jackInFromBottomC;
    });
  }
  return d;
}
