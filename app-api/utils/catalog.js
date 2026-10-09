import bundledCatalog from '../data/clean_fitness_zh.js'

const CACHE_KEY = 'clean_fitness_catalog_v3'
const COMMON_PARTS = ['胸', '肩', '背', '腿', '有氧']

function getCatalogParts(catalog) {
  const sourceParts = Array.isArray(catalog)
    ? catalog.map((item) => String(item && item.target ? item.target : '').trim()).filter(Boolean)
    : []
  const unique = [...new Set(sourceParts)]
  const common = COMMON_PARTS.filter((part) => unique.includes(part))
  const remaining = unique.filter((part) => !COMMON_PARTS.includes(part))
  return ['全部', ...common, ...remaining]
}

function readCachedCatalog() {
  if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') return null
  const cached = uni.getStorageSync(CACHE_KEY)
  return Array.isArray(cached) && cached.length ? cached : null
}

function cacheCatalog(catalog) {
  if (typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function') {
    uni.setStorageSync(CACHE_KEY, catalog)
  }
}

function loadExerciseCatalog() {
  const cached = readCachedCatalog()
  if (cached) return Promise.resolve(cached)

  const catalog = Array.isArray(bundledCatalog) ? bundledCatalog : []
  if (catalog.length) cacheCatalog(catalog)
  return Promise.resolve(catalog)
}

function clearExerciseCatalogCache() {
  if (typeof uni !== 'undefined' && typeof uni.removeStorageSync === 'function') {
    uni.removeStorageSync(CACHE_KEY)
  }
}

export { CACHE_KEY, loadExerciseCatalog, clearExerciseCatalogCache, getCatalogParts }
