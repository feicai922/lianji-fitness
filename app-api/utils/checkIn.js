function cleanDate(value) {
  const text = String(value || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return ''
  const [year, month, day] = text.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? text : ''
}

function cleanParts(parts) {
  return [...new Set((Array.isArray(parts) ? parts : [])
    .map((part) => String(part || '').trim())
    .filter(Boolean))]
}

function normalizeCheckIn(value) {
  const checkDate = cleanDate(value && value.checkDate)
  const trainingParts = cleanParts(value && value.trainingParts)
  const cardioChecked = Boolean(value && (value.cardioChecked || value.source === 'cardio'))
  if (!checkDate || (!trainingParts.length && !cardioChecked)) return null
  return {
    checkDate,
    source: trainingParts.length ? 'training' : 'cardio',
    cardioChecked,
    trainingParts
  }
}

function syncTrainingCheckIn(current, checkDate, parts) {
  const base = normalizeCheckIn(current) || {
    checkDate: String(checkDate || ''),
    cardioChecked: false,
    trainingParts: []
  }
  return normalizeCheckIn({ ...base, checkDate, trainingParts: parts })
}

function createCardioCheckIn(current, checkDate) {
  const base = normalizeCheckIn(current)
  if (base && base.trainingParts.length) throw new Error('今日已由训练自动打卡')
  return normalizeCheckIn({ checkDate, cardioChecked: true, trainingParts: [] })
}

function filterMonth(records, monthKey) {
  const prefix = String(monthKey || '') + '-'
  return (Array.isArray(records) ? records : [])
    .map(normalizeCheckIn)
    .filter((record) => record && record.checkDate.startsWith(prefix))
}

function formatLocalDate(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function monthStart(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey || ''))) return null
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  return date.getFullYear() === year && date.getMonth() === month - 1 ? date : null
}

function createMonthGrid(monthKey, records, todayKey) {
  const firstDay = monthStart(monthKey)
  if (!firstDay) return []
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const gridStart = new Date(firstDay)
  gridStart.setDate(gridStart.getDate() - mondayOffset)
  const byDate = new Map(filterMonth(records, monthKey).map((record) => [record.checkDate, record]))
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const key = formatLocalDate(date)
    const future = Boolean(todayKey && key > todayKey)
    const record = future ? null : byDate.get(key)
    return {
      key,
      day: date.getDate(),
      inMonth: date.getMonth() === firstDay.getMonth(),
      future,
      today: key === todayKey,
      source: record ? record.source : '',
      record: record || null
    }
  })
}

function summarizeMonth(records, monthKey) {
  const result = { checkedDays: 0, trainingDays: 0, cardioDays: 0, partDays: {} }
  for (const record of filterMonth(records, monthKey)) {
    result.checkedDays += 1
    if (record.trainingParts.length) {
      result.trainingDays += 1
      for (const part of record.trainingParts) result.partDays[part] = (result.partDays[part] || 0) + 1
    } else if (record.cardioChecked) {
      result.cardioDays += 1
      result.partDays['有氧'] = (result.partDays['有氧'] || 0) + 1
    }
  }
  return result
}

export {
  normalizeCheckIn,
  syncTrainingCheckIn,
  createCardioCheckIn,
  filterMonth,
  createMonthGrid,
  summarizeMonth
}
