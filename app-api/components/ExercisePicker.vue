<template>
  <view v-if="visible" class="picker-layer" @click.self="$emit('close')">
    <view class="picker-panel">
      <view class="picker-header">
        <view>
          <text class="picker-title">添加动作</text>
          <text v-if="part === '全部'" class="picker-subtitle">从全量动作库中选择</text>
          <text v-else class="picker-subtitle">添加到「{{ part }}」</text>
        </view>
        <text class="close-button" @click="$emit('close')">×</text>
      </view>
      <view class="search-box">
        <text class="search-icon">⌕</text>
        <input
          :value="searchText"
          class="search-input"
          confirm-type="search"
          placeholder="搜索中文动作名称"
          @input="$emit('update:searchText', $event.detail.value)"
        />
      </view>
      <scroll-view scroll-y class="picker-list">
        <view v-if="loading" class="picker-empty">动作库加载中…</view>
        <view v-else-if="!items.length" class="picker-empty">没有找到匹配的中文动作</view>
        <view v-for="item in items" :key="item.id" class="picker-item" @click="$emit('select', item)">
          <view class="picker-item-main">
            <text class="picker-item-name">{{ item.name_zh }}</text>
            <text class="picker-item-part">{{ item.target }}</text>
          </view>
          <text v-if="selectedIds.includes(item.id)" class="selected-label">已添加</text>
          <text v-else class="add-label">添加</text>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'ExercisePicker',
  props: {
    visible: Boolean,
    part: { type: String, default: '' },
    searchText: { type: String, default: '' },
    items: { type: Array, default: () => [] },
    selectedIds: { type: Array, default: () => [] },
    loading: Boolean
  },
  emits: ['close', 'select', 'update:searchText']
}
</script>

<style scoped>
.picker-layer {
  position: fixed;
  z-index: 20;
  inset: 0;
  display: flex;
  align-items: flex-end;
  background: rgba(23, 25, 28, .32);
}

.picker-panel {
  width: 100%;
  max-height: 82vh;
  padding: 34rpx 32rpx 42rpx;
  border-radius: 28rpx 28rpx 0 0;
  background: #ffffff;
}

.picker-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.picker-title {
  display: block;
  color: #17191c;
  font-size: 40rpx;
  font-weight: 700;
}

.picker-subtitle {
  display: block;
  margin-top: 8rpx;
  color: #8d949b;
  font-size: 26rpx;
}

.close-button {
  color: #8d949b;
  font-size: 44rpx;
  line-height: 40rpx;
}

.search-box {
  display: flex;
  align-items: center;
  height: 76rpx;
  margin: 26rpx 0 14rpx;
  padding: 0 22rpx;
  border-radius: 12rpx;
  background: #f5f6f7;
}

.search-icon {
  margin-right: 14rpx;
  color: #8d949b;
  font-size: 36rpx;
}

.search-input {
  flex: 1;
  color: #17191c;
  font-size: 29rpx;
}

.picker-list {
  max-height: 57vh;
}

.picker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #eef0f1;
}

.picker-item-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.picker-item-name {
  overflow: hidden;
  color: #17191c;
  font-size: 30rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-item-part {
  color: #9aa0a6;
  font-size: 24rpx;
}

.add-label,
.selected-label {
  flex-shrink: 0;
  color: #17191c;
  font-size: 26rpx;
}

.selected-label {
  color: #a5abb0;
}

.picker-empty {
  padding: 80rpx 0;
  color: #8d949b;
  text-align: center;
  font-size: 27rpx;
}
</style>
