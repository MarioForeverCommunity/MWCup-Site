<template>
  <div class="round-selector">    <div class="selector-header">
      <h2>Mario Worker 杯评分查看器</h2>
      <p>选择比赛年份和轮次查看详细评分</p>
    </div>
    
    <div class="selector-controls">
      <div class="control-group">
        <label for="year-select">年份:</label>
        <select id="year-select" v-model="selectedYear" @change="onYearChange">
          <option value="">请选择年份</option>
          <option v-for="year in availableYears" :key="year" :value="year">
            {{ year }}年
          </option>
        </select>
      </div>
      
      <div class="control-group" v-if="selectedYear">
        <label for="round-select">轮次:</label>
        <select id="round-select" v-model="selectedRound" @change="onRoundChange">
          <option value="">请选择轮次</option>
          <option v-for="round in availableRounds" :key="round.code" :value="round.code">
            {{ round.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- 显示评分表格 -->
    <ScoreTable 
      v-if="selectedYear && selectedRound" 
      :year="selectedYear" 
      :round="selectedRound"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchMarioWorkerYaml, extractSeasonData } from '../utils/yamlLoader'
import ScoreTable from './ScoreTable.vue'

const seasonData = ref<any>(null)
const selectedYear = ref('')
const selectedRound = ref('')

const availableYears = computed(() => {
  if (!seasonData.value) return []
  return Object.keys(seasonData.value).sort((a, b) => parseInt(b) - parseInt(a))
})

const availableRounds = computed(() => {
  if (!selectedYear.value || !seasonData.value?.[selectedYear.value]?.rounds) {
    return []
  }
  
  const rounds = seasonData.value[selectedYear.value].rounds
  const roundList: { code: string; name: string }[] = []
  
  for (const [roundKey, roundData] of Object.entries(rounds)) {
    // 处理数组形式的轮次（如 [G1, G2, G3, G4]）
    if (Array.isArray(roundKey)) {
      // 将数组中的每个轮次单独添加
      for (const singleRound of roundKey) {
        roundList.push({
          code: singleRound,
          name: getRoundDisplayName(singleRound, roundData as any)
        })
      }
    } else {
      // 处理普通的单轮次
      roundList.push({
        code: roundKey,
        name: getRoundDisplayName(roundKey, roundData as any)
      })
    }
  }
  
  // 按轮次类型排序
  return roundList.sort((a, b) => {
    const order = ['P1', 'P2', 'I1', 'I2', 'I3', 'I4', 'G1', 'G2', 'G3', 'G4', 'Q1', 'Q2', 'Q', 'R1', 'R2', 'R3', 'R', 'S1', 'S2', 'S', 'F']
    const aIndex = order.indexOf(a.code)
    const bIndex = order.indexOf(b.code)
    if (aIndex === -1 && bIndex === -1) return a.code.localeCompare(b.code)
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })
})

function getRoundDisplayName(roundCode: string, roundData: any): string {
  const roundNames: { [key: string]: string } = {
    'P1': '热身赛/预选赛',
    'P2': '资格赛',
    'I1': '初赛第一轮',
    'I2': '初赛第二轮', 
    'I3': '初赛第三轮',
    'I4': '初赛第四轮',
    'G1': '小组赛第一轮',
    'G2': '小组赛第二轮',
    'G3': '小组赛第三轮',
    'G4': '小组赛第四轮',
    'Q1': '四分之一决赛第一轮',
    'Q2': '四分之一决赛第二轮',
    'Q': '四分之一决赛',
    'R1': '复赛第一轮',
    'R2': '复赛第二轮',
    'R3': '复赛第三轮',
    'R': '复赛',
    'S1': '半决赛第一轮',
    'S2': '半决赛第二轮',
    'S': '半决赛',
    'F': '决赛'
  }
  
  let name = roundNames[roundCode] || roundCode
  
  if (roundData?.is_warmup) {
    name += ' (热身)'
  }
  
  return name
}

function onYearChange() {
  selectedRound.value = ''
}

function onRoundChange() {
  // 可以在这里添加其他逻辑
}

async function loadSeasonData() {
  try {
    const yamlDoc = await fetchMarioWorkerYaml()
    seasonData.value = extractSeasonData(yamlDoc)
  } catch (error) {
    console.error('加载赛季数据失败:', error)
  }
}

onMounted(() => {
  loadSeasonData()
})
</script>

<style scoped>
.round-selector {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.selector-header {
  text-align: center;
  margin-bottom: 30px;
}

.selector-header h2 {
  color: #2c3e50;
  margin: 0 0 10px 0;
  font-size: 28px;
}

.selector-header p {
  color: #7f8c8d;
  margin: 0;
  font-size: 16px;
}

.selector-controls {
  display: flex;
  gap: 20px;
  justify-content: center;
  align-items: end;
  margin-bottom: 30px;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 200px;
}

.control-group label {
  font-weight: 500;
  color: #34495e;
  font-size: 14px;
}

.control-group select {
  padding: 10px 12px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 16px;
  background-color: white;
  color: #2c3e50;
  transition: border-color 0.3s ease;
}

.control-group select:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.control-group select:hover {
  border-color: #3498db;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .round-selector {
    padding: 15px;
  }
  
  .selector-controls {
    flex-direction: column;
    align-items: center;
  }
  
  .control-group {
    width: 100%;
    max-width: 300px;
  }
  
  .selector-header h2 {
    font-size: 24px;
  }
}
</style>
