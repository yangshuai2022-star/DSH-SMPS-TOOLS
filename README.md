# DSH-SMPS-Tools —— LLC 电源设计 DSH 插件

把 **Power Design Toolkit V7.5**（用户专有 LLC 算法，仓库 `llc_design_tool_v1`）
的完整设计能力暴露给 DeepSeek Harness 对话，实现**从硬件规格到闭环控制代码一键完成**。

## 插件工具

### 1. `llc_design` —— 变压器/谐振参数设计

输入输出电压/功率/频率/母线范围 → 按专有算法返回：
- 整数匝数对 Np:Ns、匝比与误差
- 谐振腔 Lr/Lm/Cr、气隙/AL
- Litz 线规（原/副边）、窗口填充、Rdc
- 磁芯选型、Bpk、iGSE 磁芯损耗 + 分层 Litz 铜损分解
- 各工作点表（频率/Bpk/电流/损耗）、增益需求与 ZVS 检查、可行性判定

### 2. `llc_tune_loop` —— 数字电压环一键自动整定（浮点 + 32 位定点）

输入电源规格 + 目标穿越频率/相位裕度 → 自动设计 PI/PIF/2P2Z 控制器并返回：

| 输出 | 内容 |
|---|---|
| 浮点 | 控制器系数、z 域传函、差异方程、Direct Form I C99 代码 |
| **32 位定点** | **IQ27 数据域 / IQ20·IQ24·IQ27 系数域的整数参数表**（可直接烧录的 int 值） |
| 定点代码 | **自包含 int32 实现**（零浮点运行时，int64 中间量）+ **对接 `fx_ctrl_iq27.h` 库的初始化代码** |
| 稳定性 | 名义/最小/最大延迟包络的相位裕度、增益裕度、穿越频率、延迟裕度 |
| fail-fast | 溢出核算表（kp×e_max、ki2p×2e_max、\|s1\|、极点-单位圆余量） |

定点体系严格对齐 **DSP_CTRL_CODE** 仓库 `doc/fixed_point_impl.md`：
输出量纲积分器 PI、增量型 LPF（PIF）、DF-IIt（2P2Z）、方向性 anti-windup。

## 架构

```
src/
  index.ts                 工具注册（llc_design + llc_tune_loop）
  engine/
    index.ts               变压器设计适配层
    loopEngine.ts          环路整定适配层（浮点+定点输出组装）
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
    autotune.ts            一键整定（目标带宽/相位裕度迭代）
    qformat.ts             32 位定点转换（IQ27/IQ20/IQ24）+ 定点代码生成
  data/                    材料库 / 磁芯库 / TDK 预设（自包含）
```

## 验证

| 层 | 方法 | 结果 |
|---|---|---|
| 变压器设计 | 对拍 Python 原版（2 用例，30+ 项数值） | ✅ 一致 |
| 小信号/环路 | 对拍 Python 原版（A/B/C/D、Gvf、裕度、频响） | ✅ 一致 |
| 自动整定 | 目标 fc/PM 迭代 + Python 原版交叉验证整定结果 | ✅ 一致（PM=51.15° 双侧吻合） |
| 定点输出 | 反量化误差 < 1e-6、溢出核算全过 | ✅ |
| 端到端 | DSH headless 真实对话：单工具 + **双工具完整设计链** | ✅ 见下方记录 |

### 端到端实测记录（400V→24V/500W 半桥 LLC，fr=120kHz）

一次对话中模型依次真实调用两个工具：

- **`llc_design`**：Np:Ns=24:3，Lr=27.741 µH / Lm=138.707 µH / Cr=63.409 nF，
  气隙 0.845 mm，Litz 100 股 / 2×250 股，窗口填充 52.97%，可行 ✅
  （Bpk 167.6 mT < 180 mT，满载可用增益 0.822–1.348 覆盖 Mmin/Mmax，全部工作点感性区，
  最低换流 2.227 A，标称损耗 2.158 W）
- **`llc_tune_loop`**（fc=1 kHz、PM=50°、PI）：kp=0.0064834 / Ti=20 µs，
  定点 **kp=6798（Q20）、ki2p=3399（Q20）**、outMax=134217728（Q27），
  实测穿越 1165.4 Hz、PM=68.1°、GM=14.1 dB，离散闭环稳定（迭代 9 次收敛）
- 模型进一步完成**衔接自洽性分析**：整定工作点 fsw=152.6 kHz 落在谐振腔可用增益范围内，
  FM 方向（升频降压）与变压器设计一致

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
