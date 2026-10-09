const assert = require('node:assert/strict')
const test = require('node:test')

test('round-trips the three app data tables through a validated backup payload', async () => {
  const { createBackup, parseBackup } = await import('./backup.js')
  const source = {
    exercise: [{ id: 'bench', nameZh: '卧推' }],
    train_record: [{ recordId: 1, exerciseId: 'bench', weight: 60, sets: 3, reps: 8, trainDate: '2026-08-01' }],
    weight_record: [{ wid: 1, weight: 68, recordDate: '2026-08-01' }]
  }
  const backup = createBackup(source, '2026-08-01T08:00:00.000Z')
  assert.deepEqual(parseBackup(JSON.stringify(backup)), backup)
  assert.throws(() => parseBackup('{"version":1,"data":{"exercise":[]}}'), /备份数据/)
})

test('accepts version 1 backups that predate daily check-ins', async () => {
  const { parseBackup } = await import('./backup.js')
  const legacy = parseBackup({
    version: 1,
    exportedAt: '2026-08-18T00:00:00.000Z',
    data: { exercise: [], train_record: [], weight_record: [] },
    preferences: {}
  })
  assert.deepEqual(legacy.data.check_in, [])
})

test('exports and restores user preferences through the same storage adapter', async () => {
  const { collectPreferences, restorePreferences } = await import('./backup.js')
  const values = new Map([
    ['fitness_train_parts_v2', { parts: [{ label: '核心', targets: ['腹部'], custom: true }] }],
    ['fitness_exercise_order_v1', { 核心: ['a', 'b'] }],
    ['fitness_daily_quote_enabled_v1', false]
  ])
  const storage = {
    getStorageSync(key) { return values.get(key) },
    setStorageSync(key, value) { values.set(key, value) }
  }
  const preferences = collectPreferences(storage)
  values.clear()
  restorePreferences(preferences, storage)
  assert.deepEqual(values.get('fitness_train_parts_v2'), { parts: [{ label: '核心', targets: ['腹部'], custom: true }] })
  assert.deepEqual(values.get('fitness_exercise_order_v1'), { 核心: ['a', 'b'] })
  assert.equal(Object.hasOwn(preferences, 'fitness_daily_quote_enabled_v1'), false)
})
