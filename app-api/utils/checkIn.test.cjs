const test = require('node:test')
const assert = require('node:assert/strict')

test('training parts take display priority while a prior cardio check is retained', async () => {
  const { syncTrainingCheckIn } = await import('./checkIn.js')
  const next = syncTrainingCheckIn(
    { checkDate: '2026-08-18', cardioChecked: true, trainingParts: [] },
    '2026-08-18',
    ['胸', '背', '胸']
  )
  assert.deepEqual(next, {
    checkDate: '2026-08-18',
    source: 'training',
    cardioChecked: true,
    trainingParts: ['胸', '背']
  })
  assert.deepEqual(syncTrainingCheckIn(next, '2026-08-18', []), {
    checkDate: '2026-08-18',
    source: 'cardio',
    cardioChecked: true,
    trainingParts: []
  })
})

test('manual cardio is idempotent and blocked by training', async () => {
  const { createCardioCheckIn } = await import('./checkIn.js')
  assert.deepEqual(createCardioCheckIn(null, '2026-08-18'), {
    checkDate: '2026-08-18',
    source: 'cardio',
    cardioChecked: true,
    trainingParts: []
  })
  assert.throws(
    () => createCardioCheckIn({ checkDate: '2026-08-18', cardioChecked: false, trainingParts: ['腿'] }, '2026-08-18'),
    /训练自动打卡/
  )
})

test('month grid and statistics use Monday-first weeks and deduplicate parts per day', async () => {
  const { createMonthGrid, summarizeMonth } = await import('./checkIn.js')
  const rows = [
    { checkDate: '2026-08-01', cardioChecked: false, trainingParts: ['胸', '胸'] },
    { checkDate: '2026-08-02', cardioChecked: true, trainingParts: [] },
    { checkDate: '2026-08-03', cardioChecked: false, trainingParts: ['胸', '背'] },
    { checkDate: '2026-08-19', cardioChecked: true, trainingParts: [] }
  ]
  const grid = createMonthGrid('2026-08', rows, '2026-08-18')
  assert.equal(grid.length, 42)
  assert.equal(grid[0].key, '2026-07-27')
  assert.equal(grid.find((item) => item.key === '2026-08-19').future, true)
  assert.equal(grid.find((item) => item.key === '2026-08-19').source, '')
  assert.deepEqual(summarizeMonth(rows, '2026-08'), {
    checkedDays: 4,
    trainingDays: 2,
    cardioDays: 2,
    partDays: { '胸': 2, '背': 1, '有氧': 2 }
  })
})
