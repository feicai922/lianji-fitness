const ORDER_KEY = 'fitness_exercise_order_v1'

function getStorage(storage) {
  if (storage) return storage
  if (typeof uni !== 'undefined') return uni
  return null
}

function readExerciseOrders(storage) {
  const adapter = getStorage(storage)
  if (!adapter || typeof adapter.getStorageSync !== 'function') return {}
  let value = adapter.getStorageSync(ORDER_KEY)
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch (error) { value = {} }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).map(([key, ids]) => [
    key,
    Array.isArray(ids) ? [...new Set(ids.map((id) => String(id)).filter(Boolean))] : []
  ]))
}

function saveExerciseOrder(part, ids, storage) {
  const adapter = getStorage(storage)
  const key = String(part || '')
  if (!key || !adapter || typeof adapter.setStorageSync !== 'function') return readExerciseOrders(adapter)
  const orders = readExerciseOrders(adapter)
  orders[key] = [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id)).filter(Boolean))]
  adapter.setStorageSync(ORDER_KEY, orders)
  return orders
}

function applyExerciseOrder(exercises, part, storage) {
  const source = Array.isArray(exercises) ? exercises.slice() : []
  const order = readExerciseOrders(storage)[String(part || '')] || []
  if (!order.length) return source
  const byId = new Map(source.map((item) => [String(item && item.id), item]))
  const ordered = order.filter((id) => byId.has(id)).map((id) => byId.get(id))
  const used = new Set(ordered.map((item) => String(item.id)))
  return ordered.concat(source.filter((item) => !used.has(String(item && item.id))))
}

function moveExercise(exercises, exerciseId, direction) {
  const result = Array.isArray(exercises) ? exercises.slice() : []
  const index = result.findIndex((item) => String(item && item.id) === String(exerciseId))
  if (index < 0) return result
  const target = direction === 'down' ? index + 1 : index - 1
  if (target < 0 || target >= result.length) return result
  const [item] = result.splice(index, 1)
  result.splice(target, 0, item)
  return result
}

export { ORDER_KEY, readExerciseOrders, saveExerciseOrder, applyExerciseOrder, moveExercise }
