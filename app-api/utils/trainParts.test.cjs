const assert = require('node:assert/strict')
const test = require('node:test')

const P = {
  ALL: '全部', // 全部
  CHEST: '胸', // 胸
  SHOULDER: '肩', // 肩
  BACK: '背', // 背
  LEG: '腿', // 腿
  CARDIO: '有氧', // 有氧
  CORE: '核心', // 核心
  ABDOMEN: '腹部', // 腹部
  LATS: '背阔肌', // 背阔肌
  UPPER_BACK: '上背部', // 上背部
  QUADS: '股四头肌', // 股四头肌
  GLUTES: '臀部' // 臀部
}

test('defaults: all plus five removable parts (chest/shoulder/back/leg/cardio)', async () => {
  const { getTrainPartTabs } = await import('./trainParts.js')
  const tabs = getTrainPartTabs([], [])
  assert.deepEqual(tabs.map((t) => t.label), [
    P.ALL, P.CHEST, P.SHOULDER, P.BACK, P.LEG, P.CARDIO
  ])
})

test('adds a custom label with multi-target selection and dedupes', async () => {
  const { addCustomTrainPart, getTrainPartTabs } = await import('./trainParts.js')
  const result = addCustomTrainPart({ label: P.CORE, targets: [P.ABDOMEN, P.CHEST] }, [], [P.ABDOMEN, P.CHEST, P.BACK])
  assert.deepEqual(result, [{ label: P.CORE, targets: [P.ABDOMEN, P.CHEST] }])
  const tabs = getTrainPartTabs(result, [P.ABDOMEN, P.CHEST, P.BACK])
  assert.ok(tabs.some((t) => t.label === P.CORE && t.custom === true))
  assert.throws(
    () => addCustomTrainPart({ label: P.CORE, targets: [P.ABDOMEN] }, result, [P.ABDOMEN]),
    /(?:已存在|已存在)/
  )
})

test('addTrainPart supports multi-target and rejects empty target set', async () => {
  const { addPart } = await import('./trainParts.js')
  const parts = addPart([], { label: P.CORE, targets: [P.ABDOMEN, P.CHEST] })
  assert.deepEqual(parts, [{ label: P.CORE, targets: [P.ABDOMEN, P.CHEST], custom: true }])
  assert.throws(
    () => addPart([], { label: P.CORE, targets: [] }),
    /(?:部位|部位)/
  )
})

test('removePart can delete ANY part including a default one (e.g. chest and cardio)', async () => {
  const { removePart, tabs, defaultParts } = await import('./trainParts.js')
  let parts = defaultParts()
  assert.ok(parts.some((p) => p.label === P.CHEST))
  assert.ok(parts.some((p) => p.label === P.CARDIO))
  parts = removePart(parts, P.CHEST)
  parts = removePart(parts, P.CARDIO)
  assert.ok(!parts.some((p) => p.label === P.CHEST))
  assert.ok(!parts.some((p) => p.label === P.CARDIO))
  assert.ok(parts.some((p) => p.label === P.BACK))
  const t = tabs(parts)
  assert.ok(!t.some((tt) => tt.label === P.CHEST))
  // '全部' always remains
  assert.equal(t[0].label, P.ALL)
})

test('reorderPart moves a part and preserves order', async () => {
  const { defaultParts, reorderPart, saveParts } = await import('./trainParts.js')
  let parts = defaultParts()
  parts = reorderPart(parts, 0, 4) // move chest to the end
  const labels = parts.map((p) => p.label)
  assert.equal(labels[0], P.SHOULDER)
  assert.equal(labels[labels.length - 1], P.CHEST)
  // persistence roundtrip
  const data = {}
  const storage = { getStorageSync: (k) => data[k], setStorageSync: (k, v) => { data[k] = v } }
  saveParts(parts, storage)
  // order key persisted
  assert.ok(Array.isArray(data.fitness_train_parts_order_v1))
})

test('matchesPart aggregates detailed targets under a tab and honors multi-target custom parts', async () => {
  const { matchesPart, defaultParts, addPart } = await import('./trainParts.js')
  let parts = defaultParts()
  assert.equal(matchesPart(parts, { target: P.LATS }, P.BACK), true)
  assert.equal(matchesPart(parts, { target: P.QUADS }, P.LEG), true)
  assert.equal(matchesPart(parts, { target: P.CHEST }, P.LEG), false)
  parts = addPart(parts, { label: P.CORE, targets: [P.ABDOMEN, P.CHEST] })
  assert.equal(matchesPart(parts, { target: P.ABDOMEN }, P.CORE), true)
  assert.equal(matchesPart(parts, { target: P.CHEST }, P.CORE), true)
  assert.equal(matchesPart(parts, { target: P.BACK }, P.CORE), false)
})

test('matchesTrainPart reuses preloaded parts without reading storage per exercise', async () => {
  const { matchesTrainPart, defaultParts } = await import('./trainParts.js')
  let reads = 0
  globalThis.uni = {
    getStorageSync() {
      reads += 1
      return undefined
    }
  }
  try {
    assert.equal(matchesTrainPart({ target: P.SHOULDER }, P.SHOULDER, defaultParts()), true)
    assert.equal(reads, 0)
  } finally {
    delete globalThis.uni
  }
})

test('persists removal of default and custom parts while keeping the all tab', async () => {
  const { defaultParts, addPart, removePart, saveParts, loadParts, tabs } = await import('./trainParts.js')
  const storage = new Map()
  const adapter = {
    getStorageSync(key) { return storage.get(key) },
    setStorageSync(key, value) { storage.set(key, value) }
  }
  let parts = addPart(defaultParts(), { label: P.CORE, targets: [P.ABDOMEN, P.CHEST] })
  parts = removePart(parts, P.CHEST)
  parts = removePart(parts, P.CORE)
  saveParts(parts, adapter)
  const reloaded = loadParts(adapter)
  assert.ok(!reloaded.some((part) => part.label === P.CHEST))
  assert.ok(!reloaded.some((part) => part.label === P.CORE))
  assert.equal(tabs(reloaded)[0].label, P.ALL)
})

test('normalizes a multi-selected all target into every available source target', async () => {
  const { addCustomTrainPart } = await import('./trainParts.js')
  const result = addCustomTrainPart(
    { label: P.CORE, targets: [P.ALL, P.CHEST] },
    [],
    [P.ABDOMEN, P.CHEST, P.BACK]
  )
  assert.deepEqual(result, [{ label: P.CORE, targets: [P.ABDOMEN, P.CHEST, P.BACK] }])
})
