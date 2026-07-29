<template>
  <view class="exercise-card" @longpress="$emit('remove', exercise)">
    <view class="exercise-main">
      <text class="exercise-name">{{ exercise.nameZh }}</text>
      <text v-if="latestRecord" class="exercise-record">
        {{ latestRecord.weight }} kg × {{ latestRecord.sets }} 组 × {{ latestRecord.reps }} 次
      </text>
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
  emits: ['remove', 'tutorial', 'train']
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
}

.exercise-main {
  min-width: 0;
  flex: 1;
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
  margin-top: 10rpx;
  color: #8d949b;
  font-size: 26rpx;
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
