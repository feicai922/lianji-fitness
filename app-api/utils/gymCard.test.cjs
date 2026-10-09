const test = require('node:test')
const assert = require('node:assert/strict')

const TODAY = new Date(2026, 7, 18) // 2026-08-18

test('rejects invalid or empty expire dates', async () => {
  const { normalizeGymCard, getCardStatus } = await import('./gymCard.js')
  assert.equal(normalizeGymCard(null), null)
  assert.equal(normalizeGymCard({ expireDate: '' }), null)
  assert.equal(normalizeGymCard({ expireDate: '2026-02-30' }), null) // 不存在的日期
  assert.equal(normalizeGymCard({ expireDate: '2026/08/18' }), null)
  assert.equal(getCardStatus(''), null)
  assert.equal(getCardStatus('not-a-date'), null)
})

test('normalizes a valid card and keeps the update time', async () => {
  const { normalizeGymCard } = await import('./gymCard.js')
  assert.deepEqual(normalizeGymCard({ expireDate: '2026-12-31', updatedAt: '2026-08-18T00:00:00.000Z' }), {
    expireDate: '2026-12-31',
    updatedAt: '2026-08-18T00:00:00.000Z'
  })
  assert.deepEqual(normalizeGymCard({ expire_date: '2026-12-31' }), {
    expireDate: '2026-12-31',
    updatedAt: ''
  })
})

test('computes remaining days by calendar day, ignoring time of day', async () => {
  const { daysUntil } = await import('./gymCard.js')
  assert.equal(daysUntil('2026-08-18', TODAY), 0)
  assert.equal(daysUntil('2026-08-19', TODAY), 1)
  assert.equal(daysUntil('2026-09-18', TODAY), 31)
  assert.equal(daysUntil('2026-08-17', TODAY), -1)
  // 当天深夜与清晨应得到同样结果
  assert.equal(daysUntil('2026-08-25', new Date(2026, 7, 18, 23, 59)), 7)
  assert.equal(daysUntil('2026-08-25', new Date(2026, 7, 18, 0, 1)), 7)
})

test('maps remaining days to the three colour levels', async () => {
  const { getCardStatus } = await import('./gymCard.js')
  const tone = (date) => getCardStatus(date, TODAY).tone
  // 1 个月以上 -> 绿
  assert.equal(tone('2026-09-30'), 'green')
  assert.equal(tone('2026-09-17'), 'green') // 30 天
  // 1 周 - 1 个月 -> 黄
  assert.equal(tone('2026-09-16'), 'yellow') // 29 天
  assert.equal(tone('2026-08-25'), 'yellow') // 7 天
  // 1 周内 -> 红
  assert.equal(tone('2026-08-24'), 'red') // 6 天
  assert.equal(tone('2026-08-18'), 'red') // 今天到期
  assert.equal(tone('2026-08-01'), 'red') // 已过期
})

test('formats the remaining-days label including expiry', async () => {
  const { getCardStatus } = await import('./gymCard.js')
  assert.equal(getCardStatus('2026-08-25', TODAY).label, '剩余 7 天')
  assert.equal(getCardStatus('2026-08-18', TODAY).label, '今天到期')
  assert.equal(getCardStatus('2026-08-14', TODAY).label, '已过期 4 天')
  assert.equal(getCardStatus('2026-08-14', TODAY).expired, true)
  assert.equal(getCardStatus('2026-08-18', TODAY).expired, false)
})

test('status carries the expire date and level for rendering', async () => {
  const { getCardStatus } = await import('./gymCard.js')
  const status = getCardStatus('2026-08-20', TODAY)
  assert.equal(status.expireDate, '2026-08-20')
  assert.equal(status.days, 2)
  assert.equal(status.level, 'danger')
  assert.match(status.color, /^#/)
  assert.match(status.background, /^#/)
})
