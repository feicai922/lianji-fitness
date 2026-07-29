const test = require('node:test')
const assert = require('node:assert/strict')

test('builds a local-first GIF source list for an exercise', async () => {
  const { getExerciseGifSources } = await import('./media.js')
  assert.deepEqual(getExerciseGifSources({ id: '1512', media_id: 'qBcKorM' }), [
    '/static/gifs/1512-qBcKorM.gif',
    'https://v2.exercisedb.io/gif/qBcKorM'
  ])
})

test('returns no GIF sources for incomplete exercise media', async () => {
  const { getExerciseGifSources } = await import('./media.js')
  assert.deepEqual(getExerciseGifSources({ id: '', media_id: 'qBcKorM' }), [])
  assert.deepEqual(getExerciseGifSources({ id: '1512', media_id: '' }), [])
})
