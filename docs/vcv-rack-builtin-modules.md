# VCV Rack 内建模块清单(Core + VCV Free)

> 记录 VCV Rack 开箱即带的全部模块,供本项目(网页版模块合成器)组件设计参考。
>
> 查证时间:2026-09-12;来源:VCV Library 与官方源码。
> - **VCV Core** v2.5.2 —— 系统插件,随 Rack 本体安装,不可卸载
> - **VCV Free**(插件 slug 仍为 `Fundamental`)v2.6.4 —— 随 Rack 默认下载安装
>
> `slug` 是模块在补丁文件(`.vcv`)中的标识符,截图文件名即按 slug 命名。

## 一、VCV Core(12 个)

音频接口与 MIDI 接口,以及机架排版小工具。没有 Core,Rack 无法与声卡/MIDI 设备通信。

| # | 模块名 | slug | 功能 |
|---|--------|------|------|
| 1 | Audio 2 | `AudioInterface2` | 2 进 2 出音频接口,连接电脑声卡 |
| 2 | Audio 8 | `AudioInterface` | 8 进 8 出音频接口 |
| 3 | Audio 16 | `AudioInterface16` | 16 进 16 出音频接口 |
| 4 | MIDI to CV | `MIDIToCVInterface` | MIDI 输入 → V/oct 音高、Gate、力度等 CV/Gate,支持单音/复音/轮转等多种通道分配模式 |
| 5 | MIDI CC to CV | `MIDICCToCVInterface` | MIDI CC 控制器(旋钮/推子/踏板)→ CV 电压 |
| 6 | MIDI to Gate | `MIDITriggerToCVInterface` | MIDI 音符 → 多路 Gate/触发(鼓机式) |
| 7 | MIDI Map | `MIDI-Map` | 把 MIDI CC 映射到机架中任意模块的旋钮/推子,实现硬件遥控 |
| 8 | CV to MIDI | `CV-MIDI` | Rack 的 CV/Gate → MIDI 输出,发给外部硬件 |
| 9 | CV to MIDI CC | `CV-CC` | CV → MIDI CC 输出 |
| 10 | Gate to MIDI | `CV-Gate` | Gate/触发 → MIDI 音符输出 |
| 11 | Blank | `Blank` | 空白面板,用于排版留白 |
| 12 | Notes | `Notes` | 便签,可在机架里写文字说明 |

## 二、VCV Free / Fundamental(37 个)

基础合成器模块套装,GPL-3.0 开源。按功能分组:

### 振荡器 / LFO

| 模块名 | slug | 功能 |
|--------|------|------|
| VCO | `VCO` | 8 种算法的压控振荡器(基本波形、波表、FM、模拟仿真等) |
| VCO 2 | `VCO2` | 双振荡器波表 VCO,支持波形变形 |
| LFO | `LFO` | 8 种算法的低频振荡器 |
| LFO 2 | `LFO2` | 双振荡器波表 LFO |

### 滤波 / 动态 / 包络

| 模块名 | slug | 功能 |
|--------|------|------|
| VCF | `VCF` | 12 dB 状态变量滤波器(低通/高通/带通) |
| VCA | `VCA-1` | 线性压控放大器 |
| VCA 4 | `VCA` | 4 通道 VCA 混音器,带声像 |
| ADSR EG | `ADSR` | ADSR 包络发生器,带循环模式 |

### 效果

| 模块名 | slug | 功能 |
|--------|------|------|
| Delay | `Delay` | 双通道延迟效果,带滤波与 LFO 调制 |

### 混音 / 路由 / 信号复制

| 模块名 | slug | 功能 |
|--------|------|------|
| Mix | `Mixer` | 4 通道调音台,带静音/独奏/声像 |
| VCA Mix | `VCMixer` | 4 通道 VCA 调音台,带静音/独奏/声像/辅助发送 |
| CV Mix | `CVMix` | 2 通道 CV 控制混音器 |
| Fade | `Fade` | 2 通道交叉渐变器,CV 控制 |
| Split | `Split` | 1 路输入 → 多路输出(分线) |
| Merge | `Merge` | 多路输入 → 1 路输出(合线) |
| Mult | `Unity` | 信号复制器(1 入多出) |
| Sum | `Sum` | 多路信号求和 |
| Sequential Switch 1 to 4 | `SequentialSwitch1` | 顺序切换:1 路输入轮流分发到 4 路输出 |
| Sequential Switch 4 to 1 | `SequentialSwitch2` | 顺序切换:4 路输入轮流汇聚到 1 路输出 |
| Mid/Side | `MidSide` | 立体声 L/R ↔ Mid/Side 编解码 |

### 调制 / 工具

| 模块名 | slug | 功能 |
|--------|------|------|
| 8vert | `8vert` | 8 路衰减/反转衰减器 |
| Octave | `Octave` | 八度移位 |
| Quantizer | `Quantizer` | 音阶量化器,支持自定义音阶 |
| Random | `Random` | 随机电压/采样保持发生器,带多种输出 |
| Noise | `Noise` | 白噪声/粉噪声发生器 |
| Random Values | `RandomValues` | 由触发产生随机电压 |
| Rescale | `Rescale` | 电压缩放与偏移 |
| Logic | `Logic` | 布尔逻辑运算(AND/OR/XOR 等,组合 Gate 信号 A/B) |
| Compare | `Compare` | CV 比较器与限幅器 |
| Gates | `Gates` | Gate/触发信号处理器 |
| Process | `Process` | 通用信号处理器 |
| Mutes | `Mutes` | 8 路静音按钮 |
| Pulses | `Pulses` | 手动触发按钮组 |
| Push | `Push` | 瞬时按钮,输出 Gate 与触发 |
| SEQ 3 | `SEQ3` | 3 行 × 8 步音序器,内置量化 |
| Sample & Hold Analog Shift Register | `SHASR` | 8 级采样保持/模拟移位寄存器 |

### 可视化

| 模块名 | slug | 功能 |
|--------|------|------|
| Scope | `Scope` | 双通道示波器,支持 XY 模式 |
| Viz | `Viz` | 信号可视化面板 |

## 三、备注

- Rack 2.x 默认只带上述两个插件;Befaco、Audible Instruments 等开源插件虽免费,但需在 Library 中另行订阅下载。
- `Fundamental` 插件在 2025 年起品牌更名为 **VCV Free**,但 slug、代码仓库(`VCVRack/Fundamental`)不变,旧补丁不受影响。
- 项目早期(0.6.x 时代)Core 中的 "MIDI Interface"、"Audio" 等旧模块已被上述模块取代。

## 来源

- [VCV Library — VCV Core](https://library.vcvrack.com/Core)
- [VCV Library — VCV Free (Fundamental)](https://library.vcvrack.com/Fundamental)
- [VCV Free 产品页(模块简介)](https://vcvrack.com/Free)
- [VCVRack/Rack 源码(Core 插件)](https://github.com/VCVRack/Rack/tree/v2/src/core)
- [VCVRack/Fundamental 源码](https://github.com/VCVRack/Fundamental)
- [VCV 社区:Compare / Gates / Logic / Process发布公告](https://community.vcvrack.com/t/vcv-compare-gates-logic-and-process/17828)
