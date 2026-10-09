const test = require('node:test')
const assert = require('node:assert/strict')
const { cleanExercises, normalizeExercise, getMissingTranslations, TARGET_MAP } = require('./clean_exercises.cjs')

test('maps the source target and keeps exactly the requested fields', () => {
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
  assert.equal(item.instructions_zh, '躺下。推起。')
})

test('prefers the curated name_cn over translation cache names', () => {
  const item = normalizeExercise({
    id: '001',
    name: 'incline dumbbell press',
    name_cn: '人工整理的中文名',
    target: 'pectorals',
    media_id: 'abc',
    instructions: { zh: '躺下。推起。' }
  }, { translations: { '001': '缓存中的旧名称' } })
  assert.equal(item.name_zh, '人工整理的中文名')
})

test('does not queue name_cn rows for model translation', () => {
  const missing = getMissingTranslations([
    { id: '001', name: 'incline dumbbell press', name_cn: '人工整理的中文名', target: 'pectorals', media_id: 'abc', instructions: { zh: '躺下。推起。' } }
  ], {})
  assert.equal(missing.length, 0)
})

test('keeps non-common target categories instead of filtering them', () => {
  const result = cleanExercises([
    { id: 'a', name: 'crunch', target: 'abs', media_id: '1', instructions: { zh: '收紧。' } }
  ], { translations: { a: '卷腹' } })
  assert.equal(result.length, 1)
  assert.equal(result[0].target, '腹部')
})

test('rejects a missing model translation instead of using token concatenation', () => {
  assert.equal(normalizeExercise({
    id: 'a', name: 'unmapped movement', target: 'abs', media_id: '1',
    instructions: { zh: '收紧。' }
  }, { translations: {} }), null)
})

test('maps all 19 observed source targets', () => {
  assert.equal(Object.keys(TARGET_MAP).length, 19)
  for (const [target, targetZh] of Object.entries(TARGET_MAP)) {
    const row = normalizeExercise({
      id: target,
      name: 'exercise ' + target,
      target,
      media_id: 'media-' + target,
      instructions: { zh: '保持。' }
    }, { translations: { [target]: '动作-' + target } })
    assert.equal(row.target, targetZh)
  }
})

test('removes duplicate ids while preserving the first valid row', () => {
  const result = cleanExercises([
    { id: 'a', name: 'bench press', target: 'pectorals', media_id: '1', instructions: { zh: '一' } },
    { id: 'a', name: 'another press', target: 'pectorals', media_id: '2', instructions: { zh: '二' } }
  ], { translations: { a: '卧推' } })
  assert.equal(result.length, 1)
  assert.equal(result[0].media_id, '1')
})
