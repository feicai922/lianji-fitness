<template>
  <view class="page-shell detail-page">
    <view class="back-button" @click="goBack"><text class="back-icon">‹</text><text>返回训练</text></view>
    <view v-if="exercise" class="detail-content">
      <view class="gif-wrap">
        <image
          v-if="gifUrl && !imageFailed"
          class="exercise-gif"
          :src="gifUrl"
          mode="aspectFit"
          @error="handleGifError"
        />
        <view v-else class="gif-fallback">
          <text class="fallback-title">教程动图暂时不可用</text>
          <text class="fallback-subtitle">请按下面的步骤完成动作</text>
        </view>
      </view>
      <text class="detail-title">{{ exercise.name_zh }}</text>
      <text class="detail-target">{{ exercise.target }}</text>
      <view class="instructions">
        <text class="section-title">动作步骤</text>
        <view v-for="(step, index) in steps" :key="`${index}-${step}`" class="instruction-step">
          <text class="step-number">{{ index + 1 }}</text>
          <text class="step-text">{{ step }}</text>
        </view>
      </view>
    </view>
    <view v-else class="empty-state">动作不存在或已被移除</view>
  </view>
</template>

<script>
import { loadExerciseCatalog } from '@/utils/catalog'
import { getExerciseGifSources } from '@/utils/media'

export default {
  data() {
    return {
      exercise: null,
      gifSourceIndex: 0,
      imageFailed: false
    }
  },
  computed: {
    gifSources() {
      return getExerciseGifSources(this.exercise)
    },
    gifUrl() {
      return this.gifSources[this.gifSourceIndex] || ''
    },
    steps() {
      if (!this.exercise) return []
      return String(this.exercise.instructions_zh || '')
        .split(/[\n。！？；;.!?]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    }
  },
  async onLoad(options) {
    const id = decodeURIComponent(options && options.id ? options.id : '')
    try {
      const catalog = await loadExerciseCatalog()
      this.exercise = catalog.find((item) => item.id === id) || null
      this.gifSourceIndex = 0
      this.imageFailed = false
    } catch (error) {
      uni.showToast({ title: '教程数据加载失败', icon: 'none' })
    }
  },
  methods: {
    handleGifError() {
      if (this.gifSourceIndex < this.gifSources.length - 1) {
        this.gifSourceIndex += 1
        return
      }
      this.imageFailed = true
    },
    goBack() {
      uni.navigateBack({ delta: 1 })
    }
  }
}
</script>

<style scoped>
.detail-page { padding-top: 20rpx; }
.back-button { display: inline-flex; align-items: center; gap: 8rpx; color: #555d64; font-size: 28rpx; }
.back-icon { font-size: 54rpx; line-height: 0.8; }
.detail-content { margin-top: 28rpx; }
.gif-wrap { display: flex; align-items: center; justify-content: center; width: 100%; height: 520rpx; overflow: hidden; border-radius: 24rpx; background: #f5f6f7; }
.exercise-gif { width: 100%; height: 100%; }
.gif-fallback { display: flex; flex-direction: column; align-items: center; gap: 12rpx; color: #8d949b; text-align: center; }
.fallback-title { font-size: 30rpx; font-weight: 600; }
.fallback-subtitle { font-size: 24rpx; }
.detail-title { display: block; margin-top: 38rpx; color: #17191c; font-size: 54rpx; font-weight: 700; line-height: 1.25; }
.detail-target { display: inline-block; margin-top: 18rpx; padding: 8rpx 18rpx; border-radius: 999rpx; background: #f2f3f4; color: #727a81; font-size: 24rpx; }
.instructions { margin-top: 60rpx; }
.section-title { display: block; margin-bottom: 24rpx; color: #17191c; font-size: 32rpx; font-weight: 700; }
.instruction-step { display: flex; align-items: flex-start; gap: 20rpx; padding: 22rpx 0; border-bottom: 1rpx solid #e7e9eb; }
.step-number { display: grid; flex-shrink: 0; width: 44rpx; height: 44rpx; border-radius: 50%; background: #17191c; color: #ffffff; text-align: center; font-size: 23rpx; line-height: 44rpx; }
.step-text { flex: 1; color: #444b52; font-size: 30rpx; line-height: 1.75; }
</style>
