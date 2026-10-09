<template>
  <view class="page-shell preview-page">
    <view class="page-heading">
      <view>
        <view class="page-title">动作预览</view>
        <view class="page-subtitle">左右滑动查看动作教程</view>
      </view>
      <view class="settings-link" @click="openPartEditor">＋ 部位</view>
    </view>

    <scroll-view scroll-x scroll-with-animation :scroll-into-view="activePartTabId" class="part-tabs">
      <view
        v-for="(tab, index) in partTabs"
        :key="tab.target + ':' + tab.label"
        :id="'part-tab-' + index"
        class="part-tab"
        :class="{ active: activePart === tab.label }"
        @click="changePart(tab)"
        @longpress="confirmRemovePart(tab)"
      >{{ tab.label }}</view>
    </scroll-view>

    <view class="search-box">
      <input
        v-model="searchText"
        class="search-input"
        type="text"
        confirm-type="search"
        placeholder="搜索当前部位动作"
      />
      <text v-if="searchText" class="search-clear" @click="clearSearch">×</text>
    </view>
    <scroll-view v-if="searchText && searchResults.length" scroll-y class="search-results">
      <view v-for="exercise in searchResults" :key="exercise.id" class="search-result" @click="jumpToExercise(exercise)">
        <text class="search-result-name">{{ exercise.name_zh }}</text>
        <text class="search-result-target">{{ exercise.target || '全身' }}</text>
      </view>
    </scroll-view>
    <view v-else-if="searchText" class="search-empty">没有找到当前部位的匹配动作</view>

    <view v-if="loading" class="empty-state">正在加载动作…</view>
    <view v-else-if="!visibleExercises.length" class="empty-state">
      <text>这个部位还没有动作</text>
      <text class="empty-hint">可以点击右上角添加一个自定义部位</text>
    </view>
    <swiper
      v-else
      class="preview-swiper"
      :current="swiperIndex"
      :indicator-dots="true"
      :duration="260"
      :circular="false"
      @change="handleSwiperChange"
    >
      <swiper-item v-for="slide in previewSlides" :key="slide.exercise.id">
        <scroll-view scroll-y class="slide-scroll">
          <view class="exercise-card">
            <view class="gif-wrap">
              <image
                v-if="slide.index === currentIndex && gifUrl && !imageFailed"
                class="exercise-gif"
                :src="gifUrl"
                mode="aspectFit"
                @error="handleGifError"
              />
              <view v-else-if="slide.index === currentIndex" class="gif-fallback">
                <text class="fallback-title">教程动图暂时不可用</text>
                <text class="fallback-subtitle">请按下面的步骤完成动作</text>
              </view>
            </view>
            <text class="exercise-title">{{ slide.exercise.name_zh }}</text>
            <text class="exercise-target">{{ slide.exercise.target || '全身' }}</text>
            <view class="instruction-section">
              <view class="instruction-heading">
                <text class="section-title">动作步骤</text>
                <text class="exercise-count">第 {{ slide.index + 1 }} / {{ visibleExercises.length }} 个</text>
              </view>
              <view v-for="(step, stepIndex) in splitSteps(slide.exercise.instructions_zh)" :key="`${slide.exercise.id}-${stepIndex}`" class="instruction-step">
                <text class="step-number">{{ stepIndex + 1 }}</text>
                <text class="step-text">{{ step }}</text>
              </view>
            </view>
          </view>
        </scroll-view>
      </swiper-item>
    </swiper>

    <view v-if="partEditor.visible" class="modal-layer" @click.self="closePartEditor">
      <view class="part-editor-panel">
        <text class="form-title">添加自定义部位</text>
        <text class="form-subtitle">自定义名称，并关联任意部位或全部动作</text>
        <input v-model="partEditor.label" class="part-name-input" placeholder="例如：核心、推训练" maxlength="12" />
        <view class="part-target-options">
          <view
            v-for="target in customPartTargets"
            :key="target"
            class="part-target-option"
            :class="{ selected: partEditor.targets.includes(target) }"
            @click="togglePartTarget(target)"
          >
            <text class="part-target-check">{{ partEditor.targets.includes(target) ? '✓' : '' }}</text>
            <text>{{ target }}</text>
          </view>
        </view>
        <view class="form-actions">
          <button class="form-button ghost" @click="closePartEditor">取消</button>
          <button class="form-button dark" @click="savePartEditor">添加部位</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { loadExerciseCatalog } from '@/utils/catalog'
import { getExerciseGifSources } from '@/utils/media'
import { matchesPart, getTrainPartTabs, addCustomTrainPart, loadCustomTrainParts, saveCustomTrainParts, loadParts, removePart, saveParts } from '@/utils/trainParts'
import { applyExerciseOrder } from '@/utils/exerciseOrder'

function getPreviewPartTabs(customParts, targets) {
  return getTrainPartTabs(customParts, targets)
}

export default {
  data() {
    return {
      catalog: [],
      partTabs: [],
      activePart: '全部',
      customParts: [],
      customPartTargets: [],
      partEditor: { visible: false, label: '', targets: [] },
      searchText: '',
      currentIndex: 0,
      windowStart: 0,
      swiperIndex: 0,
      gifSourceIndex: 0,
      imageFailed: false,
      loading: true,
      exerciseOrderVersion: 0
    }
  },
  computed: {
    activePartTabId() {
      const index = this.partTabs.findIndex((tab) => tab.label === this.activePart)
      return index < 0 ? '' : 'part-tab-' + index
    },
    visibleExercises() {
      const parts = this.activePart === '全部' ? null : loadParts()
      const visible = this.activePart === '全部'
        ? this.catalog
        : this.catalog.filter((item) => matchesPart(parts, item, this.activePart))
      this.exerciseOrderVersion
      return applyExerciseOrder(visible, this.activePart)
    },
    currentExercise() {
      return this.visibleExercises[this.currentIndex] || null
    },
    previewSlides() {
      return this.visibleExercises
        .slice(this.windowStart, this.windowStart + 3)
        .map((exercise, offset) => ({ exercise, index: this.windowStart + offset }))
    },
    searchResults() {
      const keyword = this.searchText.trim().toLowerCase()
      if (!keyword) return []
      return this.visibleExercises
        .filter((exercise) => String(exercise.name_zh || '').toLowerCase().includes(keyword))
        .slice(0, 30)
    },
    gifSources() {
      return getExerciseGifSources(this.currentExercise)
    },
    gifUrl() {
      return this.gifSources[this.gifSourceIndex] || ''
    }
  },
  onShow() {
    this.exerciseOrderVersion += 1
    if (this.catalog.length) {
      const targets = [...new Set(this.catalog.map((item) => item.target).filter(Boolean))]
      this.customParts = loadCustomTrainParts()
      this.partTabs = getPreviewPartTabs(this.customParts, targets)
      if (!this.partTabs.some((tab) => tab.label === this.activePart)) this.activePart = '全部'
      return
    }
    this.loadCatalog()
  },
  methods: {
    async loadCatalog() {
      if (this.catalog.length) return
      this.loading = true
      try {
        this.catalog = await loadExerciseCatalog()
        const targets = [...new Set(this.catalog.map((item) => item.target).filter(Boolean))]
        this.customPartTargets = ['全部', ...targets.filter((target) => target !== '全部')]
        this.customParts = loadCustomTrainParts()
        this.partTabs = getPreviewPartTabs(this.customParts, targets)
        if (!this.partTabs.some((tab) => tab.label === this.activePart)) this.activePart = '全部'
        this.resetPreview()
      } catch (error) {
        uni.showToast({ title: '动作库加载失败，请重试', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    changePart(tab) {
      const target = typeof tab === 'string' ? tab : tab.label
      if (target === this.activePart) return
      this.activePart = target
      this.resetPreview()
    },
    handleSwiperChange(event) {
      const offset = Number(event.detail && event.detail.current) || 0
      this.currentIndex = this.windowStart + offset
      this.gifSourceIndex = 0
      this.imageFailed = false
      this.syncSwiperWindow()
    },
    resetPreview() {
      this.currentIndex = 0
      this.windowStart = 0
      this.swiperIndex = 0
      this.searchText = ''
      this.gifSourceIndex = 0
      this.imageFailed = false
    },
    syncSwiperWindow() {
      const maxStart = Math.max(this.visibleExercises.length - 3, 0)
      const nextStart = Math.max(0, Math.min(this.currentIndex - 1, maxStart))
      this.windowStart = nextStart
      this.swiperIndex = this.currentIndex - nextStart
    },
    clearSearch() {
      this.searchText = ''
    },
    jumpToExercise(exercise) {
      const index = this.visibleExercises.findIndex((item) => item.id === exercise.id)
      if (index < 0) return
      this.currentIndex = index
      this.syncSwiperWindow()
      this.gifSourceIndex = 0
      this.imageFailed = false
      this.clearSearch()
    },
    handleGifError() {
      if (this.gifSourceIndex < this.gifSources.length - 1) {
        this.gifSourceIndex += 1
        return
      }
      this.imageFailed = true
    },
    splitSteps(instructions) {
      return String(instructions || '')
        .split(/[\n。！？，；;.!?]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    },
    openPartEditor() {
      if (!this.customPartTargets.length) {
        uni.showToast({ title: '暂无可关联的动作部位', icon: 'none' })
        return
      }
      this.partEditor = { visible: true, label: '', targets: [] }
    },
    togglePartTarget(target) {
      const current = this.partEditor.targets.slice()
      if (target === '全部') {
        this.partEditor.targets = current.includes('全部') ? [] : ['全部']
        return
      }
      const next = current.filter((item) => item !== '全部')
      const index = next.indexOf(target)
      if (index >= 0) next.splice(index, 1)
      else next.push(target)
      this.partEditor.targets = next
    },
    closePartEditor() {
      this.partEditor.visible = false
    },
    savePartEditor() {
      try {
        const label = this.partEditor.label.trim()
        if (this.partTabs.some((tab) => tab.label === label)) throw new Error('该标签已存在')
        const next = addCustomTrainPart(this.partEditor, this.customParts, this.customPartTargets)
        this.customParts = saveCustomTrainParts(next)
        const targets = [...new Set(this.catalog.map((item) => item.target).filter(Boolean))]
        this.partTabs = getPreviewPartTabs(this.customParts, targets)
        this.activePart = this.partEditor.label.trim()
        this.closePartEditor()
        this.resetPreview()
      } catch (error) {
        uni.showToast({ title: error.message || '添加部位失败', icon: 'none' })
      }
    },
    confirmRemovePart(tab) {
      const label = tab && tab.label
      if (!label || label === '全部') return
      uni.showModal({
        title: '删除训练部位',
        content: '确定删除「' + label + '」及其显示设置吗？',
        confirmText: '删除',
        confirmColor: '#17191c',
        success: (result) => {
          if (!result.confirm) return
          const next = removePart(loadParts(), label)
          saveParts(next)
          this.customParts = loadCustomTrainParts()
          const targets = [...new Set(this.catalog.map((item) => item.target).filter(Boolean))]
          this.partTabs = getPreviewPartTabs(this.customParts, targets)
          if (this.activePart === label) this.activePart = '全部'
          this.resetPreview()
        }
      })
    }
  }
}
</script>

<style scoped>
.preview-page { padding-bottom: 30rpx; }
.page-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 24rpx; }
.settings-link { flex-shrink: 0; margin-top: 12rpx; padding: 10rpx 18rpx; border: 1rpx solid #e1e4e7; border-radius: 999rpx; color: #555d64; font-size: 24rpx; }
.part-tabs { width: 100%; margin-top: 42rpx; white-space: nowrap; border-bottom: 1rpx solid #eef0f1; }
.part-tab { display: inline-flex; align-items: center; justify-content: center; min-width: 104rpx; padding: 0 18rpx 20rpx; border-bottom: 4rpx solid transparent; color: #9aa0a6; text-align: center; font-size: 29rpx; line-height: 1.2; }
.part-tab.active { border-bottom-color: #17191c; color: #17191c; font-weight: 700; }
.search-box { display: flex; align-items: center; height: 76rpx; margin-top: 24rpx; padding: 0 22rpx; border: 1rpx solid #e5e7e9; border-radius: 16rpx; background: #f7f8f8; }
.search-input { flex: 1; min-width: 0; color: #17191c; font-size: 27rpx; }
.search-clear { flex-shrink: 0; padding-left: 16rpx; color: #9aa0a6; font-size: 38rpx; line-height: 1; }
.search-results { max-height: 330rpx; margin-top: 12rpx; border: 1rpx solid #eceef0; border-radius: 16rpx; background: #ffffff; }
.search-result { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; padding: 22rpx 24rpx; border-bottom: 1rpx solid #f0f1f2; }
.search-result:last-child { border-bottom: 0; }
.search-result-name { flex: 1; overflow: hidden; color: #17191c; font-size: 27rpx; text-overflow: ellipsis; white-space: nowrap; }
.search-result-target { flex-shrink: 0; color: #8d949b; font-size: 23rpx; }
.search-empty { margin-top: 16rpx; color: #9aa0a6; font-size: 24rpx; text-align: center; }
.preview-swiper { height: calc(100vh - 280rpx); margin-top: 22rpx; }
.slide-scroll { height: 100%; }
.exercise-card { padding-bottom: 48rpx; }
.gif-wrap { display: flex; align-items: center; justify-content: center; width: 100%; height: 500rpx; overflow: hidden; border-radius: 24rpx; background: #f5f6f7; }
.exercise-gif { width: 100%; height: 100%; }
.gif-fallback { display: flex; flex-direction: column; align-items: center; gap: 12rpx; color: #8d949b; text-align: center; }
.fallback-title { font-size: 30rpx; font-weight: 600; }
.fallback-subtitle { font-size: 24rpx; }
.exercise-title { display: block; margin-top: 32rpx; color: #17191c; font-size: 46rpx; font-weight: 700; line-height: 1.25; }
.exercise-target { display: inline-block; margin-top: 14rpx; padding: 8rpx 18rpx; border-radius: 999rpx; background: #f2f3f4; color: #727a81; font-size: 24rpx; }
.instruction-section { margin-top: 42rpx; }
.instruction-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 18rpx; }
.section-title { color: #17191c; font-size: 32rpx; font-weight: 700; }
.exercise-count { color: #9aa0a6; font-size: 23rpx; }
.instruction-step { display: flex; align-items: flex-start; gap: 18rpx; padding: 22rpx 0; border-bottom: 1rpx solid #e7e9eb; }
.step-number { display: grid; flex-shrink: 0; width: 44rpx; height: 44rpx; border-radius: 50%; background: #17191c; color: #ffffff; text-align: center; font-size: 23rpx; line-height: 44rpx; }
.step-text { flex: 1; color: #444b52; font-size: 29rpx; line-height: 1.7; }
.empty-state { padding-top: 220rpx; }
.empty-hint { display: block; margin-top: 16rpx; font-size: 23rpx; }
.modal-layer { position: fixed; z-index: 30; inset: 0; display: flex; align-items: center; justify-content: center; padding: 30rpx; background: rgba(23,25,28,.32); }
.part-editor-panel { width: 100%; padding: 38rpx 32rpx 30rpx; border-radius: 22rpx; background: #ffffff; }
.form-title { display: block; color: #17191c; font-size: 36rpx; font-weight: 700; }
.form-subtitle { display: block; margin-top: 8rpx; color: #8d949b; font-size: 24rpx; line-height: 1.5; }
.part-name-input { height: 82rpx; margin-top: 24rpx; padding: 0 20rpx; border: 1rpx solid #e1e4e7; border-radius: 12rpx; color: #17191c; font-size: 28rpx; }
.part-target-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14rpx; margin-top: 18rpx; }
.part-target-option { display: flex; align-items: center; gap: 12rpx; padding: 20rpx; border: 1rpx solid #e1e4e7; border-radius: 12rpx; color: #555d64; font-size: 25rpx; }
.part-target-option.selected { border-color: #17191c; color: #17191c; }
.part-target-check { display: flex; align-items: center; justify-content: center; width: 34rpx; height: 34rpx; border: 1rpx solid #cfd3d6; border-radius: 8rpx; font-size: 23rpx; }
.part-target-option.selected .part-target-check { border-color: #17191c; background: #17191c; color: #ffffff; }
.form-actions { display: flex; gap: 18rpx; margin-top: 24rpx; }
.form-button { flex: 1; height: 78rpx; margin: 0; border-radius: 10rpx; font-size: 26rpx; line-height: 78rpx; }
.form-button.ghost { border: 1rpx solid #e1e4e7; background: #ffffff; color: #555d64; }
.form-button.dark { background: #17191c; color: #ffffff; }
</style>
