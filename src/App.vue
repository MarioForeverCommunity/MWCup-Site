<script setup lang="ts">
import { ref } from 'vue'
import ScheduleTable from './components/ScheduleTable.vue'
import RoundSelector from './components/RoundSelector.vue'
import ChampionStatistics from './components/ChampionStatistics.vue'
import LevelFileTest from './components/LevelFileTest.vue'

const activeTab = ref<'schedule' | 'scores' | 'champions' | 'levels'>('schedule')
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>Mario Worker 杯官网</h1>
      <nav class="main-nav">
        <button 
          @click="activeTab = 'schedule'" 
          :class="{ active: activeTab === 'schedule' }"
          class="nav-btn"
        >
          赛程安排
        </button>
        <button 
          @click="activeTab = 'scores'" 
          :class="{ active: activeTab === 'scores' }"
          class="nav-btn"
        >
          评分查询
        </button>
        <button 
          @click="activeTab = 'champions'" 
          :class="{ active: activeTab === 'champions' }"
          class="nav-btn"
        >
          冠军统计
        </button>
        <button 
          @click="activeTab = 'levels'" 
          :class="{ active: activeTab === 'levels' }"
          class="nav-btn"
        >
          关卡查询
        </button>
      </nav>
    </header>

    <main class="app-main">
      <div v-if="activeTab === 'schedule'">
        <ScheduleTable />
      </div>
      
      <div v-if="activeTab === 'scores'">
        <RoundSelector />
      </div>
      
      <div v-if="activeTab === 'champions'">
        <ChampionStatistics />
      </div>
      
      <div v-if="activeTab === 'levels'">
        <LevelFileTest />
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  background-color: #f8f9fa;
}

.app-header {
  background: white;
  border-bottom: 1px solid #dee2e6;
  padding: 20px 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.app-header h1 {
  margin: 0 0 15px 0;
  text-align: center;
  color: #2c3e50;
  font-size: 28px;
  font-weight: 600;
}

.main-nav {
  display: flex;
  justify-content: center;
  gap: 20px;
  padding: 0 20px;
}

.nav-btn {
  padding: 12px 24px;
  border: 2px solid #3498db;
  background: white;
  color: #3498db;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 120px;
}

.nav-btn:hover {
  background: #ecf0f1;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(52, 152, 219, 0.2);
}

.nav-btn.active {
  background: #3498db;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(52, 152, 219, 0.3);
}

.app-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

@media (max-width: 768px) {
  .main-nav {
    flex-direction: column;
    gap: 10px;
    padding: 0 20px;
  }
  
  .nav-btn {
    min-width: auto;
  }
  
  .app-header h1 {
    font-size: 24px;
  }
  
  .app-main {
    padding: 15px;
  }
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
