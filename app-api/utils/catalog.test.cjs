const assert = require('node:assert/strict')
const test = require('node:test')

test('returns all, common parts, then remaining source order', async () => {
  const { getCatalogParts } = await import('./catalog.js')
  assert.deepEqual(getCatalogParts([
    { target: '肱二头肌' },
    { target: '胸' },
    { target: '腹部' },
    { target: '胸' }
  ]), ['全部', '胸', '肱二头肌', '腹部'])
})

test('ignores empty and duplicate target values', async () => {
  const { getCatalogParts } = await import('./catalog.js')
  assert.deepEqual(getCatalogParts([
    { target: '' },
    { target: '肩' },
    { target: '肩' },
    {}
  ]), ['全部', '肩'])
})

test('uses a new cache version for curated exercise names', async () => {
  const { CACHE_KEY } = await import('./catalog.js')
  assert.equal(CACHE_KEY, 'clean_fitness_catalog_v3')
})
