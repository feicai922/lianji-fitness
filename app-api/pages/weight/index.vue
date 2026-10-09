<template>
  <view class="page-shell weight-page">
    <view class="page-title">体重管理</view>
    <view class="page-subtitle">保持稳定，持续进步</view>

    <view class="weight-entry">
      <view class="entry-copy">
        <text class="entry-label">今日体重</text>
        <text class="entry-hint">记录一次，就能看到变化</text>
      </view>
      <view class="entry-control">
        <input v-model="weightInput" type="digit" class="weight-input" placeholder="--" />
        <text class="weight-unit">kg</text>
      </view>
      <button class="save-weight" @click="saveWeight">保存</button>
    </view>

    <view v-if="weights.length" class="weight-summary">
      <view class="summary-item">
        <text class="summary-label">当前体重</text>
        <text class="summary-value">{{ currentWeight }} <text>kg</text></text>
      </view>
      <view class="summary-item summary-divider">
        <text class="summary-label">较上次</text>
        <text class="summary-value">{{ weightDelta }}</text>
      </view>
    </view>

    <view v-if="weights.length" class="chart-section">
      <view class="section-heading"><text>趋势</text><text class="section-note">最近 {{ weights.length }} 条记录</text></view>
      <view class="chart-card">
        <qiun-data-charts type="line" :chart-data="chartData" :opts="chartOpts" :ontouch="true" />
      </view>
    </view>
    <view v-else class="empty-state chart-empty">记录体重后，这里会显示趋势图</view>

    <view class="history-section">
      <view class="section-heading"><text>历史记录</text><text class="section-note">长按可删除</text></view>
      <view v-if="weights.length" class="weight-list">
        <view v-for="item in weights" :key="item.wid" class="weight-item" @longpress="confirmRemoveWeight(item)">
          <text class="weight-date">{{ item.recordDate }}</text>
          <text class="weight-value">{{ item.weight }} <text>kg</text></text>
        </view>
      </view>
      <view v-else class="history-empty">还没有体重记录</view>
    </view>
  </view>
</template>

<script>
import { initDb, listWeights, addWeight, removeWeight } from '@/utils/sqlite'
import { validateWeight } from '@/utils/validators'

export default {
  data() {
    return { weightInput: '', weights: [] }
  },
  computed: {
    chartData() {
      const rows = this.weights.slice().reverse()
      return {
        categories: rows.map((item) => item.recordDate.slice(5).replace('-', '/')),
        series: [{ name: '体重', data: rows.map((item) => Number(item.weight)) }]
      }
    },
    chartOpts() {
      // qiun/uCharts 在 enableScroll 时用 xAxis.itemCount 计算点间距；
      // 不显式赋值会让 eachSpacing 变成 NaN，所有点坐标失效、整张图不渲染。
      const enableScroll = this.weights.length > 7
      return {
        color: ['#8b939a'],
        padding: [20, 12, 10, 12],
        enableScroll,
        legend: { show: false },
        xAxis: {
          disableGrid: true,
          axisLineColor: '#e7e9eb',
          labelTextColor: '#9aa0a6',
          itemCount: enableScroll ? 7 : this.weights.length,
          scrollShow: true,
          scrollAlign: 'right'
        },
        yAxis: { gridType: 'dash', dashLength: 2, gridColor: '#eef0f1', axisLineColor: '#ffffff', labelTextColor: '#9aa0a6' },
        extra: { line: { type: 'curve', width: 2, activeType: 'hollow' } }
      }
    },
    currentWeight() {
      return this.weights.length ? this.weights[0].weight : '--'
    },
    weightDelta() {
      if (this.weights.length < 2) return '—'
      const delta = Number(this.weights[0].weight) - Number(this.weights[1].weight)
      return `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg`
    }
  },
  onShow() {
    this.loadWeights()
  },
  methods: {
    async loadWeights() {
      try {
        await initDb()
        this.weights = await listWeights()
      } catch (error) {
        uni.showToast({ title: '体重记录加载失败', icon: 'none' })
      }
    },
    async saveWeight() {
      const result = validateWeight(this.weightInput)
      if (!result.valid) {
        uni.showToast({ title: result.message, icon: 'none' })
        return
      }
      try {
        await addWeight(result.value)
        this.weightInput = ''
        uni.showToast({ title: '体重已保存', icon: 'none' })
        await this.loadWeights()
      } catch (error) {
        uni.showToast({ title: '保存失败，请重试', icon: 'none' })
      }
    },
    confirmRemoveWeight(item) {
      uni.showModal({
        title: '删除体重记录',
        content: `确定删除 ${item.recordDate} 的 ${item.weight} kg 记录吗？`,
        confirmText: '删除',
        confirmColor: '#17191c',
        success: async (result) => {
          if (!result.confirm) return
          await removeWeight(item.wid)
          await this.loadWeights()
        }
      })
    }
  }
}
</script>

<style scoped>
.weight-page { padding-bottom: 100rpx; }
.weight-entry { display: flex; align-items: center; min-height: 154rpx; margin-top: 50rpx; padding: 28rpx 24rpx 28rpx 28rpx; border: 1rpx solid #e1e4e7; border-radius: 18rpx; background: #ffffff; box-shadow: 0 12rpx 28rpx rgba(23,25,28,.04); }
.entry-copy { min-width: 0; flex: 1; }
.entry-label { display: block; color: #17191c; font-size: 30rpx; font-weight: 700; }
.entry-hint { display: block; margin-top: 8rpx; color: #9aa0a6; font-size: 22rpx; }
.entry-control { display: flex; align-items: baseline; margin: 0 20rpx 0 12rpx; }
.weight-input { width: 116rpx; color: #17191c; font-size: 42rpx; font-weight: 700; text-align: right; }
.weight-unit { margin-left: 8rpx; color: #8d949b; font-size: 23rpx; }
.save-weight { width: 132rpx; height: 68rpx; margin: 0; border-radius: 12rpx; background: #17191c; color: #ffffff; font-size: 25rpx; line-height: 68rpx; }
.weight-summary { display: flex; margin-top: 24rpx; padding: 26rpx 0; border-bottom: 1rpx solid #eef0f1; }
.summary-item { flex: 1; padding: 0 26rpx; }
.summary-item:first-child { padding-left: 4rpx; }
.summary-divider { border-left: 1rpx solid #e7e9eb; }
.summary-label { display: block; color: #9aa0a6; font-size: 23rpx; }
.summary-value { display: block; margin-top: 8rpx; color: #17191c; font-size: 34rpx; font-weight: 700; }
.summary-value text { color: #8d949b; font-size: 22rpx; font-weight: 400; }
.chart-section { margin-top: 48rpx; }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; color: #17191c; font-size: 34rpx; font-weight: 700; }
.section-note { color: #9aa0a6; font-size: 22rpx; font-weight: 400; }
.chart-card { height: 390rpx; margin-top: 20rpx; padding: 20rpx 14rpx; border: 1rpx solid #eef0f1; border-radius: 20rpx; background: #ffffff; box-shadow: 0 12rpx 28rpx rgba(23,25,28,.03); }
.chart-empty { padding: 130rpx 0 80rpx; }
.history-section { margin-top: 52rpx; }
.weight-list { margin-top: 16rpx; overflow: hidden; border-top: 1rpx solid #eef0f1; border-radius: 14rpx; }
.weight-item { display: flex; align-items: center; justify-content: space-between; padding: 30rpx 22rpx; border-bottom: 1rpx solid #e7e9eb; background: #ffffff; }
.weight-date { color: #555d64; font-size: 26rpx; }
.weight-value { color: #17191c; font-size: 34rpx; font-weight: 600; }
.weight-value text { color: #8d949b; font-size: 22rpx; font-weight: 400; }
.history-empty { padding: 70rpx 0; color: #9aa0a6; text-align: center; font-size: 24rpx; }
</style>
