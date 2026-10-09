const BACKUP_VERSION = 1
const TABLE_NAMES = ['exercise', 'train_record', 'weight_record', 'check_in', 'gym_card']
const REQUIRED_TABLE_NAMES = ['exercise', 'train_record', 'weight_record']
const PART_PREFERENCE_KEYS = ['fitness_train_custom_parts_v1', 'fitness_train_parts_order_v1', 'fitness_train_parts_v2']
const EXERCISE_ORDER_KEY = 'fitness_exercise_order_v1'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeBackupData(data) {
  const source = data || {}
  if (REQUIRED_TABLE_NAMES.some((name) => !Array.isArray(source[name]))) {
    throw new Error('备份数据缺少必要的数据表')
  }
  return Object.fromEntries(TABLE_NAMES.map((name) => [name, clone(Array.isArray(source[name]) ? source[name] : [])]))
}

function createBackup(store, exportedAt = new Date().toISOString(), preferences = {}) {
  return {
    version: BACKUP_VERSION,
    exportedAt: String(exportedAt),
    data: normalizeBackupData(store),
    preferences: clone(preferences || {})
  }
}

function parseBackup(value) {
  let backup = value
  if (typeof backup === 'string') {
    try { backup = JSON.parse(backup) } catch (error) { throw new Error('备份数据不是合法 JSON') }
  }
  if (!backup || typeof backup !== 'object' || backup.version !== BACKUP_VERSION || !backup.data) {
    throw new Error('备份数据格式不完整或版本不支持')
  }
  return {
    version: backup.version,
    exportedAt: String(backup.exportedAt || ''),
    data: normalizeBackupData(backup.data),
    preferences: clone(backup.preferences || {})
  }
}

function getStorage(storage) {
  if (storage) return storage
  if (typeof uni !== 'undefined') return uni
  return null
}

function collectPreferences(storage) {
  const adapter = getStorage(storage)
  if (!adapter || typeof adapter.getStorageSync !== 'function') return {}
  const preferences = {}
  for (const key of [...PART_PREFERENCE_KEYS, EXERCISE_ORDER_KEY]) {
    const value = adapter.getStorageSync(key)
    if (value !== undefined && value !== null && value !== '') preferences[key] = clone(value)
  }
  return preferences
}

function restorePreferences(preferences, storage) {
  const adapter = getStorage(storage)
  if (!adapter || typeof adapter.setStorageSync !== 'function' || !preferences || typeof preferences !== 'object') return
  for (const key of [...PART_PREFERENCE_KEYS, EXERCISE_ORDER_KEY]) {
    if (Object.prototype.hasOwnProperty.call(preferences, key)) adapter.setStorageSync(key, clone(preferences[key]))
  }
}

export { BACKUP_VERSION, TABLE_NAMES, createBackup, parseBackup, collectPreferences, restorePreferences }
