const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const root = path.resolve(__dirname, '../..')

test('registers a mobile monthly check-in calendar with cardio and part statistics', () => {
  const pages = JSON.parse(fs.readFileSync(path.join(root, 'pages.json'), 'utf8'))
  assert.ok(pages.pages.some((page) => page.path === 'pages/checkin/index'))
  assert.ok(pages.tabBar.list.some((item) => item.pagePath === 'pages/checkin/index' && item.text === '每日打卡'))

  const source = fs.readFileSync(path.join(__dirname, 'index.vue'), 'utf8')
  assert.match(source, /createMonthGrid/)
  assert.match(source, /summarizeMonth/)
  assert.match(source, /createCardioCheckIn/)
  assert.match(source, /listCheckIns/)
  assert.match(source, /grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/)
  assert.match(source, /aspect-ratio: 1/)
  assert.match(source, /今日已由训练自动打卡/)
  assert.match(source, /本月部位训练天数/)
  assert.match(source, /changeMonth\(-1\)/)
  assert.match(source, /changeMonth\(1\)/)
})
