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

test('copies only catalog GIFs into the static asset directory', () => {
  const fs = require('node:fs')
  const os = require('node:os')
  const path = require('node:path')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitness-gifs-'))
  const sourceDir = path.join(root, 'videos')
  const targetDir = path.join(root, 'static', 'gifs')
  fs.mkdirSync(sourceDir, { recursive: true })
  fs.writeFileSync(path.join(sourceDir, '001-media-a.gif'), 'gif-a')
  fs.writeFileSync(path.join(sourceDir, '002-media-b.gif'), 'gif-b')
  fs.writeFileSync(path.join(sourceDir, '999-unused.gif'), 'unused')

  const result = copyExerciseGifs([
    { id: '001', media_id: 'media-a' },
    { id: '002', media_id: 'media-b' },
    { id: '003', media_id: 'missing' }
  ], { sourceDir, targetDir })

  assert.deepEqual(result, { copied: 2, missing: 1 })
  assert.equal(fs.readFileSync(path.join(targetDir, '001-media-a.gif'), 'utf8'), 'gif-a')
  assert.equal(fs.existsSync(path.join(targetDir, '999-unused.gif')), false)
})
