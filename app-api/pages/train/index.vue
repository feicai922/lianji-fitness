<template>
  <view class="page-shell train-page">
    <view class="page-title">训练记录</view>
    <view class="page-subtitle">今天也要完成训练</view>

    <view class="part-tabs">
      <view
        v-for="part in parts"
        :key="part"
        class="part-tab"
        :class="{ active: activePart === part }"
        @click="changePart(part)"
      >{{ part }}</view>
    </view>

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

    <view v-if="trainDialog.visible" class="modal-layer" @click.self="closeTrainDialog">
      <view class="form-panel">
        <text class="form-title">录入训练</text>
        <text class="form-subtitle">{{ trainDialog.exercise && trainDialog.exercise.nameZh }}</text>
        <view class="form-row"><text>重量</text><input v-model="trainDialog.weight" type="digit" placeholder="0" /><text class="unit">kg</text></view>
        <view class="form-row"><text>组数</text><input v-model="trainDialog.sets" type="number" placeholder="4" /><text class="unit">组</text></view>
        <view class="form-row"><text>每组次数</text><input v-model="trainDialog.reps" type="number" placeholder="8" /><text class="unit">次</text></view>
        <view class="form-actions"><button class="form-button ghost" @click="closeTrainDialog">取消</button><button class="form-button dark" @click="saveTrainRecord">保存记录</button></view>
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

export default {
  components: { ExerciseCard, ExercisePicker },
  data() {
    return {
      parts: ['胸', '肩', '背', '腿', '有氧'],
      activePart: '胸',
      exercises: [],
      latestRecords: {},
      loading: true,
      pickerVisible: false,
      catalogLoading: false,
      searchText: '',
      trainDialog: { visible: false, exercise: null, weight: '', sets: '', reps: '' },
      catalog: []
    }
  },
  computed: {
    currentExerciseIds() {
      return this.exercises.map((item) => item.id)
    },
    filteredCatalog() {
      const keyword = this.searchText.trim().toLowerCase()
      if (!keyword) return this.catalog
      return this.catalog.filter((item) => item.name_zh.toLowerCase().includes(keyword))
    }
  },
  onShow() {
    this.loadExercises()
  },
  methods: {
    async loadExercises() {
      this.loading = true
      try {
        await initDb()
        this.exercises = await listExercises(this.activePart)
        const records = await Promise.all(this.exercises.map(async (exercise) => [exercise.id, (await listTrainRecords(exercise.id))[0] || null]))
        this.latestRecords = Object.fromEntries(records)
      } catch (error) {
        uni.showToast({ title: '动作加载失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    async changePart(part) {
      if (part === this.activePart) return
      this.activePart = part
      await this.loadExercises()
    },
    openPicker() {
      this.searchText = ''
      this.pickerVisible = true
      if (!this.catalog.length) this.loadCatalog()
    },
    async loadCatalog() {
      this.catalogLoading = true
      try {
        this.catalog = await loadExerciseCatalog()
      } catch (error) {
        uni.showToast({ title: '动作库加载失败，请重试', icon: 'none' })
      } finally {
        this.catalogLoading = false
      }
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
        await addExercise({ ...item, target: this.activePart })
        uni.showToast({ title: '已添加', icon: 'none' })
        await this.loadExercises()
      } catch (error) {
        uni.showToast({ title: '添加失败，请重试', icon: 'none' })
      }
    },
    openTutorial(exercise) {
      uni.navigateTo({ url: `/pages/detail/index?id=${encodeURIComponent(exercise.id)}` })
    },
    openTrainDialog(exercise) {
      const latest = this.latestRecords[exercise.id]
      this.trainDialog = {
        visible: true,
        exercise,
        recordId: latest ? latest.recordId : null,
        weight: latest ? String(latest.weight) : '',
        sets: latest ? String(latest.sets) : '',
        reps: latest ? String(latest.reps) : ''
      }
    },
    closeTrainDialog() {
      this.trainDialog.visible = false
    },
    async saveTrainRecord() {
      const result = validateTrainForm(this.trainDialog)
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
    confirmRemoveExercise(exercise) {
      uni.showModal({
        title: '删除动作',
        content: `确定删除「${exercise.nameZh}」及其训练记录吗？`,
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
.part-tabs { display: flex; width: 100%; margin-top: 48rpx; padding: 0 4rpx; border-bottom: 1rpx solid #eef0f1; }
.part-tab { flex: 1; min-width: 0; padding: 0 0 20rpx; border-bottom: 4rpx solid transparent; color: #9aa0a6; text-align: center; font-size: 31rpx; line-height: 1.2; }
.part-tab.active { border-bottom-color: #17191c; color: #17191c; font-weight: 700; }
.empty-state { padding-top: 220rpx; }
.empty-hint { display: block; margin-top: 16rpx; font-size: 23rpx; }
.exercise-list { margin-top: 6rpx; }
.floating-add { position: fixed; z-index: 10; right: 34rpx; bottom: 116rpx; width: 112rpx; height: 112rpx; border-radius: 50%; background: #17191c; color: #ffffff; text-align: center; font-size: 62rpx; font-weight: 300; line-height: 104rpx; box-shadow: 0 10rpx 28rpx rgba(23,25,28,.18); }
.modal-layer { position: fixed; z-index: 30; inset: 0; display: flex; align-items: center; justify-content: center; padding: 44rpx; background: rgba(23,25,28,.32); }
.form-panel { width: 100%; padding: 38rpx 32rpx 30rpx; border-radius: 22rpx; background: #ffffff; }
.form-title { display: block; color: #17191c; font-size: 36rpx; font-weight: 700; }
.form-subtitle { display: block; overflow: hidden; margin-top: 8rpx; color: #8d949b; font-size: 24rpx; text-overflow: ellipsis; white-space: nowrap; }
.form-row { display: flex; align-items: center; height: 94rpx; border-bottom: 1rpx solid #e7e9eb; color: #555d64; font-size: 26rpx; }
.form-row input { flex: 1; min-width: 0; padding: 0 20rpx; color: #17191c; text-align: right; font-size: 28rpx; }
.unit { width: 60rpx; color: #8d949b; text-align: right; font-size: 23rpx; }
.form-actions { display: flex; gap: 18rpx; margin-top: 30rpx; }
.form-button { flex: 1; height: 78rpx; margin: 0; border-radius: 10rpx; font-size: 26rpx; line-height: 78rpx; }
.form-button.ghost { border: 1rpx solid #e1e4e7; background: #ffffff; color: #555d64; }
.form-button.dark { background: #17191c; color: #ffffff; }
</style>
