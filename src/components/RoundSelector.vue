<template>
  <div class="page-header animate-fadeInUp">
    <h2 class="animate-textGlow">Mario Worker 杯评分数据查看</h2>
    <div class="control-panel">
      <div class="form-group">
        <label for="year-select" class="form-label">届次:</label>
        <select id="year-select" v-model="selectedYear" @change="onYearChange" class="form-control hover-scale">
          <option value="">请选择届次</option>
          <option v-for="year in availableYears" :key="year" :value="year">
            {{ year }}年第{{ getEditionNumber(year) }}届
          </option>
        </select>
      </div>
      
      <div class="form-group animate-scaleIn" v-if="selectedYear">
        <label for="round-select" class="form-label">轮次:</label>
        <select id="round-select" v-model="selectedRound" @change="onRoundChange" class="form-control hover-scale">
          <option value="">请选择轮次</option>
          <option v-for="round in availableRounds" :key="round.code" :value="round.code">
            {{ round.name }}
          </option>
        </select>
      </div>
    </div>
  </div>

  <!-- 显示评分表格 -->
  <ScoreTable 
    v-if="selectedYear && selectedRound" 
    :year="selectedYear" 
    :round="selectedRound"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchMarioWorkerYaml, extractSeasonData } from '../utils/yamlLoader'
import { getEditionNumber } from '../utils/editionHelper'
import { getRoundChineseName } from '../utils/roundNames'
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
    // 检查是否是数组表示的轮次（如 "[G1, G2, G3, G4]"）
    if (roundKey.startsWith('[') && roundKey.endsWith(']')) {
      try {
        const parsedKey = JSON.parse(roundKey);
        if (Array.isArray(parsedKey)) {
          for (const singleRound of parsedKey) {
          roundList.push({
            code: singleRound,
            name: getRoundChineseName(singleRound, roundData as any)
          });
        }
          continue;
        }
      } catch {
        // JSON解析失败，按普通轮次处理
      }
    }
    
    // 检查是否是逗号分隔的多轮次（如 "G1,G2,G3,G4"）
    if (roundKey.includes(',')) {
      const singleRounds = roundKey.split(',').map(r => r.trim());
      for (const singleRound of singleRounds) {
        roundList.push({
          code: singleRound,
          name: getRoundChineseName(singleRound, roundData as any)
        });
      }
      continue;
    }
    
    // 处理普通的单轮次
    roundList.push({
      code: roundKey,
      name: getRoundChineseName(roundKey, roundData as any)
    });
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
/* 组件特定样式 - 使用新的CSS类系统 */
/* 大部分样式现在使用全局CSS类，只保留必要的组件特定样式 */
</style>
