const test = require('node:test')
const assert = require('node:assert/strict')
test('validates training and weight input before persistence', () => {
  return import('./validators.js').then(({ validateTrainForm, validateWeight }) => {
    assert.equal(validateTrainForm({ weight: '20.5', sets: '4', reps: '8' }).valid, true)
    assert.equal(validateTrainForm({ weight: '-1', sets: '4', reps: '8' }).valid, false)
    assert.equal(validateTrainForm({ weight: '20', sets: '0', reps: '8' }).valid, false)
    assert.equal(validateWeight('68.5').valid, true)
    assert.equal(validateWeight('501').valid, false)
  })
})

test('formats dates and validates clean exercise rows', async () => {
  const [{ formatDate }, { isExercise }] = await Promise.all([import('./date.js'), import('./validators.js')])
  assert.equal(formatDate(new Date(2026, 6, 29)), '2026-07-29')
  assert.equal(isExercise({ id: '1', name_zh: '卧推', target: '胸', media_id: 'x', instructions_zh: '推起。' }), true)
  assert.equal(isExercise({ id: '1', name_zh: '', target: '胸', media_id: 'x', instructions_zh: '推起。' }), false)
})

test('provides the same CRUD contract without plus.sqlite', async () => {
  const db = await import('./sqlite.js')
  db.resetForTests()
  await db.initDb()
  await db.addExercise({ id: 'bench', name_zh: '杠铃卧推', target: '胸', media_id: 'm1', instructions_zh: '躺下。' })
  await db.addExercise({ id: 'bench', name_zh: '重复动作', target: '胸', media_id: 'm2', instructions_zh: '忽略。' })
  assert.equal((await db.listExercises('胸')).length, 1)
  const record = await db.addTrainRecord({ exerciseId: 'bench', weight: 60, sets: 4, reps: 8, trainDate: '2026-07-29' })
  assert.equal((await db.listTrainRecords('bench'))[0].recordId, record.recordId)
  const weight = await db.addWeight(68.5, '2026-07-29')
  assert.equal((await db.listWeights())[0].wid, weight.wid)
  await db.removeExercise('bench')
  assert.equal((await db.listExercises('胸')).length, 0)
  assert.equal((await db.listTrainRecords('bench')).length, 0)
})

test('updates the selected training record values', async () => {
  const db = await import('./sqlite.js')
  db.resetForTests()
  await db.addExercise({ id: 'row', name_zh: '深蹲', target: '腿', media_id: 'm2', instructions_zh: '下蹲。' })
  const record = await db.addTrainRecord({ exerciseId: 'row', weight: 40, sets: 3, reps: 10, trainDate: '2026-07-29' })
  await db.updateTrainRecord(record.recordId, { weight: 45, sets: 4, reps: 8 })
  const updated = (await db.listTrainRecords('row'))[0]
  assert.equal(updated.weight, 45)
  assert.equal(updated.sets, 4)
  assert.equal(updated.reps, 8)
})
