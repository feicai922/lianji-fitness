# 练记

一个面向 Android 的中文健身训练记录 UniApp，提供本地存储版和联网教程版两个应用版本。

## 两个版本

| 目录 | 版本 | 动作数据与中文教程 | 动作 GIF | 适合场景 |
| --- | --- | --- | --- | --- |
| `app-local/` | 练记·本地版 | 本地内置，并缓存到设备 | 本地内置，支持离线查看 | 希望尽量不依赖网络 |
| `app-api/` | 练记·联网版 | 本地内置 | 从 GitHub 网络加载 | 接受联网以节省安装包体积 |

两个版本共用同一套中文动作目录、训练记录、动作搜索、训练参数编辑和体重管理功能。联网版的网络请求只用于加载教程 GIF；网络不可用时，中文动作名称、分类和文字步骤仍然可以使用。

## 主要功能

- 训练记录与体重管理两个底部 Tab
- 胸、肩、背、腿、有氧五个训练部位分类
- 按中文动作名称搜索并添加动作
- 为每个动作记录重量、组数和每组次数
- 查看中文教程步骤与动作演示 GIF
- Android App 使用本地 SQLite 保存训练记录和体重数据
- H5 预览使用浏览器本地存储降级方案

## 项目结构

```text
练记/
├─ app-local/       # 本地存储版 UniApp
├─ app-api/         # 联网教程版 UniApp
├─ README.md        # 本说明
└─ .gitignore       # 两个子项目共用的仓库忽略规则
```

## 开发环境

- HBuilderX
- UniApp Vue 3
- Android App-Plus
- `uview-plus`
- `qiun-data-charts`

打开项目时，请分别将 `app-local/` 或 `app-api/` 作为 HBuilderX 项目打开，不要把仓库根目录当作 UniApp 项目运行。

## 本地开发

在 HBuilderX 中：

1. 打开 `app-local/` 或 `app-api/`。
2. 确认对应项目的 `manifest.json` 已设置唯一的 `appid`、应用名称和图标。
3. 运行到浏览器进行页面调试，或运行到 Android App 基座测试原生存储功能。
4. 首次运行 Android 版本时，应用会创建本地数据库；H5 版本会自动使用本地存储降级方案。

## 数据处理

两个项目都已经包含清洗后的中文动作数据：

```text
static/json/clean_fitness_zh.json
data/clean_fitness_zh.js
```

数据字段为：

```text
id, name_zh, target, media_id, instructions_zh
```

原始数据集目录 `exercises-dataset-main/` 被 Git 忽略。若要重新生成数据，请将原始数据集放回对应项目目录，再执行：

```powershell
Set-Location app-local
node scripts/clean_exercises.cjs
```

API 版可在 `app-api/` 中执行同样的命令。

## GIF 来源

联网版默认从以下 GitHub Raw 地址加载 GIF：

```text
https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/{id}-{media_id}.gif
```

GIF 属于第三方数据集内容。公开发布源码或 APK 前，请确认数据集和媒体文件的使用许可，并在遵循许可要求的情况下保留来源说明。联网版需要网络权限，但网络失败时仍应显示中文文字教程。

## 打包 APK

正式 APK 使用 HBuilderX：

1. 打开要打包的子项目。
2. 选择“发行 → 原生 App-云打包”。
3. 配置应用名称、包名、图标和 Android 签名证书。
4. 确认两个项目的 `appid`、Android 包名和应用名称不同，避免两个 APK 互相覆盖。
5. 分别打包并在真机安装测试。

推荐的文件名：

```text
练记-本地版-v1.0.0.apk
练记-联网版-v1.0.0.apk
```

APK 不提交到源码仓库，`.gitignore` 已将 `*.apk` 和 `*.aab` 排除。建议在 GitHub 仓库的 **Releases** 页面上传这两个 APK 作为发行附件。

## GitHub 发布流程

在仓库根目录执行：

```powershell
git add README.md .gitignore app-local app-api
git commit -m "feat: add local and api fitness apps"
git branch -M main
git remote add origin https://github.com/你的用户名/lianji-fitness.git
git push -u origin main
```

首次提交前可以检查将要上传的文件：

```powershell
git status --short
git check-ignore -v app-local/unpackage app-api/unpackage app-local/exercises-dataset-main
```

创建 GitHub Release（例如 `v1.0.0`）后，将两个 APK 拖到 Release 附件区域并发布即可。

## 检查命令

在任意一个子项目目录中执行：

```powershell
node --test scripts/clean_exercises.test.cjs utils/sqlite.test.cjs
node --check scripts/clean_exercises.cjs
node --check utils/sqlite.js
```

API 版还可以执行：

```powershell
npm run test:data
node --check utils/media.js
```
