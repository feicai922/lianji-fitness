<template>
  <view class="page-shell checkin-page">
    <view class="page-heading">
      <view>
        <view class="page-title">每日打卡</view>
        <view class="page-subtitle">记录每一次完成训练的日子</view>
      </view>
    </view>

    <view class="calendar-card">
      <view class="month-header">
        <view class="month-button" @click="changeMonth(-1)">‹</view>
        <text class="month-title">{{ monthTitle }}</text>
        <view class="month-button" @click="changeMonth(1)">›</view>
      </view>
      <view class="weekday-row">
        <text v-for="day in weekdays" :key="day">{{ day }}</text>
      </view>
      <view class="calendar-grid">
        <view
          v-for="day in calendarDays"
          :key="day.key"
          class="calendar-day"
          :class="{
            muted: !day.inMonth,
            future: day.future,
            training: day.source === 'training',
            cardio: day.source === 'cardio',
            today: day.today
          }"
        >
          <text>{{ day.day }}</text>
        </view>
      </view>
      <view class="legend">
        <view><text class="legend-dot training-dot"></text><text>训练自动打卡</text></view>
        <view><text class="legend-dot cardio-dot"></text><text>有氧手动打卡</text></view>
      </view>
    </view>

    <view class="today-card">
      <text class="section-title">今天的打卡</text>
      <text class="today-hint">{{ todayMessage }}</text>
      <button class="cardio-button" :disabled="cardioDisabled" @click="checkCardio">{{ cardioButtonText }}</button>
    </view>

    <view class="summary-card">
      <text class="section-title">本月统计</text>
      <view class="summary-row">
        <view><text class="summary-number">{{ summary.checkedDays }}</text><text>已打卡</text></view>
        <view><text class="summary-number">{{ summary.trainingDays }}</text><text>训练</text></view>
        <view><text class="summary-number">{{ summary.cardioDays }}</text><text>有氧</text></view>
      </view>
      <text class="part-title">本月部位训练天数</text>
      <view v-if="partSummary.length" class="part-chips">
        <text v-for="item in partSummary" :key="item.part" class="part-chip">{{ item.part }} {{ item.days }} 天</text>
      </view>
      <text v-else class="empty-parts">本月还没有打卡记录</text>
    </view>
  </view>
</template>

<script>
import { formatDate } from '@/utils/date'
import { getCheckIn, listCheckIns, saveCheckIn } from '@/utils/sqlite'
import { createCardioCheckIn, createMonthGrid, summarizeMonth } from '@/utils/checkIn'

export default {
  data() {
    return {
      monthKey: formatDate().slice(0, 7),
      records: [],
      loading: true,
      weekdays: ['一', '二', '三', '四', '五', '六', '日']
    }
  },
  computed: {
    monthTitle() {
      const [year, month] = this.monthKey.split('-')
      return year + ' 年 ' + Number(month) + ' 月'
    },
    calendarDays() {
      return createMonthGrid(this.monthKey, this.records, formatDate())
    },
    summary() {
      return summarizeMonth(this.records, this.monthKey)
    },
    partSummary() {
      return Object.entries(this.summary.partDays)
        .map(([part, days]) => ({ part, days }))
        .sort((a, b) => b.days - a.days || a.part.localeCompare(b.part, 'zh-CN'))
    },
    todayRecord() {
      const today = formatDate()
      return this.records.find((item) => item.checkDate === today) || null
    },
    todayStatus() {
      return this.todayRecord ? this.todayRecord.source : ''
    },
    cardioDisabled() {
      return Boolean(this.todayStatus)
    },
    cardioButtonText() {
      if (this.todayStatus === 'training') return '今日已由训练自动打卡'
      if (this.todayStatus === 'cardio') return '今日已完成有氧打卡'
      return '有氧打卡'
    },
    todayMessage() {
      if (this.todayStatus === 'training') return '已根据训练组完成状态自动打卡'
      if (this.todayStatus === 'cardio') return '有氧打卡已完成，明天继续加油'
      return '没有训练时，也可以手动完成有氧打卡'
    }
  },
  onShow() {
    this.loadMonth()
  },
  methods: {
    async loadMonth() {
      this.loading = true
      try {
        this.records = await listCheckIns()
      } catch (error) {
        uni.showToast({ title: '打卡记录加载失败，请重试', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    async changeMonth(offset) {
      const [year, month] = this.monthKey.split('-').map(Number)
      const date = new Date(year, month - 1 + Number(offset || 0), 1)
      this.monthKey = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0')
      await this.loadMonth()
    },
    async checkCardio() {
      if (this.cardioDisabled) return
      const today = formatDate()
      try {
        const next = createCardioCheckIn(await getCheckIn(today), today)
        await saveCheckIn(next)
        await this.loadMonth()
        uni.showToast({ title: '已完成有氧打卡', icon: 'none' })
      } catch (error) {
        await this.loadMonth()
        uni.showToast({ title: error.message || '有氧打卡失败，请重试', icon: 'none' })
      }
    }
  }
}
</script>

<style scoped>
.checkin-page { padding-bottom: 48rpx; }
.calendar-card, .today-card, .summary-card { margin-top: 28rpx; padding: 30rpx 26rpx; border: 1rpx solid #eceef0; border-radius: 22rpx; background: #ffffff; box-shadow: 0 12rpx 30rpx rgba(23, 25, 28, .05); }
.month-header { display: flex; align-items: center; justify-content: space-between; }
.month-title, .section-title { color: #17191c; font-size: 32rpx; font-weight: 700; }
.month-button { display: flex; align-items: center; justify-content: center; width: 62rpx; height: 62rpx; border: 1rpx solid #e1e4e7; border-radius: 50%; color: #555d64; font-size: 46rpx; line-height: 1; }
.weekday-row, .calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); text-align: center; }
.weekday-row { margin-top: 28rpx; color: #8d949b; font-size: 22rpx; }
.calendar-grid { gap: 8rpx; margin-top: 14rpx; }
.calendar-day { display: flex; align-items: center; justify-content: center; min-width: 0; aspect-ratio: 1; border: 1rpx solid transparent; border-radius: 12rpx; color: #555d64; font-size: 24rpx; }
.calendar-day.muted { color: #c7cbd0; }
.calendar-day.future { background: #fafbfb; color: #c7cbd0; }
.calendar-day.training { background: #2f855a; color: #ffffff; font-weight: 700; }
.calendar-day.cardio { background: #9ae6b4; color: #195334; font-weight: 700; }
.calendar-day.today { border-color: #17191c; }
.legend { display: flex; flex-wrap: wrap; gap: 24rpx; margin-top: 26rpx; color: #70777e; font-size: 22rpx; }
.legend > view { display: flex; align-items: center; gap: 8rpx; }
.legend-dot { width: 16rpx; height: 16rpx; border-radius: 50%; }
.training-dot { background: #2f855a; }.cardio-dot { background: #9ae6b4; }
.today-hint { display: block; margin-top: 12rpx; color: #8d949b; font-size: 24rpx; }
.cardio-button { height: 78rpx; margin-top: 24rpx; border-radius: 12rpx; background: #17191c; color: #ffffff; font-size: 27rpx; line-height: 78rpx; }
.cardio-button[disabled] { background: #e9ecee; color: #858b91; }
.summary-row { display: flex; margin-top: 28rpx; }
.summary-row > view { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8rpx; color: #858b91; font-size: 22rpx; }
.summary-number { color: #17191c; font-size: 40rpx; font-weight: 700; }
.part-title { display: block; margin-top: 30rpx; color: #555d64; font-size: 25rpx; font-weight: 700; }
.part-chips { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 16rpx; }
.part-chip { padding: 10rpx 16rpx; border-radius: 999rpx; background: #edf7ef; color: #276749; font-size: 23rpx; }
.empty-parts { display: block; margin-top: 16rpx; color: #9aa0a6; font-size: 23rpx; }
</style>
