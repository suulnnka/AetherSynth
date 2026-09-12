/* CompactPanel 的样式表(独立注入,组件可单独复用到其他项目)。

   .cpx-scope   外观主题作用域:CSS 变量 + data-widget 控件风格,
                工坊面板与画布上的自制组件实例共用。
   .cpx-root    面板外壳布局(仅工坊面板使用)。 */

export const CPX_CSS = `
.cpx-scope{
  --cpx-accent:#ffb01f;
  --cpx-text:#2b3138;
  --cpx-box:72px;
  --w-knob:radial-gradient(circle at 34% 28%,#454d57,#262b31 62%,#101317);
  --w-knob-ring:inset 0 0 0 1px #0a0c0f;
  --w-knob-shadow:0 2px 5px rgba(30,40,60,.4);
  --w-track:linear-gradient(90deg,#b9c0ca,#f2f4f7 45%,#b9c0ca);
  --w-track-ring:inset 0 0 0 1px #9aa3ae;
  --w-handle:linear-gradient(180deg,#fdfdfe,#c6ccd5);
  --w-handle-ring:inset 0 0 0 1px #9aa3ae;
  --w-sw-off:#c9ced6;
  --w-sw-off-ring:#9aa3ae;
  --w-sw-on:#4fbf7d;
  --w-sw-on-ring:#2f8a55;
  --w-meter-bg:#0b0d10;
  --w-meter-bar:linear-gradient(180deg,#7dffb0,#1d9e5c);
  --w-cell:rgba(255,255,255,.82);
}
/* 输入控件风格(可在主题里切换) */
.cpx-scope[data-widget="light"]{
  --w-knob:radial-gradient(circle at 34% 28%,#ffffff,#dfe3e9 55%,#aab2bd);
  --w-knob-ring:inset 0 0 0 1px #8d97a3;
  --w-handle:linear-gradient(180deg,#ffffff,#c9cfd8);
}
.cpx-scope[data-widget="neon"]{
  --w-knob:radial-gradient(circle at 34% 28%,#1b1e26,#0d0f14 62%,#05060a);
  --w-knob-ring:inset 0 0 0 1px #00ffd055;
  --w-knob-shadow:0 0 10px rgba(0,255,208,.25);
  --w-track:linear-gradient(90deg,#14161c,#23262e 45%,#14161c);
  --w-track-ring:inset 0 0 0 1px #00ffd055;
  --w-handle:linear-gradient(180deg,#101318,#1e232b);
  --w-handle-ring:inset 0 0 0 1px #00ffd088;
  --w-sw-off:#14161c;
  --w-sw-off-ring:#00ffd066;
  --w-meter-bg:#05060a;
  --w-meter-bar:linear-gradient(180deg,#00ffd0,#0080a0);
  --w-cell:rgba(10,14,18,.55);
}
.cpx-scope[data-widget="retro"]{
  --w-knob:radial-gradient(circle at 34% 28%,#f5e9c8,#dcc894 60%,#b49a66);
  --w-knob-ring:inset 0 0 0 1px #8a744a;
  --w-track:linear-gradient(90deg,#c8b488,#efe4c4 45%,#c8b488);
  --w-track-ring:inset 0 0 0 1px #8a744a;
  --w-handle:linear-gradient(180deg,#f7ecd0,#d9c493);
  --w-handle-ring:inset 0 0 0 1px #8a744a;
  --w-sw-off:#e2d4ac;
  --w-sw-off-ring:#8a744a;
  --w-meter-bg:#1c1810;
  --w-meter-bar:linear-gradient(180deg,#ffd24d,#c98a1a);
  --w-cell:rgba(255,250,235,.6);
}
.cpx-scope[data-widget="minimal"]{
  --w-knob:#e8ebef;
  --w-knob-ring:inset 0 0 0 1px #b6bdc7;
  --w-knob-shadow:none;
  --w-track:#d8dde3;
  --w-track-ring:inset 0 0 0 1px #b6bdc7;
  --w-handle:#ffffff;
  --w-handle-ring:inset 0 0 0 1px #b6bdc7;
}
/* 面板外壳(仅工坊面板用;模块实例不带 cpx-root) */
.cpx-root{
  display:flex;flex-direction:column;height:100%;min-height:0;
  font-family:system-ui,"Microsoft YaHei",sans-serif;color:var(--cpx-text);
}
.cpx-head{display:flex;align-items:center;gap:6px;padding:7px 9px;
  border-bottom:1px solid rgba(127,127,127,.35);background:rgba(127,127,127,.08);}
.cpx-nametag{font-size:10px;opacity:.65;white-space:nowrap;}
.cpx-name{flex:1;min-width:0;background:transparent;border:none;color:inherit;
  border-bottom:1px dashed rgba(127,127,127,.55);font-weight:700;font-size:12.5px;
  padding:1px 3px;outline:none;font-family:inherit;}
.cpx-name:focus{border-bottom-style:solid;border-bottom-color:var(--cpx-accent);}
.cpx-grid{flex:1;min-height:0;overflow-y:auto;display:grid;gap:6px;
  padding:6px;align-content:start;justify-content:start;}
.cpx-cell{position:relative;border:1px solid rgba(127,127,127,.4);border-radius:8px;
  background:var(--w-cell);padding:3px 2px;display:flex;flex-direction:column;
  align-items:center;gap:2px;overflow:hidden;box-sizing:border-box;}
.cpx-cell.sel{outline:calc(var(--cpx-box)/36) solid var(--cpx-accent);outline-offset:-1px;}
.cpx-label{font-size:8.5px;line-height:1.2;color:var(--cpx-text);opacity:.75;width:96%;
  text-align:center;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}
.cpx-x{position:absolute;right:3px;top:2px;color:inherit;opacity:.5;cursor:pointer;
  font-size:10px;line-height:1;width:12px;text-align:center;}
.cpx-x:hover{opacity:1;color:#e04040;}
.cpx-empty{grid-column:1 / -1;color:var(--cpx-text);opacity:.6;font-size:10.5px;
  text-align:center;padding:14px 6px;line-height:1.8;white-space:pre-line;}
.cpx-knob{width:calc(var(--cpx-box)*.56);height:calc(var(--cpx-box)*.56);border-radius:50%;
  position:relative;cursor:ns-resize;flex:0 0 auto;
  background:var(--w-knob);box-shadow:var(--w-knob-ring),var(--w-knob-shadow);}
.cpx-kptr{position:absolute;left:50%;top:11%;width:calc(var(--cpx-box)*.035 + 1px);
  height:26%;margin-left:calc((var(--cpx-box)*.035 + 1px)/-2);
  border-radius:2px;background:var(--cpx-accent);box-shadow:0 0 4px var(--cpx-accent);}
.cpx-val{font-size:9px;color:var(--cpx-accent);font-weight:700;font-variant-numeric:tabular-nums;}
.cpx-fader{position:relative;flex:1;width:calc(var(--cpx-box)*.15);min-height:34px;
  border-radius:5px;cursor:ns-resize;background:var(--w-track);box-shadow:var(--w-track-ring);}
.cpx-fhandle{position:absolute;left:50%;width:calc(var(--cpx-box)*.3);height:calc(var(--cpx-box)*.15);
  transform:translate(-50%,-50%);border-radius:3px;background:var(--w-handle);
  box-shadow:var(--w-handle-ring),0 1px 3px rgba(30,40,60,.35);cursor:grab;}
.cpx-sw{width:calc(var(--cpx-box)*.42);height:calc(var(--cpx-box)*.24);border-radius:999px;
  cursor:pointer;position:relative;flex:0 0 auto;
  background:var(--w-sw-off);box-shadow:inset 0 0 0 1px var(--w-sw-off-ring);transition:background .15s;}
.cpx-sw.on{background:var(--w-sw-on);box-shadow:inset 0 0 0 1px var(--w-sw-on-ring);}
.cpx-sw .cpx-swdot{position:absolute;top:2px;left:2px;
  width:calc(var(--cpx-box)*.24 - 4px);height:calc(var(--cpx-box)*.24 - 4px);border-radius:50%;
  background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.35);transition:left .15s;}
.cpx-sw.on .cpx-swdot{left:calc(100% - var(--cpx-box)*.24 + 2px);}
.cpx-meter{position:relative;flex:1;width:calc(var(--cpx-box)*.2);min-height:34px;border-radius:4px;
  background:var(--w-meter-bg);box-shadow:inset 0 0 0 1px #000;
  display:flex;align-items:flex-end;overflow:hidden;}
.cpx-mbar{width:100%;background:var(--w-meter-bar);height:0%;}
`;
