const assert = require('node:assert/strict')
const test = require('node:test')

test('applies and updates an independent order for each part', async () => {
  const { applyExerciseOrder, moveExercise, saveExerciseOrder } = await import('./exerciseOrder.js')
  const storage = new Map()
  const adapter = {
    getStorageSync(key) { return storage.get(key) },
    setStorageSync(key, value) { storage.set(key, value) }
  }
  const exercises = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  assert.deepEqual(applyExerciseOrder(exercises, '胸', adapter).map((item) => item.id), ['a', 'b', 'c'])
  const moved = moveExercise(exercises, 'c', 'up')
  saveExerciseOrder('胸', moved.map((item) => item.id), adapter)
  assert.deepEqual(applyExerciseOrder(exercises, '胸', adapter).map((item) => item.id), ['a', 'c', 'b'])
  assert.deepEqual(applyExerciseOrder(exercises, '背', adapter).map((item) => item.id), ['a', 'b', 'c'])
})
