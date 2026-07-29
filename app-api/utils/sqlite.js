import { formatDate } from './date.js'

const DB_NAME = 'fitness_record'
const STORAGE_KEY = 'fitness_record_store_v1'
const EMPTY_STORE = {
  exercise: [],
  train_record: [],
  weight_record: [],
  sequence: { recordId: 0, wid: 0 }
}

let initialized = false
let nativeReady = false
let memoryStore = clone(EMPTY_STORE)

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function isNativeSqliteAvailable() {
  return typeof plus !== 'undefined' && plus.sqlite && typeof plus.sqlite.openDatabase === 'function'
}

function readFallback() {
  if (typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function') {
    const stored = uni.getStorageSync(STORAGE_KEY)
    return stored && stored.exercise ? normalizeStore(stored) : clone(EMPTY_STORE)
  }
  return normalizeStore(memoryStore)
}

function writeFallback(store) {
  memoryStore = normalizeStore(store)
  if (typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function') uni.setStorageSync(STORAGE_KEY, memoryStore)
}

function normalizeStore(store) {
  const result = store || {}
  return {
    exercise: Array.isArray(result.exercise) ? result.exercise : [],
    train_record: Array.isArray(result.train_record) ? result.train_record : [],
    weight_record: Array.isArray(result.weight_record) ? result.weight_record : [],
    sequence: {
      recordId: Number(result.sequence && result.sequence.recordId) || 0,
      wid: Number(result.sequence && result.sequence.wid) || 0
    }
  }
}

function executeNative(sql) {
  return new Promise((resolve, reject) => {
    plus.sqlite.executeSql({ name: DB_NAME, sql, success: resolve, fail: reject })
  })
}

function selectNative(sql) {
  return new Promise((resolve, reject) => {
    plus.sqlite.selectSql({ name: DB_NAME, sql, success: resolve, fail: reject })
  })
}

function openNative() {
  return new Promise((resolve, reject) => {
    plus.sqlite.openDatabase({
      name: DB_NAME,
      path: `_doc/${DB_NAME}.db`,
      success: resolve,
      fail: reject
    })
  })
}

async function initDb() {
  if (initialized) return
  if (isNativeSqliteAvailable()) {
    try {
      await openNative()
      await executeNative('CREATE TABLE IF NOT EXISTS exercise (id TEXT PRIMARY KEY, nameZh TEXT NOT NULL, targetPart TEXT NOT NULL, mediaId TEXT NOT NULL, instructionsZh TEXT NOT NULL)')
      await executeNative('CREATE TABLE IF NOT EXISTS train_record (recordId INTEGER PRIMARY KEY AUTOINCREMENT, exerciseId TEXT NOT NULL, weight REAL NOT NULL, sets INTEGER NOT NULL, reps INTEGER NOT NULL, trainDate TEXT NOT NULL)')
      await executeNative('CREATE TABLE IF NOT EXISTS weight_record (wid INTEGER PRIMARY KEY AUTOINCREMENT, weight REAL NOT NULL, recordDate TEXT NOT NULL)')
      nativeReady = true
    } catch (error) {
      nativeReady = false
    }
  }
  initialized = true
}

async function run(sql, fallbackAction) {
  await initDb()
  if (nativeReady) return executeNative(sql)
  const store = readFallback()
  const result = fallbackAction(store)
  writeFallback(store)
  return result
}

async function query(sql, fallbackAction) {
  await initDb()
  if (nativeReady) return selectNative(sql)
  const store = readFallback()
  return fallbackAction(store)
}

function sqlText(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

async function listExercises(targetPart) {
  const part = String(targetPart || '')
  return query(
    `SELECT id, nameZh, targetPart, mediaId, instructionsZh FROM exercise WHERE targetPart = ${sqlText(part)} ORDER BY nameZh COLLATE NOCASE ASC`,
    (store) => store.exercise.filter((item) => item.targetPart === part).sort((a, b) => a.nameZh.localeCompare(b.nameZh, 'zh-CN'))
  )
}

async function addExercise(exercise) {
  const row = {
    id: String(exercise.id),
    nameZh: String(exercise.name_zh || exercise.nameZh),
    targetPart: String(exercise.target || exercise.targetPart),
    mediaId: String(exercise.media_id || exercise.mediaId),
    instructionsZh: String(exercise.instructions_zh || exercise.instructionsZh)
  }
  return run(
    `INSERT OR IGNORE INTO exercise (id, nameZh, targetPart, mediaId, instructionsZh) VALUES (${sqlText(row.id)}, ${sqlText(row.nameZh)}, ${sqlText(row.targetPart)}, ${sqlText(row.mediaId)}, ${sqlText(row.instructionsZh)})`,
    (store) => {
      if (!store.exercise.some((item) => item.id === row.id)) store.exercise.push(row)
      return row
    }
  )
}

async function removeExercise(exerciseId) {
  const id = String(exerciseId)
  await initDb()
  if (nativeReady) {
    await executeNative(`DELETE FROM train_record WHERE exerciseId = ${sqlText(id)}`)
    await executeNative(`DELETE FROM exercise WHERE id = ${sqlText(id)}`)
    return true
  }
  const store = readFallback()
  store.train_record = store.train_record.filter((item) => item.exerciseId !== id)
  store.exercise = store.exercise.filter((item) => item.id !== id)
  writeFallback(store)
  return true
}

async function listTrainRecords(exerciseId) {
  const id = String(exerciseId)
  return query(
    `SELECT recordId, exerciseId, weight, sets, reps, trainDate FROM train_record WHERE exerciseId = ${sqlText(id)} ORDER BY trainDate DESC, recordId DESC`,
    (store) => store.train_record.filter((item) => item.exerciseId === id).sort(sortByDateDesc)
  )
}

async function addTrainRecord({ exerciseId, weight, sets, reps, trainDate = formatDate() }) {
  const row = { exerciseId: String(exerciseId), weight: Number(weight), sets: Number(sets), reps: Number(reps), trainDate: String(trainDate) }
  return run(
    `INSERT INTO train_record (exerciseId, weight, sets, reps, trainDate) VALUES (${sqlText(row.exerciseId)}, ${row.weight}, ${row.sets}, ${row.reps}, ${sqlText(row.trainDate)})`,
    (store) => {
      row.recordId = ++store.sequence.recordId
      store.train_record.push(row)
      return row
    }
  )
}

async function updateTrainRecord(recordId, { weight, sets, reps }) {
  const id = Number(recordId)
  const nextWeight = Number(weight)
  const nextSets = Number(sets)
  const nextReps = Number(reps)
  return run(
    `UPDATE train_record SET weight = ${nextWeight}, sets = ${nextSets}, reps = ${nextReps} WHERE recordId = ${id}`,
    (store) => {
      const record = store.train_record.find((item) => Number(item.recordId) === id)
      if (!record) return null
      record.weight = nextWeight
      record.sets = nextSets
      record.reps = nextReps
      return record
    }
  )
}

async function removeTrainRecord(recordId) {
  const id = Number(recordId)
  return run(
    `DELETE FROM train_record WHERE recordId = ${id}`,
    (store) => {
      store.train_record = store.train_record.filter((item) => Number(item.recordId) !== id)
      return true
    }
  )
}

async function listWeights() {
  return query(
    'SELECT wid, weight, recordDate FROM weight_record ORDER BY recordDate DESC, wid DESC',
    (store) => store.weight_record.slice().sort((a, b) => String(b.recordDate).localeCompare(String(a.recordDate)) || b.wid - a.wid)
  )
}

async function addWeight(weight, recordDate = formatDate()) {
  const row = { weight: Number(weight), recordDate: String(recordDate) }
  return run(
    `INSERT INTO weight_record (weight, recordDate) VALUES (${row.weight}, ${sqlText(row.recordDate)})`,
    (store) => {
      row.wid = ++store.sequence.wid
      store.weight_record.push(row)
      return row
    }
  )
}

async function removeWeight(wid) {
  const id = Number(wid)
  return run(
    `DELETE FROM weight_record WHERE wid = ${id}`,
    (store) => {
      store.weight_record = store.weight_record.filter((item) => Number(item.wid) !== id)
      return true
    }
  )
}

function sortByDateDesc(a, b) {
  return String(b.trainDate).localeCompare(String(a.trainDate)) || Number(b.recordId) - Number(a.recordId)
}

function resetForTests() {
  initialized = false
  nativeReady = false
  memoryStore = clone(EMPTY_STORE)
}

export {
  initDb,
  listExercises,
  addExercise,
  removeExercise,
  listTrainRecords,
  addTrainRecord,
  updateTrainRecord,
  removeTrainRecord,
  listWeights,
  addWeight,
  removeWeight,
  resetForTests
}
