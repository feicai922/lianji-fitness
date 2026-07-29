function pad(value) {
  return String(value).padStart(2, '0')
}

function formatDate(date = new Date()) {
  const current = date instanceof Date ? date : new Date(date)
  return `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}`
}

function formatShortDate(value) {
  const text = String(value || '')
  return text.length >= 10 ? text.slice(5, 10).replace('-', '/') : text
}

export { formatDate, formatShortDate }
