<template>
  <view class="page-shell settings-page">
    <view class="page-title">设置</view>
    <view class="page-subtitle">管理训练记录页面的显示内容</view>

    <view class="data-card">
      <text class="setting-title">数据备份</text>
      <text class="setting-hint">导出内容会复制到剪贴板，重装后可粘贴导入</text>
      <view class="data-actions">
        <button class="data-button ghost" @click="handleExport">导出数据</button>
        <button class="data-button dark" @click="handleImport">导入数据</button>
      </view>
    </view>
  </view>
</template>

<script>
import { exportData as exportAppData, importData } from '@/utils/sqlite'
import { collectPreferences, restorePreferences } from '@/utils/backup'

export default {
  methods: {
    async handleExport() {
      try {
        const backup = await exportAppData(collectPreferences())
        const payload = JSON.stringify(backup, null, 2)
        uni.setClipboardData({
          data: payload,
          success: () => uni.showToast({ title: '备份已复制', icon: 'none' }),
          fail: () => uni.showToast({ title: '导出失败，请重试', icon: 'none' })
        })
      } catch (error) {
        uni.showToast({ title: '导出失败，请重试', icon: 'none' })
      }
    },
    handleImport() {
      uni.getClipboardData({
        success: async (result) => {
          try {
            const backup = await importData(result.data)
            restorePreferences(backup.preferences)
            uni.showToast({ title: '备份已导入', icon: 'none' })
          } catch (error) {
            uni.showToast({ title: error.message || '导入失败，请检查备份内容', icon: 'none' })
          }
        },
        fail: () => uni.showToast({ title: '请先复制备份 JSON', icon: 'none' })
      })
    }
  }
}
</script>

<style scoped>
.settings-page { padding-top: 24rpx; }
.setting-title { color: #17191c; font-size: 32rpx; font-weight: 700; }
.setting-hint { color: #8d949b; font-size: 24rpx; line-height: 1.5; }
.data-card { margin-top: 24rpx; padding: 30rpx 28rpx; border: 1rpx solid #eceef0; border-radius: 22rpx; background: #ffffff; box-shadow: 0 12rpx 30rpx rgba(23, 25, 28, .05); }
.data-card > .setting-hint { display: block; margin-top: 10rpx; }
.data-actions { display: flex; gap: 16rpx; margin-top: 24rpx; }
.data-button { flex: 1; height: 72rpx; margin: 0; border-radius: 10rpx; font-size: 25rpx; line-height: 72rpx; }
.data-button.ghost { border: 1rpx solid #e1e4e7; background: #ffffff; color: #555d64; }
.data-button.dark { background: #17191c; color: #ffffff; }
</style>
