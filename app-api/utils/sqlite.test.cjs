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

test('validates per-set weight and reps independently', async () => {
  const { validateTrainForm } = await import('./validators.js')
  const result = validateTrainForm({
    setDetails: [
      { setNo: 1, weight: '40', reps: '12' },
      { setNo: 2, weight: '45', reps: '10' }
    ]
  })
  assert.equal(result.valid, true)
  assert.deepEqual(result.value.setDetails, [
    { setNo: 1, weight: 40, reps: 12 },
    { setNo: 2, weight: 45, reps: 10 }
  ])
  assert.equal(validateTrainForm({ setDetails: [{ setNo: 1, weight: '', reps: '12' }] }).valid, false)
})

test('persists different set details and reads legacy scalar records', async () => {
  const db = await import('./sqlite.js')
  db.resetForTests()
  await db.initDb()
  await db.addExercise({ id: 'sets', name_zh: '卧推', target: '胸', media_id: 'm3', instructions_zh: '推起。' })

  const record = await db.addTrainRecord({
    exerciseId: 'sets',
    setDetails: [
      { setNo: 1, weight: 40, reps: 12 },
      { setNo: 2, weight: 45, reps: 10 }
    ],
    trainDate: '2026-07-29'
  })
  const saved = (await db.listTrainRecords('sets'))[0]
  assert.equal(saved.recordId, record.recordId)
  assert.deepEqual(saved.setDetails, [
    { setNo: 1, weight: 40, reps: 12 },
    { setNo: 2, weight: 45, reps: 10 }
  ])

  const legacy = await db.addTrainRecord({
    exerciseId: 'sets',
    weight: 30,
    sets: 4,
    reps: 8,
    trainDate: '2026-07-28'
  })
  const legacySaved = (await db.listTrainRecords('sets')).find((item) => item.recordId === legacy.recordId)
  assert.deepEqual(legacySaved.setDetails, [
    { setNo: 1, weight: 30, reps: 8 },
    { setNo: 2, weight: 30, reps: 8 },
    { setNo: 3, weight: 30, reps: 8 },
    { setNo: 4, weight: 30, reps: 8 }
  ])
})

test('exports and restores all three data tables without native sqlite', async () => {
  const db = await import('./sqlite.js')
  db.resetForTests()
  await db.addExercise({ id: 'exported', name_zh: '硬拉', target: '腿', media_id: 'm4', instructions_zh: '站稳。' })
  await db.addTrainRecord({ exerciseId: 'exported', weight: 80, sets: 3, reps: 5, trainDate: '2026-08-01' })
  await db.addWeight(70, '2026-08-01')
  const backup = await db.exportData({ exerciseOrderVersion: 2 })
  db.resetForTests()
  await db.importData(backup)
  assert.equal((await db.listExercises('腿'))[0].id, 'exported')
  assert.equal((await db.listTrainRecords('exported'))[0].weight, 80)
  assert.equal((await db.listWeights())[0].weight, 70)
  assert.equal(backup.preferences.exerciseOrderVersion, 2)
})

test('upserts daily check-ins and preserves cardio after training is cleared', async () => {
  const db = await import('./sqlite.js')
  db.resetForTests()
  await db.saveCheckIn({ checkDate: '2026-08-18', cardioChecked: true, trainingParts: [] })
  await db.saveCheckIn({ checkDate: '2026-08-18', cardioChecked: true, trainingParts: ['胸'] })
  assert.deepEqual(await db.getCheckIn('2026-08-18'), {
    checkDate: '2026-08-18', source: 'training', cardioChecked: true, trainingParts: ['胸']
  })
  await db.saveCheckIn({ checkDate: '2026-08-18', cardioChecked: true, trainingParts: [] })
  assert.deepEqual(await db.getCheckIn('2026-08-18'), {
    checkDate: '2026-08-18', source: 'cardio', cardioChecked: true, trainingParts: []
  })
})

test('exports check-ins and imports legacy backups without them', async () => {
  const db = await import('./sqlite.js')
  db.resetForTests()
  await db.saveCheckIn({ checkDate: '2026-08-18', cardioChecked: false, trainingParts: ['背'] })
  const backup = await db.exportData()
  assert.equal(backup.data.check_in.length, 1)
  db.resetForTests()
  await db.importData({ version: 1, data: { exercise: [], train_record: [], weight_record: [] }, preferences: {} })
  assert.deepEqual(await db.listCheckIns(), [])
})
