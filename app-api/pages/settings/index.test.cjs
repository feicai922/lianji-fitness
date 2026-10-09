const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const root = path.resolve(__dirname, '../..')

test('registers settings separately and adds preview as the last bottom tab', () => {
  const pages = JSON.parse(fs.readFileSync(path.join(root, 'pages.json'), 'utf8'))
  assert.ok(pages.pages.some((page) => page.path === 'pages/settings/index'))
  assert.equal(pages.tabBar.list.some((tab) => tab.pagePath === 'pages/settings/index'), false)
  assert.equal(pages.tabBar.list.at(-1).pagePath, 'pages/preview/index')

  const source = fs.readFileSync(path.join(__dirname, 'index.vue'), 'utf8')
  assert.doesNotMatch(source, /每日诺言诺语/)
  assert.doesNotMatch(source, /<switch/)
  assert.doesNotMatch(source, /DailyQuote/)
  assert.match(source, /导出数据/)
  assert.match(source, /导入数据/)
  assert.match(source, /exportAppData/)
  assert.match(source, /restorePreferences/)
})
