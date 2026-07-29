基于HBuilderX UniApp Vue3 + uViewUI3开发简约轻量化安卓健身记录App，仅适配安卓端，浅色极简原生风格，无多余动画，全部界面中文。
核心需求清单：
1. 底部Tab导航共2页：【训练记录】、【体重管理】
2. 【训练记录】页面顶部横向Tab栏固定5个部位：胸、肩、背、腿、有氧，切换不同部位动作列表；
3. 动作列表功能：
  3.1 右下角悬浮加号按钮：弹窗加载static/json/clean_fitness_zh.json全部中文动作，支持搜索动作名称，选中即可添加到当前部位本地数据库；
  3.2 列表Item展示：中文动作名、该动作历史训练记录（重量kg × 组数×次数）；
  3.3 Item两个操作按钮：【查看教程】、【录入训练】；
  3.4 长按Item弹出确认弹窗，可删除该部位下此动作；
4. 动作教程详情页：
  4.1 顶部image组件加载在线GIF，拼接规则：`https://v2.exercisedb.io/gif/{media_id}`；
  4.2 大标题展示name_zh中文动作名；
  4.3 分段渲染instructions_zh分步中文教学文字；
  4.4 顶部返回按钮回到动作列表；
5. 录入训练弹窗：输入框填写重量(Float kg)、组数、每组次数，保存到本地SQLite训练记录表；
6. 【体重管理】页面：
  6.1 输入框填写当日体重，点击保存存入本地数据库；
  6.2 使用uni-data-charts绘制日期-体重折线趋势图，线条浅灰简约；
  6.3 下方展示全部历史体重记录列表，长按可删除单条体重数据；
7. 本地SQLite数据库三张表结构：
表1 exercise(自定义动作)
id TEXT PRIMARY KEY, nameZh TEXT, targetPart TEXT, mediaId TEXT, instructionsZh TEXT
表2 train_record(训练重量记录)
recordId INTEGER PRIMARY KEY AUTOINCREMENT, exerciseId TEXT, weight REAL, sets INTEGER, reps INTEGER, trainDate TEXT
表3 weight_record(体重记录)
wid INTEGER PRIMARY KEY AUTOINCREMENT, weight REAL, recordDate TEXT
8. 代码规范：
- 全部页面分包pages/train、pages/weight、pages/detail；
- 封装utils/sqlite.js数据库通用增删改查工具；
- pages.json自动注册所有页面，底部tab配置完成；
- UI极简白底，黑色正文，浅灰色分割线，适配手机竖屏；
- 输出完整：pages页面vue代码、utils工具类、pages.json、全局样式、数据库初始化逻辑；
- 适配安卓App，云打包可直接导出APK。