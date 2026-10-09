<template>
  <view class="exercise-card" :class="{ 'is-dragging': dragging }" @longpress="handleCardLongPress">
    <view
      class="drag-button"
      :class="{ 'is-pressing': handlePressed, 'is-dragging': dragging }"
      @longpress.stop="handleHandleLongPress"
      @touchstart.stop="beginHandlePress"
      @touchmove.stop="handleHandleMove"
      @touchend.stop="endHandlePress"
      @touchcancel.stop="cancelHandlePress"
    >
      <view class="drag-icon">
        <view class="drag-bar"></view>
        <view class="drag-bar"></view>
        <view class="drag-bar"></view>
      </view>
    </view>
    <view class="exercise-main">
      <text class="exercise-name">{{ exercise.nameZh }}</text>
      <text v-if="latestRecord" class="exercise-record">{{ formatTrainSummary(latestRecord) }}</text>
      <text v-else class="exercise-record">还没有训练记录</text>
    </view>
    <view class="exercise-actions">
      <button class="mini-button" @click.stop="$emit('tutorial', exercise)">查看教程</button>
      <button class="mini-button dark-button" @click.stop="$emit('train', exercise)">{{ latestRecord ? '编辑训练' : '录入训练' }}</button>
    </view>
  </view>
</template>

<script>
export default {
  name: 'ExerciseCard',
  props: {
    exercise: { type: Object, required: true },
    latestRecord: { type: Object, default: null }
  },
  emits: ['remove', 'tutorial', 'train', 'dragstart', 'dragmove', 'dragend'],
  data() {
    return {
      handlePressTimer: null,
      suppressReleaseTimer: null,
      handlePressed: false,
      dragging: false,
      suppressCardLongPress: false,
      pressStartEvent: null
    }
  },
  beforeUnmount() {
    this.clearHandleTimers()
  },
  methods: {
    beginHandlePress(event) {
      this.clearHandleTimers()
      this.handlePressed = true
      this.suppressCardLongPress = true
      this.pressStartEvent = event
      this.handlePressTimer = setTimeout(() => {
        this.handlePressTimer = null
        if (!this.handlePressed) return
        this.dragging = true
        this.$emit('dragstart', this.pressStartEvent, this.exercise)
      }, 260)
    },
    handleHandleLongPress() {
      this.suppressCardLongPress = true
    },
    handleHandleMove(event) {
      if (!this.handlePressed || !this.dragging) return
      this.$emit('dragmove', event, this.exercise)
    },
    endHandlePress(event) {
      this.finishHandlePress(event)
    },
    cancelHandlePress(event) {
      this.finishHandlePress(event)
    },
    finishHandlePress(event) {
      const wasDragging = this.dragging
      this.clearHandlePressTimer()
      this.handlePressed = false
      this.dragging = false
      this.pressStartEvent = null
      if (wasDragging) this.$emit('dragend', event, this.exercise)
      this.suppressReleaseTimer = setTimeout(() => {
        this.suppressCardLongPress = false
        this.suppressReleaseTimer = null
      }, 180)
    },
    handleCardLongPress() {
      if (this.suppressCardLongPress) return
      this.$emit('remove', this.exercise)
    },
    clearHandlePressTimer() {
      if (this.handlePressTimer) {
        clearTimeout(this.handlePressTimer)
        this.handlePressTimer = null
      }
    },
    clearHandleTimers() {
      this.clearHandlePressTimer()
      if (this.suppressReleaseTimer) {
        clearTimeout(this.suppressReleaseTimer)
        this.suppressReleaseTimer = null
      }
    },
    formatTrainSummary(record) {
      const details = Array.isArray(record.setDetails) ? record.setDetails : []
      if (!details.length) return record.weight + ' kg × ' + record.sets + ' 组 × ' + record.reps + ' 次'
      const summary = details.map((set) => String(set.weight) + '×' + String(set.reps)).join(' / ')
      return details.length + ' 组 · ' + summary
    }
  }
}
</script>

<style scoped>
.exercise-card {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
  padding: 30rpx 0;
  border-bottom: 1rpx solid #e7e9eb;
  transition: transform 180ms cubic-bezier(.2,.8,.2,1), box-shadow 180ms ease, background-color 180ms ease;
}

.exercise-card.is-dragging {
  transform: translateY(-4rpx) scale(1.01);
  border-radius: 12rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 26rpx rgba(23,25,28,.12);
}

.exercise-main {
  min-width: 0;
  flex: 1;
}

.drag-button {
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96rpx;
  min-height: 116rpx;
  margin: -30rpx 14rpx -30rpx 0;
  border-radius: 12rpx 0 0 12rpx;
  background: #f5f6f7;
  touch-action: none;
  transition: transform 180ms cubic-bezier(.2,.8,.2,1), color 180ms ease;
}

.drag-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7rpx;
  width: 38rpx;
}

.drag-bar {
  width: 34rpx;
  height: 4rpx;
  border-radius: 999rpx;
  background: #8d949b;
  transition: width 180ms ease, background-color 180ms ease;
}

.drag-button.is-pressing {
  transform: scale(1.08);
  background: #e9ebed;
}

.drag-button.is-dragging {
  transform: scale(1.14);
  background: #e1e4e7;
}

.drag-button.is-pressing .drag-bar {
  width: 38rpx;
  background: #555d64;
}

.drag-button.is-dragging .drag-bar {
  width: 40rpx;
  background: #17191c;
}

.exercise-name {
  display: block;
  overflow: hidden;
  color: #17191c;
  font-size: 34rpx;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.exercise-record {
  display: block;
  overflow: hidden;
  margin-top: 10rpx;
  color: #8d949b;
  font-size: 26rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.exercise-actions {
  display: flex;
  flex-shrink: 0;
  gap: 10rpx;
}

.mini-button {
  height: 56rpx;
  margin: 0;
  padding: 0 16rpx;
  border: 1rpx solid #e1e4e7;
  border-radius: 8rpx;
  background: #ffffff;
  color: #555d64;
  font-size: 24rpx;
  line-height: 56rpx;
}

.dark-button {
  border-color: #17191c;
  background: #17191c;
  color: #ffffff;
}
</style>
