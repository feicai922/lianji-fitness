# 全量动作目录与逐组训练记录 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将两个 UniApp 版本升级为包含全部有效动作、使用健身语境大模型翻译动作名，并支持每组独立重量与次数且兼容旧记录。

**Architecture:** 数据生成阶段在两个项目中运行同一套 Node.js 清洗与翻译流程。翻译通过环境变量配置的 OpenAI 兼容 Chat Completions 接口完成，结果按动作 id 缓存，本地生成的中文目录直接打包进 App；App 运行时不接触翻译 API。训练数据继续沿用 train_record，增加 setDetailsJson 保存逐组 JSON，并在读取层将旧的固定 weight/sets/reps 记录转换成重复组明细。

**Tech Stack:** UniApp Vue 3、Vue 单文件组件、Node.js CommonJS 数据脚本、Android App-Plus SQLite、H5 uni.setStorageSync 降级存储、Node.js 内置 fetch、Node test runner。

---

### Task 1: 建立可测试的健身动作翻译模块

**Files:**
- Create: app-local/scripts/translation.cjs
- Create: app-local/scripts/translation.test.cjs
- Create: app-api/scripts/translation.cjs
- Create: app-api/scripts/translation.test.cjs
- Modify: app-local/.gitignore
- Modify: app-api/.gitignore
- Modify: .gitignore

- [ ] **Step 1: Write failing translation tests**

在两个项目的 translation.test.cjs 使用相同测试内容，覆盖以下纯函数契约：

~~~js
const assert = require('node:assert/strict')
const test = require('node:test')
const {
  buildTranslationPrompt,
  parseTranslationResponse,
  normalizeBaseUrl,
  mergeTranslationCache
} = require('./translation.cjs')

test('builds a fitness-context prompt without asking for explanations', () => {
  const prompt = buildTranslationPrompt([{ id: '1', name: 'incline dumbbell press' }])
  assert.match(prompt, /健身/)
  assert.match(prompt, /严格 JSON/)
  assert.match(prompt, /incline dumbbell press/)
})

test('parses a JSON array returned inside a markdown fence', () => {
  const fence = String.fromCharCode(96).repeat(3)
  const result = parseTranslationResponse(fence + 'json\n[{"id":"1","name_zh":"\\u4e0a\\u659c\\u54d1\\u94c3\\u63a8\\u4e3e"}]\n' + fence)
  assert.deepEqual(result, { '1': '上斜哑铃推举' })
})

test('rejects missing ids and empty translations', () => {
  assert.throws(() => parseTranslationResponse('[{"id":"1","name_zh":""}]'), /翻译结果/)
  assert.throws(() => parseTranslationResponse('[{"id":"2","name_zh":"卧推"}]'), /id/)
})

test('normalizes an OpenAI-compatible base URL', () => {
  assert.equal(normalizeBaseUrl('https://example.com/v1/'), 'https://example.com/v1')
})

test('cache merge keeps source text with translated name', () => {
  const result = mergeTranslationCache({}, [{ id: '1', name: 'bench press' }], { '1': '杠铃卧推' })
  assert.deepEqual(result['1'], { source: 'bench press', name_zh: '杠铃卧推' })
})
~~~

- [ ] **Step 2: Run the tests and confirm they fail**

Run in both app-local and app-api:

~~~powershell
node --test scripts/translation.test.cjs
~~~

Expected: FAIL because translation.cjs does not exist yet.

- [ ] **Step 3: Implement the translation module**

Export these functions:

- buildTranslationPrompt(items): instruct the model to translate English exercise names into natural Simplified Chinese in a professional fitness context; preserve equipment, posture, grip, direction, side, and variation; return only an array of {id,name_zh}.
- parseTranslationResponse(content, expectedItems): strip an optional Markdown JSON fence, parse an array, require every expected id exactly once, require a non-empty name_zh, and reject an unchanged English source.
- normalizeBaseUrl(value): remove trailing slashes.
- mergeTranslationCache(cache, items, translations): write { source, name_zh } entries keyed by id.
- translateBatch(items, options): POST to the normalized base URL plus /chat/completions with model, temperature 0.1, a system message containing the fitness translation rules, and a user message containing the JSON input list. Use injected fetchImpl and sleepImpl for tests. Retry HTTP 429 and 5xx responses up to three attempts with 1s and 2s delays; throw an error containing the batch ids after the final failure.
- loadTranslationConfig(env): require TRANSLATION_API_BASE_URL, TRANSLATION_API_KEY, and TRANSLATION_MODEL only when untranslated items exist; never log the key.

- [ ] **Step 4: Run translation tests**

~~~powershell
node --test scripts/translation.test.cjs
~~~

Expected: PASS.

- [ ] **Step 5: Add only local cache patterns to ignore files**

Add this pattern to the root and both child ignore files:

~~~gitignore
**/.translation-cache.json
~~~

Do not add any API key, certificate, or real endpoint to a tracked file.

---

### Task 2: Replace five-category cleaning with full catalog generation

**Files:**
- Modify: app-local/scripts/clean_exercises.cjs
- Modify: app-local/scripts/clean_exercises.test.cjs
- Modify: app-api/scripts/clean_exercises.cjs
- Modify: app-api/scripts/clean_exercises.test.cjs
- Modify: app-local/package.json
- Modify: app-api/package.json

- [ ] **Step 1: Update cleaning tests to require all target mappings and model-provided names**

Replace the current fallback-translation assertions with tests that pass an explicit translation map:

~~~js
test('keeps every supported target and only the five catalog fields', () => {
  const item = normalizeExercise({
    id: '001',
    name: 'incline dumbbell press',
    target: 'pectorals',
    media_id: 'abc',
    instructions: { zh: '躺下。推起。' }
  }, { translations: { '001': '上斜哑铃推举' } })

  assert.deepEqual(Object.keys(item), ['id', 'name_zh', 'target', 'media_id', 'instructions_zh'])
  assert.equal(item.name_zh, '上斜哑铃推举')
  assert.equal(item.target, '胸')
})

test('keeps non-common target categories instead of filtering them', () => {
  const result = cleanExercises([
    { id: 'a', name: 'crunch', target: 'abs', media_id: '1', instructions: { zh: '收紧。' } }
  ], { translations: { a: '卷腹' } })
  assert.equal(result[0].target, '腹部')
})

test('rejects a missing model translation instead of using token concatenation', () => {
  assert.equal(normalizeExercise({
    id: 'a', name: 'unmapped movement', target: 'abs', media_id: '1',
    instructions: { zh: '收紧。' }
  }, { translations: {} }), null)
})
~~~

Add a test asserting Object.keys(TARGET_MAP).length === 19 and all 19 source targets produce a non-null normalized row.

- [ ] **Step 2: Run the cleaning tests and confirm the old fallback assertions fail**

~~~powershell
node --test scripts/clean_exercises.test.cjs
~~~

Expected: FAIL on the old five-category and dictionary-fallback expectations.

- [ ] **Step 3: Implement full target mapping and strict translation lookup**

In both cleaning scripts:

- Expand TARGET_MAP to the 19 observed source targets: abs, quads, lats, calves, pectorals, glutes, hamstrings, adductors, triceps, cardiovascular system, spine, upper back, biceps, delts, forearms, traps, serratus anterior, abductors, levator scapulae.
- Remove PHRASE_MAP, TOKEN_MAP and the English token concatenation fallback.
- Change normalizeExercise(item, { translations }) to use item.name_zh when present, otherwise translations[item.id]; return null when no Chinese name is available.
- Keep instructions.zh as instructions_zh; do not call the model for the existing 1324 Chinese instruction values.
- Keep required-field validation, duplicate id de-duplication, UTF-8 output, and the local GIF copy behavior.

- [ ] **Step 4: Make the clean command translate missing names, cache by source id, then write output**

The asynchronous main flow in both scripts must:

1. Read exercises-dataset-main/data/exercises.json.
2. Read data/.translation-cache.json if it exists.
3. Collect records with no name_zh and no cache entry whose cached source equals the current English name.
4. If the list is non-empty, load the three translation environment variables and send batches of 20 items.
5. After each successful batch, merge and write the cache as UTF-8 JSON so an interrupted run can resume.
6. Build the cleaned catalog with the merged translations.
7. Abort before writing output if any valid record still lacks a translation; list the missing ids and English names.
8. Atomically write static/json/clean_fitness_zh.json and data/clean_fitness_zh.js; the local version then copies only referenced GIFs.

- [ ] **Step 5: Add local configuration and run fixture tests**

Add a tracked scripts/translation.example.env in each project containing only:

~~~text
TRANSLATION_API_BASE_URL=https://replace-with-your-openai-compatible-endpoint/v1
TRANSLATION_API_KEY=replace-me
TRANSLATION_MODEL=replace-with-your-model-id
~~~

Run:

~~~powershell
node --test scripts/clean_exercises.test.cjs scripts/translation.test.cjs
node --check scripts/clean_exercises.cjs
node --check scripts/translation.cjs
~~~

Expected: PASS in both projects. Do not run the full 1324-item translation until the user sets a new key locally.

---

### Task 3: Add dynamic catalog categories and preserve source targets when adding

**Files:**
- Create: app-local/utils/catalog.test.cjs
- Create: app-api/utils/catalog.test.cjs
- Modify: app-local/utils/catalog.js
- Modify: app-api/utils/catalog.js
- Modify: app-local/pages/train/index.vue
- Modify: app-api/pages/train/index.vue
- Modify: app-local/components/ExercisePicker.vue
- Modify: app-api/components/ExercisePicker.vue

- [ ] **Step 1: Write failing category-order tests**

Export getCatalogParts(catalog) from both catalog modules and test:

~~~js
test('returns all, common parts, then remaining source order', async () => {
  const { getCatalogParts } = await import('./catalog.js')
  assert.deepEqual(getCatalogParts([
    { target: '肱二头肌' }, { target: '胸' }, { target: '腹部' }, { target: '胸' }
  ]), ['全部', '胸', '腹部', '肱二头肌'])
})
~~~

- [ ] **Step 2: Implement the pure category helper**

Use the order 全部 → 胸、肩、背、腿、有氧 when present → remaining unique target values in first-seen order. Export the helper without changing the catalog cache key or storage behavior.

- [ ] **Step 3: Update the training page data flow**

In both training pages:

- Load all user-added exercises with listExercises() once, store them as allExercises, and expose exercises as a computed filter for activePart.
- Load the catalog before computing parts, or recompute parts = getCatalogParts(catalog) after catalog load.
- Set the initial active part to 全部.
- Filter picker items by current part unless the current part is 全部, then apply the existing Chinese-name search.
- In addFromCatalog(item), call addExercise(item) without replacing item.target with activePart.
- Keep existing selected-id and tutorial behavior.

- [ ] **Step 4: Update the picker subtitle and category layout**

Make the subtitle say 添加动作 for 全部, otherwise 添加到「部位」. Make the category row horizontally scrollable so all 19 categories remain usable on a phone. Keep the existing search field and selected labels.

- [ ] **Step 5: Run category and existing catalog tests**

~~~powershell
node --test utils/catalog.test.cjs utils/sqlite.test.cjs
~~~

Expected: PASS in both projects.

---

### Task 4: Add set-detail validation and storage compatibility

**Files:**
- Modify: app-local/utils/validators.js
- Modify: app-api/utils/validators.js
- Modify: app-local/utils/sqlite.js
- Modify: app-api/utils/sqlite.js
- Modify: app-local/utils/sqlite.test.cjs
- Modify: app-api/utils/sqlite.test.cjs

- [ ] **Step 1: Write failing validation and storage tests**

Add tests for:

~~~js
const details = [
  { setNo: 1, weight: '40', reps: '12' },
  { setNo: 2, weight: '45', reps: '10' }
]
const result = validateTrainForm({ setDetails: details })
assert.deepEqual(result.value.setDetails, [
  { setNo: 1, weight: 40, reps: 12 },
  { setNo: 2, weight: 45, reps: 10 }
])
assert.equal(validateTrainForm({ setDetails: [{ setNo: 1, weight: '', reps: '12' }] }).valid, false)
~~~

Add a fallback-storage test:

~~~js
const record = await db.addTrainRecord({
  exerciseId: 'bench',
  setDetails: [
    { setNo: 1, weight: 40, reps: 12 },
    { setNo: 2, weight: 45, reps: 10 }
  ],
  trainDate: '2026-07-29'
})
const saved = (await db.listTrainRecords('bench'))[0]
assert.deepEqual(saved.setDetails, [
  { setNo: 1, weight: 40, reps: 12 },
  { setNo: 2, weight: 45, reps: 10 }
])
~~~

Add a legacy test that { weight: 40, sets: 4, reps: 10 } reads as four identical set details.

- [ ] **Step 2: Run the new tests and confirm they fail**

~~~powershell
node --test utils/sqlite.test.cjs
~~~

Expected: FAIL because the current validator only accepts scalar weight/sets/reps and SQLite has no set-details field.

- [ ] **Step 3: Implement strict per-set normalization**

In both validators, add validateSetDetails(setDetails) and make validateTrainForm accept the new shape while retaining scalar input compatibility for old callers. Normalize all rows to:

~~~js
{ setNo: 1, weight: Number(weight), reps: Number(reps) }
~~~

Reject empty weight, negative weight, zero/non-integer reps, missing rows, and non-contiguous set numbers. Return legacy summary fields from the first row plus setDetails.

In both SQLite modules:

- Add setDetailsJson TEXT to the table creation SQL.
- Run ALTER TABLE train_record ADD COLUMN setDetailsJson TEXT inside a try/catch after table creation.
- Add normalizeSetDetails and inflateTrainRecord helpers.
- Store new rows using JSON.stringify(setDetails).
- Read and parse setDetailsJson; if absent or invalid, repeat old scalar values sets times.
- Return setDetails, sets, weight, and reps so old cards and new UI both have a stable contract.
- Update fallback storage normalization so old persisted records are upgraded on read without losing data.
- Keep delete and date ordering behavior unchanged.

- [ ] **Step 4: Run storage and syntax tests**

~~~powershell
node --test utils/sqlite.test.cjs
node --check utils/sqlite.js
node --check utils/validators.js
~~~

Expected: PASS in both projects.

---

### Task 5: Replace the fixed training dialog with dynamic set rows

**Files:**
- Modify: app-local/pages/train/index.vue
- Modify: app-api/pages/train/index.vue
- Modify: app-local/components/ExerciseCard.vue
- Modify: app-api/components/ExerciseCard.vue

- [ ] **Step 1: Add UI regression checks to the implementation checklist**

Before editing, verify the current dialog contains the fixed fields 重量、组数、每组次数; after editing, the template must contain a v-for over trainDialog.setDetails, an add-set action, and a per-row delete action. This is a static check because UniApp SFCs are not compiled by the Node unit suite.

- [ ] **Step 2: Implement dynamic four-set dialog**

In both training pages:

- Replace scalar dialog fields with setDetails: [].
- Add createDefaultSetDetails() returning four rows with blank weight and reps.
- On opening a new record, use four default rows.
- On opening an existing record, clone latest.setDetails.
- Render each row with 第 N 组, a kg input, a 次数 input, and a delete button; disable deletion when only one row remains.
- Add an 添加一组 button.
- Pass setDetails to validateTrainForm.
- On update, call updateTrainRecord(recordId, result.value); on insert, call addTrainRecord({ exerciseId, ...result.value }).
- Keep existing success/error toasts and reload behavior.

- [ ] **Step 3: Update card summaries**

Display a compact summary generated from latestRecord.setDetails, for example:

~~~text
4 组 · 40×12 / 45×10 / 45×8 / 50×6
~~~

For a legacy record, the storage layer will already provide repeated details, so no special card branch is needed.

- [ ] **Step 4: Add responsive styles**

Make the dialog body scrollable when more than four rows exist, keep the footer visible, and give each row enough horizontal space for weight, reps, and delete controls on a narrow Android screen.

- [ ] **Step 5: Run static and unit verification**

~~~powershell
Select-String -Path pages/train/index.vue -Pattern 'trainDialog\.setDetails|v-for=.*setDetails|添加一组'
node --test utils/sqlite.test.cjs utils/catalog.test.cjs
~~~

Expected: the static search finds all three UI markers and the unit tests pass in both projects.

---

### Task 6: Update documentation, run complete verification, and generate the new catalog

**Files:**
- Modify: README.md
- Modify: app-local/README.md
- Modify: app-api/README.md
- Modify: app-local/package.json
- Modify: app-api/package.json

- [ ] **Step 1: Document safe translation setup**

Document that the user must revoke the exposed key, create a replacement, set the three environment variables locally, run node scripts/clean_exercises.cjs, and never commit the key or cache. Use placeholders only:

~~~powershell
$env:TRANSLATION_API_BASE_URL = '你的 OpenAI 兼容接口地址'
$env:TRANSLATION_API_KEY = '新的本地 Key'
$env:TRANSLATION_MODEL = '你的模型名称'
node scripts/clean_exercises.cjs
~~~

Document that the two generated catalog files are committed and the App never calls the model.

- [ ] **Step 2: Run all tests and checks in both projects**

~~~powershell
node --test scripts/clean_exercises.test.cjs scripts/translation.test.cjs utils/sqlite.test.cjs utils/catalog.test.cjs utils/media.test.cjs
node --check scripts/clean_exercises.cjs
node --check scripts/translation.cjs
node --check utils/sqlite.js
node --check utils/validators.js
~~~

Expected: all tests pass and all checks exit with code 0 in app-local and app-api.

- [ ] **Step 3: Generate the full catalog locally with the user’s replacement key**

After the user sets a replacement key in their own PowerShell session:

~~~powershell
Set-Location app-local
node scripts/clean_exercises.cjs
Set-Location ../app-api
node scripts/clean_exercises.cjs
~~~

Expected: each project reports 1324 valid records (or the exact count after required-field validation), all 19 target labels are represented, and no output name is empty or identical to its English source.

- [ ] **Step 4: Validate generated output without printing secrets**

For each project, run:

~~~powershell
node -e "const fs=require('fs'); const x=JSON.parse(fs.readFileSync('static/json/clean_fitness_zh.json','utf8')); console.log({count:x.length, fields:[...new Set(x.flatMap(Object.keys))], parts:[...new Set(x.map(v=>v.target))]})"
~~~

Expected: fields are exactly id,name_zh,target,media_id,instructions_zh; count is the full valid count; no API key appears in tracked files.

- [ ] **Step 5: Review the diff before committing**

~~~powershell
git diff --check
git status --short
git diff --stat
~~~

Confirm that only source, tests, generated catalog, docs, and ignore rules are included; .translation-cache.json, datasets, build outputs, APKs, and signing files remain ignored.
