# 练记

一个面向 Android 的中文健身训练记录 UniApp。目前仓库只保留联网教程 API 版：`app-api/`。

动作名称、分类和文字教程内置在应用中；动作演示 GIF 从 GitHub 网络加载。网络不可用时，动作搜索和中文文字教程仍可使用。

## 主要功能

- 训练记录与体重管理
- 按部位浏览、搜索并添加动作，支持自定义训练部位标签
- 每个动作可记录多组不同的重量和次数，可添加或删除训练组
- 训练弹窗中每组左侧可手动点选“今日完成”圆圈；当天会保留，次日自动清空
- 查看中文动作教程与在线 GIF 演示
- 动作与训练记录可排序、编辑和删除
- Android App 使用本地 SQLite 保存数据；H5 预览使用浏览器本地存储降级方案
- 数据导出、导入与动作预览

## 项目结构

```text
练记/
├─ app-api/         # 联网教程版 UniApp
├─ docs/            # 设计与实施说明
├─ README.md        # 本说明
└─ .gitignore
```

请将 `app-api/` 作为 HBuilderX 项目打开，不要把仓库根目录作为 UniApp 项目运行。

## 开发环境

- HBuilderX
- UniApp Vue 3
- Android App-Plus
- `uview-plus`
- `uni-data-charts`

## 本地开发

1. 在 HBuilderX 中打开 `app-api/`。
2. 运行到浏览器调试，或运行到 Android App 基座测试原生存储功能。
3. 首次运行 Android 版本时会创建本地数据库；H5 会自动使用本地存储降级方案。

## 动作数据与 GIF

清洗后的动作数据位于：

```text
app-api/static/json/clean_fitness_zh.json
app-api/data/clean_fitness_zh.js
```

动作数据字段：

```text
id, name_zh, target, media_id, instructions_zh
```

联网版 GIF 默认使用：

```text
https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/{id}-{media_id}.gif
```

GIF 来自第三方数据集。发布源码或 APK 前，请确认数据集与媒体文件的使用许可，并保留必要的来源说明。

## 测试

在 `app-api/` 目录中运行：

```powershell
npm run test:data
node --check utils/sqlite.js
node --check utils/dailySetCheck.js
```

## 打包 APK

在 HBuilderX 中选择“发行 → 原生 App-云打包”，配置应用名称、包名、图标及 Android 签名后进行打包。生成的 APK 或 AAB 不应提交到仓库。

## 更新 GitHub

完成本地提交后，先同步远程提交，再推送：

```powershell
git pull --rebase --autostash origin main
git push origin main
```

若同步出现冲突，先处理冲突文件并完成 rebase，再执行推送；不要使用强制推送覆盖远程提交。
