const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const source = fs.readFileSync(path.join(__dirname, 'index.vue'), 'utf8')

test('renders at most the recent 7 records by default', () => {
  assert.match(source, /const RECENT_COUNT = 7/)
  assert.match(source, /chartRows\(\)/)
  assert.match(source, /this\.weights\.slice\(0, RECENT_COUNT\)/)
})

test('loads the full history only on an explicit tap', () => {
  assert.match(source, /showAll/)
  assert.match(source, /toggleFullChart/)
  assert.match(source, /@click="toggleFullChart"/)
  // 默认必须是关的，不能在 onShow 里被打开
  assert.match(source, /showAll: false/)
})

test('draws a trend line without data point markers', () => {
  // uCharts skips drawPointShape entirely when this is exactly false.
  assert.match(source, /dataPointShape:\s*false/)
})

test('keeps the chart wired to real data', () => {
  assert.match(source, /qiun-data-charts/)
  assert.match(source, /listWeights/)
  assert.match(source, /chartData/)
  assert.match(source, /visibleRows/)
})
