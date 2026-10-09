const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const source = fs.readFileSync(path.join(__dirname, 'index.vue'), 'utf8')

// Regression: qiun/uCharts computes point spacing as
//   Math.min(opts.xAxis.itemCount, categories.length)
// whenever enableScroll is true. Leaving itemCount undefined makes the spacing
// NaN, so every point collapses and the line chart renders nothing.
test('always passes xAxis.itemCount when scroll is enabled', () => {
  assert.match(source, /enableScroll/)
  assert.match(source, /itemCount/)
  // itemCount must be driven by the same enableScroll decision
  assert.match(source, /itemCount:\s*enableScroll\s*\?/)
})

test('keeps the scroll threshold and chart wiring intact', () => {
  assert.match(source, /this\.weights\.length > 7/)
  assert.match(source, /qiun-data-charts/)
  assert.match(source, /chartData/)
  assert.match(source, /listWeights/)
})
