# DSH-SMPS-Tools —— LLC 电源设计 DSH 插件

把 **Power Design Toolkit V7.5**（用户专有 LLC 算法，仓库 `llc_design_tool_v1`）
的完整设计能力暴露给 DeepSeek Harness 对话，实现**从硬件规格到闭环控制代码（浮点 + 32 位定点）一键完成**。

## 插件工具

### 1. `llc_design` —— 变压器/谐振参数设计

输入输出电压/功率/频率/母线范围 → 按专有算法返回：
- 整数匝数对 Np:Ns、匝比与误差（自动匝数搜索）
- 谐振腔 Lr/Lm/Cr、气隙/AL
- Litz 线规（原/副边）、窗口填充、Rdc
- 磁芯选型（**自动从磁芯库搜索**，14 个 PQ/EE/EC/EER/ETD 型号）、Bpk、
  iGSE 磁芯损耗 + 分层 Litz 铜损分解
- 各工作点表（频率/Bpk/电流/损耗）、增益需求与 ZVS 检查、可行性判定
- 输出电容参数（`outputCapF`/`outputCapEsrMohm`）计入模型

### 2. `llc_tune_loop` —— 数字电压环一键自动整定（浮点 + 32 位定点）

输入电源规格 + 目标穿越频率/相位裕度 → 自动设计 **PI / PIF / 2P2Z** 控制器并返回完整报告：

| 输出 | 内容 |
|---|---|
| 浮点 | **2P2Z 输出 Numerator/Denominator/GAIN 归一化格式**（float64 完整精度 17 位有效数字） |
| 32 位定点 | **IQ27 数据域 / IQ20·IQ24·IQ27 系数域整数参数表**（可直接烧录） |
| 定点代码 | 自包含 int32 实现（零浮点，int64 中间量）+ 对接 `fx_ctrl_iq27.h` 库初始化 |
| 稳定性 | fc/PM/GM/延迟裕度 + **ASCII Bode 图**（幅频+相频，`showBode=false` 可关） |
| fail-fast | 溢出核算表（kp×e_max、ki2p×2e_max、\|s1\|、极点-单位圆余量 ≥100 LSB） |
| 参数问答 | 缺失关键参数时生成**交互式问答引导**（选项+默认值，不脑补） |

**2P2Z 自动整定**（两阶段对数二分）：先收敛零点位置（减少超前相位），
再收敛极点位置（增加滞后），精确命中目标 PM（实测 2kHz/50° → PM 49-51°）。

**定点体系严格对齐 DSP_CTRL_CODE 仓库 `doc/fixed_point_impl.md`**：
输出量纲积分器 PI、增量型 LPF（PIF）、DF-IIt（2P2Z）、方向性 anti-windup、
B0 外置增益归一化（§14.2）、增益类系数 IQ20 / 极点位置类系数 IQ27。

### 3. `llc_analyze_controller` —— 自定义控制器分析

输入归一化 2P2Z 系数（B0/B1/B2/A1/A2）→ 输出完整设计报告：
- 控制器识别（零点/极点/稳定性/直流增益/极点频率/类型）
- IQ27 定点化 + 溢出核算（\|B1+B2\|+\|A1+A2\|、极点-单位圆余量）
- 归一化 DF-IIt C99 代码
- ASCII Bode 图

## 架构

```
src/
  index.ts                 工具注册（llc_design + llc_tune_loop + llc_analyze_controller）
  engine/
    index.ts               变压器设计适配层（含磁芯库→设计输入转换）
    loopEngine.ts          环路整定适配层（浮点+定点+归一化输出组装）
    analyzeController.ts   自定义控制器分析
    assumptions.ts         参数完整性检查 + 交互式问答引导
    asciiBode.ts           ASCII Bode 图渲染（幅频/相频字符画）
  core/
    numeric.ts             Brent 求根 / 修正贝塞尔 / gamma / rfft
    spec.ts                LLCDesignSpec
    tank.ts                FHA 谐振腔 + 增益根求解
    operatingPoint.ts      工作点求解
  control/
    linalg.ts              矩阵运算 / expm / 特征值 QR / 多项式求根
    tf.ts                  ss2tf / ZOH·bilinear 离散 / SISO·z 域传函
    plant.ts               7 状态动态相量模型 + 牛顿稳态 + 调频外环
    linearize.ts           数值雅可比线性化
    discretize.ts          ZOH 离散化
    digitalLoop.ts         数字环链（FM LUT / ADC / 采样延迟 / Bode / 裕度）
    autotune.ts            一键整定（PI/PIF 迭代 + 2P2Z 两阶段对数二分）
    qformat.ts             32 位定点转换（IQ27/IQ20/IQ24）+ 归一化 2P2Z 定点 + 代码生成
  data/                    材料库 / 磁芯库 / TDK 预设（自包含）
```

## 验证

| 层 | 方法 | 结果 |
|---|---|---|
| 变压器设计 | 对拍 Python 原版（2 用例，30+ 项数值） | ✅ 一致 |
| 小信号/环路 | 对拍 Python 原版（A/B/C/D、Gvf、裕度、频响） | ✅ 一致 |
| 自动整定 | 目标 fc/PM 迭代 + Python 原版交叉验证整定结果 | ✅ 一致（PM=51.15° 双侧吻合） |
| 2P2Z 整定 | 两阶段二分精确命中目标 PM | ✅ 2kHz/50° → PM 49-51° |
| 定点输出 | 反量化误差 <1e-6、溢出核算全过、归一化 B0 外置 | ✅ |
| 端到端 | DSH headless 真实对话调用工具 | ✅ |

### 端到端实测记录

**400V→50V/30A（1500W）半桥 LLC，fr=80kHz，3300µF/2mΩ，2kHz/50° 2P2Z：**
- 变压器：PQ50，Np:Ns=20:5，Lr=15.05µH/Lm=75.25µH/Cr=263nF，fill=39.2%，Bpk=177.7mT，可行 ✅
- 2P2Z：`Numerator: 1、-1.3862010825846180、0.47266382015715724` /
  `Denominator: 1、-1.3520182308231041、0.45698832411950913` / `GAIN: 0.027996603352793324`
- 定点：B0=29357(Q20)、B1=-186052760(Q27)、B2=63439864(Q27)、A1=-181464815(Q27)、A2=61335935(Q27)
- 裕度：fc=2000Hz、PM=49.4°、GM=11.4dB、离散稳定、收敛 ✅

**400V→50V/20A（1000W）半桥 LLC，fr=80kHz，2200µF/2mΩ，2kHz/50° 2P2Z：**
- 2P2Z：GAIN=0.0286941915、B1=-1.3862010826、B2=0.4726638202、A1=-1.2036330269、A2=0.3621831159
- 裕度：fc=2000Hz、PM=51.0°、GM=14.9dB、离散稳定 ✅

**关键工程发现（工具诚实报告）：**
- PI 在 2kHz 的 PM 物理上限 ≈32-34°（plant 相位 -148°），无法达到 50° → 高带宽必须用 2P2Z
- plant 在 1-1.5kHz 有谐振峰（GM=0 不稳定窗口），2kHz 翻过峰后重新稳定
- 70kHz fr 用例带宽上限 ~880Hz（谐振峰位置不同）

## 开发运行

```sh
# DSH 源码环境
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness && pnpm install && pnpm run build
pnpm dsh web --patch /home/yangshuai/task/llc-design-plugin/cordis.yml
# 或 headless：
pnpm dsh --profile headless --patch .../cordis.yml "用 llc_tune_loop 整定..."
```

## 定点输出对齐的参考体系

- `DSP_CTRL_CODE`（git@github.com:yangshuai2022-star/DSP_CTRL_CODE.git）：
  `src/fx_ctrl_iq27.h` 定点库 + `doc/fixed_point_impl.md` 设计规范（IQ27 归一化定标）
- 本插件的定点整数参数与代码可直接对接该库，或独立使用自包含 int32 版本。

## 参数问答（不脑补原则）

用户未显式提供工程关键参数（母线范围/K/Q/磁芯/带宽/采样等）时，
工具生成**交互式问答清单**（问题 + 可点选选项 + 默认值），由用户确认后再设计。
