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
          <router-view />
        </div>
        <div v-else-if="activeTab === 'holding'" :key="'holding'">
          <ChampionStatistics />
        </div>
        <div v-else-if="activeTab === 'totalpoints'" :key="'totalpoints'">
          <router-view />
        </div>
        <div v-else-if="activeTab === 'players'" :key="'players'">
          <PlayerRecords />
        </div>
        <div v-else-if="activeTab === 'judges'" :key="'judges'">
          <JudgeRecords />
        </div>
        <div v-else-if="activeTab === 'attendance'" :key="'attendance'">
          <AttendanceStats />
        </div>
        <div v-else-if="activeTab === 'users'" :key="'users'">
          <UserManagement />
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PlayerRecords from './PlayerRecords.vue'
import ChampionStatistics from './ChampionStatistics.vue'
import JudgeRecords from './JudgeRecords.vue'
import AttendanceStats from './AttendanceStats.vue'
import UserManagement from './UserManagement.vue'

const tabs = [
  { key: 'ranking', label: '关卡排名' },
  { key: 'holding', label: '举办情况' },
  { key: 'totalpoints', label: '积分排行' },
  { key: 'players', label: '选手战绩' },
  { key: 'judges', label: '评委数据' },
  { key: 'attendance', label: '上传率统计' },
  { key: 'users', label: '用户一览' }, // 新增用户一览Tab
]

// Vue Router
const route = useRoute()
const router = useRouter()

// 检查路由参数来确定初始选择的标签页
const getInitialTab = () => {
  const statsParam = route.params.stat
  
  if (statsParam && tabs.find(tab => tab.key === statsParam)) {
    return statsParam as string
  }
  
  return 'ranking' // 默认选择关卡排名
}

const activeTab = ref(getInitialTab())

// 标记是否已经初始化
const isInitialized = ref(false)

// 设置活动标签页并更新路由
const setActiveTab = (tabKey: string) => {
  // 更新活动标签页状态
  activeTab.value = tabKey
  
  // 根据标签页类型导航到不同的路由
  if (tabKey === 'ranking') {
    router.push({ name: 'StatsRanking', params: { type: 'single' } })
  } else if (tabKey === 'totalpoints') {
    router.push({ name: 'StatsTotalPoints', params: { year: '2025' } })
  } else {
    // 其他标签页保持原有的路由结构
    router.push({ name: 'StatsSub', params: { stat: tabKey } })
  }
}

// 监听路由参数变化
watch(() => route.params.stat, (newStat) => {
  if (newStat && newStat !== activeTab.value) {
    activeTab.value = newStat as string
  }
}, { immediate: false })

// 监听路由名称变化来处理子路由
watch(() => route.name, (newName) => {
  if (newName === 'StatsRanking' && activeTab.value !== 'ranking') {
    activeTab.value = 'ranking'
  } else if (newName === 'StatsTotalPoints' && activeTab.value !== 'totalpoints') {
    activeTab.value = 'totalpoints'
  }
}, { immediate: true })

// 组件挂载时处理路由参数
onMounted(() => {
  // 只在组件首次挂载时处理路由同步
  if (!isInitialized.value) {
    // 根据当前路由名称处理初始化
    const currentName = route.name
    const currentStat = route.params.stat
    
    if (currentName === 'StatsRanking') {
      activeTab.value = 'ranking'
    } else if (currentName === 'StatsTotalPoints') {
      activeTab.value = 'totalpoints'
    } else if (!currentStat || !tabs.find(tab => tab.key === currentStat)) {
      // 如果当前路由参数为空或不合法，才需要更新路由
      router.replace({
        name: 'StatsSub',
        params: { stat: activeTab.value }
      })
    }
    isInitialized.value = true
  }
})

// 组件卸载时的清理工作
onUnmounted(() => {
  // 不再需要移除事件监听器，因为Vue Router会自动处理
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
