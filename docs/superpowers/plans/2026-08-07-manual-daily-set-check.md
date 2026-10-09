# Manual Daily Set Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual, daily-resetting completion circle for every training set and remove the Daily Promise/Quote feature from the API app.

**Architecture:** A new `utils/dailySetCheck.js` module owns a single local-storage payload keyed by local calendar date, exercise ID, and set number. The train page loads the status for its dialog and only changes it from the circle control; it never stores this status in SQLite training records. Removing Daily Promise/Quote also removes the settings switch, backup preference, data, script, utility, and tests.

**Tech Stack:** UniApp Vue 3, JavaScript ES modules, `uni` synchronous storage, Node.js built-in test runner.

---

## File structure

- Create `app-api/utils/dailySetCheck.js`: date-keyed check-state persistence.
- Create `app-api/utils/dailySetCheck.test.cjs`: unit tests for isolation, toggling, same-day persistence, and next-day reset.
- Modify `app-api/pages/train/index.vue` and `app-api/pages/train/index.test.cjs`: add the left circle and delete quote use.
- Modify `app-api/pages/settings/index.vue`, `app-api/pages/settings/index.test.cjs`, `app-api/utils/backup.js`, and `app-api/utils/backup.test.cjs`: remove quote setting and preference.
- Modify `app-api/package.json`: exchange the obsolete quote test for the new set-check test.
- Delete `app-api/utils/dailyQuote.js`, `app-api/utils/dailyQuote.test.cjs`, `app-api/data/dailyQuotes.js`, `app-api/data/seasonalQuotes.js`, `app-api/scripts/build_daily_quotes.cjs`, `app-api/scripts/build_daily_quotes.test.cjs`, and `app-api/诺言诺语.txt`.

### Task 1: Add the daily-set-check utility with tests

**Files:**
- Create: `app-api/utils/dailySetCheck.js`
- Test: `app-api/utils/dailySetCheck.test.cjs`

- [ ] **Step 1: Write the failing tests**

```js
const test = require('node:test')
const assert = require('node:assert/strict')

function storageAdapter() {
  const values = new Map()
  return {
    getStorageSync(key) { return values.get(key) },
    setStorageSync(key, value) { values.set(key, value) }
  }
}

test('toggles one exercise set without affecting another set or exercise', async () => {
  const { isDailySetChecked, toggleDailySetChecked } = await import('./dailySetCheck.js')
  const storage = storageAdapter()
  const date = new Date(2026, 7, 7, 10)
  assert.equal(isDailySetChecked('bench', 1, storage, date), false)
  assert.equal(toggleDailySetChecked('bench', 1, storage, date), true)
  assert.equal(isDailySetChecked('bench', 1, storage, date), true)
  assert.equal(isDailySetChecked('bench', 2, storage, date), false)
  assert.equal(isDailySetChecked('squat', 1, storage, date), false)
  assert.equal(toggleDailySetChecked('bench', 1, storage, date), false)
})

test('keeps checks for one local day and resets them on the next day', async () => {
  const { isDailySetChecked, toggleDailySetChecked } = await import('./dailySetCheck.js')
  const storage = storageAdapter()
  toggleDailySetChecked('bench', 3, storage, new Date(2026, 7, 7, 23))
  assert.equal(isDailySetChecked('bench', 3, storage, new Date(2026, 7, 7, 23, 59)), true)
  assert.equal(isDailySetChecked('bench', 3, storage, new Date(2026, 7, 8, 0, 1)), false)
})
```

- [ ] **Step 2: Verify the test is red**

Run: `node --test utils/dailySetCheck.test.cjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `dailySetCheck.js`.

- [ ] **Step 3: Write the minimal utility**

```js
const STORAGE_KEY = 'fitness_daily_set_checks_v1'

function getStorage(storage) {
  if (storage) return storage
  if (typeof uni !== 'undefined') return uni
  return null
}

function getLocalDateKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function getSetKey(exerciseId, setNo) {
  return String(exerciseId) + ':' + Number(setNo)
}

function readTodayChecks(storage, date = new Date()) {
  const adapter = getStorage(storage)
  const value = adapter && typeof adapter.getStorageSync === 'function' ? adapter.getStorageSync(STORAGE_KEY) : null
  if (!value || typeof value !== 'object' || value.date !== getLocalDateKey(date) || !Array.isArray(value.checked)) return []
  return [...new Set(value.checked.map(String))]
}

function isDailySetChecked(exerciseId, setNo, storage, date = new Date()) {
  return readTodayChecks(storage, date).includes(getSetKey(exerciseId, setNo))
}

function toggleDailySetChecked(exerciseId, setNo, storage, date = new Date()) {
  const adapter = getStorage(storage)
  const key = getSetKey(exerciseId, setNo)
  const current = readTodayChecks(adapter, date)
  const checked = current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
  if (adapter && typeof adapter.setStorageSync === 'function') adapter.setStorageSync(STORAGE_KEY, { date: getLocalDateKey(date), checked })
  return checked.includes(key)
}

export { STORAGE_KEY, getLocalDateKey, getSetKey, readTodayChecks, isDailySetChecked, toggleDailySetChecked }
```

- [ ] **Step 4: Verify the test is green**

Run: `node --test utils/dailySetCheck.test.cjs`

Expected: PASS; 2 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add utils/dailySetCheck.js utils/dailySetCheck.test.cjs
git commit -m "feat: add manual daily set checks"
```

### Task 2: Render and toggle the left circle

**Files:**
- Modify: `app-api/pages/train/index.vue`
- Modify: `app-api/pages/train/index.test.cjs`

- [ ] **Step 1: Make the page test fail for the new control and removed quote**

Replace its quote-positive assertion with:

```js
assert.match(source, /daily-set-check/)
assert.match(source, /@click="toggleSetCheck\(set\.setNo\)"/)
assert.match(source, /isDailySetChecked/)
assert.doesNotMatch(source, /每日诺言诺语/)
assert.doesNotMatch(source, /dailyQuote/)
```

- [ ] **Step 2: Verify it is red**

Run: `node --test pages/train/index.test.cjs`

Expected: FAIL because the control and methods do not exist, while quote references remain.

- [ ] **Step 3: Implement the page-only UI behavior**

In `pages/train/index.vue`, replace the quote import with:

```js
import { isDailySetChecked, toggleDailySetChecked } from '@/utils/dailySetCheck'
```

Remove `dailyQuoteEnabled`, `dailyQuote`, `loadDailyQuote()`, its calls from `onShow` and `onPullDownRefresh`, and the `.daily-quote-card` markup/styles. Add:

```js
isSetChecked(setNo) {
  const exercise = this.trainDialog.exercise
  return Boolean(exercise && isDailySetChecked(exercise.id, setNo))
},
toggleSetCheck(setNo) {
  const exercise = this.trainDialog.exercise
  if (!exercise) return
  toggleDailySetChecked(exercise.id, setNo)
  this.trainDialog = { ...this.trainDialog }
}
```

Add this as the first child of every `.set-row`:

```vue
<view class="daily-set-check" :class="{ checked: isSetChecked(set.setNo) }" @click="toggleSetCheck(set.setNo)">
  <text>{{ isSetChecked(set.setNo) ? '✓' : '' }}</text>
</view>
```

Add:

```css
.daily-set-check { display: flex; flex-shrink: 0; align-items: center; justify-content: center; width: 42rpx; height: 42rpx; margin-right: 12rpx; border: 2rpx solid #cfd3d6; border-radius: 50%; color: #ffffff; font-size: 25rpx; }
.daily-set-check.checked { border-color: #17191c; background: #17191c; }
```

- [ ] **Step 4: Verify it is green**

Run: `node --test pages/train/index.test.cjs`

Expected: PASS; both source-level page tests pass.

- [ ] **Step 5: Commit**

```powershell
git add pages/train/index.vue pages/train/index.test.cjs
git commit -m "feat: toggle daily training sets manually"
```

### Task 3: Remove the quote setting and its backup preference

**Files:**
- Modify: `app-api/pages/settings/index.vue`
- Modify: `app-api/pages/settings/index.test.cjs`
- Modify: `app-api/utils/backup.js`
- Modify: `app-api/utils/backup.test.cjs`

- [ ] **Step 1: Write the failing removal tests**

Replace the quote-positive settings assertions with:

```js
assert.doesNotMatch(source, /每日诺言诺语/)
assert.doesNotMatch(source, /<switch/)
assert.doesNotMatch(source, /DailyQuote/)
```

In `utils/backup.test.cjs`, remove the quote entry and final equality assertion, then add:

```js
assert.equal(Object.hasOwn(preferences, 'fitness_daily_quote_enabled_v1'), false)
```

- [ ] **Step 2: Verify they are red**

Run: `node --test pages/settings/index.test.cjs utils/backup.test.cjs`

Expected: FAIL because the settings switch and old preference key remain.

- [ ] **Step 3: Remove the obsolete implementation**

Delete the quote card, quote import, `data()`, `onShow()`, `handleChange()`, post-import enabled assignment, and related CSS from `pages/settings/index.vue`, retaining only backup controls. Remove `DAILY_QUOTE_KEY` and both occurrences of it in preference loops in `utils/backup.js`.

- [ ] **Step 4: Verify they are green**

Run: `node --test pages/settings/index.test.cjs utils/backup.test.cjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add pages/settings/index.vue pages/settings/index.test.cjs utils/backup.js utils/backup.test.cjs
git commit -m "refactor: remove daily quote preferences"
```

### Task 4: Delete quote artifacts and complete verification

**Files:**
- Modify: `app-api/package.json`
- Delete: `app-api/utils/dailyQuote.js`, `app-api/utils/dailyQuote.test.cjs`, `app-api/data/dailyQuotes.js`, `app-api/data/seasonalQuotes.js`, `app-api/scripts/build_daily_quotes.cjs`, `app-api/scripts/build_daily_quotes.test.cjs`, `app-api/诺言诺语.txt`

- [ ] **Step 1: Update the test script**

Set `test:data` to:

```json
"test:data": "node --test scripts/clean_exercises.test.cjs scripts/translation.test.cjs utils/sqlite.test.cjs utils/backup.test.cjs utils/exerciseOrder.test.cjs utils/catalog.test.cjs utils/media.test.cjs utils/dailySetCheck.test.cjs pages/train/index.test.cjs pages/settings/index.test.cjs pages/preview/index.test.cjs utils/trainParts.test.cjs"
```

- [ ] **Step 2: Delete the removed feature files**

Run:

```powershell
Remove-Item -LiteralPath 'utils/dailyQuote.js','utils/dailyQuote.test.cjs','data/dailyQuotes.js','data/seasonalQuotes.js','scripts/build_daily_quotes.cjs','scripts/build_daily_quotes.test.cjs','诺言诺语.txt'
```

Expected: only the seven listed files are removed.

- [ ] **Step 3: Verify no current source references the feature**

Run: `Get-ChildItem -File -Recurse -Include *.js,*.cjs,*.vue,package.json | Select-String -Pattern 'dailyQuote|每日诺言诺语|build_daily_quotes|seasonalQuotes'`

Expected: no matches outside ignored historical backup folders.

- [ ] **Step 4: Run the full test suite**

Run: `npm run test:data`

Expected: exit code 0; every listed Node test passes.

- [ ] **Step 5: Commit cleanup**

```powershell
git add package.json
git add -u -- utils/dailyQuote.js utils/dailyQuote.test.cjs data/dailyQuotes.js data/seasonalQuotes.js scripts/build_daily_quotes.cjs scripts/build_daily_quotes.test.cjs 诺言诺语.txt
git commit -m "refactor: remove daily promise quotes"
```

## Final verification

- [ ] Run `npm run test:data` again after the final commit candidate.
- [ ] Run `git diff --check` and verify no whitespace errors.
- [ ] In HBuilderX/H5 preview, verify each left circle toggles independently; remains checked after reopening the dialog today; can be unchecked; and is unaffected by saving a record or changing weight/reps.
- [ ] Open Settings and verify only data-backup controls remain.

