# 健身记录 APP 设计说明

## 目标

构建一个基于 UniApp Vue3、面向安卓竖屏的中文健身记录 APP。用户打开后直接进入训练记录页，按胸、肩、背、腿、有氧切换动作；可以从静态动作库搜索并添加动作、查看在线教程、记录训练数据，并在体重管理页记录体重和查看趋势。

## 设计决策

- 采用 A「训练优先」布局：训练 Tab 首屏直接展示动作列表，体重管理保持独立 Tab。
- `static/json/clean_fitness_zh.json` 是动作选择弹窗的唯一静态数据源，静态资源使用 UTF-8 JSON 数组，字段固定为 `id`、`name_zh`、`target`、`media_id`、`instructions_zh`。
- 原始数据实际使用 `name`、`instructions.zh` 和肌群型 `target` 值，因此清洗脚本负责字段归一化、部位映射、中文名称生成和空值过滤。
- 部位映射：`pectorals`、`serratus anterior` → 胸；`delts` → 肩；`upper back`、`lats`、`spine`、`traps`、`levator scapulae` → 背；`glutes`、`quads`、`hamstrings`、`calves`、`adductors`、`abductors` → 腿；`cardiovascular system` → 有氧。其他肌群过滤。
- 中文名称优先使用本地短语词典对英文动作名逐段翻译；未命中时用英文动作名的可读中文兜底，保证 `name_zh` 非空且用户可搜索。
- 安卓 App 使用 `plus.sqlite`；H5/浏览器开发预览使用同一套接口的 `uni.setStorageSync` 降级实现，避免页面逻辑分叉。数据库初始化包含 `exercise`、`train_record`、`weight_record` 三表。
- 动作不会自动全部写入用户动作表，初始列表为空；添加动作弹窗从静态 JSON 加载、按中文名称实时搜索，点击即添加到当前部位。

## 页面与交互

### 训练记录页 `pages/train/index`

顶部显示页面标题和 5 个部位 Tab，默认胸。列表项显示动作名、最近一次训练的 `重量 kg × 组数 组 × 次数 次`，并提供“查看教程”和“录入训练”。右下角悬浮加号打开动作选择弹窗；弹窗有输入框和结果列表，输入内容按 `name_zh` 不区分大小写过滤。已添加到当前部位的动作显示已添加状态，避免重复插入。长按列表项后使用确认弹窗删除动作，同时删除其训练记录。

### 教程详情页 `pages/detail/index`

从训练页传入动作 id，读取动作数据，顶部使用 `https://v2.exercisedb.io/gif/{media_id}` 加载 GIF；图片失败时显示中文占位提示。教学内容优先按换行、句号和中文标点拆分成步骤，逐段显示；顶部返回按钮回到训练页。

### 录入训练弹窗

重量使用数字输入，允许小数且必须大于等于 0；组数和每组次数必须为正整数。保存时写入当前日期 `YYYY-MM-DD`，刷新该动作的最近一次记录。取消不写入数据。

### 体重管理页 `pages/weight/index`

输入当日体重并保存，写入 `weight_record`；同一天重复保存时追加一条记录，历史列表按日期倒序。折线图使用 `uni-data-charts`，无历史数据时显示空状态；长按记录要求二次确认后删除。

### 底部 Tab

仅有“训练记录”和“体重管理”两个页面，使用原生 tabBar 配置，白底、黑色正文、浅灰分割线，避免多余动画。

## 数据流

```text
exercises.json
  -> scripts/clean_exercises.cjs
  -> static/json/clean_fitness_zh.json
  -> 训练页添加弹窗（搜索 name_zh）
  -> sqlite.exercise
  -> 训练列表 / 教程详情 / 训练记录

训练录入 -> sqlite.train_record -> 动作列表最近记录
体重录入 -> sqlite.weight_record -> 趋势图 + 历史列表
```

## 错误与边界

- 静态 JSON 读取失败时显示“动作库加载失败”，允许关闭弹窗重试。
- JSON 中缺少 id、中文名、部位、media_id 或中文教学的记录不输出；空白字符串也视为空值。
- 教程 GIF 加载失败不阻塞文字教程。
- 重复添加动作不插入第二条；删除动作前弹窗确认，并清理关联训练记录。
- SQLite 未就绪、非 App 环境或 SQL 异常时统一降级到本地存储并保留页面可用性。
- 所有录入表单在提交前校验数值和空值，失败只提示，不写入半成品数据。

## 验收标准

1. 清洗脚本可以从现有 `exercises-dataset-main/data/exercises.json` 生成合法 UTF-8 JSON，字段严格为 5 个，且只有五个中文部位。
2. 训练页默认打开，5 个部位可以切换；添加弹窗支持按中文名称搜索、添加和防重复。
3. 动作教程可展示指定在线 GIF、中文名称和分段教学。
4. 训练录入可保存重量、组数、次数，列表能显示最近记录；长按可删除。
5. 体重录入、趋势图、历史列表和长按删除可用。
6. 安卓 App 使用 SQLite 表结构，浏览器预览不因 `plus.sqlite` 不存在而报错。
