<template>
  <div class="stats-tabs">
    <div class="tab-bar">
      <button v-for="tab in tabs" :key="tab.key"
        :class="['tab-btn', 'btn-base', activeTab === tab.key ? 'btn-primary' : 'btn-secondary', {active: tab.key === activeTab}]"
        @click="setActiveTab(tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>
    <div class="tab-content">
      <Transition name="fade" mode="out-in">
        <div v-if="activeTab === 'ranking'" :key="'ranking'">
          <RankingModule />
        </div>
        <div v-else-if="activeTab === 'totalpoints'" :key="'totalpoints'">
          <TotalPointsRanking />
        </div>
        <div v-else-if="activeTab === 'players'" :key="'players'">
          <PlayerRecords />
        </div>
        <div v-else-if="activeTab === 'champions'" :key="'champions'">
          <ChampionStatistics />
        </div>
        <div v-else-if="activeTab === 'judges'" :key="'judges'">
          <JudgeRecords />
        </div>
        <div v-else-if="activeTab === 'attendance'" :key="'attendance'">
          <AttendanceStats />
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import RankingModule from './RankingModule.vue'
import TotalPointsRanking from './TotalPointsRanking.vue'
import PlayerRecords from './PlayerRecords.vue'
import ChampionStatistics from './ChampionStatistics.vue'
import JudgeRecords from './JudgeRecords.vue'
import AttendanceStats from './AttendanceStats.vue'

const tabs = [
  { key: 'ranking', label: '关卡排名' },
  { key: 'totalpoints', label: '积分排行' },
  { key: 'players', label: '选手战绩' },
  { key: 'champions', label: '冠军统计' },
  { key: 'judges', label: '评委数据' },
  { key: 'attendance', label: '出勤率统计' },
]

// 检查URL参数来确定初始选择的标签页
const getInitialTab = () => {
  const urlParams = new URLSearchParams(window.location.search)
  const statsParam = urlParams.get('stats')
  
  if (statsParam && tabs.find(tab => tab.key === statsParam)) {
    return statsParam
  }
  
  return 'ranking' // 默认选择关卡排名
}

const activeTab = ref(getInitialTab())

// 设置活动标签页并更新URL参数
const setActiveTab = (tabKey: string) => {
  activeTab.value = tabKey
  updateUrlParams(tabKey)
}

// 更新URL参数
const updateUrlParams = (statsTab: string) => {
  const url = new URL(window.location.href)
  const params = new URLSearchParams(url.search)
  
  // 设置stats参数
  params.set('stats', statsTab)
  
  // 更新URL（不会触发页面刷新）
  const newUrl = `${url.pathname}?${params.toString()}`
  window.history.replaceState({}, '', newUrl)
}

// 处理浏览器前进后退事件
const handlePopState = () => {
  const newTab = getInitialTab()
  if (newTab !== activeTab.value) {
    activeTab.value = newTab
  }
}

// 组件挂载时监听popstate事件并确保URL参数正确
onMounted(() => {
  // 确保URL参数与当前选择的标签页一致
  updateUrlParams(activeTab.value)
  window.addEventListener('popstate', handlePopState)
})

onUnmounted(() => {
  window.removeEventListener('popstate', handlePopState)
})
</script>

<style scoped>
.stats-tabs {
  width: 100%;
  min-height: 300px;
}

.tab-bar {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
  flex-wrap: wrap;
  justify-content: center;
}

.tab-btn {
  min-width: 100px;
}

.tab-content {
  min-height: 200px;
}

.content-panel {
  animation: fadeIn 0.3s ease;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
