<template>
  <view class="page-shell train-page">
    <view class="page-heading">
      <view>
        <view class="page-title">训练记录</view>
        <view class="page-subtitle">今天也要完成训练</view>
      </view>
      <view class="settings-link" @click="openSettings">设置</view>
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
      <view class="part-tab add-part-tab" @click="openPartEditor">+</view>
    </scroll-view>

    <view v-if="loading" class="empty-state">正在加载动作…</view>
    <view v-else-if="!exercises.length" class="empty-state">
      <text>这个部位还没有动作</text>
      <text class="empty-hint">点击右下角 + 添加你的第一个动作</text>
    </view>
    <view v-else class="exercise-list">
      <ExerciseCard
        v-for="exercise in exercises"
        :key="exercise.id"
        :exercise="exercise"
        :latest-record="latestRecords[exercise.id]"
        @tutorial="openTutorial"
        @train="openTrainDialog"
        @remove="confirmRemoveExercise"
        @dragstart="startExerciseDrag"
        @dragmove="moveExerciseDrag"
        @dragend="endExerciseDrag"
      />
    </view>

    <view class="floating-add" @click="openPicker">+</view>

    <ExercisePicker
      :visible="pickerVisible"
      :part="activePart"
      :items="filteredCatalog"
      :search-text="searchText"
      :selected-ids="currentExerciseIds"
      :loading="catalogLoading"
      @close="closePicker"
      @select="addFromCatalog"
      @update:search-text="searchText = $event"
    />


    <view v-if="partEditor.visible" class="modal-layer" @click.self="closePartEditor">
      <view class="part-editor-panel">
        <text class="form-title">自定义训练标签</text>
        <text class="form-subtitle">自定义显示名称，并关联一个动作部位</text>
        <input v-model="partEditor.label" class="part-name-input" placeholder="例如：核心、手臂" maxlength="12" />
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
          <button class="form-button dark" @click="savePartEditor">添加标签</button>
        </view>
      </view>
    </view>

    <view v-if="trainDialog.visible" class="modal-layer" @click.self="closeTrainDialog">
      <view class="form-panel">
        <scroll-view scroll-y class="form-scroll">
          <text class="form-title">录入训练</text>
          <text class="form-subtitle">{{ trainDialog.exercise && trainDialog.exercise.nameZh }}</text>
          <view v-for="(set, index) in trainDialog.setDetails" :key="set.setNo" class="set-row">
            <view class="daily-set-check" :class="{ checked: isSetChecked(set.setNo) }" @click="toggleSetCheck(set.setNo)">
              <text>{{ isSetChecked(set.setNo) ? '✓' : '' }}</text>
            </view>
            <text class="set-number">第 {{ index + 1 }} 组</text>
            <input v-model="set.weight" class="set-input" type="digit" placeholder="重量" />
            <text class="set-unit">kg</text>
            <input v-model="set.reps" class="set-input reps-input" type="number" placeholder="次数" />
            <text class="set-unit">次</text>
            <button class="remove-set-button" :disabled="trainDialog.setDetails.length <= 1" @click="removeSet(index)">×</button>
          </view>
          <button class="add-set-button" @click="addSet">＋ 添加一组</button>
        </scroll-view>
        <view class="form-actions">
          <button class="form-button ghost" @click="closeTrainDialog">取消</button>
          <button class="form-button dark" @click="saveTrainRecord">保存记录</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import ExerciseCard from '@/components/ExerciseCard.vue'
import ExercisePicker from '@/components/ExercisePicker.vue'
import { initDb, listExercises, addExercise, removeExercise, listTrainRecords, addTrainRecord, updateTrainRecord } from '@/utils/sqlite'
import { validateTrainForm } from '@/utils/validators'
import { loadExerciseCatalog } from '@/utils/catalog'
import { getTrainPartTargets, matchesPart, getTrainPartTabs, addCustomTrainPart, loadCustomTrainParts, saveCustomTrainParts } from '@/utils/trainParts'
import { isDailySetChecked, toggleDailySetChecked } from '@/utils/dailySetCheck'
import { loadParts, removePart, saveParts } from '@/utils/trainParts'
import { applyExerciseOrder, moveExercise, saveExerciseOrder } from '@/utils/exerciseOrder'
import { formatDate } from '@/utils/date'
import { getCheckIn, saveCheckIn } from '@/utils/sqlite'
import { readTodayChecks } from '@/utils/dailySetCheck'
import { syncTrainingCheckIn } from '@/utils/checkIn'

export default {
  components: { ExerciseCard, ExercisePicker },
  data() {
    return {
      partTabs: [{ label: '全部', target: '全部', custom: false }],
      activePart: '全部',
      allExercises: [],
      latestRecords: {},
      loading: true,
      pickerVisible: false,
      catalogLoading: false,
      searchText: '',
      trainDialog: { visible: false, exercise: null, recordId: null, setDetails: [] },
      catalog: [],
      customParts: [],
      customPartTargets: [],
      partEditor: { visible: false, label: '', targets: [] },
      exerciseOrderVersion: 0,
      draggingExerciseId: '',
      dragLastY: 0
    }
  },
  computed: {
    activePartTabId() {
      const index = this.partTabs.findIndex((tab) => tab.label === this.activePart)
      return index < 0 ? '' : 'part-tab-' + index
    },
    exercises() {
      const parts = this.activePart === '全部' ? null : loadParts()
      const visible = this.activePart === '全部'
        ? this.allExercises
        : this.allExercises.filter((item) => matchesPart(parts, item, this.activePart))
      this.exerciseOrderVersion
      return applyExerciseOrder(visible, this.activePart)
    },
    currentExerciseIds() {
      return this.allExercises.map((item) => item.id)
    },
    filteredCatalog() {
      const keyword = this.searchText.trim().toLowerCase()
      const parts = this.activePart === '全部' ? null : loadParts()
      const byPart = this.activePart === '全部'
        ? this.catalog
        : this.catalog.filter((item) => matchesPart(parts, item, this.activePart))
      if (!keyword) return byPart
      return byPart.filter((item) => item.name_zh.toLowerCase().includes(keyword))
    }
  },
  onShow() {
    this.loadExercises()
    this.loadCatalog()
  },
  async onPullDownRefresh() {
    try {
      await this.loadExercises()
      if (!this.catalog.length) await this.loadCatalog()
    } finally {
      uni.stopPullDownRefresh()
    }
  },
  methods: {
    isSetChecked(setNo) {
      const exercise = this.trainDialog.exercise
      return Boolean(exercise && isDailySetChecked(exercise.id, setNo))
    },
    async toggleSetCheck(setNo) {
      const exercise = this.trainDialog.exercise
      if (!exercise) return
      toggleDailySetChecked(exercise.id, setNo)
      this.trainDialog = { ...this.trainDialog }
      try {
        await this.syncTodayTrainingCheckIn()
      } catch (error) {
        uni.showToast({ title: '打卡同步失败', icon: 'none' })
      }
    },
    async syncTodayTrainingCheckIn() {
      const checkedKeys = readTodayChecks()
      const parts = [...new Set(this.allExercises
        .filter((exercise) => checkedKeys.some((key) => key.startsWith(String(exercise.id) + ':')))
        .map((exercise) => exercise.targetPart || exercise.target)
        .filter(Boolean))]
      const today = formatDate()
      await saveCheckIn(syncTrainingCheckIn(await getCheckIn(today), today, parts))
    },
    openSettings() {
      uni.navigateTo({ url: '/pages/settings/index' })
    },
    createDefaultSetDetails(count = 4) {
      return Array.from({ length: count }, (_, index) => ({
        setNo: index + 1,
        weight: '',
        reps: ''
      }))
    },
    async loadExercises() {
      this.loading = true
      try {
        await initDb()
        this.allExercises = await listExercises()
        const records = await Promise.all(this.allExercises.map(async (exercise) => [
          exercise.id,
          (await listTrainRecords(exercise.id))[0] || null
        ]))
        this.latestRecords = Object.fromEntries(records)
        try {
          await this.syncTodayTrainingCheckIn()
        } catch (error) {
          // Loading the training page remains available when the check-in retry fails.
        }
      } catch (error) {
        uni.showToast({ title: '动作加载失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    async loadCatalog() {
      if (this.catalog.length) return
      this.catalogLoading = true
      try {
        this.catalog = await loadExerciseCatalog()
        const targets = [...new Set(this.catalog.map((item) => item.target).filter(Boolean))]
        this.customPartTargets = ['全部', ...targets.filter((target) => target !== '全部')]
        this.customParts = loadCustomTrainParts()
        this.partTabs = getTrainPartTabs(this.customParts, targets)
        if (!this.partTabs.some((tab) => tab.label === this.activePart)) this.activePart = '全部'
      } catch (error) {
        uni.showToast({ title: '动作库加载失败，请重试', icon: 'none' })
      } finally {
        this.catalogLoading = false
      }
    },
    async changePart(tab) {
      const target = typeof tab === 'string' ? tab : tab.label
      if (target === this.activePart) return
      this.activePart = target
    },
    openPartEditor() {
      if (!this.customPartTargets.length) {
        uni.showToast({ title: '暂无可添加的动作部位', icon: 'none' })
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
        this.partTabs = getTrainPartTabs(this.customParts, targets)
        this.activePart = this.partEditor.label.trim()
        this.closePartEditor()
      } catch (error) {
        uni.showToast({ title: error.message || '添加标签失败', icon: 'none' })
      }
    },
    openPicker() {
      this.searchText = ''
      this.pickerVisible = true
      this.loadCatalog()
    },
    closePicker() {
      this.pickerVisible = false
    },
    async addFromCatalog(item) {
      if (this.currentExerciseIds.includes(item.id)) {
        uni.showToast({ title: '动作已添加', icon: 'none' })
        return
      }
      try {
        await addExercise(item)
        uni.showToast({ title: '已添加', icon: 'none' })
        await this.loadExercises()
      } catch (error) {
        uni.showToast({ title: '添加失败，请重试', icon: 'none' })
      }
    },
    openTutorial(exercise) {
      uni.navigateTo({ url: '/pages/detail/index?id=' + encodeURIComponent(exercise.id) })
    },
    openTrainDialog(exercise) {
      const latest = this.latestRecords[exercise.id]
      const setDetails = latest && Array.isArray(latest.setDetails) && latest.setDetails.length
        ? latest.setDetails.map((set, index) => ({ setNo: index + 1, weight: String(set.weight), reps: String(set.reps) }))
        : this.createDefaultSetDetails()
      this.trainDialog = {
        visible: true,
        exercise,
        recordId: latest ? latest.recordId : null,
        setDetails
      }
    },
    addSet() {
      const next = this.trainDialog.setDetails.length + 1
      this.trainDialog.setDetails.push({ setNo: next, weight: '', reps: '' })
    },
    removeSet(index) {
      if (this.trainDialog.setDetails.length <= 1) return
      this.trainDialog.setDetails.splice(index, 1)
      this.trainDialog.setDetails.forEach((set, setIndex) => { set.setNo = setIndex + 1 })
    },
    closeTrainDialog() {
      this.trainDialog.visible = false
    },
    async saveTrainRecord() {
      const result = validateTrainForm({ setDetails: this.trainDialog.setDetails })
      if (!result.valid) {
        uni.showToast({ title: result.message, icon: 'none' })
        return
      }
      try {
        if (this.trainDialog.recordId) {
          await updateTrainRecord(this.trainDialog.recordId, result.value)
          uni.showToast({ title: '训练已更新', icon: 'none' })
        } else {
          await addTrainRecord({ exerciseId: this.trainDialog.exercise.id, ...result.value })
          uni.showToast({ title: '训练已保存', icon: 'none' })
        }
        this.closeTrainDialog()
        await this.loadExercises()
      } catch (error) {
        uni.showToast({ title: '保存失败，请重试', icon: 'none' })
      }
    },
    confirmRemovePart(tab) {
      const label = tab && tab.label
      if (!label || label === '全部') return
      uni.showModal({
        title: '删除训练部位',
        content: '确定删除「' + label + '」及其显示设置吗？动作和训练记录不会被删除。',
        confirmText: '删除',
        confirmColor: '#17191c',
        success: async (result) => {
          if (!result.confirm) return
          const next = removePart(loadParts(), label)
          saveParts(next)
          this.customParts = loadCustomTrainParts()
          const targets = [...new Set(this.catalog.map((item) => item.target).filter(Boolean))]
          this.partTabs = getTrainPartTabs(this.customParts, targets)
          if (this.activePart === label) this.activePart = '全部'
        }
      })
    },
    startExerciseDrag(event, exercise) {
      const touch = event && event.touches && event.touches[0]
      this.draggingExerciseId = exercise.id
      this.dragLastY = touch ? (touch.clientY ?? touch.pageY ?? 0) : 0
    },
    moveExerciseDrag(event, exercise) {
      if (this.draggingExerciseId !== exercise.id) return
      const touch = event && event.touches && event.touches[0]
      if (!touch) return
      const currentY = touch.clientY ?? touch.pageY ?? 0
      const delta = currentY - this.dragLastY
      if (Math.abs(delta) < 36) return
      const direction = delta > 0 ? 'down' : 'up'
      const moved = moveExercise(this.exercises, exercise.id, direction)
      if (moved.findIndex((item) => item.id === exercise.id) === this.exercises.findIndex((item) => item.id === exercise.id)) return
      saveExerciseOrder(this.activePart, moved.map((item) => item.id))
      this.exerciseOrderVersion += 1
      this.dragLastY = currentY
    },
    endExerciseDrag() {
      this.draggingExerciseId = ''
      this.dragLastY = 0
    },
    confirmRemoveExercise(exercise) {
      uni.showModal({
        title: '删除动作',
        content: '确定删除「' + exercise.nameZh + '」及其训练记录吗？',
        confirmText: '删除',
        confirmColor: '#17191c',
        success: async (result) => {
          if (!result.confirm) return
          await removeExercise(exercise.id)
          await this.loadExercises()
        }
      })
    }
  }
}
</script>

<style scoped>
.train-page { padding-bottom: 120rpx; }
.page-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 24rpx; }
.settings-link { flex-shrink: 0; margin-top: 12rpx; padding: 10rpx 18rpx; border: 1rpx solid #e1e4e7; border-radius: 999rpx; color: #555d64; font-size: 24rpx; }
.part-tabs { width: 100%; margin-top: 48rpx; white-space: nowrap; border-bottom: 1rpx solid #eef0f1; }
.part-tab { display: inline-flex; align-items: center; justify-content: center; min-width: 112rpx; padding: 0 20rpx 20rpx; border-bottom: 4rpx solid transparent; color: #9aa0a6; text-align: center; font-size: 31rpx; line-height: 1.2; }
.part-tab.active { border-bottom-color: #17191c; color: #17191c; font-weight: 700; }
.add-part-tab { min-width: 82rpx; color: #17191c; font-size: 38rpx; }
.part-editor-panel { width: 100%; padding: 38rpx 32rpx 30rpx; border-radius: 22rpx; background: #ffffff; }
.part-name-input { height: 82rpx; margin-top: 24rpx; padding: 0 20rpx; border: 1rpx solid #e1e4e7; border-radius: 12rpx; color: #17191c; font-size: 28rpx; }
.part-target-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14rpx; margin-top: 18rpx; }
.part-target-option { display: flex; align-items: center; gap: 12rpx; padding: 20rpx; border: 1rpx solid #e1e4e7; border-radius: 12rpx; color: #555d64; font-size: 25rpx; }
.part-target-option.selected { border-color: #17191c; color: #17191c; }
.part-target-check { display: flex; align-items: center; justify-content: center; width: 34rpx; height: 34rpx; border: 1rpx solid #cfd3d6; border-radius: 8rpx; font-size: 23rpx; }
.part-target-option.selected .part-target-check { border-color: #17191c; background: #17191c; color: #ffffff; }
.empty-state { padding-top: 220rpx; }
.empty-hint { display: block; margin-top: 16rpx; font-size: 23rpx; }
.exercise-list { margin-top: 6rpx; }
.floating-add { position: fixed; z-index: 10; right: 34rpx; bottom: 116rpx; width: 112rpx; height: 112rpx; border-radius: 50%; background: #17191c; color: #ffffff; text-align: center; font-size: 62rpx; font-weight: 300; line-height: 104rpx; box-shadow: 0 10rpx 28rpx rgba(23,25,28,.18); }
.modal-layer { position: fixed; z-index: 30; inset: 0; display: flex; align-items: center; justify-content: center; padding: 30rpx; background: rgba(23,25,28,.32); }
.form-panel { display: flex; flex-direction: column; width: 100%; max-height: 86vh; padding: 38rpx 32rpx 30rpx; border-radius: 22rpx; background: #ffffff; }
.form-scroll { flex: 1; min-height: 0; max-height: 68vh; }
.form-title { display: block; color: #17191c; font-size: 36rpx; font-weight: 700; }
.form-subtitle { display: block; overflow: hidden; margin-top: 8rpx; color: #8d949b; font-size: 24rpx; text-overflow: ellipsis; white-space: nowrap; }
.set-row { display: flex; align-items: center; min-height: 88rpx; margin-top: 12rpx; padding: 0 10rpx; border: 1rpx solid #e7e9eb; border-radius: 12rpx; color: #555d64; font-size: 24rpx; }
.daily-set-check { display: flex; flex-shrink: 0; align-items: center; justify-content: center; width: 42rpx; height: 42rpx; margin-right: 12rpx; border: 2rpx solid #cfd3d6; border-radius: 50%; color: #ffffff; font-size: 25rpx; }
.daily-set-check.checked { border-color: #17191c; background: #17191c; }
.set-number { flex-shrink: 0; width: 82rpx; }
.set-input { flex: 1; min-width: 0; padding: 0 8rpx; color: #17191c; text-align: right; font-size: 27rpx; }
.reps-input { max-width: 100rpx; }
.set-unit { flex-shrink: 0; color: #9aa0a6; font-size: 22rpx; }
.remove-set-button { width: 48rpx; height: 48rpx; margin: 0 0 0 8rpx; padding: 0; border: 0; background: transparent; color: #9aa0a6; font-size: 34rpx; line-height: 48rpx; }
.remove-set-button[disabled] { color: #d7dade; }
.add-set-button { height: 72rpx; margin: 18rpx 0 0; border: 1rpx dashed #bfc4c8; border-radius: 10rpx; background: #fafbfb; color: #555d64; font-size: 25rpx; line-height: 72rpx; }
.form-actions { display: flex; gap: 18rpx; margin-top: 24rpx; }
.form-button { flex: 1; height: 78rpx; margin: 0; border-radius: 10rpx; font-size: 26rpx; line-height: 78rpx; }
.form-button.ghost { border: 1rpx solid #e1e4e7; background: #ffffff; color: #555d64; }
.form-button.dark { background: #17191c; color: #ffffff; }
</style>
