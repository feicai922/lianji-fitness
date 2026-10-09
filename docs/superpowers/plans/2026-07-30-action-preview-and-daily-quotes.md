# API 版动作预览与每日诺言诺语实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 只为 `app-api` 增加独立动作预览页、可自定义部位筛选、每日诺言诺语卡片和设置开关，保持训练记录、体重管理和网络 GIF 不变。

**Architecture:** 动作预览复用 `loadExerciseCatalog()`、`trainParts.js` 和 `media.js`，通过原生 `swiper` 按筛选后的目录顺序切换。每日诺言诺语由根目录文本生成静态模块，运行时按本地日期选句；开关保存在本地存储，训练页 `onShow` 时重新读取。

**Tech Stack:** UniApp Vue 3、原生 `swiper`、Node.js 原生测试、现有动作目录/部位/GIF 工具。

---

### Task 1: 生成每日诺言诺语静态数据

**Files:** Create `app-api/scripts/build_daily_quotes.cjs`, `app-api/scripts/build_daily_quotes.test.cjs`, `app-api/data/dailyQuotes.js`; modify `app-api/package.json`; read `app-api/诺言诺语.txt`。

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { parseQuotes } = require('./build_daily_quotes.cjs')

test('parses the source file into 50 non-empty quotes without numbering', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '诺言诺语.txt'), 'utf8')
  const quotes = parseQuotes(source)
  assert.equal(quotes.length, 50)
  assert.ok(quotes.every((quote) => quote.length > 0))
  assert.equal(quotes[0].startsWith('1.'), false)
})
```

- [ ] **Step 2: Verify RED**

Run `node --test scripts/build_daily_quotes.test.cjs`; it must fail because the generator does not exist.

- [ ] **Step 3: Implement the parser and generator**

```js
const fs = require('node:fs')
const path = require('node:path')
const ROOT = path.resolve(__dirname, '..')
const INPUT_PATH = path.join(ROOT, '诺言诺语.txt')
const OUTPUT_PATH = path.join(ROOT, 'data', 'dailyQuotes.js')

function parseQuotes(text) {
  return String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/)
    .map((line) => line.trim()).filter(Boolean)
    .map((line) => line.replace(/^\d+[.、]\s*/, '').trim()).filter(Boolean)
}

function main() {
  const quotes = parseQuotes(fs.readFileSync(INPUT_PATH, 'utf8'))
  if (quotes.length !== 50) throw new Error('诺言诺语.txt 必须包含 50 条非空句子')
  fs.writeFileSync(OUTPUT_PATH, 'export default ' + JSON.stringify(quotes) + '\n', 'utf8')
}

if (require.main === module) main()
module.exports = { parseQuotes }
```

- [ ] **Step 4: Verify GREEN and generate data**

Run `node --test scripts/build_daily_quotes.test.cjs` and `node scripts/build_daily_quotes.cjs`; expect 50 parsed quotes and `data/dailyQuotes.js`.

- [ ] **Step 5: Add repeatable command and commit**

Add `"sync-quotes": "node scripts/build_daily_quotes.cjs"` to `app-api/package.json`, then run:

```powershell
git add app-api/scripts/build_daily_quotes.cjs app-api/scripts/build_daily_quotes.test.cjs app-api/data/dailyQuotes.js app-api/package.json
git commit -m "feat: add daily quote static data"
```

### Task 2: Implement daily quote and setting helpers

**Files:** Create `app-api/utils/dailyQuote.js` and `app-api/utils/dailyQuote.test.cjs`.

- [ ] **Step 1: Write the failing tests**

Test that the same local date returns the same index, the index is in `[0, 49]`, the storage key is `fitness_daily_quote_enabled_v1`, the default is `true`, and false/true changes persist through a provided storage adapter.

- [ ] **Step 2: Verify RED**

Run `node --test utils/dailyQuote.test.cjs`; it must fail because the module is absent.

- [ ] **Step 3: Implement the module**

```js
import dailyQuotes from '../data/dailyQuotes.js'

const STORAGE_KEY = 'fitness_daily_quote_enabled_v1'

function getDailyQuoteIndex(date = new Date(), count = dailyQuotes.length) {
  if (!count) return -1
  const start = new Date(date.getFullYear(), 0, 1)
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.floor((current - start) / 86400000) % count
}

function getDailyQuote(date = new Date()) {
  const index = getDailyQuoteIndex(date)
  return index < 0 ? '' : dailyQuotes[index] || ''
}

function getStorage(storage) {
  if (storage) return storage
  if (typeof uni !== 'undefined') return uni
  return null
}

function getDailyQuoteEnabled(storage) {
  const adapter = getStorage(storage)
  const value = adapter && typeof adapter.getStorageSync === 'function'
    ? adapter.getStorageSync(STORAGE_KEY) : undefined
  if (value === undefined || value === null || value === '') return true
  return value === true || value === 1 || value === '1' || value === 'true'
}

function setDailyQuoteEnabled(enabled, storage) {
  const value = Boolean(enabled)
  const adapter = getStorage(storage)
  if (adapter && typeof adapter.setStorageSync === 'function') adapter.setStorageSync(STORAGE_KEY, value)
  return value
}

export { STORAGE_KEY, getDailyQuoteIndex, getDailyQuote, getDailyQuoteEnabled, setDailyQuoteEnabled }
```

- [ ] **Step 4: Verify GREEN and commit**

Run `node --test utils/dailyQuote.test.cjs`, then commit the helper and test with `feat: add daily quote settings helper`.

### Task 3: Register settings and the third bottom tab

**Files:** Modify `app-api/pages.json`; create `app-api/pages/settings/index.vue` and `app-api/pages/settings/index.test.cjs`.

- [ ] **Step 1: Write the failing page/config test**

Assert that `pages/settings/index` is registered but absent from `tabBar`, the last tab is `pages/preview/index`, and the settings source contains `每日诺言诺语`, `switch`, and `setDailyQuoteEnabled`.

- [ ] **Step 2: Verify RED**

Run `node --test pages/settings/index.test.cjs`; it must fail before registration/page creation.

- [ ] **Step 3: Register pages**

Add `pages/settings/index` with the title `设置`, and append `{ "pagePath": "pages/preview/index", "text": "动作预览" }` to the existing tabBar list.

- [ ] **Step 4: Implement settings page**

Use a `switch` bound to `enabled`; in `onShow`, call `getDailyQuoteEnabled()`, and in the change handler call `setDailyQuoteEnabled(event.detail.value)`. Display a single row named `每日诺言诺语` with the hint `在训练记录页面底部显示每日一句`.

- [ ] **Step 5: Verify GREEN and commit**

Run `node --test pages/settings/index.test.cjs`; commit with `feat: add settings page and preview tab`.

### Task 4: Add the daily quote to the training page

**Files:** Modify `app-api/pages/train/index.vue` and `app-api/pages/train/index.test.cjs`.

- [ ] **Step 1: Write the failing page assertions**

Assert the source includes `/pages/settings/index`, `getDailyQuoteEnabled`, `getDailyQuote`, and `每日诺言诺语`; run `node --test pages/train/index.test.cjs` and verify RED.

- [ ] **Step 2: Add the settings entry and quote state**

Wrap the title/subtitle in a heading with a right-side `设置` click target. Import the daily quote helpers and add `dailyQuoteEnabled: true` and `dailyQuote: ''` to data.

- [ ] **Step 3: Add the bottom card and lifecycle methods**

Render the card after the exercise list and before overlays when `dailyQuoteEnabled && dailyQuote`. Implement:

```js
loadDailyQuote() {
  this.dailyQuoteEnabled = getDailyQuoteEnabled()
  this.dailyQuote = this.dailyQuoteEnabled ? getDailyQuote() : ''
},
openSettings() {
  uni.navigateTo({ url: '/pages/settings/index' })
}
```

Call `loadDailyQuote()` from `onShow` and from pull-down refresh. Returning from settings must refresh the value.

- [ ] **Step 4: Verify GREEN and commit**

Run `node --test pages/train/index.test.cjs`; commit with `feat: show daily quote on training page`.

### Task 5: Implement the action preview page

**Files:** Create `app-api/pages/preview/index.vue` and `app-api/pages/preview/index.test.cjs`.

- [ ] **Step 1: Write the failing page test**

Assert page registration/tabBar placement and source presence of `<swiper`, `@change="handleSwiperChange"`, `getTrainPartTabs`, `openPartEditor`, `getExerciseGifSources`, and `instructions_zh`; run the test and verify RED.

- [ ] **Step 2: Implement catalog state and filtering**

Use `catalog`, `partTabs`, `activePart`, `customParts`, `customPartTargets`, `partEditor`, `currentIndex`, `gifSourceIndex`, `imageFailed`, and `loading`. Compute `visibleExercises` with `matchesTrainPart(item, activePart)`, `currentExercise`, `gifSources`, `gifUrl`, and punctuation-split `steps`.

- [ ] **Step 3: Implement the swiper card**

Use a non-circular `swiper` bound to `currentIndex`; each slide shows the network GIF, name, target, `第 x / y 个`, and Chinese steps. `handleSwiperChange` updates the index and resets GIF failure state. On image failure, try the next source before showing the existing fallback text. An empty filtered list shows `这个部位还没有动作`.

- [ ] **Step 4: Reuse custom part behavior**

Copy the existing train-page editor interaction, calling `addCustomTrainPart`, `saveCustomTrainParts`, `loadCustomTrainParts`, and `getTrainPartTabs` with the shared `fitness_train_custom_parts_v1` key. Reset `currentIndex`, `gifSourceIndex`, and `imageFailed` whenever the part changes.

- [ ] **Step 5: Verify GREEN and commit**

Run `node --test pages/preview/index.test.cjs`; commit with `feat: add action preview page`.

### Task 6: Full verification and manual acceptance

**Files:** Verify all API files above and the generated `app-api/data/dailyQuotes.js`.

- [ ] **Step 1: Regenerate and run all tests**

Run:

```powershell
npm run sync-quotes
npm run test:data
```

Expect all tests to pass, 1324 exercise rows to remain available, and 50 quote rows to be generated.

- [ ] **Step 2: Run syntax and diff checks**

Run `node --check scripts/build_daily_quotes.cjs`, `node --check utils/dailyQuote.js`, and `git diff --check -- app-api`; all must exit 0.

- [ ] **Step 3: Manual HBuilderX acceptance**

Run the API version and verify: the third bottom tab opens action preview; each default/custom part filters in order; GIF/name/steps change together; settings can hide and restore the quote card; the same day keeps the same quote; existing training and weight pages remain usable.

- [ ] **Step 4: Record final status**

Run `git status --short` and `git log -5 --oneline`, then report test counts and remind the user to rerun or repackage the API APK in HBuilderX.
