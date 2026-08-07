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
