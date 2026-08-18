# 生活计划预算

生活计划预算是一款面向个人使用的跨平台计划与预算管理应用。它把日期、时间、行程阶段、备选方案和费用放在同一份计划中，适合安排出行、聚餐、购物、活动等具有时间和预算约束的生活事项。

> [!IMPORTANT]
> **生成式 AI 创作声明**
>
> 本项目采用强生成式 AI 驱动的开发方式。仓库中的代码主要由生成式 AI 生成，并非创作者逐行手工编码。创作者负责提出主要产品想法、描述和确认需求、选择实现方向、验收运行结果，并对部分代码与实现问题进行检查和修正。阅读、使用或评价本项目时，请不要将其理解为传统意义上的纯手工编码作品。

## 主要功能

- **月计划与日程视图**：按月份浏览重点计划，按日期查看当天的定时、全天和未定时间计划。
- **预算汇总**：统计计划数量、已完成数量、已确定预算和仍待选择的预算项。
- **单次计划**：支持全天或具体时刻，打开编辑页即可直接填写费用明细。
- **行程计划**：计划可以包含任意数量的阶段，每个阶段分别设置名称、备注和时间。
- **固定与备选阶段**：固定阶段的费用必然发生；备选阶段可维护多个互斥方案，并选择最终执行方案。
- **分类费用**：记录交通、门票、餐饮、住宿、活动、购物和其他费用，金额以分为单位保存，避免浮点误差。
- **完整新建与编辑**：支持保存草稿、编辑已有计划、切换计划结构，并限制过去日期的新建操作。
- **计划状态展示**：根据草稿完整性、方案选择和完成情况展示草稿、待选择、待完成或已完成状态。
- **本地持久化**：计划、阶段、方案、费用和全局设置统一保存在本地 SQLite 数据库中。
- **全局外观设置**：支持跟随系统、浅色和深色模式，提供绿色、蓝色、珊瑚红和黑白中性配色，以及字号和字重设置。
- **存储占用查看**：设置页展示当前 SQLite 数据库及其附属文件的总占用空间。
- **跨平台界面**：Android、iOS 和 Web 共用主要业务代码；Web 端以居中的手机画布呈现。

## 实现技术

| 类别 | 技术 |
| --- | --- |
| 应用框架 | Expo SDK 57、React Native 0.86 |
| 界面与运行时 | React 19、React Native Web |
| 开发语言 | TypeScript 6 |
| 路由 | Expo Router 文件路由 |
| 本地数据库 | Expo SQLite、WAL 模式、事务化结构迁移 |
| 原生控件 | React Native Community DateTimePicker |
| 图标 | Lucide React Native |
| 测试 | Vitest、React DOM 服务端静态渲染 |
| 代码检查 | TypeScript、ESLint、eslint-config-expo |
| Android 构建 | Expo Application Services（EAS Build） |

## 软件结构

项目采用轻量分层，界面和存储实现通过明确的数据结构连接：

```text
src/
├─ app/             页面路由与页面级控制器
├─ components/      计划编辑、展示、设置和布局组件
├─ domain/          计划结构、预算、时间、表单与校验规则
├─ db/              SQLite 建表、迁移和初始数据
├─ repositories/    计划与设置的持久化接口
├─ services/        SQLite 占用等平台服务
└─ theme/           动态主题、外观状态与样式工具
```

计划使用显式的 `single` 和 `journey` 结构类型。行程阶段进一步区分 `fixed` 和 `choice`，费用直接归属于固定阶段或备选方案，避免公共往返费用被重复记录。Repository 负责以事务方式保存完整计划树，领域层负责预算计算、结构转换、时间排序和输入校验。

SQLite 当前结构版本为 v4。迁移过程会校验计划结构、阶段归属、方案选择、费用数量和金额，并在失败时回滚事务。数据库启用外键约束和 WAL 日志模式。

公开仓库只保留应用运行、测试和构建所需内容。本机编辑器配置、AI 协作指令、内部设计过程文档、一次性资源生成脚本以及未使用的 Expo 示例代码均不纳入版本控制。

## 数据与平台边界

- 当前版本不包含账号、云端服务或跨设备同步，数据保存在运行设备本地。
- Android、iOS 和 Web 使用同一套领域模型和 Repository 接口。
- SQLite 文件占用依赖平台文件能力；无法可靠读取时，界面会显示暂时无法获取，而不会伪造估算值。
- Web 端可用于交互预览，APK 图标、原生日期时间控件和文件占用应以 Android 安装包或真机结果为准。

## 开发环境

- Node.js `22.13.0` 或更高版本
- npm
- Android/iOS 调试可使用 Expo Go、开发构建或模拟器
- APK 云构建需要 Expo 账号

安装依赖：

```powershell
npm install
```

启动开发服务器：

```powershell
npx expo start
```

也可以按平台启动：

```powershell
npm run android
npm run ios
npm run web
```

## 质量检查

```powershell
npm test
npx tsc --noEmit
npm run lint
npx expo export --platform web
```

测试覆盖计划领域规则、预算计算、SQLite 迁移、Repository 事务、编辑交互、动态主题、设置持久化和平台适配逻辑。

## 构建 Android APK

首次使用 EAS 时登录并初始化构建配置：

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

使用 `preview` 配置生成可直接安装的 APK：

```powershell
npx eas-cli@latest build --platform android --profile preview
```

EAS 构建完成后会提供 APK 下载地址。`production` 配置通常用于生成应用商店发布所需的 AAB。

## 许可证

项目许可证见 [LICENSE](./LICENSE)。
