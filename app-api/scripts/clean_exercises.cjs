const fs = require('node:fs')
const path = require('node:path')
const {
  loadTranslationConfig,
  translateMissingNames,
  readTranslationCache,
  mergeTranslationCache,
  writeTranslationCache
} = require('./translation.cjs')

const ROOT = path.resolve(__dirname, '..')
const INPUT_PATH = path.join(ROOT, 'exercises-dataset-main', 'data', 'exercises.json')
const OUTPUT_PATH = path.join(ROOT, 'static', 'json', 'clean_fitness_zh.json')
const BUNDLED_OUTPUT_PATH = path.join(ROOT, 'data', 'clean_fitness_zh.js')
const CACHE_PATH = path.join(ROOT, 'data', '.translation-cache.json')

const TARGET_MAP = {
  abs: '腹部',
  quads: '股四头肌',
  lats: '背阔肌',
  calves: '小腿',
  pectorals: '胸',
  glutes: '臀部',
  hamstrings: '大腿后侧',
  adductors: '内收肌',
  triceps: '肱三头肌',
  'cardiovascular system': '有氧',
  spine: '脊柱',
  'upper back': '上背部',
  biceps: '肱二头肌',
  delts: '肩',
  forearms: '前臂',
  traps: '斜方肌',
  'serratus anterior': '前锯肌',
  abductors: '外展肌',
  'levator scapulae': '肩胛提肌'
}

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function normalizeKey(value) {
  return cleanText(value).toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ')
}

function normalizeExercise(item, { translations = {} } = {}) {
  if (!item || typeof item !== 'object') return null
  const targetPart = TARGET_MAP[normalizeKey(item.target)]
  const id = cleanText(item.id)
  const mediaId = cleanText(item.media_id)
  const nameZh = cleanText(item.name_cn) || cleanText(item.name_zh) || cleanText(translations[id])
  const instructionsZh = cleanText(item.instructions_zh) || cleanText(item.instructions && item.instructions.zh)

  if (!id || !targetPart || !mediaId || !nameZh || !instructionsZh) return null

  return {
    id,
    name_zh: nameZh,
    target: targetPart,
    media_id: mediaId,
    instructions_zh: instructionsZh
  }
}

function cleanExercises(input, options = {}) {
  if (!Array.isArray(input)) throw new TypeError('exercises.json 必须是数组')
  const seen = new Set()
  return input.map((item) => normalizeExercise(item, options)).filter((item) => {
    if (!item || seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function isStructurallyValid(item) {
  return Boolean(
    item &&
    typeof item === 'object' &&
    cleanText(item.id) &&
    TARGET_MAP[normalizeKey(item.target)] &&
    cleanText(item.media_id) &&
    (cleanText(item.instructions_zh) || cleanText(item.instructions && item.instructions.zh))
  )
}

function getCachedTranslations(input, cache) {
  const result = {}
  for (const item of input) {
    const id = cleanText(item && item.id)
    const source = cleanText(item && item.name)
    const entry = cache && cache[id]
    if (id && entry && entry.source === source && entry.name_zh) result[id] = entry.name_zh
    if (id && cleanText(item && item.name_zh)) result[id] = cleanText(item.name_zh)
  }
  return result
}

function getMissingTranslations(input, cache) {
  return input.filter((item) => {
    if (!isStructurallyValid(item) || cleanText(item.name_cn) || cleanText(item.name_zh)) return false
    const id = cleanText(item.id)
    const source = cleanText(item.name)
    const entry = cache && cache[id]
    return !entry || entry.source !== source || !cleanText(entry.name_zh)
  })
}

function getUnresolvedRows(input, translations) {
  return input.filter((item) => isStructurallyValid(item) && !normalizeExercise(item, { translations }))
}

function writeAtomic(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const tempPath = filePath + '.tmp'
  fs.writeFileSync(tempPath, content, 'utf8')
  fs.rmSync(filePath, { force: true })
  fs.renameSync(tempPath, filePath)
}

async function translateMissing(input, cache) {
  const missing = getMissingTranslations(input, cache)
  if (!missing.length) return cache
  const config = loadTranslationConfig()
  let nextCache = cache
  let completed = 0
  await translateMissingNames(missing, {
    ...config,
    concurrency: process.env.TRANSLATION_CONCURRENCY,
    batchSize: process.env.TRANSLATION_BATCH_SIZE,
    onBatchComplete(batch, translations) {
      nextCache = mergeTranslationCache(nextCache, batch, translations)
      writeTranslationCache(CACHE_PATH, nextCache)
      completed += batch.length
      console.log('已翻译并缓存 ' + completed + '/' + missing.length + ' 条动作名')
    }
  })
  return nextCache
}

async function main() {
  const input = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'))
  let cache = readTranslationCache(CACHE_PATH)
  cache = await translateMissing(input, cache)
  const translations = getCachedTranslations(input, cache)
  const unresolved = getUnresolvedRows(input, translations)
  if (unresolved.length) {
    const details = unresolved.slice(0, 20).map((item) => item.id + ': ' + item.name).join('; ')
    throw new Error('仍有动作缺少中文名称（共 ' + unresolved.length + ' 条）: ' + details)
  }

  const output = cleanExercises(input, { translations })
  writeAtomic(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n')
  writeAtomic(BUNDLED_OUTPUT_PATH, 'export default ' + JSON.stringify(output) + '\n')
  const counts = output.reduce((result, item) => {
    result[item.target] = (result[item.target] || 0) + 1
    return result
  }, {})
  console.log('已生成 ' + path.relative(ROOT, OUTPUT_PATH) + '，共 ' + output.length + ' 条')
  console.log(counts)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}

module.exports = {
  TARGET_MAP,
  cleanExercises,
  normalizeExercise,
  isStructurallyValid,
  getCachedTranslations,
  getMissingTranslations,
  getUnresolvedRows,
  writeAtomic
}
