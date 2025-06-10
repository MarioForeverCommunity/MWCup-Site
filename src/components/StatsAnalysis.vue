<template>
  <div class="stats-tabs">
    <div class="tab-bar">
      <button v-for="tab in tabs" :key="tab.key"
        :class="['tab-btn', 'btn-base', activeTab === tab.key ? 'btn-primary' : 'btn-secondary', {active: tab.key === activeTab}]"
        @click="activeTab = tab.key"
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
import { ref } from 'vue'
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
const activeTab = ref('ranking')
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
