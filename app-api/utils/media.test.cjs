const test = require('node:test')
const assert = require('node:assert/strict')

test('builds a remote-only GIF source list for an exercise', async () => {
  const { getExerciseGifSources } = await import('./media.js')
  assert.deepEqual(getExerciseGifSources({ id: '1512', media_id: 'qBcKorM' }), [
    'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/1512-qBcKorM.gif'
  ])
})

test('returns no GIF sources for incomplete exercise media', async () => {
  const { getExerciseGifSources } = await import('./media.js')
  assert.deepEqual(getExerciseGifSources({ id: '', media_id: 'qBcKorM' }), [])
  assert.deepEqual(getExerciseGifSources({ id: '1512', media_id: '' }), [])
})
