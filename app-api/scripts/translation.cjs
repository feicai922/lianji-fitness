const fs = require('node:fs')
const path = require('node:path')

const MAX_ATTEMPTS = 3
const BATCH_SIZE = 20

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function normalizeBaseUrl(value) {
  return cleanText(value).replace(/\/+$/, '')
}

function buildTranslationPrompt(items) {
  const payload = items.map((item) => ({ id: String(item.id), name: String(item.name) }))
  return [
    '你是一名熟悉力量训练、健身器械和运动解剖学的专业健身教练，同时负责英文动作名称的简体中文本地化。',
    '请把下面每条英文健身动作名称翻译成自然、准确、常用的简体中文。',
    '必须保留器械、姿势、握法、方向、左右侧、单侧/双侧和动作变式等信息；不要逐词硬译，不要添加解释，不要输出英文。',
    '只返回严格 JSON 数组，每个元素格式为 {"id":"原id","name_zh":"中文动作名"}，不要 Markdown、不要额外文字。',
    '待翻译数据：',
    JSON.stringify(payload)
  ].join('\n')
}

function stripJsonFence(content) {
  const text = typeof content === 'string' ? content.trim() : ''
  const fence = String.fromCharCode(96).repeat(3)
  if (!text.startsWith(fence)) return text
  const firstLineEnd = text.indexOf('\n')
  const end = text.lastIndexOf(fence)
  if (firstLineEnd < 0 || end <= firstLineEnd) return text
  return text.slice(firstLineEnd + 1, end).trim()
}

function parseTranslationResponse(content, expectedItems = []) {
  let parsed
  try {
    parsed = JSON.parse(stripJsonFence(content))
  } catch (error) {
    throw new Error('翻译结果不是合法 JSON')
  }
  if (!Array.isArray(parsed)) throw new Error('翻译结果必须是 JSON 数组')

  const expected = new Map(expectedItems.map((item) => [String(item.id), cleanText(item.name)]))
  const result = {}
  for (const item of parsed) {
    const id = cleanText(item && item.id)
    const nameZh = cleanText(item && item.name_zh)
    if (!id || !expected.has(id)) throw new Error('翻译结果包含未知 id')
    if (result[id]) throw new Error('翻译结果包含重复 id')
    if (!nameZh) throw new Error('翻译结果包含空的中文动作名')
    if (nameZh.toLowerCase() === expected.get(id).toLowerCase()) {
      throw new Error('翻译结果仍是英文原文')
    }
    result[id] = nameZh
  }

  for (const item of expectedItems) {
    if (!result[String(item.id)]) throw new Error('翻译结果缺少 id: ' + item.id)
  }
  return result
}

function mergeTranslationCache(cache, items, translations) {
  const result = cache && typeof cache === 'object' ? { ...cache } : {}
  for (const item of items) {
    const id = String(item.id)
    const nameZh = cleanText(translations[id])
    if (!nameZh) throw new Error('没有找到动作的中文翻译: ' + id)
    result[id] = { source: cleanText(item.name), name_zh: nameZh }
  }
  return result
}

function loadTranslationConfig(env = process.env) {
  const baseUrl = normalizeBaseUrl(env.TRANSLATION_API_BASE_URL)
  const apiKey = cleanText(env.TRANSLATION_API_KEY)
  const model = cleanText(env.TRANSLATION_MODEL)
  if (!baseUrl || !apiKey || !model) {
    throw new Error('缺少翻译配置，请设置 TRANSLATION_API_BASE_URL、TRANSLATION_API_KEY 和 TRANSLATION_MODEL')
  }
  return { baseUrl, apiKey, model }
}

async function translateBatch(items, {
  baseUrl,
  apiKey,
  model,
  fetchImpl = globalThis.fetch,
  sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('当前 Node.js 不支持 fetch')
  const url = normalizeBaseUrl(baseUrl) + '/chat/completions'
  const body = {
    model,
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content: '你只输出严格 JSON，不输出 Markdown 或解释。你是专业健身动作中英翻译器。'
      },
      { role: 'user', content: buildTranslationPrompt(items) }
    ]
  }

  let lastError = null
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify(body)
      })
      const raw = await response.text()
      let payload
      try {
        payload = JSON.parse(raw)
      } catch (error) {
        payload = {}
      }
      if (!response.ok) {
        const message = cleanText(payload.error && (payload.error.message || payload.error.code)) || 'HTTP ' + response.status
        const error = new Error('翻译接口请求失败: ' + message)
        if (response.status !== 429 && response.status < 500) throw error
        lastError = error
      } else {
        const content = payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content
        return parseTranslationResponse(content, items)
      }
    } catch (error) {
      lastError = error
      if (error.message && error.message.indexOf('翻译结果') >= 0) throw error
      if (error.message && error.message.indexOf('未知 id') >= 0) throw error
      if (error.message && error.message.indexOf('重复 id') >= 0) throw error
      if (error.message && error.message.indexOf('英文原文') >= 0) throw error
      if (error.message && error.message.indexOf('合法 JSON') >= 0) throw error
    }
    if (attempt < MAX_ATTEMPTS - 1) await sleepImpl(1000 * (2 ** attempt))
  }
  throw new Error('翻译批次失败（id: ' + items.map((item) => item.id).join(', ') + '）: ' + (lastError ? lastError.message : '未知错误'))
}

async function translateMissingNames(items, options = {}) {
  const requested = Number(options.concurrency ?? process.env.TRANSLATION_CONCURRENCY ?? 2)
  const concurrency = Math.min(Math.max(Number.isFinite(requested) ? Math.floor(requested) : 2, 1), 8)
  const requestedBatchSize = Number(options.batchSize ?? process.env.TRANSLATION_BATCH_SIZE ?? BATCH_SIZE)
  const batchSize = Math.min(Math.max(Number.isFinite(requestedBatchSize) ? Math.floor(requestedBatchSize) : BATCH_SIZE, 1), 100)
  const { onBatchComplete, concurrency: ignoredConcurrency, batchSize: ignoredBatchSize, ...batchOptions } = options
  const batches = []
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize))
  }
  if (!batches.length) return {}

  const result = {}
  let completionQueue = Promise.resolve()
  let nextBatchIndex = 0
  const worker = async () => {
    while (true) {
      const batchIndex = nextBatchIndex++
      if (batchIndex >= batches.length) return
      const batch = batches[batchIndex]
      const translations = await translateBatch(batch, batchOptions)
      Object.assign(result, translations)
      if (typeof onBatchComplete === 'function') {
        const callbackTask = completionQueue.then(() => onBatchComplete(batch, translations, batchIndex))
        completionQueue = callbackTask.catch(() => {})
        await callbackTask
      }
    }
  }

  const workerCount = Math.min(concurrency, batches.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return result
}

function readTranslationCache(cachePath) {
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
}

function writeTranslationCache(cachePath, cache) {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true })
  const tempPath = cachePath + '.tmp'
  fs.writeFileSync(tempPath, JSON.stringify(cache, null, 2) + '\n', 'utf8')
  fs.renameSync(tempPath, cachePath)
}

module.exports = {
  BATCH_SIZE,
  buildTranslationPrompt,
  parseTranslationResponse,
  normalizeBaseUrl,
  mergeTranslationCache,
  loadTranslationConfig,
  translateBatch,
  translateMissingNames,
  readTranslationCache,
  writeTranslationCache
}
