# 练记

一个面向 Android 的中文健身训练记录 UniApp。仓库只保留一个版本：`app-api/`。

动作名称、分类和中文文字教程全部内置在应用中，**不依赖网络**；只有动作演示 GIF 需要联网从 GitHub 加载。断网时动作搜索、训练记录、打卡和文字教程都照常可用。

## 主要功能

底部四个 Tab：

- **训练记录**：按部位浏览动作（全部 / 胸 / 肩 / 背 / 腿 / 有氧），可新增自定义部位标签并关联多个动作部位，长按标签可删除
  - 悬浮 `+` 打开动作库，按中文名称实时搜索并添加
  - 每个动作可记录**多组不同重量与次数**，可增删训练组
  - 每组左侧可手动点选「今日完成」圆圈，当天保留、次日自动清空
  - 已完成的组会同步到「每日打卡」
  - 长按卡片删除动作（连同其训练记录），拖拽左侧手柄可排序
- **体重管理**：记录每日体重，折线趋势图，历史列表长按删除
- **每日打卡**：月历视图，训练完成后自动打卡，有氧可手动打卡；含本月统计与按部位训练天数
- **动作预览**：左右滑动逐个查看教程（每次只渲染 3 个，避免卡顿），支持按名称搜索跳转
- **设置 / 动作教程**：剪贴板 JSON 备份导出与导入；教程页展示在线 GIF 与分段中文步骤

数据存储：Android App 使用本地 SQLite（`plus.sqlite`），H5 浏览器预览自动降级为本地存储，页面逻辑不分叉。

## 项目结构

```text
练记/
├─ app-api/                  # UniApp 工程（用 HBuilderX 打开这个目录）
│  ├─ pages/                 # train / weight / detail / preview / checkin / settings
│  ├─ components/            # ExerciseCard、ExercisePicker
│  ├─ utils/                 # sqlite、catalog、trainParts、checkIn、backup 等
│  ├─ data/                  # 打包进 App 的动作库（clean_fitness_zh.js）
│  ├─ static/json/           # 同上数据的 JSON 版本
│  ├─ scripts/               # 数据清洗与翻译脚本及其测试
│  └─ exercises-dataset-main/# 第三方动作数据集（仅作数据来源）
├─ docs/superpowers/         # 设计与实施说明（plans / specs）
├─ lianji-release.jks        # Android 签名文件
└─ README.md
```

请将 `app-api/` 作为 HBuilderX 项目打开，不要把仓库根目录作为 UniApp 项目运行。

## 开发环境

- HBuilderX
- UniApp Vue 3 / Android App-Plus
- `uview-plus`、`uni-data-charts`

## 本地开发

1. 在 HBuilderX 中打开 `app-api/`。
2. 运行到浏览器调试，或运行到 Android App 基座测试原生存储功能。
3. 首次运行 Android 版本时会创建本地数据库；H5 自动使用本地存储降级方案。

## 动作数据与 GIF

清洗后的动作数据位于：

```text
app-api/static/json/clean_fitness_zh.json   # JSON 版本，供脚本与测试使用
app-api/data/clean_fitness_zh.js            # 打包进 App 的 ESM 版本，运行时数据源
```

动作数据字段：

```text
id, name_zh, target, media_id, instructions_zh
```

GIF 拼接规则：

```text
https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/{id}-{media_id}.gif
```

GIF 来自第三方数据集，通过 GitHub raw 外链加载，国内网络可能加载失败；失败时会显示中文占位提示，不影响文字教程。发布源码或 APK 前，请确认数据集与媒体文件的使用许可，并保留必要的来源说明。

## 测试

在 `app-api/` 目录中运行：

```powershell
npm run test:data
node --check utils/sqlite.js
node --check utils/dailySetCheck.js
```

`test:data` 覆盖数据清洗、翻译、SQLite 数据层、备份、动作排序、打卡、自定义部位以及各页面逻辑，共 51 个用例。

## 打包 APK

在 HBuilderX 中选择「发行 → 原生 App-云打包」，配置应用名称、包名、图标及 Android 签名后进行打包。

`app-api/unpackage/` 是 HBuilderX 的构建输出目录，已加入 `.gitignore`，可以随时整个删除，下次构建会重新生成。生成的 APK 或 AAB 不应提交到仓库。

## 更新 GitHub

完成本地提交后，先同步远程提交，再推送：

```powershell
git pull --rebase --autostash origin main
git push origin main
```

若同步出现冲突，先处理冲突文件并完成 rebase，再执行推送；不要使用强制推送覆盖远程提交。
