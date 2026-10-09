import { formatDate } from './date.js'
import { createBackup, parseBackup } from './backup.js'
import { normalizeCheckIn } from './checkIn.js'
import { normalizeGymCard } from './gymCard.js'

const DB_NAME = 'fitness_record'
const STORAGE_KEY = 'fitness_record_store_v1'
const EMPTY_STORE = {
  exercise: [],
  train_record: [],
  weight_record: [],
  check_in: [],
  gym_card: [],
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
    check_in: Array.isArray(result.check_in) ? result.check_in : [],
    gym_card: Array.isArray(result.gym_card) ? result.gym_card : [],
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
      path: '_doc/' + DB_NAME + '.db',
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
      await executeNative('CREATE TABLE IF NOT EXISTS train_record (recordId INTEGER PRIMARY KEY AUTOINCREMENT, exerciseId TEXT NOT NULL, weight REAL NOT NULL, sets INTEGER NOT NULL, reps INTEGER NOT NULL, setDetailsJson TEXT, trainDate TEXT NOT NULL)')
      try {
        await executeNative('ALTER TABLE train_record ADD COLUMN setDetailsJson TEXT')
      } catch (error) {
        // The column already exists on upgraded databases.
      }
      await executeNative('CREATE TABLE IF NOT EXISTS weight_record (wid INTEGER PRIMARY KEY AUTOINCREMENT, weight REAL NOT NULL, recordDate TEXT NOT NULL)')
      await executeNative("CREATE TABLE IF NOT EXISTS check_in (checkDate TEXT PRIMARY KEY, cardioChecked INTEGER NOT NULL DEFAULT 0, trainingPartsJson TEXT NOT NULL DEFAULT '[]')")
      await executeNative('CREATE TABLE IF NOT EXISTS gym_card (cardId INTEGER PRIMARY KEY, expireDate TEXT NOT NULL, updatedAt TEXT)')
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
  return "'" + String(value).replace(/'/g, "''") + "'"
}

function sqlNullableText(value) {
  return value === null || value === undefined || value === '' ? 'NULL' : sqlText(value)
}

function normalizeSetDetails(setDetails, fallback = {}) {
  if (Array.isArray(setDetails) && setDetails.length) {
    return setDetails.map((item, index) => ({
      setNo: index + 1,
      weight: Number(item.weight),
      reps: Number(item.reps)
    }))
  }
  const weight = Number(fallback.weight)
  const reps = Number(fallback.reps)
  const count = Math.max(1, Number(fallback.sets) || 1)
  return Array.from({ length: count }, (_, index) => ({
    setNo: index + 1,
    weight,
    reps
  }))
}

function inflateTrainRecord(row) {
  let details = []
  try {
    details = row.setDetailsJson ? JSON.parse(row.setDetailsJson) : []
  } catch (error) {
    details = []
  }
  details = normalizeSetDetails(details, row)
  return {
    recordId: Number(row.recordId),
    exerciseId: String(row.exerciseId),
    weight: Number(details[0].weight),
    sets: details.length,
    reps: Number(details[0].reps),
    setDetails: details,
    trainDate: String(row.trainDate)
  }
}

function inflateCheckIn(row) {
  let trainingParts = []
  try {
    trainingParts = typeof row.trainingPartsJson === 'string' ? JSON.parse(row.trainingPartsJson) : row.trainingParts
  } catch (error) {
    trainingParts = []
  }
  return normalizeCheckIn({
    checkDate: row.checkDate,
    cardioChecked: Boolean(Number(row.cardioChecked)),
    trainingParts
  })
}

function inflateGymCard(row) {
  if (!row) return null
  return normalizeGymCard({
    expireDate: row.expireDate,
    updatedAt: row.updatedAt
  })
}

async function listExercises(targetPart) {
  const part = String(targetPart || '')
  const where = part ? ' WHERE targetPart = ' + sqlText(part) : ''
  return query(
    'SELECT id, nameZh, targetPart, mediaId, instructionsZh FROM exercise' + where + ' ORDER BY nameZh COLLATE NOCASE ASC',
    (store) => {
      const rows = part ? store.exercise.filter((item) => item.targetPart === part) : store.exercise.slice()
      return rows.sort((a, b) => a.nameZh.localeCompare(b.nameZh, 'zh-CN'))
    }
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
    'INSERT OR IGNORE INTO exercise (id, nameZh, targetPart, mediaId, instructionsZh) VALUES (' +
      sqlText(row.id) + ', ' + sqlText(row.nameZh) + ', ' + sqlText(row.targetPart) + ', ' +
      sqlText(row.mediaId) + ', ' + sqlText(row.instructionsZh) + ')',
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
    await executeNative('DELETE FROM train_record WHERE exerciseId = ' + sqlText(id))
    await executeNative('DELETE FROM exercise WHERE id = ' + sqlText(id))
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
  const rows = await query(
    'SELECT recordId, exerciseId, weight, sets, reps, setDetailsJson, trainDate FROM train_record WHERE exerciseId = ' +
      sqlText(id) + ' ORDER BY trainDate DESC, recordId DESC',
    (store) => store.train_record.filter((item) => item.exerciseId === id).sort(sortByDateDesc)
  )
  return rows.map(inflateTrainRecord)
}

async function addTrainRecord({ exerciseId, weight, sets, reps, setDetails, trainDate = formatDate() }) {
  const details = normalizeSetDetails(setDetails, { weight, sets, reps })
  const first = details[0]
  const row = {
    exerciseId: String(exerciseId),
    weight: Number(first.weight),
    sets: details.length,
    reps: Number(first.reps),
    setDetailsJson: JSON.stringify(details),
    setDetails: details,
    trainDate: String(trainDate)
  }
  return run(
    'INSERT INTO train_record (exerciseId, weight, sets, reps, setDetailsJson, trainDate) VALUES (' +
      sqlText(row.exerciseId) + ', ' + row.weight + ', ' + row.sets + ', ' + row.reps + ', ' +
      sqlText(row.setDetailsJson) + ', ' + sqlText(row.trainDate) + ')',
    (store) => {
      row.recordId = ++store.sequence.recordId
      store.train_record.push(row)
      return row
    }
  )
}

async function updateTrainRecord(recordId, { weight, sets, reps, setDetails }) {
  const id = Number(recordId)
  const details = normalizeSetDetails(setDetails, { weight, sets, reps })
  const first = details[0]
  const json = JSON.stringify(details)
  return run(
    'UPDATE train_record SET weight = ' + Number(first.weight) + ', sets = ' + details.length +
      ', reps = ' + Number(first.reps) + ', setDetailsJson = ' + sqlText(json) + ' WHERE recordId = ' + id,
    (store) => {
      const record = store.train_record.find((item) => Number(item.recordId) === id)
      if (!record) return null
      record.weight = Number(first.weight)
      record.sets = details.length
      record.reps = Number(first.reps)
      record.setDetailsJson = json
      record.setDetails = details
      return inflateTrainRecord(record)
    }
  )
}

async function removeTrainRecord(recordId) {
  const id = Number(recordId)
  return run(
    'DELETE FROM train_record WHERE recordId = ' + id,
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
    'INSERT INTO weight_record (weight, recordDate) VALUES (' + row.weight + ', ' + sqlText(row.recordDate) + ')',
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
    'DELETE FROM weight_record WHERE wid = ' + id,
    (store) => {
      store.weight_record = store.weight_record.filter((item) => Number(item.wid) !== id)
      return true
    }
  )
}

async function listCheckIns() {
  const rows = await query(
    'SELECT checkDate, cardioChecked, trainingPartsJson FROM check_in ORDER BY checkDate ASC',
    (store) => store.check_in.slice().sort((a, b) => String(a.checkDate).localeCompare(String(b.checkDate)))
  )
  return rows.map(inflateCheckIn).filter(Boolean)
}

async function getCheckIn(checkDate) {
  const date = String(checkDate || '')
  const rows = await query(
    'SELECT checkDate, cardioChecked, trainingPartsJson FROM check_in WHERE checkDate = ' + sqlText(date),
    (store) => store.check_in.filter((item) => String(item.checkDate) === date)
  )
  return inflateCheckIn(rows[0] || {})
}

async function deleteCheckIn(checkDate) {
  const date = String(checkDate || '')
  return run(
    'DELETE FROM check_in WHERE checkDate = ' + sqlText(date),
    (store) => {
      store.check_in = store.check_in.filter((item) => String(item.checkDate) !== date)
      return true
    }
  )
}

async function saveCheckIn(value) {
  const row = normalizeCheckIn(value)
  if (!row) return deleteCheckIn(value && value.checkDate)
  const json = JSON.stringify(row.trainingParts)
  return run(
    'INSERT OR REPLACE INTO check_in (checkDate, cardioChecked, trainingPartsJson) VALUES (' +
      sqlText(row.checkDate) + ', ' + Number(row.cardioChecked) + ', ' + sqlText(json) + ')',
    (store) => {
      const index = store.check_in.findIndex((item) => String(item.checkDate) === row.checkDate)
      const saved = { checkDate: row.checkDate, cardioChecked: row.cardioChecked, trainingPartsJson: json }
      if (index >= 0) store.check_in.splice(index, 1, saved)
      else store.check_in.push(saved)
      return row
    }
  )
}

// 健身房卡只有一张，固定 cardId = 1。
async function getGymCard() {
  const rows = await query(
    'SELECT cardId, expireDate, updatedAt FROM gym_card WHERE cardId = 1',
    (store) => store.gym_card.filter((item) => Number(item.cardId) === 1)
  )
  return inflateGymCard(rows[0])
}

async function saveGymCard(expireDate) {
  const row = normalizeGymCard({ expireDate, updatedAt: new Date().toISOString() })
  if (!row) return deleteGymCard()
  return run(
    'INSERT OR REPLACE INTO gym_card (cardId, expireDate, updatedAt) VALUES (1, ' +
      sqlText(row.expireDate) + ', ' + sqlText(row.updatedAt) + ')',
    (store) => {
      const saved = { cardId: 1, expireDate: row.expireDate, updatedAt: row.updatedAt }
      const index = store.gym_card.findIndex((item) => Number(item.cardId) === 1)
      if (index >= 0) store.gym_card.splice(index, 1, saved)
      else store.gym_card.push(saved)
      return { expireDate: row.expireDate, updatedAt: row.updatedAt }
    }
  )
}

async function deleteGymCard() {
  return run(
    'DELETE FROM gym_card WHERE cardId = 1',
    (store) => {
      store.gym_card = store.gym_card.filter((item) => Number(item.cardId) !== 1)
      return null
    }
  )
}

async function exportData(preferences = {}) {
  await initDb()
  if (nativeReady) {
    const [exercise, train_record, weight_record, check_in, gym_card] = await Promise.all([
      selectNative('SELECT id, nameZh, targetPart, mediaId, instructionsZh FROM exercise'),
      selectNative('SELECT recordId, exerciseId, weight, sets, reps, setDetailsJson, trainDate FROM train_record'),
      selectNative('SELECT wid, weight, recordDate FROM weight_record'),
      selectNative('SELECT checkDate, cardioChecked, trainingPartsJson FROM check_in'),
      selectNative('SELECT cardId, expireDate, updatedAt FROM gym_card')
    ])
    return createBackup({ exercise, train_record, weight_record, check_in, gym_card }, new Date().toISOString(), preferences)
  }
  return createBackup(readFallback(), new Date().toISOString(), preferences)
}

function normalizeImportedData(data) {
  return {
    exercise: data.exercise.map((row) => ({
      id: String(row.id || ''),
      nameZh: String(row.nameZh || ''),
      targetPart: String(row.targetPart || ''),
      mediaId: String(row.mediaId || ''),
      instructionsZh: String(row.instructionsZh || '')
    })).filter((row) => row.id && row.nameZh && row.targetPart && row.mediaId && row.instructionsZh),
    train_record: data.train_record.map((row) => ({
      recordId: Number(row.recordId),
      exerciseId: String(row.exerciseId || ''),
      weight: Number(row.weight),
      sets: Number(row.sets),
      reps: Number(row.reps),
      setDetailsJson: row.setDetailsJson ? String(row.setDetailsJson) : null,
      trainDate: String(row.trainDate || '')
    })).filter((row) => Number.isInteger(row.recordId) && row.recordId > 0 && row.exerciseId && Number.isFinite(row.weight) && Number.isInteger(row.sets) && row.sets > 0 && Number.isInteger(row.reps) && row.reps > 0 && row.trainDate),
    weight_record: data.weight_record.map((row) => ({
      wid: Number(row.wid),
      weight: Number(row.weight),
      recordDate: String(row.recordDate || '')
    })).filter((row) => Number.isInteger(row.wid) && row.wid > 0 && Number.isFinite(row.weight) && row.recordDate),
    check_in: (data.check_in || []).map(inflateCheckIn).filter(Boolean),
    // 存回本地时始终带上固定的 cardId，否则读取端按 cardId = 1 查不到这张卡。
    gym_card: (data.gym_card || []).map(inflateGymCard).filter(Boolean).slice(0, 1)
      .map((card) => ({ cardId: 1, expireDate: card.expireDate, updatedAt: card.updatedAt }))
  }
}

async function importData(payload) {
  const backup = parseBackup(payload)
  const data = normalizeImportedData(backup.data)
  await initDb()
  if (nativeReady) {
    await executeNative('DELETE FROM train_record')
    await executeNative('DELETE FROM exercise')
    await executeNative('DELETE FROM weight_record')
    await executeNative('DELETE FROM check_in')
    await executeNative('DELETE FROM gym_card')
    for (const row of data.exercise) {
      await executeNative('INSERT OR REPLACE INTO exercise (id, nameZh, targetPart, mediaId, instructionsZh) VALUES (' +
        sqlText(row.id) + ', ' + sqlText(row.nameZh) + ', ' + sqlText(row.targetPart) + ', ' +
        sqlText(row.mediaId) + ', ' + sqlText(row.instructionsZh) + ')')
    }
    for (const row of data.train_record) {
      await executeNative('INSERT INTO train_record (recordId, exerciseId, weight, sets, reps, setDetailsJson, trainDate) VALUES (' +
        Number(row.recordId) + ', ' + sqlText(row.exerciseId) + ', ' + Number(row.weight) + ', ' + Number(row.sets) + ', ' +
        Number(row.reps) + ', ' + sqlNullableText(row.setDetailsJson) + ', ' + sqlText(row.trainDate) + ')')
    }
    for (const row of data.weight_record) {
      await executeNative('INSERT INTO weight_record (wid, weight, recordDate) VALUES (' + Number(row.wid) + ', ' +
        Number(row.weight) + ', ' + sqlText(row.recordDate) + ')')
    }
    for (const row of data.check_in) {
      await executeNative('INSERT INTO check_in (checkDate, cardioChecked, trainingPartsJson) VALUES (' +
        sqlText(row.checkDate) + ', ' + Number(row.cardioChecked) + ', ' + sqlText(JSON.stringify(row.trainingParts)) + ')')
    }
    for (const row of data.gym_card) {
      await executeNative('INSERT OR REPLACE INTO gym_card (cardId, expireDate, updatedAt) VALUES (1, ' +
        sqlText(row.expireDate) + ', ' + sqlNullableText(row.updatedAt) + ')')
    }
    return backup
  }
  writeFallback({
    ...data,
    sequence: {
      recordId: Math.max(0, ...data.train_record.map((row) => Number(row.recordId) || 0)),
      wid: Math.max(0, ...data.weight_record.map((row) => Number(row.wid) || 0))
    }
  })
  return backup
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
  listCheckIns,
  getCheckIn,
  saveCheckIn,
  deleteCheckIn,
  getGymCard,
  saveGymCard,
  deleteGymCard,
  exportData,
  importData,
  normalizeSetDetails,
  inflateTrainRecord,
  inflateCheckIn,
  inflateGymCard,
  resetForTests
}
