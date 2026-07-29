<script>
import { initDb } from './utils/sqlite'

export default {
  onLaunch() {
    initDb().catch(() => {
      uni.showToast({ title: '本地数据初始化失败', icon: 'none' })
    })
  }
}
</script>

<style>
page {
  background: #ffffff;
  color: #17191c;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif;
}

view, text, button, input {
  box-sizing: border-box;
}

button::after {
  border: 0;
}
</style>
