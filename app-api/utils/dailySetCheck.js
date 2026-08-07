const STORAGE_KEY = 'fitness_daily_set_checks_v1'

function getStorage(storage) {
  if (storage) return storage
  if (typeof uni !== 'undefined') return uni
  return null
}

function getLocalDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function getSetKey(exerciseId, setNo) {
  return String(exerciseId) + ':' + Number(setNo)
}

function readTodayChecks(storage, date = new Date()) {
  const adapter = getStorage(storage)
  const value = adapter && typeof adapter.getStorageSync === 'function'
    ? adapter.getStorageSync(STORAGE_KEY)
    : null
  if (!value || typeof value !== 'object' || value.date !== getLocalDateKey(date) || !Array.isArray(value.checked)) return []
  return [...new Set(value.checked.map(String))]
}

function isDailySetChecked(exerciseId, setNo, storage, date = new Date()) {
  return readTodayChecks(storage, date).includes(getSetKey(exerciseId, setNo))
}

function toggleDailySetChecked(exerciseId, setNo, storage, date = new Date()) {
  const adapter = getStorage(storage)
  const key = getSetKey(exerciseId, setNo)
  const current = readTodayChecks(adapter, date)
  const checked = current.includes(key)
    ? current.filter((item) => item !== key)
    : [...current, key]
  if (adapter && typeof adapter.setStorageSync === 'function') {
    adapter.setStorageSync(STORAGE_KEY, { date: getLocalDateKey(date), checked })
  }
  return checked.includes(key)
}

export { STORAGE_KEY, getLocalDateKey, getSetKey, readTodayChecks, isDailySetChecked, toggleDailySetChecked }
