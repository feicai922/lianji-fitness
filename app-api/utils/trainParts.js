// Train part manager: all parts (default + custom) removable, multi-target, reorderable.

const ALL_PART = { label: '全部', target: '全部', custom: false } // 全部

// 默认可删部位（除“全部”外均可删除）
const DEFAULT_PART_DEF = [
  { label: '胸', targets: ['胸'] }, // 胸
  { label: '肩', targets: ['肩'] }, // 肩
  { label: '背', targets: ['背', '背阔肌', '上背部'] }, // 背 -> 背/背阔肌/上背部
  { label: '腿', targets: ['腿', '股四头肌', '小腿', '臀部', '大腿后侧', '内收肌', '外展肌'] },
  { label: '有氧', targets: ['有氧'] } // 有氧
]
const ALL_LABEL = '全部' // 全部
const STORAGE_KEY = 'fitness_train_custom_parts_v1'
const ORDER_STORAGE_KEY = 'fitness_train_parts_order_v1'
const PARTS_STATE_KEY = 'fitness_train_parts_v2'

function getStorage(storage) {
  if (storage) return storage
  if (typeof uni !== 'undefined') return uni
  return null
}

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function normalizePartTargets(targets, availableTargets = []) {
  const values = [...new Set((Array.isArray(targets) ? targets : [targets]).map(cleanText).filter(Boolean))]
  if (!values.includes(ALL_LABEL)) return values.filter((value) => value !== ALL_LABEL)
  const available = [...new Set((Array.isArray(availableTargets) ? availableTargets : []).map(cleanText).filter((value) => value && value !== ALL_LABEL))]
  return available.length ? available : values.filter((value) => value !== ALL_LABEL)
}

// ---------- 旧接口兼容 ----------
function getTrainPartTargets(target) {
  const found = DEFAULT_PART_DEF.find((p) => p.label === cleanText(target)) || DEFAULT_PART_DEF.find((p) => p.targets.includes(cleanText(target)))
  return found ? found.targets.slice() : [cleanText(target)]
}

function normalizeCustomParts(parts, availableTargets = []) {
  const allowed = new Set((Array.isArray(availableTargets) ? availableTargets : []).map(cleanText).filter(Boolean))
  const hasTargetConstraint = allowed.size > 0
  const result = []
  const seen = new Set()
  for (const item of Array.isArray(parts) ? parts : []) {
    const label = cleanText(item && (item.label || item.name))
    const targets = Array.isArray(item && item.targets)
      ? item.targets.map(cleanText).filter(Boolean)
      : [cleanText(item && item.target)].filter(Boolean)
    if (!label || !targets.length) continue
    if (label === ALL_LABEL) continue
    const expandedTargets = normalizePartTargets(targets, availableTargets)
    const validTargets = hasTargetConstraint
      ? expandedTargets.filter((t) => allowed.has(t))
      : expandedTargets
    if (!validTargets.length) continue
    const key = label + '::' + validTargets.join(',')
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ label, targets: validTargets })
  }
  return result
}

// ---------- 部位全量管理 ----------
// parts 结构：Array<{ label, targets:number[], custom:boolean }>，含默认与自定义
// DEFAULT_PARTS: legacy-compatible fixed five removable parts
const DEFAULT_PARTS = DEFAULT_PART_DEF.map((p) => ({ label: p.label, target: p.targets[0] || p.label, custom: false }))

function defaultParts() {
  return DEFAULT_PART_DEF.map((p) => ({ label: p.label, targets: p.targets.slice(), custom: false }))
}

function applyOrder(parts, orderLabels) {
  const order = Array.isArray(orderLabels) ? orderLabels.map(cleanText).filter(Boolean) : []
  if (!order.length) return parts
  const copy = parts.slice()
  copy.sort((a, b) => {
    const ia = order.indexOf(a.label)
    const ib = order.indexOf(b.label)
    if (ia === -1 && ib === -1) return 0
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
  return copy
}

function loadOrder(storage) {
  const adapter = getStorage(storage)
  if (!adapter || typeof adapter.getStorageSync !== 'function') return []
  let value = adapter.getStorageSync(ORDER_STORAGE_KEY)
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch (e) { value = [] }
  }
  return Array.isArray(value) ? value.map((s) => String(s)).filter(Boolean) : []
}

function loadParts(storage) {
  const adapter = getStorage(storage)
  if (!adapter || typeof adapter.getStorageSync !== 'function') return defaultParts()
  const savedState = adapter.getStorageSync(PARTS_STATE_KEY)
  if (savedState && Array.isArray(savedState.parts)) {
    const savedParts = savedState.parts
      .map((part) => ({
        label: cleanText(part && part.label),
        targets: normalizePartTargets(part && part.targets),
        custom: Boolean(part && part.custom)
      }))
      .filter((part) => part.label && part.label !== ALL_LABEL && part.targets.length)
    return applyOrder(savedParts, loadOrder(adapter))
  }
  const custom = loadCustomTrainParts(adapter)
  const parts = defaultParts()
  for (const c of custom) {
    if (!parts.some((p) => p.label === c.label)) parts.push({ label: c.label, targets: c.targets.slice(), custom: true })
  }
  return applyOrder(parts, loadOrder(adapter))
}

function saveParts(parts, storage) {
  const adapter = getStorage(storage)
  const all = (Array.isArray(parts) ? parts : [])
    .filter((part) => part && cleanText(part.label) && cleanText(part.label) !== ALL_LABEL)
    .map((part) => ({
      label: cleanText(part.label),
      targets: normalizePartTargets(part.targets),
      custom: Boolean(part.custom)
    }))
    .filter((part, index, list) => part.targets.length && list.findIndex((item) => item.label === part.label) === index)
  if (!adapter || typeof adapter.setStorageSync !== 'function') return all
  const custom = all.filter((p) => p.custom).map((p) => ({ label: p.label, targets: p.targets.slice() }))
  const order = all.map((p) => p.label)
  adapter.setStorageSync(STORAGE_KEY, custom)
  adapter.setStorageSync(ORDER_STORAGE_KEY, order)
  adapter.setStorageSync(PARTS_STATE_KEY, { parts: all })
  return all
}

// tabs：全部 + 每个部位
function tabs(parts) {
  return [
    { ...ALL_PART },
    ...parts.map((p) => ({ label: p.label, target: p.label, custom: p.custom }))
  ]
}

function getPartMatchTargets(parts, partLabel) {
  const label = cleanText(partLabel)
  if (!label || label === ALL_LABEL) return []
  const found = (Array.isArray(parts) ? parts : []).find((p) => p.label === label)
  return found ? found.targets.slice() : getTrainPartTargets(label)
}

function matchesPart(parts, exercise, partLabel) {
  const targets = getPartMatchTargets(parts, partLabel)
  if (!targets.length) return true // 全部或未知
  const exerciseTarget = cleanText(exercise && (exercise.target || exercise.targetPart))
  return targets.includes(exerciseTarget)
}

function addPart(parts, { label, targets, availableTargets = [] }) {
  const name = cleanText(label)
  const targs = normalizePartTargets(targets, availableTargets)
  if (!name) throw new Error('请输入标签名称并选择动作部位') // 请输入标签名称并选择动作部位
  if (!targs.length) throw new Error('请选择至少一个动作部位') // 请选择至少一个动作部位
  const list = (Array.isArray(parts) ? parts : []).slice()
  if (list.some((p) => p.label === name)) throw new Error('该标签已存在') // 该标签已存在
  list.push({ label: name, targets: targs, custom: true })
  return list
}

function removePart(parts, label) {
  const name = cleanText(label)
  if (!name || name === ALL_LABEL) return parts
  return (Array.isArray(parts) ? parts : []).filter((p) => p.label !== name)
}

function reorderPart(parts, from, to) {
  const list = (Array.isArray(parts) ? parts : []).slice()
  const max = list.length
  let f = Number(from)
  let t = Number(to)
  if (!Number.isInteger(f) || !Number.isInteger(t)) return list
  if (f < 0 || f >= max || t < 0 || t >= max) return list
  if (f === t) return list
  const [moved] = list.splice(f, 1)
  list.splice(t, 0, moved)
  return list
}

// ---------- 旧接口（兼容既有页面/测试） ----------
function getTrainPartTabs(customParts = [], availableTargets = [], storage) {
  // 以“全部显示给用户”为目标：默认部位 + 自定义部位；优先使用持久化的顺序
  const parts = loadParts(storage)
  const custom = normalizeCustomParts(customParts, availableTargets)
  for (const c of custom) {
    if (!parts.some((p) => p.label === c.label)) parts.push({ label: c.label, targets: c.targets.slice(), custom: true })
  }
  return tabs(parts)
}

function addCustomTrainPart(part, existingParts = [], availableTargets = []) {
  const created = addPart([], {
    label: part && part.label,
    targets: part && (part.targets || [part.target]),
    availableTargets
  })
  const label = created[0] ? created[0].label : part && part.label
  const targets = created[0] ? created[0].targets : []
  const list = (Array.isArray(existingParts) ? existingParts : []).slice()
  if (list.some((p) => p.label === label)) throw new Error('该自定义标签已存在') // 该自定义标签已存在
  list.push({ label, targets })
  return list
}

function loadCustomTrainParts(storage) {
  const adapter = getStorage(storage)
  if (!adapter || typeof adapter.getStorageSync !== 'function') return []
  return normalizeCustomParts(adapter.getStorageSync(STORAGE_KEY))
}

function saveCustomTrainParts(parts, storage) {
  const adapter = getStorage(storage)
  const value = normalizeCustomParts(parts)
  if (adapter && typeof adapter.setStorageSync === 'function') {
    const current = loadParts(adapter)
    const merged = current.filter((part) => !part.custom || value.some((item) => item.label === part.label))
    for (const item of value) {
      if (!merged.some((part) => part.label === item.label)) merged.push({ ...item, custom: true })
    }
    saveParts(merged, adapter)
  }
  return value
}

function matchesTrainPart(exercise, activePart, parts = loadParts()) {
  return matchesPart(parts, exercise, activePart)
}

export {
  ALL_LABEL,
  ALL_PART,
  DEFAULT_PART_DEF,
  defaultParts,
  tabs,
  loadOrder,
  loadParts,
  saveParts,
  getPartMatchTargets,
  matchesPart,
  addPart,
  removePart,
  reorderPart,
  STORAGE_KEY,
  DEFAULT_PARTS,
  getTrainPartTargets,
  matchesTrainPart,
  getTrainPartTabs,
  addCustomTrainPart,
  loadCustomTrainParts,
  saveCustomTrainParts,
  normalizePartTargets,
  PARTS_STATE_KEY
}
