# 练记 · Fitness Record App

> 基于 HBuilderX UniApp Vue3 + uViewUI3 开发的简约轻量化安卓健身记录 App，仅适配安卓端，浅色极简原生风格，全部界面中文。

## 目标

用户打开后直接进入训练记录页，按部位切换动作；可以从全量动作库搜索并添加动作、查看所在线教程、按组记录训练数据，并在体重管理页记录体重和查看趋势，在打卡页回顾训练频率。

## 设计决策

- 采用「训练优先」布局：训练 Tab 首屏直接展示动作列表，体重、打卡、预览各自独立 Tab。
- `data/clean_fitness_zh.js` 是打包进 App 的动作库数据源（ESM 导出），`static/json/clean_fitness_zh.json` 是同一份数据的 JSON 版本，供脚本与测试使用；字段固定为 `id`、`name_zh`、`target`、`media_id`、`instructions_zh`。
- 原始数据使用 `name`、`instructions.zh` 和肌群型 `target` 值，由 `scripts/clean_exercises.cjs` 负责字段归一化、部位映射、中文名称生成和空值过滤。
- 部位映射：`pectorals`、`serratus anterior` → 胸；`delts` → 肩；`upper back`、`lats`、`spine`、`traps`、`levator scapulae` → 背；`glutes`、`quads`、`hamstrings`、`calves`、`adductors`、`abductors` → 腿；`cardiovascular system` → 有氧。其他肌群过滤。
- 中文名称优先使用本地短语词典对英文动作名逐段翻译；未命中时调用外部翻译脚本 `scripts/translation.cjs`（结果缓存在 `data/.translation-cache.json`，已 gitignore）；仍未命中时用英文动作名的可读中文兜底，保证 `name_zh` 非空且用户可搜索。
- 安卓 App 使用 `plus.sqlite`；H5/浏览器开发预览使用同一套接口的 `uni.setStorageSync` 降级实现，避免页面逻辑分叉。
- 动作不会自动全部写入用户动作表，初始列表为空；添加弹窗从全量动作库加载、按中文名称实时搜索，点击即添加。
- 页面中所有中文均以 **可读中文字面量** 书写，不再使用 `\uXXXX` 转义。

## 页面与交互

### 训练记录页 `pages/train/index`

顶部是部位 Tab，由 `utils/trainParts.js` 管理：默认「全部 + 胸肩背腿有氧」，可点 `+` 新增自定义标签（一个标签可关联多个动作部位，或关联「全部」），长按标签删除其显示设置（不删动作与记录）。Tab 顺序持久化在本地存储。

列表项 `components/ExerciseCard.vue` 显示动作名与最近一次训练的组详情（`组数 · 重量×次数 / 重量×次数…`），提供「查看教程」和「录入训练」（已有记录时显示「编辑训练」）。左侧拖拽手柄长按 260ms 进入拖动排序，卡片长按弹确认框删除动作并清理其训练记录。

右下角悬浮 `+` 打开 `components/ExercisePicker.vue`，输入内容按 `name_zh` 不区分大小写过滤，已添加的动作显示「已添加」状态，避免重复插入。

### 录入训练弹窗

弹窗内每组一行：左侧圆圈点选「今日完成」、重量（数字，允许小数且 ≥ 0）、次数（正整数），可添加或删除训练组（至少保留一组）。保存时写入当前日期 `YYYY-MM-DD`；已有记录时为更新，否则为新增。取消不写入数据。

勾选「今日完成」会即时同步到打卡表：按当天已勾选的动作解析出所属的**训练页部位标签**（背阔肌 → 背）后写入 `check_in`。

### 教程详情页 `pages/detail/index`

从训练页传入动作 id，读取动作数据，顶部用 `utils/media.js` 拼接的 GitHub raw 地址加载 GIF；图片失败时显示中文占位提示，不阻塞文字教程。教学内容按换行、句号和中文标点拆分成步骤逐段显示，顶部返回按钮回到训练页。

### 每日打卡页 `pages/checkin/index`

页面**顶部**是健身房卡到期提醒卡片：手动选择到期日并保存到 `gym_card` 表，显示剩余天数与到期日。剩余 1 个月以上为绿色、1 周至 1 个月为黄色、1 周内为红色，已过期显示「已过期 N 天」（同样为红色）。

下方是月历视图，可左右切换月份。当天存在训练打卡时显示深绿，有氧打卡显示浅绿，今天有描边。当天未打卡时可点「有氧打卡」按钮手动打卡；已由训练自动打卡时按钮禁用并提示。最后展示本月已打卡天数、训练天数、有氧天数，以及按部位的训练天数统计。

部位统计只认「训练记录」页的部位标签：训练打卡写入时就已把动作的细分部位映射为标签（背阔肌 → 背），旧记录在渲染前也会做一次同样的映射。没有任何标签覆盖的动作不计入部位天数，此时页面会提示「有 X 天训练的动作还没有对应的部位标签」。

### 体重管理页 `pages/weight/index`

输入当日体重并保存写入 `weight_record`；同一天重复保存会追加记录。折线图使用 `qiun-data-charts`，无历史数据时显示空状态；长按记录二次确认后删除。

趋势图默认只渲染**最近 7 次**记录（`RECENT_COUNT`），记录超过 7 条时标题行右侧出现「加载全部 N 次」入口，必须手动点击才渲染完整曲线 —— 避免每次进入页面都为大量数据做一次完整绘制。曲线设置 `dataPointShape: false`，只画折线趋势、不画数据点。

### 动作预览页 `pages/preview/index`

使用 `swiper` 左右滑动逐个查看当前部位的动作教程。为控制内存，只渲染当前项前后共 3 个 slide（`windowStart` 窗口滑动）。顶部搜索框按名称过滤，点击结果直接跳转到对应 slide。右上角可添加自定义部位。

### 设置页 `pages/settings/index`

「导出数据」把完整备份 JSON 复制到剪贴板；「导入数据」从剪贴板读取并整体覆盖本地数据。备份格式由 `utils/backup.js` 定义（`version` / `exportedAt` / `data` / `preferences`），除四张数据表外还会带上自定义部位与动作排序等偏好设置。

### 底部 Tab

使用原生 tabBar 配置，共四个：「训练记录」「体重管理」「每日打卡」「动作预览」。白底、黑色正文、浅灰分割线，无多余动画。

## 数据流

```text
exercises.json（第三方数据集）
  -> scripts/clean_exercises.cjs (+ scripts/translation.cjs 翻译)
  -> data/clean_fitness_zh.js + static/json/clean_fitness_zh.json
  -> 添加动作弹窗 / 动作预览页（搜索 name_zh）
  -> sqlite.exercise
  -> 训练列表 / 教程详情 / 训练记录

训练录入（按组）      -> sqlite.train_record  -> 卡片最近记录
「今日完成」勾选      -> utils/dailySetCheck -> utils/trainParts（部位标签）-> sqlite.check_in
有氧手动打卡          -> sqlite.check_in     -> 打卡月历 + 本月统计
体重录入              -> sqlite.weight_record -> 趋势图 + 历史列表
健身房卡到期日        -> sqlite.gym_card      -> 剩余天数与颜色提醒
导出/导入             -> utils/backup.js     -> 剪贴板 JSON
```

## 本地数据表

| 表 | 说明 |
|---|---|
| `exercise` | 用户添加的动作 |
| `train_record` | 训练记录，每组重量与次数存于 `setDetailsJson` |
| `weight_record` | 体重记录 |
| `check_in` | 每日打卡（训练部位标签 + 有氧标记） |
| `gym_card` | 健身房卡到期日，固定 `cardId = 1`，只存一条 |

## 错误与边界

- 动作库加载失败时显示「动作库加载失败，请重试」，允许关闭弹窗重试。
- JSON 中缺少 id、中文名、部位、media_id 或中文教学的记录不输出；空白字符串也视为空值。
- GIF 加载失败不阻塞文字教程。
- 重复添加动作不插入第二条；删除动作前弹窗确认，并清理关联训练记录。
- SQLite 未就绪、非 App 环境或 SQL 异常时统一降级到本地存储并保留页面可用性。
- 所有录入表单在提交前校验数值和空值，失败只提示，不写入半成品数据。
- 导入备份时校验版本与必需数据表，格式不符直接报错且不改动现有数据；旧备份没有 `check_in` / `gym_card` 时按空处理，不会报错。
- 健身房卡读取失败不影响打卡主流程；到期日留空即清除该记录。

## 测试

```powershell
npm run test:data
```

覆盖数据清洗、翻译解析、SQLite 数据层、备份导入导出、动作排序、打卡逻辑、健身房卡到期计算、自定义部位，以及训练/设置/预览/打卡/体重五个页面的组件逻辑。当前 67 个用例全部通过。

## 验收标准

1. 清洗脚本可以从 `exercises-dataset-main/data/exercises.json` 生成合法 UTF-8 数据，字段严格为 5 个，且只有五个中文部位。
2. 训练页默认打开，部位 Tab 可切换；添加弹窗支持按中文名称搜索、添加和防重复；可新增与删除自定义部位标签。
3. 动作教程可展示指定在线 GIF、中文名称和分段教学；动作预览页可左右滑动浏览。
4. 训练录入可按组保存不同的重量与次数，卡片显示最近记录，可编辑、拖拽排序、长按删除。
5. 「今日完成」勾选当天保留、次日清空，并可在打卡页看到对应记录。
6. 体重录入、趋势图、历史列表和长按删除可用；记录超过 7 条开启滚动时曲线图仍正常显示。
7. 打卡页月历、有氧手动打卡与本月统计可用；部位天数只按训练页标签统计。
8. 健身房卡到期日可手动设置，剩余天数按绿/黄/红三档显示，过期显示「已过期 N 天」。
9. 导出/导入备份可完整还原数据（含健身房卡）与偏好设置。
10. 安卓 App 使用 SQLite 表结构，浏览器预览不因 `plus.sqlite` 不存在而报错。

---

Source of truth: `task.md`, docs under `docs/superpowers/`.
