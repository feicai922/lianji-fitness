const test = require('node:test')
const assert = require('node:assert/strict')

test('loads the bundled catalog and caches it locally', async () => {
  const { loadExerciseCatalog } = await import('./catalog.js')
  let stored = null
  global.uni = {
    getStorageSync() { return stored },
    setStorageSync(key, value) { stored = value }
  }
  const result = await loadExerciseCatalog()
  assert.equal(result.length, 826)
  assert.equal(result[0].id, '1512')
  assert.equal(stored.length, 826)
  delete global.uni
})

test('prefers the local cache on subsequent reads', async () => {
  const { loadExerciseCatalog } = await import('./catalog.js')
  const cached = [{ id: 'cached', name_zh: '本地缓存动作' }]
  global.uni = {
    getStorageSync() { return cached },
    setStorageSync() { throw new Error('不应重新写入缓存') }
  }
  const result = await loadExerciseCatalog()
  assert.deepEqual(result, cached)
  delete global.uni
})
