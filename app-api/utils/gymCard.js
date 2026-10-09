// 健身房卡到期提醒：剩余天数计算 + 三档颜色/文案。
// 颜色档位：1 个月以上 = 绿，1 周 - 1 个月 = 黄，1 周内（含已过期）= 红。

const MONTH_DAYS = 30
const WARN_DAYS = 7

const LEVELS = {
  safe: { level: 'safe', tone: 'green', color: '#2f855a', background: '#edf7ef' },
  warning: { level: 'warning', tone: 'yellow', color: '#8a6100', background: '#fdf5e3' },
  danger: { level: 'danger', tone: 'red', color: '#b42318', background: '#fdeceb' }
}

function cleanDate(value) {
  const text = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return ''
  const [year, month, day] = text.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? text : ''
}

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

// 只比较“日”，避免因时分秒导致剩余天数出现半天误差。
function toDayNumber(dateText) {
  const text = cleanDate(dateText)
  if (!text) return null
  const [year, month, day] = text.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000)
}

function daysUntil(expireDate, today = new Date()) {
  const target = toDayNumber(expireDate)
  const base = toDayNumber(formatDate(today instanceof Date ? today : new Date(today)))
  if (target === null || base === null) return null
  return target - base
}

function getCardLevel(days) {
  if (!Number.isFinite(days)) return null
  if (days < WARN_DAYS) return LEVELS.danger
  if (days < MONTH_DAYS) return LEVELS.warning
  return LEVELS.safe
}

function getCardStatus(expireDate, today = new Date()) {
  const date = cleanDate(expireDate)
  if (!date) return null
  const days = daysUntil(date, today)
  const level = getCardLevel(days)
  return {
    expireDate: date,
    days,
    expired: days < 0,
    level: level.level,
    tone: level.tone,
    color: level.color,
    background: level.background,
    label: formatDaysLabel(days)
  }
}

function formatDaysLabel(days) {
  if (!Number.isFinite(days)) return ''
  if (days < 0) return '已过期 ' + Math.abs(days) + ' 天'
  if (days === 0) return '今天到期'
  return '剩余 ' + days + ' 天'
}

function normalizeGymCard(value) {
  const expireDate = cleanDate(value && (value.expireDate || value.expire_date))
  if (!expireDate) return null
  const updatedAt = String((value && (value.updatedAt || value.updated_at)) || '')
  return { expireDate, updatedAt }
}

export {
  MONTH_DAYS,
  WARN_DAYS,
  cleanDate,
  daysUntil,
  getCardLevel,
  getCardStatus,
  formatDaysLabel,
  normalizeGymCard
}
