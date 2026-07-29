# 健身记录 UniApp

这是一个面向安卓竖屏的 UniApp Vue3 健身记录 APP，采用浅色极简界面，包含训练记录、动作教程、训练录入和体重趋势管理。

根目录保留 `index.html` 作为 Vue3 + Vite H5 运行入口；如果新建工程时缺失该文件，HBuilderX 会提示“根目录缺少 index.html”并停止编译。

## 已实现功能

- 训练记录与体重管理两个底部 Tab。
- 胸、肩、背、腿、有氧五个动作部位切换。
- 从 `static/json/clean_fitness_zh.json` 添加动作，弹窗支持按中文动作名称搜索。
- 动作库会随 APP 内置打包，首次读取后缓存到本地，动作搜索不依赖网络。
- 动作卡片展示最近训练记录，支持查看教程、录入训练和长按删除。
- 动作名称、分类和中文分步教学随 APP 本地内置；教程 GIF 从数据集的 GitHub HTTPS 地址在线加载，网络失败时仍保留中文步骤。
- 安卓 App-Plus 使用 SQLite；H5/浏览器预览自动使用本地存储降级。
- 体重记录、`uni-data-charts` 趋势折线和长按删除历史体重。

## 数据清洗

原始数据位于 `exercises-dataset-main/data/exercises.json`。实际数据的中文教学字段是 `instructions.zh`，名称是英文 `name`，清洗脚本负责将它们归一化为任务要求的五个字段。

```powershell
node scripts/clean_exercises.cjs
```

输出文件为 `static/json/clean_fitness_zh.json`，当前生成 826 条有效记录，字段严格为：

```text
id, name_zh, target, media_id, instructions_zh
```

为了兼容 Android App-Plus，清洗脚本同时生成 `data/clean_fitness_zh.js` 作为内置数据包。`utils/catalog.js` 首次从内置数据写入 `uni.setStorageSync('clean_fitness_catalog_v1')`，后续优先读取本地缓存；因此动作库不需要联网，也不依赖 App 端对 `/static` 路径的请求支持。

部位映射规则：

```text
pectorals / serratus anterior -> 胸
delts -> 肩
upper back / lats / spine / traps / levator scapulae -> 背
glutes / quads / hamstrings / calves / adductors / abductors -> 腿
cardiovascular system -> 有氧
```

无法归入五个部位或缺少必需字段的记录会被过滤。中文名称优先使用本地动作短语词典，未命中的动作使用可读中文词语组合兜底；中文教学直接取数据集中的 `instructions.zh`。

## HBuilderX 使用

1. 用 HBuilderX 打开当前目录。
2. 当前工程已经导入 `uview-plus@3.8.90` 和 `qiun-data-charts@2.5.0-20230101`，`main.js` 与 `pages.json` 已完成注册；如重新创建工程，再从插件市场导入这两个插件。
3. 运行到 Android App 基座或连接安卓真机；首次运行会自动创建 `_doc/fitness_record.db`。
4. API 版采用混合模式：中文动作元数据和步骤本地读取，教程 GIF 使用 GitHub HTTPS 地址，需要网络；网络不可用时仍可查看中文文字步骤。
5. 云打包前在 `manifest.json` 中补充应用图标、包名、签名证书和正式版本信息。

## 检查命令

```powershell
node --test scripts/clean_exercises.test.cjs utils/sqlite.test.cjs
node --check scripts/clean_exercises.cjs
node --check utils/sqlite.js
```

当前没有配置 CLI 打包链，最终 APK 需要通过 HBuilderX 的 Android 云打包流程生成。
