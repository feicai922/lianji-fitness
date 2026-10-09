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
    partDays: { '胸': 2, '背': 1, '有氧': 2 },
    unmatchedDays: 0
  })
})

test('statistics only count parts that exist as training-page labels', async () => {
  const { summarizeMonth } = await import('./checkIn.js')
  const rows = [
    { checkDate: '2026-08-01', cardioChecked: false, trainingParts: ['背阔肌'] },
    { checkDate: '2026-08-02', cardioChecked: false, trainingParts: ['背'] },
    { checkDate: '2026-08-03', cardioChecked: false, trainingParts: ['背阔肌', '背'] },
    { checkDate: '2026-08-04', cardioChecked: true, trainingParts: [] }
  ]
  // 训练页只有「胸/肩/背/腿/有氧」时：背阔肌不计入，单独记为未匹配天数
  assert.deepEqual(summarizeMonth(rows, '2026-08', ['胸', '肩', '背', '腿', '有氧']), {
    checkedDays: 4,
    trainingDays: 3,
    cardioDays: 1,
    partDays: { '背': 2, '有氧': 1 },
    unmatchedDays: 1
  })
  // 没有限制时保持旧行为，细分部位照样统计
  assert.deepEqual(summarizeMonth(rows, '2026-08', null).partDays, {
    '背阔肌': 2,
    '背': 2,
    '有氧': 1
  })
  // 训练页存在同名标签时，细分部位被合并进该标签
  assert.deepEqual(summarizeMonth(rows, '2026-08', ['背', '背阔肌', '有氧']).partDays, {
    '背阔肌': 2,
    '背': 2,
    '有氧': 1
  })
})

test('cardio days are only counted when the cardio part is a known label', async () => {
  const { summarizeMonth } = await import('./checkIn.js')
  const rows = [{ checkDate: '2026-08-05', cardioChecked: true, trainingParts: [] }]
  const summary = summarizeMonth(rows, '2026-08', ['胸', '背'])
  assert.equal(summary.cardioDays, 1)
  assert.deepEqual(summary.partDays, {})
})
