const test = require('node:test')
const assert = require('node:assert/strict')
const { cleanExercises, normalizeExercise, translateName, copyExerciseGifs } = require('./clean_exercises.cjs')

test('maps the source target and keeps exactly the requested fields', () => {
  const item = normalizeExercise({
    id: '001',
    name: 'incline dumbbell press',
    target: 'pectorals',
    media_id: 'abc',
    instructions: { zh: '躺下。推起。' }
  })
  assert.deepEqual(Object.keys(item), ['id', 'name_zh', 'target', 'media_id', 'instructions_zh'])
  assert.equal(item.name_zh, '上斜哑铃推举')
  assert.equal(item.target, '胸')
  assert.equal(item.instructions_zh, '躺下。推起。')
})

test('filters unsupported targets and blank required values', () => {
  const result = cleanExercises([
    { id: 'a', name: 'crunch', target: 'abs', media_id: '1', instructions: { zh: '收紧。' } },
    { id: 'b', name: 'bench press', target: 'pectorals', media_id: '', instructions: { zh: '推起。' } },
    { id: 'c', name: 'barbell squat', target: 'quads', media_id: '3', instructions: { zh: '下蹲。' } }
  ])
  assert.equal(result.length, 1)
  assert.equal(result[0].target, '腿')
})

test('translates common names and keeps an understandable fallback', () => {
  assert.equal(translateName('barbell bench press'), '杠铃卧推')
  assert.match(translateName('unmapped movement'), /动作|unmapped|movement/)
})

test('removes duplicate ids while preserving the first valid row', () => {
  const result = cleanExercises([
    { id: 'a', name: 'bench press', target: 'pectorals', media_id: '1', instructions: { zh: '一' } },
    { id: 'a', name: 'another press', target: 'pectorals', media_id: '2', instructions: { zh: '二' } }
  ])
  assert.equal(result.length, 1)
  assert.equal(result[0].media_id, '1')
})
