# 健身记录 APP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个可在 HBuilderX 中打开、可云打包安卓 APK 的 UniApp Vue3 健身记录 APP，并生成可由静态资源读取的中文动作库。

**Architecture:** 使用 UniApp Vue3 页面分包与原生 tabBar；`utils/sqlite.js` 暴露 Promise 风格的初始化、查询、插入和删除接口，App-Plus 走 `plus.sqlite`，浏览器走本地存储降级。清洗脚本将数据集映射为严格五字段 JSON，页面只通过数据库工具和静态 JSON 访问数据。

**Tech Stack:** UniApp Vue3、uViewUI3/uview-plus 组件约定、uni-data-charts、Android App-Plus SQLite、Node.js 清洗脚本。

---

### Task 1: 建立 UniApp 工程骨架与全局配置

**Files:**
- Create: `package.json`
- Create: `main.js`
- Create: `App.vue`
- Create: `pages.json`
- Create: `manifest.json`
- Create: `uni.scss`
- Create: `static/json/.gitkeep`

- [ ] **Step 1: 创建最小工程配置**

写入 UniApp Vue3 入口、安卓 App 配置、两个 tabBar 页面和 `pages/train`、`pages/weight`、`pages/detail` 分包注册；全局样式固定白底、黑色文本和浅灰分割线。

- [ ] **Step 2: 添加依赖与脚本**

在 `package.json` 中声明 Vue3、`uview-plus`、`@dcloudio/uni-ui` 和 `uni-data-charts` 依赖，并添加 `clean-data`、`test:data` 脚本；不把原始 17MB 数据复制到静态资源。

- [ ] **Step 3: 验证入口文件**

运行 `Get-Content -Raw main.js,pages.json,manifest.json`，确认 JSON 无注释语法错误、页面路径全部指向后续要创建的文件。

### Task 2: 实现动作数据清洗并生成静态 JSON

**Files:**
- Create: `scripts/clean_exercises.cjs`
- Create: `scripts/clean_exercises.test.cjs`
- Create: `static/json/clean_fitness_zh.json`
- Modify: `package.json`

- [ ] **Step 1: 写清洗规则测试**

测试 `normalizeExercise`：把 `pectorals` 映射为 `胸`，读取 `instructions.zh`，生成非空中文名称；测试 `abs` 被过滤、缺少 `media_id` 的条目被过滤、输出键集合严格等于 `id/name_zh/target/media_id/instructions_zh`。

- [ ] **Step 2: 运行测试确认失败**

运行 `node --test scripts/clean_exercises.test.cjs`，预期因脚本尚未存在而失败。

- [ ] **Step 3: 实现清洗脚本**

脚本读取 `exercises-dataset-main/data/exercises.json`，通过显式 `TARGET_MAP` 归类五个部位；通过短语词典翻译动作名，剩余 token 使用“动作名”中文兜底；从 `instructions.zh` 读取教学，过滤空值、去除首尾空白，并以 `JSON.stringify(result, null, 2)` 写入 UTF-8 `static/json/clean_fitness_zh.json`。

- [ ] **Step 4: 运行测试和生成命令**

运行 `node --test scripts/clean_exercises.test.cjs` 与 `node scripts/clean_exercises.cjs`；预期测试通过，输出 JSON 可被 `JSON.parse` 读取，数量大于 0，所有记录只有 5 个键且 `target` 只包含五个中文部位。

### Task 3: 封装 SQLite 与浏览器降级存储

**Files:**
- Create: `utils/sqlite.js`
- Create: `utils/date.js`
- Create: `utils/validators.js`
- Create: `utils/sqlite.test.cjs`

- [ ] **Step 1: 写工具层契约测试**

测试日期格式化、训练表单验证、体重表单验证和动作部位过滤；为 Node 测试提供内存存储适配，验证新增动作、查询部位动作、训练记录、体重记录和删除级联的返回值。

- [ ] **Step 2: 运行测试确认失败**

运行 `node --test utils/sqlite.test.cjs`，预期因工具函数尚未实现而失败。

- [ ] **Step 3: 实现数据库初始化**

在 App-Plus 环境调用 `plus.sqlite.openDatabase`，执行三张表：`exercise(id TEXT PRIMARY KEY, nameZh TEXT, targetPart TEXT, mediaId TEXT, instructionsZh TEXT)`、`train_record(recordId INTEGER PRIMARY KEY AUTOINCREMENT, exerciseId TEXT, weight REAL, sets INTEGER, reps INTEGER, trainDate TEXT)`、`weight_record(wid INTEGER PRIMARY KEY AUTOINCREMENT, weight REAL, recordDate TEXT)`。

- [ ] **Step 4: 实现统一 CRUD 与降级**

暴露 `initDb`、`listExercises(part)`、`addExercise(exercise)`、`removeExercise(id)`、`listTrainRecords(exerciseId)`、`addTrainRecord(input)`、`removeTrainRecord(id)`、`listWeights()`、`addWeight(weight)`、`removeWeight(id)`；非 App-Plus 时在一个 storage key 内按表名保存，所有方法返回 Promise，删除动作先删训练记录再删动作。

- [ ] **Step 5: 运行工具测试**

运行 `node --test utils/sqlite.test.cjs`，预期全部 PASS，并检查异常输入不会写入存储。

### Task 4: 实现训练记录页与添加动作搜索

**Files:**
- Create: `pages/train/index.vue`
- Create: `components/ExerciseCard.vue`
- Create: `components/ExercisePicker.vue`
- Modify: `App.vue`

- [ ] **Step 1: 实现训练页状态与数据加载**

维护 `parts`、`activePart`、`exercises`、`loading`、`pickerVisible`、`searchText` 和 `trainDialog`；页面进入或切换部位调用 `listExercises`，每个动作查询最近一条训练记录。

- [ ] **Step 2: 实现动作卡片交互**

卡片显示中文名称和最近记录，点击“查看教程”跳转 `/pages/detail/index?id=...`，点击“录入训练”打开表单，长按用 `uni.showModal` 确认后删除动作和关联记录。

- [ ] **Step 3: 实现添加弹窗和中文搜索**

首次打开弹窗读取 `/static/json/clean_fitness_zh.json`；`filteredCatalog` 使用 `name_zh.toLowerCase().includes(searchText.trim().toLowerCase())`，点击动作后写入当前 `activePart`，若已存在则提示“动作已添加”，添加后刷新列表但不关闭弹窗，便于连续选择。

- [ ] **Step 4: 实现训练录入校验与保存**

重量允许非负小数，组数和次数必须为正整数；验证通过后调用 `addTrainRecord`，关闭弹窗并刷新卡片；失败使用 `uni.showToast` 显示中文原因。

### Task 5: 实现教程详情页

**Files:**
- Create: `pages/detail/index.vue`

- [ ] **Step 1: 加载动作详情**

通过页面参数 id 从静态 JSON 找到动作，构造 `https://v2.exercisedb.io/gif/${media_id}`，标题显示 `name_zh`；找不到动作时显示空状态并提供返回按钮。

- [ ] **Step 2: 分段展示中文教学**

将 `instructions_zh` 按换行、`。`、`.`、`；` 和 `;` 拆分，过滤空段，使用序号列表显示；`@error` 时隐藏图片并展示“教程动图加载失败，可继续查看文字步骤”。

- [ ] **Step 3: 验证导航**

用 HBuilderX 预览或静态检查确认训练页跳转详情、详情页返回后保留当前部位和列表状态。

### Task 6: 实现体重管理页与趋势图

**Files:**
- Create: `pages/weight/index.vue`

- [ ] **Step 1: 加载并展示体重记录**

页面进入调用 `listWeights`，按日期倒序展示；空数据时展示“还没有体重记录”。

- [ ] **Step 2: 保存体重**

输入值必须为大于 0 且不超过 500 的小数，保存时写入当天 `YYYY-MM-DD`，成功后清空输入框并刷新图表和历史列表。

- [ ] **Step 3: 接入 uni-data-charts**

将历史记录转换为 `{categories: ['07-25',...], series: [{name:'体重', data:[...]}]}`，线条使用浅灰色；无记录时不渲染图表组件。

- [ ] **Step 4: 实现长按删除**

长按历史项弹出确认框，确认后调用 `removeWeight` 并重新加载。

### Task 7: 完成样式、uViewUI3 接入与静态检查

**Files:**
- Modify: `App.vue`
- Modify: `uni.scss`
- Modify: `package.json`
- Create: `README.md`

- [ ] **Step 1: 统一视觉样式**

收敛页面内重复样式到全局变量：白色背景、#17191c 正文、#aeb4ba 辅助色、#e7e9eb 分割线、8px 圆角；点击态使用轻微背景变化，不加入复杂动画。

- [ ] **Step 2: 接入 uViewUI3 组件约定**

在入口注册 uview-plus，弹窗、输入框、按钮和空状态优先使用 uViewUI3 组件；保留原生 uni API 作为安卓/H5 的兼容底层。

- [ ] **Step 3: 编写运行说明**

README 说明清洗命令、HBuilderX 打开方式、uViewUI3/uni-data-charts 安装方式、安卓真机 SQLite 注意事项和教程 GIF 需要网络。

- [ ] **Step 4: 进行静态检查**

运行 `node --check scripts/clean_exercises.cjs`、`node --check utils/sqlite.js`，用 JSON.parse 校验 `pages.json`、`manifest.json` 和清洗输出，确认不存在乱码替代字符。

### Task 8: 端到端验收

**Files:**
- Modify: `scripts/clean_exercises.test.cjs`
- Modify: `utils/sqlite.test.cjs`
- Modify: `README.md`

- [ ] **Step 1: 跑完整自动化检查**

运行 `npm run clean-data`、`npm run test:data` 和 `node --test scripts/clean_exercises.test.cjs utils/sqlite.test.cjs`，预期全部通过。

- [ ] **Step 2: 做页面手工验收**

按顺序验证：打开训练页 → 切换部位 → 打开加号 → 输入中文动作名搜索 → 添加动作 → 查看教程 → 录入训练 → 长按删除；再进入体重页 → 保存体重 → 查看折线 → 长按删除。

- [ ] **Step 3: 记录兼容限制**

在 README 标明最终 APK 仍需在 HBuilderX 中配置 App 图标、包名和签名证书；在线 GIF 在无网络环境下不可用，但文字教程仍可读。
