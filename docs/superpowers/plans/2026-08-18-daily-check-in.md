# 每日打卡 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 增加由训练组勾选自动驱动、可当天手动有氧打卡，并以月历和部位训练天数展示历史的每日打卡功能。

**Architecture:** utils/checkIn.js 承担纯规则与月历数据计算；utils/sqlite.js 为 SQLite 和 H5 fallback 提供统一的日打卡持久化接口。训练页在勾选状态变化后同步当天训练部位，打卡页只消费持久化记录并创建幂等的有氧标记。

**Tech Stack:** UniApp Vue 3、JavaScript ES modules、plus.sqlite、uni 同步存储、Node.js 内置 test runner。

---

## 文件结构

- 新建 app-api/utils/checkIn.js：记录规范化、自动训练同步、月历网格、月统计。
- 新建 app-api/utils/checkIn.test.cjs：纯业务规则单元测试。
- 修改 app-api/utils/sqlite.js、app-api/utils/sqlite.test.cjs：原生/H5 持久化、导入导出。
- 修改 app-api/utils/backup.js、app-api/utils/backup.test.cjs：旧备份兼容。
- 修改 app-api/pages/train/index.vue、app-api/pages/train/index.test.cjs：训练勾选同步。
- 新建 app-api/pages/checkin/index.vue、app-api/pages/checkin/index.test.cjs：日历和有氧操作。
- 修改 app-api/pages.json 与 app-api/package.json：Tab、页面与测试入口。

### Task 1: 实现纯打卡规则与月历数据

**Files:**
- Create: app-api/utils/checkIn.js
- Test: app-api/utils/checkIn.test.cjs

- [ ] **Step 1: 写入失败测试**

在 checkIn.test.cjs 添加三个测试：训练优先但保留此前有氧状态；手动有氧幂等且训练存在时拒绝；周一开头的 42 格月历及按部位去重的月统计。

~~~js
test('training parts take display priority while a prior cardio check is retained', async () => {
  const { syncTrainingCheckIn } = await import('./checkIn.js')
  const next = syncTrainingCheckIn(
    { checkDate: '2026-08-18', cardioChecked: true, trainingParts: [] },
    '2026-08-18',
    ['胸', '背', '胸']
  )
  assert.deepEqual(next, { checkDate: '2026-08-18', source: 'training', cardioChecked: true, trainingParts: ['胸', '背'] })
  assert.equal(syncTrainingCheckIn(next, '2026-08-18', []).source, 'cardio')
})
test('manual cardio is idempotent and blocked by training', async () => {
  const { createCardioCheckIn } = await import('./checkIn.js')
  assert.equal(createCardioCheckIn(null, '2026-08-18').source, 'cardio')
  assert.throws(() => createCardioCheckIn({ checkDate: '2026-08-18', trainingParts: ['腿'] }, '2026-08-18'), /训练自动打卡/)
})
test('month grid and statistics are Monday-first and deduplicate daily parts', async () => {
  const { createMonthGrid, summarizeMonth } = await import('./checkIn.js')
  const rows = [
    { checkDate: '2026-08-01', cardioChecked: false, trainingParts: ['胸', '胸'] },
    { checkDate: '2026-08-02', cardioChecked: true, trainingParts: [] },
    { checkDate: '2026-08-03', cardioChecked: false, trainingParts: ['胸', '背'] }
  ]
  assert.equal(createMonthGrid('2026-08', rows, '2026-08-18').length, 42)
  assert.deepEqual(summarizeMonth(rows, '2026-08'), { checkedDays: 3, trainingDays: 2, cardioDays: 1, partDays: { '胸': 2, '背': 1, '有氧': 1 } })
})
~~~

- [ ] **Step 2: 运行测试确认失败**

Run: node --test utils/checkIn.test.cjs

Expected: FAIL，无法导入 ./checkIn.js。

- [ ] **Step 3: 实现最小规则模块**

实现并导出 normalizeCheckIn、syncTrainingCheckIn、createCardioCheckIn、filterMonth、createMonthGrid、summarizeMonth。记录字段始终是 checkDate、cardioChecked、trainingParts；source 由非空训练部位推导为 training，否则由 cardioChecked 推导为 cardio。无训练和无有氧的记录返回 null。

~~~js
function syncTrainingCheckIn(current, checkDate, parts) {
  const base = normalizeCheckIn(current) || { checkDate: String(checkDate), cardioChecked: false, trainingParts: [] }
  return normalizeCheckIn({ ...base, checkDate, trainingParts: parts })
}
function createCardioCheckIn(current, checkDate) {
  const base = normalizeCheckIn(current)
  if (base && base.trainingParts.length) throw new Error('今日已由训练自动打卡')
  return normalizeCheckIn({ checkDate, cardioChecked: true, trainingParts: [] })
}
~~~

月历固定返回 42 项，日期对象含 key、day、inMonth、future、today、source。统计只计算传入月份：训练日数看 trainingParts，有氧日数看无训练部位的 cardioChecked，每条训练记录的部位先去重，手动有氧记入 partDays.有氧。

- [ ] **Step 4: 运行测试确认通过**

Run: node --test utils/checkIn.test.cjs

Expected: PASS，3 个测试通过。

- [ ] **Step 5: 提交此任务**

~~~powershell
git add app-api/utils/checkIn.js app-api/utils/checkIn.test.cjs
git commit -m "feat: add daily check-in rules"
~~~

### Task 2: 接入 SQLite、H5 fallback 与备份

**Files:**
- Modify: app-api/utils/backup.js
- Modify: app-api/utils/backup.test.cjs
- Modify: app-api/utils/sqlite.js
- Modify: app-api/utils/sqlite.test.cjs

- [ ] **Step 1: 写入失败测试**

在 backup.test.cjs 断言仅有 exercise、train_record、weight_record 的 version 1 备份经 parseBackup 后含 data.check_in: []。在 sqlite.test.cjs 断言同日期保存两次只剩一条、先有氧后训练的 source 为 training、训练部位清空后恢复 cardio，并断言导出含 check_in、导入旧备份不抛错。

- [ ] **Step 2: 运行测试确认失败**

Run: node --test utils/backup.test.cjs utils/sqlite.test.cjs

Expected: FAIL，check_in 表和 saveCheckIn / getCheckIn 接口尚不存在。

- [ ] **Step 3: 扩展备份格式**

令 TABLE_NAMES 包含 exercise、train_record、weight_record、check_in，同时定义 REQUIRED_TABLE_NAMES 为前三项。让 createBackup 与 parseBackup 都把缺失的 check_in 标准化为空数组，新版导出始终包含它，旧备份仍可导入。

~~~js
function normalizeBackupData(data) {
  const source = data || {}
  if (REQUIRED_TABLE_NAMES.some((name) => !Array.isArray(source[name]))) {
    throw new Error('备份数据缺少必要的数据表')
  }
  return Object.fromEntries(TABLE_NAMES.map((name) => [name, clone(Array.isArray(source[name]) ? source[name] : [])]))
}
~~~

- [ ] **Step 4: 扩展 sqlite 适配层**

在 sqlite.js 导入 normalizeCheckIn，并在 EMPTY_STORE / normalizeStore 中增加 check_in: []。在 initDb 创建：

~~~js
await executeNative("CREATE TABLE IF NOT EXISTS check_in (checkDate TEXT PRIMARY KEY, cardioChecked INTEGER NOT NULL DEFAULT 0, trainingPartsJson TEXT NOT NULL DEFAULT '[]')")
~~~

实现并导出 inflateCheckIn(row)、listCheckIns()、getCheckIn(checkDate)、saveCheckIn(value)、deleteCheckIn(checkDate)。原生端按 checkDate 使用 INSERT OR REPLACE，fallback 端按日期替换数组元素。传入规范化为 null 的值时删除该日期记录。原生导出查询和导入删除/插入流程均加入 check_in；导入时每条数据使用 normalizeCheckIn 并过滤 null。

- [ ] **Step 5: 运行持久化测试确认通过**

Run: node --test utils/backup.test.cjs utils/sqlite.test.cjs

Expected: PASS，原有测试与新增持久化、旧备份兼容测试通过。

- [ ] **Step 6: 提交此任务**

~~~powershell
git add app-api/utils/backup.js app-api/utils/backup.test.cjs app-api/utils/sqlite.js app-api/utils/sqlite.test.cjs
git commit -m "feat: persist daily check-ins"
~~~

### Task 3: 训练组勾选同步为自动打卡

**Files:**
- Modify: app-api/pages/train/index.vue
- Modify: app-api/pages/train/index.test.cjs

- [ ] **Step 1: 写入失败测试**

在训练页测试中 mock listExercises、getCheckIn、saveCheckIn，验证勾选后会用全部今日已勾选动作的目标部位调用 syncTrainingCheckIn；同部位去重。验证取消最后勾选会同步空部位数组，且同步失败不撤销圆圈勾选并 toast 打卡同步失败。

- [ ] **Step 2: 运行测试确认失败**

Run: node --test pages/train/index.test.cjs

Expected: FAIL，当前 toggleSetCheck 仅更新 dailySetCheck。

- [ ] **Step 3: 增加同步实现**

在训练页导入 formatDate、getCheckIn、saveCheckIn、syncTrainingCheckIn。添加 isExerciseCheckedToday(exercise)：当前打开弹窗的动作检查全部 setDetails.setNo；其他动作根据 latestRecords[exercise.id].setDetails 的全部组号检查。添加 syncTodayTrainingCheckIn()：读取 allExercises，筛选已勾选动作，提取并去重 targetPart 或 target，再保存 syncTrainingCheckIn(await getCheckIn(formatDate()), formatDate(), parts)。

将 toggleSetCheck 改为 async：先调用 toggleDailySetChecked 并刷新 trainDialog，再等待同步；错误只 toast，不回滚勾选。成功加载动作后也调用一次同步，作为失败补偿。

- [ ] **Step 4: 运行训练页测试确认通过**

Run: node --test pages/train/index.test.cjs

Expected: PASS，包含新增勾选、取消与失败容错断言。

- [ ] **Step 5: 提交此任务**

~~~powershell
git add app-api/pages/train/index.vue app-api/pages/train/index.test.cjs
git commit -m "feat: sync training checks to daily check-ins"
~~~

### Task 4: 实现每日打卡月历并注册 Tab

**Files:**
- Create: app-api/pages/checkin/index.vue
- Create: app-api/pages/checkin/index.test.cjs
- Modify: app-api/pages.json

- [ ] **Step 1: 写入失败测试**

测试页面计算状态：monthTitle 为 2026 年 8 月、calendarDays 长度为 42、训练状态禁用有氧、切换月份可跨年、未来日期带 future: true、空状态点击有氧保存 { checkDate: today, cardioChecked: true, trainingParts: [] }，重复点击仍只保留一条。再断言本月统计为 checkedDays、trainingDays、cardioDays 与 partDays。

- [ ] **Step 2: 运行测试确认失败**

Run: node --test pages/checkin/index.test.cjs

Expected: FAIL，页面尚不存在。

- [ ] **Step 3: 创建页面**

Options API 的 data 至少包含 monthKey: formatDate().slice(0, 7)、records: []、loading: true。在 onShow 与月份变更时运行 loadMonth()：读取 listCheckIns()，以 createMonthGrid(monthKey, records, formatDate()) 和 summarizeMonth(records, monthKey) 驱动计算属性。checkCardio 先读当天记录，再使用 createCardioCheckIn 和 saveCheckIn；训练自动打卡异常时刷新并提示，成功后刷新并提示已完成有氧打卡。

模板提供七列网格、周一至周日表头、上/下月按钮、训练/有氧图例、本月三项统计、部位训练天数 chips 与今日状态按钮。CSS 使用 grid-template-columns: repeat(7, minmax(0, 1fr)) 和 aspect-ratio: 1；训练色 #2f855a，有氧色 #9ae6b4，并保留文字图例。未来日无打卡样式。

在 pages.json 注册 pages/checkin/index，并在体重管理后、动作预览前新增 Tab { pagePath: pages/checkin/index, text: 每日打卡 }。不移除现有 Tab。

- [ ] **Step 4: 运行页面测试确认通过**

Run: node --test pages/checkin/index.test.cjs

Expected: PASS，月历、统计与有氧幂等状态全部通过。

- [ ] **Step 5: 提交此任务**

~~~powershell
git add app-api/pages/checkin/index.vue app-api/pages/checkin/index.test.cjs app-api/pages.json
git commit -m "feat: add daily check-in calendar"
~~~

### Task 5: 总测试和手动验收

**Files:**
- Modify: app-api/package.json

- [ ] **Step 1: 更新测试脚本**

在 test:data 中加入 utils/checkIn.test.cjs 与 pages/checkin/index.test.cjs，保留全部现有测试。

- [ ] **Step 2: 运行自动测试和语法检查**

Run: npm run test:data

Expected: PASS，退出码 0。

Run: node --check utils/checkIn.js; node --check utils/sqlite.js

Expected: 两项均退出码 0 且没有输出。

- [ ] **Step 3: H5 手动验收**

用 HBuilderX 打开 app-api/ 并运行到浏览器：

1. 勾选训练组，确认当日训练打卡、有氧按钮锁定。
2. 取消最后勾选，确认训练打卡消失。
3. 完成有氧打卡，再勾选训练；确认升级为训练打卡，取消训练后恢复有氧。
4. 勾选不同部位，确认当月总打卡只加一天而部位各加一天；同部位多动作只加一天。
5. 切换月份，确认周一开头、42 格布局和未来日期样式。
6. 导出数据并导入空 H5 存储，确认日历和统计恢复。

- [ ] **Step 4: 提交此任务**

~~~powershell
git add app-api/package.json
git commit -m "test: cover daily check-in flow"
~~~

## 计划自检

- Spec coverage：Task 1 覆盖自动/手动规则、月历与部位统计；Task 2 覆盖 SQLite、H5、导入导出；Task 3 接通训练勾选；Task 4 交付页面与 Tab；Task 5 进行自动和手动验证。
- 数据一致性：所有层使用 checkDate、cardioChecked、trainingParts，页面 source 始终由训练部位推导。
- 旧备份兼容：旧版三表备份被标准化为四表，其中 check_in: []。
- 工作区注意：当前存在用户暂存修改。执行前先检查 git status；仅当索引没有无关修改时，才运行各任务的提交命令，不得将既有修改一并提交。

