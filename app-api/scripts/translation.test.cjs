const assert = require('node:assert/strict')
const test = require('node:test')
const {
  buildTranslationPrompt,
  parseTranslationResponse,
  normalizeBaseUrl,
  mergeTranslationCache,
  translateMissingNames
} = require('./translation.cjs')

test('builds a fitness-context prompt without asking for explanations', () => {
  const prompt = buildTranslationPrompt([{ id: '1', name: 'incline dumbbell press' }])
  assert.match(prompt, /健身/)
  assert.match(prompt, /严格 JSON/)
  assert.match(prompt, /incline dumbbell press/)
})

test('parses a JSON array returned inside a markdown fence', () => {
  const fence = String.fromCharCode(96).repeat(3)
  const response = fence + 'json\n[{"id":"1","name_zh":"上斜哑铃推举"}]\n' + fence
  const result = parseTranslationResponse(response, [{ id: '1', name: 'incline dumbbell press' }])
  assert.deepEqual(result, { '1': '上斜哑铃推举' })
})

test('rejects missing ids and empty translations', () => {
  assert.throws(
    () => parseTranslationResponse('[{"id":"1","name_zh":""}]', [{ id: '1', name: 'bench press' }]),
    /翻译结果/
  )
  assert.throws(
    () => parseTranslationResponse('[{"id":"2","name_zh":"卧推"}]', [{ id: '1', name: 'bench press' }]),
    /id/
  )
})

test('rejects an unchanged English translation', () => {
  assert.throws(
    () => parseTranslationResponse('[{"id":"1","name_zh":"bench press"}]', [{ id: '1', name: 'bench press' }]),
    /英文原文/
  )
})

test('normalizes an OpenAI-compatible base URL', () => {
  assert.equal(normalizeBaseUrl('https://example.com/v1/'), 'https://example.com/v1')
})

test('cache merge keeps source text with translated name', () => {
  const result = mergeTranslationCache({}, [{ id: '1', name: 'bench press' }], { '1': '杠铃卧推' })
  assert.deepEqual(result['1'], { source: 'bench press', name_zh: '杠铃卧推' })
})

test('translates batches concurrently without exceeding the configured limit', async () => {
  let active = 0
  let maxActive = 0
  let calls = 0
  let activeCallbacks = 0
  let maxActiveCallbacks = 0
  const items = Array.from({ length: 60 }, (_, index) => ({ id: String(index + 1), name: 'exercise ' + (index + 1) }))
  const fetchImpl = async (url, options) => {
    calls += 1
    active += 1
    maxActive = Math.max(maxActive, active)
    await new Promise((resolve) => setTimeout(resolve, 5))
    const request = JSON.parse(options.body)
    const payload = JSON.parse(request.messages[1].content.split('\n').at(-1))
    active -= 1
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [{ message: { content: JSON.stringify(payload.map((item) => ({ id: item.id, name_zh: '??' + item.id }))) } }]
      })
    }
  }

  const result = await translateMissingNames(items, {
    baseUrl: 'https://example.com/v1',
    apiKey: 'test-key',
    model: 'test-model',
    fetchImpl,
    concurrency: 3,
    batchSize: 20,
    onBatchComplete: async () => {
      activeCallbacks += 1
      maxActiveCallbacks = Math.max(maxActiveCallbacks, activeCallbacks)
      await new Promise((resolve) => setTimeout(resolve, 5))
      activeCallbacks -= 1
    }
  })

  assert.equal(calls, 3)
  assert.equal(maxActive, 3)
  assert.equal(maxActiveCallbacks, 1)
  assert.equal(Object.keys(result).length, 60)
})
