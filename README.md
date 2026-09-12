# AetherSynth · 网格模块减法合成器

**中文** | [English](README.en.md)

纯前端 Web Audio 模块化合成器:像搭真机一样,在网格画布上放置组件(振荡器、
滤波器、音序器、鼓机、效果器……),用 3.5mm 线缆连接搭棚,弹出自己的声音;
还能在「组件工坊」里设计个性化组件。

**在线试用:<https://suulnnka.github.io/AetherSynth/>**

## 运行

```bash
npm start        # 启动开发服务器 → http://127.0.0.1:8642
npm test         # 运行单元测试(Node 内置 test runner,零依赖)
```

> ES Modules 必须通过 http(s) 访问,不能直接双击 index.html(file:// 会被 CORS 拦截)。

## 怎么玩

1. 从左侧组件栏把组件拖进画布(时钟、VCO、VCF、VCA、包络、音序器、鼓机、喇叭……)
2. 从组件的输出口拖一根线到另一个组件的输入口——接错就拔,点线缆删除
3. 「歌曲」菜单内置多首示例:三件套流行乐、Minimoog / Model D 音色曲、
   FM 钟琴、8-bit 长曲「像素远征」,以及把 NES 音源 NSF 文件离线转谱还原的
   「NSF 转谱 · 四轨全曲」(4 轨 × 16 小节钢琴卷帘 × 4 乐段,段选器自动轮换)
4. 右键组件的接口 / 控件可「发送到工坊」,把它变成自制组件的素材
   (自制组件右键可重新编辑);Del 删除,Ctrl+D 复制,Shift 多选后可「封装为组合」
5. 画布自动存档(localStorage),菜单可导出 / 导入 JSON

## 目录结构

```
├── index.html            页面骨架(顶栏 / 侧栏 / 画布 / 工坊 / 帮助)
├── styles/               样式,按界面区域拆分
│   ├── base.css          变量 / 顶栏 / 状态栏 / 弹层
│   ├── palette.css       左侧组件栏
│   ├── canvas.css        画布 / 模块外壳 / 接口 / 螺丝 / 线缆
│   ├── widgets.css       模块内容区小部件(旋钮 / 推子 / 琴键 / 屏幕…)
│   └── studio.css        组件工坊面板与自制组件内容网格
├── scripts/serve.js      零依赖静态服务器(npm start)
├── src/
│   ├── main.js           入口:装配各层 + window.SYNTH 调试 API
│   ├── core/             与具体组件无关的内核
│   │   ├── state.js      全局可变状态(mods / cables / 视图 / 交互光标)
│   │   ├── audio.js      AudioContext 单例(可重建切采样率)/ Mon / 噪声缓冲
│   │   ├── ports.js      外壳排版常量与接口定位(纯函数)
│   │   ├── registry.js   组件定义注册表 + 信号类型表
│   │   ├── flow.js       活跃度计算(纯函数)+ DOM 应用
│   │   ├── save.js       存档防抖写盘(序列化函数反向注册,避免环)
│   │   ├── view.js       平移 / 缩放 / 格距
│   │   ├── selection.js  单选 / Shift 多选
│   │   ├── cables.js     线缆创建 / 删除 / SVG 绘制
│   │   ├── module.js     Mod 基类与生命周期
│   │   ├── composite.js  组合模块(封装 / 解体)
│   │   ├── serialize.js  补丁序列化 / 反序列化 / 导入导出
│   │   ├── loop.js       双驱动主循环(rAF + 音频线程泵)
│   │   └── engine.js     采样率切换(序列化 → 重建引擎 → 还原)
│   ├── kit/              模块内容区小部件套件(旋钮 / 推子 / 开关 / 触控板 / 琴键 / 屏幕)
│   ├── modules/          内置组件定义,按类别一文件:
│   │   ├── controls.js   旋钮 / 推子 / 触控板 / 开关 …
│   │   ├── keyboard.js   MIDI 键盘
│   │   ├── sequencer.js  MIDI 音序器(1024 步)+ 钢琴卷帘(C2~C6,1~16 小节)
│   │   ├── sources.js    VCO / FM / LFO(SYNC 相位硬同步、空占比)/ 噪声 / 麦克风
│   │   ├── clock.js      时钟(BPM / 空占比 / RST 复位)
│   │   ├── drums.js      底鼓 / 军鼓 / 踩镲
│   │   ├── processors.js VCF / VCA / ADSR / 延迟 / 量化 / S&H / 放大器 / 一分八 …
│   │   ├── effects.js    压限器 / 比特量化 / 重采样
│   │   ├── math.js       数字运算组件工厂(加 / 减 / 乘 / 除 / 选择器…)
│   │   ├── outputs.js    立体声喇叭 / 示波器 / 频谱仪 / XY / 录音机
│   │   └── index.js      总装:注册 + 侧栏顺序
│   ├── workshop/         组件工坊:UI 布局编辑器(按格拖拽排版)
│   │   ├── panel.js        CompactPanel 控件格渲染(可独立复用)
│   │   ├── panel-styles.js 控件格样式(独立注入)
│   │   ├── layout.js       布局模型(格位 / 吸附 / 尺寸,纯函数可单测)
│   │   ├── custom-def.js   布局规格 → 真组件定义(含端口绑定注入/监视)
│   │   ├── studio.js       工坊面板:添加 / 拖拽排版 / 属性检查器 / 保存放置
│   │   └── designs.js      设计清单(我的组件)/ 放置 / 删除
│   ├── palette/          左侧组件栏渲染
│   ├── songs/            示例歌曲数据 / 搭棚 / 演示音色
│   ├── interactions/     画布指针 / 全局键盘 / 右键菜单
│   └── ui/               工具条 / 状态栏 / toast / tooltip / 窗口组件(window.js:
│                         AppWindow + confirmDialog/alertDialog,全部弹窗的统一承载)
└── tests/                node:test 单元测试(纯逻辑层)
```

## 架构要点

- **分层单向依赖**:`utils/state → ports/registry/flow → audio → cables → module → composite`,
  上层(模块定义、工坊、交互、UI)只向下依赖;少量反向需求用回调解耦
  (如 `save.js` 的序列化函数、`view.js` 的格距变化监听由 main 注入)。
- **可测试性**:端口排版、活跃度 BFS、工坊规格→端口/尺寸换算、歌曲数据校验
  等纯逻辑与 DOM / 音频完全分离,直接跑在 Node 里(`npm test`)。
- **音频上下文活绑定**:`audio.js` 以 `export let ctx` 导出引擎,采样率切换
  整体重建实例,所有引用方自动看到新引擎;补丁先序列化再原样还原。
- **扩展新组件**:在 `src/modules/` 对应分类文件里加一个 def(必要时新建
  分类文件并在 `modules/index.js` 注册),端口类型在 `registry.js` 的
  `PORT_TYPES` 声明,信号来路在 `flow.js` 的 `FLOW` 声明(信号源组件免声明)。
- **扩展工坊控件**:在 `panel.js` 的 `mkCell` 加一种控件 kind,在
  `custom-def.js` 的 `customLayout` 里为它映射端口方向即可。
