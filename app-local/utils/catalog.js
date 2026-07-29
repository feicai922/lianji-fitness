import bundledCatalog from '../data/clean_fitness_zh.js'

const CACHE_KEY = 'clean_fitness_catalog_v1'

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

export { loadExerciseCatalog, clearExerciseCatalogCache }
