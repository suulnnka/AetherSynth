# Max/MSP 内建对象清单

> 记录 Cycling '74 Max(含 MSP)开箱即带的内建对象,供本项目组件设计参考。
>
> 与 VCV Rack 不同,Max 的"内建模组"是**函数级原语**(一个对象 ≈ 一个运算/工具),不是整机设备;
> 设备级的组合靠 patcher(子程序)自行搭建。完整清单以官方文档的功能分类列表为准
> (Max 7 编写,Max 8/9 核心沿用,后续新增单列),查证时间 2026-09-12。

## 一、对象体系概览

| 子系统 | 命名特征 | 职责 |
|--------|----------|------|
| Max | 无后缀 | 控制层:数字/消息/事件调度(默认按调度器时间执行) |
| MSP | `~` 后缀 | 信号层:采样率音频信号处理(每个 vector 逐样本计算) |
| Jitter | `jit.*` | 视频/矩阵/3D 图形(数百个对象,本文不展开) |
| Gen | `gen` / `gen~` / `codebox` | 样本级编译算法(gen~ 跑音频,jit.gen/jit.pix 跑纹理) |
| MC | `mc.*` | 多通道音频处理(Max 8 引入,任意 MSP 对象可加 mc. 前缀) |
| RNBO | `rnbo~` 等 | 补丁导出为 C++/音频插件(Max 9 引入) |

## 二、MSP 信号对象(约 200 个,17 类)

### Analysis(分析)

| 对象 | 说明 |
|------|------|
| `snapshot~` | 把信号在某一刻转成控制值(信号→数字的桥梁) |
| `capture~` | 捕获一段信号样本供查看 |
| `change~` | 值变化时才报告 |
| `count~` | 统计样本计数 |
| `edge~` | 检测信号过沿(上升/下降) |
| `fzero~` | 基频检测 |
| `maximum~` `minimum~` `minmax~` | 逐样本比较/统计最大最小 |
| `peakamp~` | 峰值幅度 |
| `spike~` | 瞬态尖峰检测 |
| `sync~` | 信号同步检测 |
| `thresh~` | 阈值越限检测(带迟滞) |
| `zerox~` | 过零检测 |

### Delays(延迟)

| 对象 | 说明 |
|------|------|
| `delay~` | 固定时长信号延迟 |
| `tapin~` / `tapout~` | 延迟线 + 多抽头读取(做回声/混响的基础) |

### Dynamics(动态)

| 对象 | 说明 |
|------|------|
| `omx.comp~` | 压缩器(遗留 omx 家族) |
| `omx.peaklim~` | 峰值限制器 |
| `omx.4band~` / `omx.5band~` | 多段处理器 |

### FFT(频谱)

| 对象 | 说明 |
|------|------|
| `fft~` / `ifft~` | 快速傅里叶正/逆变换 |
| `pfft~` + `fftin~` / `fftout~` | 分区( partitioned )FFT 处理框架,子 patch 里改频谱 |
| `cartopol~` / `poltocar~` | 直角坐标 ↔ 极坐标 |
| `frameaccum~` `framedelta~` `frameaverage~` `framesmooth~` | 频谱帧的累加/差分/平均/平滑 |
| `fbinshift~` | 频谱 bin 平移 |
| `gizmo~` | 频谱域音高移位 |
| `phasewrap~` | 相位折叠 |
| `vectral~` | 帧数据向量处理 |
| `fftinfo~` | 查询 FFT 参数 |

### Filters(滤波)

| 对象 | 说明 |
|------|------|
| `biquad~` | 双二阶滤波器(万能滤波核心) |
| `onepole~` | 单极点低通 |
| `svf~` | 状态变量滤波器(LP/HP/BP) |
| `lores~` | 谐振低通 |
| `reson~` | 谐振带通 |
| `allpass~` | 全通 |
| `comb~` | 梳状滤波 |
| `teeth~` | 双梳状滤波 |
| `cascade~` | 级联滤波组 |
| `cross~` | 二分频交叉滤波(低/高两路输出) |
| `fffb~` | 固定滤波器组 |
| `hilbert~` | 希尔伯特变换 |
| `phaseshift~` | 相位移动 |
| `slide~` | 斜率限制(平滑) |
| `buffir~` | 用 buffer 作冲激响应的 FIR |
| `filtercoeff~` | 生成 biquad~ 系数 |

### Functions(信号函数/包络)

| 对象 | 说明 |
|------|------|
| `line~` | 分段线性斜坡(信号级) |
| `curve~` | 分段曲线斜坡 |
| `adsr~` | ADSR 包络 |
| `sig~` | 常数信号 |
| `rand~` | 随机斜坡信号 |
| `count~` | 信号级计数器 |
| `seq~` | 按序列读函数值 |
| `techno~` | 律动包络(鼓组风格) |
| `trapezoid~` `triangle~` `zigzag~` | 梯形/三角/锯齿形包络形状 |

### Generators(发生器)

| 对象 | 说明 |
|------|------|
| `sah~` | 采样保持 |

### Input-Output(输入输出)

| 对象 | 说明 |
|------|------|
| `dac~` / `adc~` | 音频输出/输入(多通道) |
| `ezdac~` / `ezadc~` | 一键式立体声输出/输入(UI) |
| `adoutput~` | 音频驱动输出(遗留) |
| `sfplay~` / `sfrecord~` | 声音文件播放/录制 |
| `sfinfo~` / `sflist~` | 声音文件信息/列表 |
| `rewire~` | ReWire 通道 |

### Modifiers(修饰器)

| 对象 | 说明 |
|------|------|
| `clip~` | 限幅 |
| `deltaclip~` | 限制相邻样本变化量 |
| `delta~` | 一阶差分 |
| `degrade~` | 比特深度/采样率劣化(比特粉碎) |
| `downsamp~` | 降采样 |
| `freqshift~` | 频率移位 |
| `normalize~` | 归一化到峰值 |
| `overdrive~` | 过载失真 |
| `pong~` | 折叠反射到区间内 |
| `rampsmooth~` | 斜坡平滑 |
| `rate~` | 变速播放信号(重采样式时间伸缩) |
| `round~` / `trunc~` | 按间隔取整/截断 |

### Operators(运算符,约 50 个)

逐样本信号数学运算:`+~` `-~` `*~` `/~` `%~` `!-~` `!/~`(反转操作数)`==~` `!=~` `>~` `>=~` `<~` `<=~` `abs~` `sqrt~` `pow~` `log~` `sin~` `cos~` `tan~` `asin~` `acos~` `atan~` `atan2~` `sinh~` `cosh~` `tanh~` `asinh~` `acosh~` `atanh~` `sinx~` `cosx~` `tanx~` `bitand~` `bitor~` `bitxor~` `bitnot~` `bitshift~`。

| 专用换算 | 说明 |
|----------|------|
| `mtof~` / `ftom~` | MIDI 音高号 ↔ 频率 |
| `atodb~` / `dbtoa~` | 线性幅度 ↔ dB |
| `avg~` / `average~` | 短时均值 / 按时间窗求均值 |

> 注:`cos~` 等基础三角函数输入为弧度;`cosx~` 等 `x` 版本输入为周期(0–1 相位),常与 `phasor~` 搭配。

### Plug-ins(插件宿主)

| 对象 | 说明 |
|------|------|
| `vst~` | VST 插件宿主 |
| `plugin~` / `plugout~` | 把 patch 本身封装成宿主内的插件 |
| `plugsend~` / `plugreceive~` | 插件侧参数/音频交换 |
| `plugsync~` / `plugphasor~` | 宿主同步 |
| `hostcontrol~` `hostphasor~` `hostsync~` | 作为宿主插件运行时的同步控制 |

### Polyphony(复音)

| 对象 | 说明 |
|------|------|
| `poly~` | 复音实例管理器(克隆子 patch,自动分配声部) |
| `in` / `in~` / `out` / `out~` | 子 patch 的输入/输出口 |
| `thispoly~` | 实例自身状态(繁忙/静音) |

### Routing(路由)

| 对象 | 说明 |
|------|------|
| `gate~` | 信号门(1 入分发) |
| `selector~` | 多路选 1 |
| `matrix~` | 多入多出路由矩阵 |
| `send~` / `receive~` | 无线信号收发 |

### Sampling(采样)

| 对象 | 说明 |
|------|------|
| `buffer~` | 采样缓冲区(内存中的音频) |
| `polybuffer~` | 多缓冲区集合 |
| `play~` | 按相位播放 buffer |
| `groove~` | 变速变调播放 |
| `wave~` | 波表播放(多相位指针,带 UI) |
| `2d.wave~` | 二维波表播放/查看 |
| `index~` | 按索引读取 |
| `lookup~` | 用 buffer 做传递函数查表 |
| `peek~` / `poke~` | 读/写 buffer 单个样本 |
| `info~` | buffer 信息(长度、采样率等) |
| `record~` | 录入 buffer |
| `chucker~` | 唱片机式播放 |
| `stutter~` | 结巴重复效果 |

### Synthesis(合成振荡器/噪声)

| 对象 | 说明 |
|------|------|
| `cycle~` | 正弦/波表振荡器(输入=频率) |
| `phasor~` | 锯齿相位发生器(0–1 斜坡) |
| `saw~` | 锯齿振荡器 |
| `rect~` | 矩形(方)波振荡器 |
| `tri~` | 三角波振荡器 |
| `train~` | 脉冲串(可调脉宽) |
| `kink~` | 波形"扭曲"整形 |
| `noise~` | 白噪声 |
| `pink~` | 粉噪声 |
| `click~` | 单样本脉冲 |
| `oscbank~` / `ioscbank~` | 加法合成振荡器组 |

### System(系统)

| 对象 | 说明 |
|------|------|
| `dspstate~` | DSP 状态(采样率/向量大小) |
| `dsptime~` | DSP 时间 |
| `sampstoms~` / `mstosamps~` | 样本数 ↔ 毫秒换算 |
| `mute~` | 静音子 patch 以省 CPU |
| `adstatus` | 音频驱动状态 |
| `pass` | — |

### User Interface(信号 UI)

| 对象 | 说明 |
|------|------|
| `scope~` | 示波器 |
| `spectroscope~` | 频谱仪 |
| `waveform~` | buffer 波形显示与编辑 |
| `meter~` / `levelmeter~` | 电平表 |
| `gain~` | 增益推子 |
| `number~` | 信号数字框 |
| `function` | 分段包络编辑器 |
| `filtergraph~` | 滤波曲线编辑器 |
| `plot~` | 绘图 |
| `zplane~` | 零极点滤波器展示 |

## 三、Max 控制对象(约 300 个,17 类)

### Control(流程控制)

| 对象 | 说明 |
|------|------|
| `trigger`(t) | 按指定顺序分发消息(右到左等) |
| `route` / `select` | 按消息头分流 / 匹配输出 bang |
| `gate` / `switch` | 消息门 / 多选一开关 |
| `change` | 值变化时才输出 |
| `counter` | 计数器(范围/方向/倍增丰富) |
| `if` | 条件分支 |
| `match` | 匹配特定列表/模式 |
| `split` | 按数值区间分流 |
| `peak` | 取历史最大值 |
| `uzi` | 高速连发指定次数 |
| `onebang` | 单次放行 bang |
| `togedge` | 翻转输出 0/1 |
| `past` | 某条件持续后才触发 |
| `trough` | 门限式消息通行 |
| `grab` | 拦截其他对象发出的消息 |
| `forward` | 按名字动态转发消息 |
| `universal` | 向全部活动窗口广播 |
| `dict` 家族(`dict.iter` `dict.pack` `dict.route` 等 12 个) | JSON 字典操作 |
| `filterdesign` / `filterdetail` | 设计/查看滤波器系数(供 biquad~) |
| `attrui` / `getattr` | 属性查看与读取 |
| `pvar` | 按名字绑定 UI 值 |
| `patcher` / `thispatcher` | 子 patch / 控制 patch 自身 |

### Data(数据存储)

| 对象 | 说明 |
|------|------|
| `int` / `float` | 数值存储 |
| `coll` | 带索引的集合(可存文件) |
| `table` / `itable` | 表格数据 |
| `text` | 文本/多行数据 |
| `bag` | 可重复数值集合 |
| `histo` | 直方图统计 |
| `funbuff` | 数对查找表 |
| `anal` | 相邻数值对对比(老对象) |
| `borax` | 音符开/关配对统计 |
| `bucket` | 数值逐级下传 |
| `cycle` | 输出轮流分发到各出口 |
| `decode` | 数值→独热位解码 |
| `funnel` / `spray` | 多入口汇总 / 按编号分发 |
| `line` / `bline` | 插值斜坡 / 斜坡逐点 bang |
| `function` | 分段函数编辑器 |
| `preset` | 预设存取 |
| `pattr` `pattrstorage` `autopattr` `pattrhub` `pattrforward` `pattrmarker` | 层级参数管理与预设系统 |
| `qlist` | 消息序列表 |
| `prob` | 概率表 |
| `spell` | 数字转英文单词 |
| `value`(v) | 按名字共享的变量 |
| `nodes` | 节点网络数据 |

### Devices(设备)

| 对象 | 说明 |
|------|------|
| `hi` | HID 设备(手柄/数位板等) |
| `serial` | 串口 |
| `udpsend` / `udpreceive` | UDP 网络收发 |
| `vdp` | — |

### Files(文件)

| 对象 | 说明 |
|------|------|
| `folder` | 列出目录内容 |
| `filein` / `filewatch` | 读文本文件 / 监视文件变化 |
| `filedate` / `filepath` | 文件日期 / 路径查询 |
| `absolutepath` `relativepath` `conformpath` `strippath` | 路径处理 |
| `opendialog` / `savedialog` | 打开/保存对话框 |
| `fontlist` / `onecopy` | 字体列表 / 文件复制 |

### Interaction(交互)

| 对象 | 说明 |
|------|------|
| `key` / `keyup` | 键盘按下/抬起 |
| `mousestate` / `mousefilter` | 鼠标状态/过滤 |
| `modifiers` | 修饰键状态 |
| `numkey` | 小键盘数字 |
| `dialog` | 弹出对话框 |

### Languages(脚本)

| 对象 | 说明 |
|------|------|
| `js` | JavaScript 脚本对象 |
| `mxj` | Java 脚本对象 |

### Lists(列表)

| 对象 | 说明 |
|------|------|
| `pack` / `pak` / `unpack` | 打包/打包(即时触发)/拆包 |
| `join` / `unjoin` | 多入口拼接 / 按数量切分 |
| `iter` | 列表拆成逐个元素 |
| `thresh` | 时间窗口内的元素聚合成列表 |
| `quickthresh` | 快速聚合 |
| `funnel` / `spray` | 汇总 / 分发 |
| `atoi` / `itoa` | 字符 ↔ ASCII 码 |
| `zl` | 列表万能工具子命令组(len/sort/group/iter/reg/sub/lookup/…) |

### Math(数学)

四则与逻辑运算:`+` `-` `*` `/` `%` `!-` `!/` `==` `!=` `>` `>=` `<` `<=` `&` `|` `&&` `||` `<<` `>>` `abs` `acos` `acosh` `asin` `asinh` `atan` `atanh` `atan2` `cos` `cosh` `sin` `sinh` `tan` `tanh` `sqrt` `pow` `exp`。

| 专用对象 | 说明 |
|----------|------|
| `expr` / `vexpr` | C 风格表达式(单值/向量) |
| `accum` | 累加器 |
| `clip` | 限幅 |
| `scale` / `zmap` | 区间映射 |
| `line` / `linedrive` | 插值斜坡 / 指数化斜坡 |
| `drunk` | 醉步随机游走 |
| `random` | 随机数 |
| `urn` | 不重复抽签 |
| `mean` | 平均值 |
| `mtof` / `ftom` | MIDI 音高 ↔ 频率 |
| `atodb` / `dbtoa` | 幅度 ↔ dB |
| `cartopol` / `poltocar` | 直角 ↔ 极坐标 |
| `regexp` | 正则表达式 |

### Messages(消息)

| 对象 | 说明 |
|------|------|
| `message`(msg) | 消息框 |
| `prepend` / `append` / `substitute` | 消息头/尾/片段修改 |
| `sprintf` | 格式化字符串 |
| `send` / `receive` | 无线消息收发(s/r) |
| `loadmess` | 加载时发送消息 |
| `tosymbol` / `fromsymbol` | 符号 ↔ 列表 |

### MIDI(输入输出)

| 对象 | 说明 |
|------|------|
| `notein` / `noteout` | 音符消息 |
| `ctlin` / `ctlout` | 控制器(CC) |
| `pgmin` / `pgmout` | 音色切换 |
| `bendin` / `bendout` | 弯音 |
| `touchin` / `touchout` | 通道压力 |
| `polyin` / `polyout` | 复音触后 |
| `midiin` / `midiout` | 原始 MIDI 字节流 |
| `rtin` | 实时消息(时钟/启停) |
| `sysexin` / `sxformat` | 系统专用消息 |
| `midiinfo` | 设备信息 |
| `midiflush` | 冲掉未配对音符 |
| `xbendin` `xbendin2` `xbendout` `xbendout2` `xnotein` `xnoteout` | 扩展(14 位)弯音/音符 |

### Notes(音符处理)

| 对象 | 说明 |
|------|------|
| `makenote` | 自动补 note-off |
| `stripnote` | 过滤 note-off |
| `sustain` | 延音踏板处理 |
| `flush` | 清除挂起音符 |
| `offer` | 音符开关配对 |
| `poly` | 音符声部分配(送 poly~ 前用) |
| `midiparse` / `midiformat` | MIDI 流解析/组包 |

### Patching(patch 管理)

| 对象 | 说明 |
|------|------|
| `loadbang` / `closebang` / `freebang` | 加载/关闭/释放时触发 |
| `patcherargs` | 读取子 patch 参数 |
| `pcontrol` | 打开/关闭 patch 窗口 |
| `bgcolor` | 改背景色 |
| `loadmess` / `thispatcher` / `patcher` | (见上) |

### Right-to-Left(顺序控制)

| 对象 | 说明 |
|------|------|
| `trigger` / `bangbang` | 顺序分发 |
| `bondo` / `buddy` | 攒齐多路输入再统一输出 |
| `swap` / `fswap` | 两数交换 |

### Sequencing(序列)

| 对象 | 说明 |
|------|------|
| `seq` | MIDI 文件式序列播放/录制 |
| `mtr` | 多轨消息录制 |
| `follow` / `detonate` | 乐谱跟随/播放 |

### System(系统)

| 对象 | 说明 |
|------|------|
| `print` | 打印到 Max 窗口 |
| `error` | 报错 |
| `date` | 日期时间 |
| `gestalt` | 系统信息 |
| `screensize` | 屏幕尺寸 |
| `suspend` | 暂停/恢复处理 |
| `active` | 窗口激活状态 |
| `colorpicker` / `menubar` / `fontlist` | 取色器/菜单栏/字体 |

### Timing(时序)

| 对象 | 说明 |
|------|------|
| `metro` | 定时 bang(节拍器) |
| `delay` | bang 延迟 |
| `pipe` | 每个数据各自延迟后输出 |
| `timer` | 计时器 |
| `transport` | 全局走带(BPM/播放头) |
| `tempo` | 修改走带速度 |
| `timepoint` | 走带时间点触发 |
| `when` | 走带条件判断 |
| `translate` | 时间单位换算(ms/音符/BPM) |
| `clocker` | 自由运行时钟 |
| `qmetro` / `qlim` | 队列友好定时/队列限速 |
| `speedlim` | 消息限速 |
| `defer` / `deferlow` | 转入队列/低优先级执行 |
| `cpuclock` | CPU 时间 |
| `counter` `line` `function` `thresh` `quickthresh` | (见其他类) |

### User Interface(UI 对象)

| 对象 | 说明 |
|------|------|
| `button` / `toggle` | 按钮 / 开关 |
| `message` / `comment` / `panel` | 消息框 / 注释 / 面板 |
| `number` / `flonum` | 整数/浮点数字框 |
| `slider` / `dial` | 滑条 / 旋钮 |
| `rslider` / `multislider` / `gainslider` | 范围滑条 / 多段滑条 / 增益推子 |
| `incdec` | +/- 步进按钮 |
| `umenu` / `radiogroup` / `tab` | 下拉菜单 / 单选组 / 选项卡 |
| `textbutton` / `textedit` | 文字按钮 / 文本编辑 |
| `swatch` | 取色 |
| `kslider` / `nslider` | 钢琴键盘 / 音符键盘 |
| `gswitch` / `gswitch2` | 交叉切换 UI |
| `led` / `ubutton` | 指示灯 / 透明按钮 |
| `pictctrl` / `pictslider` / `fpic` | 图片控件 / 图片滑块 / 图片显示 |
| `matrixctrl` | 矩阵点阵控件 |
| `lcd` | 自由绘图区 |
| `preset` / `attrui` | 预设 / 属性 |
| `inlet` / `outlet` | 显式出入口 |
| `dropfile` / `hint` / `nodes` / `itable` / `jit.cellblock` | 拖放文件/提示/节点网/表格/Jitter 表格 |

## 四、Max 8/9 新增子系统(家族,不逐个列出)

| 家族 | 说明 |
|------|------|
| MC 多通道(`mc.*`) | Max 8 引入。任意 MSP 对象加 `mc.` 前缀即可多通道运行(如 `mc.cycle~`),配 `mc.channel~` 等通道管理对象 |
| Gen(`gen` `gen~` `codebox`) | 样本级算法编程,`gen~` 内置一整套 gen 算子库(相当于内嵌的小语言) |
| Jitter(`jit.*`) | 视频/矩阵/3D,数百个对象 |
| Mira(`mira.*`) | 平板远程控制 patch 界面 |
| M4L(`live.*`) | 配合 Ableton Live 的专用对象(随 Max 附带) |
| BEAP / Vizzie | 附带的模块合成器 bpatcher 库 / 视频效果 bpatcher 库 |
| RNBO(`rnbo~`) | Max 9 引入,把 patch 导出为 C++/VST3/AU 插件 |

## 五、备注

- Max 对象是细粒度原语(如 `+~` 就是一个加法器),与 VCV Rack 的设备级模块(如 VCF)粒度不同;
  本项目更接近 VCV 的"模块"粒度,Max 的价值在于参考其**时间调度体系**(调度器 vs 信号向量、
  `transport`/`metro`/`delay`/`pipe` 的分层)与 **snapshot~ 式"信号↔控制"桥接**设计。
- 拼写约定:`~` 后缀 = 信号版;`mc.` 前缀 = 多通道版;单字母简写如 `t`(trigger)、`f`(float)、`v`(value)、`s/r`(send/receive)。

## 来源

- [官方功能分类:Max Objects(Max 7 文档)](https://docs.cycling74.com/max7/vignettes/max_functional)
- [官方功能分类:MSP Objects(Max 7 文档)](https://docs.cycling74.com/max7/vignettes/msp_functional)
- [Object Reference(Max 文档总入口)](https://docs.cycling74.com/reference/)
- [MSP: Introduction(官方教程)](https://docs.cycling74.com/learn/articles/01_mspintro/)
