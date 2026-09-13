# Reaktor 6 内建模组清单

> 记录 Native Instruments Reaktor 6 开箱即带的建模资源,供本项目组件设计参考。
>
> 查证时间:2026-09-12(Reaktor 6 最新版 6.5,2023-04)。
> 说明:NI 文档站已改版,"完整模块参考"没有公开的单一网页清单;本文基于官方手册
> (Getting Started / What Is New / Building in Primary)与长期使用知识整理。
> **Primary/Core 的逐个模块名以软件内 Library 浏览器与 Module Reference 为准**,本文列出的是
> 各类别的代表性/常见模块;Blocks 与自带乐器部分则有官方页面佐证。

## 一、体系概览

Reaktor 的"内建模组"分五个层次,粒度从细到粗:

| 层次 | 是什么 | 粒度类比 |
|------|--------|----------|
| Primary 模块 | 原语级模块,事件流 + 音频流两种信号 | ≈ Max/MSP 的对象 |
| Core Cell / Core 模块 | 样本级编程的更底层原语(Core 是编译优化的) | ≈ gen~/codebox |
| 工厂宏库 | 官方预制宏(Bandlimited 振荡器、Ladder 滤波、压缩器等) | ≈ 现成子程序 |
| **Blocks** | 模块合成器风格的宏面板(6.0 主打),接"虚拟 Eurorack" | ≈ VCV Rack 模块 |
| Factory Library | 70+ 台成品乐器/效果(Ensemble) | ≈ VCV 的完整音色机架 |

结构层级:Ensemble(工程)→ Instrument(乐器)→ Cell/ Macro(宏)→ Module(原语)。
信号分两种:**事件流**(控制率,类似 Max)与**音频流**(采样率,类似 MSP),模块名按类别组织。

## 二、Primary 原语模块(按浏览器分类)

### Panel(面板 UI)

`Knob`(旋钮)、`Fader`(推子)、`Button`(按钮)、`Switch`(开关)、`List`(列表)、`Enumeration`(枚举)、`Multi Display`(多波形显示)、`Poly Display`(复音显示)、`LCD Scope`(示波器)、`XY`(XY 板)、`Event Table`(事件表)、`Audio Table`(音频表)、`Picture`(图片)、`Text`(文本)、`Mouse X` / `Mouse Y`(鼠标坐标)。

> 6.0 重构了表格框架(Event/Audio Table 系列新模块),6.0.3 给 Multi/Poly Display 加了抗锯齿线对象,并新增 GUI Core Cell 与 Structure Comment 模块。

### LFO / Oscillator(振荡器)

`Sine`(正弦)、`Saw`(锯齿)、`Tri`(三角)、`Pulse`(脉冲/方波)、`Ramp`(斜坡)、`Impulse`(冲激)、`Sine FM`(相位调制正弦)、`Multi Wave`(波表)、`Noise`(白噪声)、`Pink Noise`(粉噪声)。
所有振荡器可作 LFO 用(降频);限带振荡器在工厂宏库里(Bandlimited 系列)。

### Envelope(包络)

`AD`、`AHD`、`AR`、`ASR`、`ADSR`、`DAHDSR`(带延迟/保持的全功能包络)、`Env`(多段可编辑包络)。

### Filter(滤波器)

经典系列:`1-Pole LP`、`2-Pole LP/HP/BP`、`4-Pole LP/HP`、`Allpass`、`Comb`(梳状)。
6.0 新增 **ZDF(零延迟反馈)系列**滤波模块(更接近模拟响应,支持音频级截止调制)。

### DSP(音频处理)

`Amp`(增益)、`Audio Switch`(切换)、`Cross Fade`(交叉淡化)、`Wave Shaper`(波形整形失真)、`Env Follower`(包络跟随)、`Latch`(事件锁存音频)。
采样类模块:`Sampler`(基础采样回放)、`Sampler Loop`(循环)、`Sampler Stretch`(拉伸/颗粒)、`Sample Lookup`(查表读取)——配合 `Audio Table` 存放采样。

### Math(数学)

四则与比较:`Add` `Sub` `Mul` `Div` `Mod` `Min` `Max` `Abs` `Compare`;函数:`Sqrt` `Exp` `Ln` `Log` `Sin` `Cos` `Tan`;取整:`Round` `Ceil` `Floor`。

### MIDI(输入输出)

`Note Pitch` / `Note Gate` / `Note Velocity`(音符三件套)、`Note+`(三合一)、`Controller`(CC)、`Pitch Bend`(弯音)、`Channel Message`(原始通道消息)、`Clock`(MIDI 时钟同步)、`Song Pos`(乐曲位置)、`MIDI In` / `MIDI Out`(原始字节流收发)。

### Event(事件处理)

`Hold`(保持)、`Value`(存储)、`Order`(决定触发顺序)、`Step Filter`(步进过滤)、`Timer`(定时)、`Gate Engine`(门限引擎,做节奏门控)、`Router`(按值路由)、`Selector`(多选一)、`Switch`(开关)、`A to E`(音频转事件)、`Compare`(比较)。

### Structure(结构)

`Macro`(宏容器)、`IC Send` / `IC Receive`(内部时钟收发,跨层级通信)、`Snap Value` / `Snap Address`(快照读写,做 presets)。

## 三、Core 层

Core Cell 内部的原语比 Primary 更细、样本级调度、编译优化:

- 端口/信号:`In`/`Out`(音频/事件/核心端口)、`Rx`/`Tx`(总线收发)、**Bundles 与 Scoped Bus(6.0 新增的总线机制)**;
- 流程:`Latch`(锁存)、`Order`(排序)、`Merge`(合并)、`Router`(路由)、`Compare`(比较)、`Constant`/`Scalar`(常量);
- 信号变换:`AtoE` / `EtoA`(音频↔事件)、`z^-1`(单位延迟,反馈滤波的基础);
- 存取:`Read` / `Write` / 插值读取(数组/表格访问)、采样率与控制率时钟模块(6.0 新增)。

Core 之上还有**工厂 Core 宏库**(限带振荡器、ZDF/Ladder 滤波、各种包络、立体声效果等),Monark、Prism 等官方乐器的核心算法即由这些宏搭建。

## 四、Blocks(6.0 主打:虚拟 Eurorack 宏面板)

Blocks 本质是"带 Eurorack 面板的官方宏",统一 3.5mm 插口风格,CV/Gate 互连,在 **Rack(机架)** 中拼装。完整清单随 6.0→6.3 持续扩充(以软件内浏览器为准),确定内容包括:

- **Bento Box 家族**(8 个,6.0 的一站式基础套件):`OSC`(振荡器)、`FLT`(滤波)、`AMP`(放大)、`ENV`(ADSR 包络)、`LFO`、`MIX`(混音)、`SEQ`(8 步音序器)、`S&H:CV`(采样保持/CV 处理);
- **MONARK 系列**:`MONARK OSC` / `MONARK FLT` / `MONARK ENV`(把 Monark 合成器的振荡器、滤波器、包络拆成的单模块);
- 后续版本新增:`Shift Sequencer`、`Curve Sequencer`、`Duality OSC`、`Morph` 等音序器/振荡器/变形类模块;
- 免费的 **Blocks Base**(Komplete Start 附带)是其中基础块的子集。

> 注意:Toybox、Sonus Modular、Hyperspace、Nanomod 等是 NI 商店里销售的**第三方** Blocks 包,不属于内建。

## 五、Factory Library(70+ 台成品乐器/效果)

官方宣称 70+ 个成品 Ensemble,代表作品:

| 类型 | 名称 | 说明 |
|------|------|------|
| 合成器 | **Monark** | 业界标杆的经典单音合成器复刻(单音模拟风) |
| 合成器 | **Prism** / **Mikro Prism** | 共振峰/模态合成(铃铛般质感) |
| 合成器 | **Razor** | 加法合成 + 失真(电子风格) |
| 合成器 | **Skanner XT** | 采样+扫描合成 |
| 合成器 | **The Mouth** | 人声驱动的口哨/和声合成 |
| 合成器 | **Forms** | 粒子/循环采样合成器 |
| 合成器 | **Rounds** | 数字有机音色(手风琴式声部) |
| 合成器 | **Kontour** | 双振荡器复音合成 |
| 鼓机 | **Spark** | 鼓组创作系统 |
| 效果 | **The Finger** | 手势驱动的 multipoint 特效 |
| 效果 | **Drivers** | 滤波/驱动特效 |
| 经典库 | Carbon 2、Junatik、Limelight、Lurker、Deep Space、Travelizer、Metaphysical Function、SpaceDrone、SteamPipe 2 等 | 历代工厂合集(合成器/鼓机/氛围/特效) |

另有 **Legacy Library.zip**(R5 时代的经典老库)随安装附带,解压后可加载。用户库(User Library)是社区共享内容,不算内建。

## 六、对本项目的参考价值

- **Blocks ≈ VCV Rack 模块**:同为学生项目组件栏最直接的对照——统一 CV/Gate 电压约定、面板即接口;本项目已有的组件(喇叭/压限器/比特量化)对应 Blocks 的 OUT/FLT/DSP 类,可参考其"输入电平→旋钮→输出"的极简面板布局。
- **Primary ≈ Max 对象**:粒度最细,适合参考其**事件流 vs 音频流双信号体系**与 `A to E` 这类跨率桥接设计。
- Reaktor 的 Snapshot(快照)系统与 IC Send/Receive 跨层级通信,是"预设管理/参数总线"两个功能的成熟范本。

## 来源

- [NI — Reaktor 产品页(Factory Library 70+、Monark Blocks)](https://www.native-instruments.com/products/reaktor)
- [REAKTOR 6 Getting Started(官方手册 PDF)](https://docs.native-instruments.com/pdf-guides/REAKTOR_6_Getting_Started_English_0419.pdf)
- [REAKTOR 6 What Is New(官方手册 PDF,6.0–6.3 新增)](https://docs.native-instruments.com/pdf-guides/REAKTOR_6_What_Is_New_English_0419.pdf)
- [REAKTOR 6 Building in Primary(官方手册 PDF)](https://docs.native-instruments.com/pdf-guides/REAKTOR_6_Building_in_Primary_English_0419.pdf)
- [Wikipedia — Reaktor](https://en.wikipedia.org/wiki/Reaktor)
- [NI 社区 — Reaktor 6 完整版自带什么乐器](https://community.native-instruments.com/discussion/51003/what-synths-ensembles-does-reaktor-6-full-version-come-with)
- [REAKTOR Blocks Quickstart](https://www.native-instruments.com/pages/reaktor-blocks-quickstart)
