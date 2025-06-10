<template>
  <div class="page-header">
    <div class="control-panel animate-fadeInUp">
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
      
      <div class="form-group animate-scaleIn" v-if="selectedYear && isWikiAvailable">
        <label for="round-select" class="form-label">Wiki:</label>
        <button @click="openWikiPage" class="btn-primary">
          {{ selectedRound ? `查看${getStageNameForWiki(selectedRound)}词条` : '查看本届主词条' }}
        </button>
      </div>
    </div>
  </div>
    <!-- 内容区域 -->
  <div v-if="selectedYear" class="content-area">
    <!-- 只选择了届次，显示完整赛程表 -->
    <div v-if="!selectedRound">
      <ScheduleTable 
        :year="selectedYear" 
        :hide-controls="true"
      />
    </div>
    
    <!-- 选择了具体轮次，显示该轮次的详细内容 -->
    <div v-else>
      <!-- 显示单轮次赛程表 -->
      <ScheduleTable 
        :year="selectedYear" 
        :round="selectedRound"
        :hide-controls="true"
      />

      <!-- 显示试题内容 -->
      <SubjectDisplay 
        :year="selectedYear" 
        :round="selectedRound"
      />

      <!-- 显示评分表格 -->
      <ScoreTable 
        :year="selectedYear" 
        :round="selectedRound"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { fetchMarioWorkerYaml, extractSeasonData } from '../utils/yamlLoader'
import { getEditionNumber } from '../utils/editionHelper'
import { getRoundChineseName } from '../utils/roundNames'
import ScoreTable from './ScoreTable.vue'
import SubjectDisplay from './SubjectDisplay.vue'
import ScheduleTable from './ScheduleTable.vue'

const seasonData = ref<any>(null)
const selectedYear = ref('')
const selectedRound = ref('')

// 检查Wiki是否可用（第一届没有词条）
const isWikiAvailable = computed(() => {
  if (!selectedYear.value) return false
  const year = parseInt(selectedYear.value)
  return year > 2012 // 第一届是2012年，从第二届开始有词条
})

// 获取比赛阶段名称（用于Wiki链接，不显示轮次编号）
const getStageNameForWiki = (round: string): string => {
  if (round.startsWith('G')) return '小组赛'
  if (round.startsWith('I')) return '初赛'
  if (round.startsWith('R')) return '复赛'
  if (round.startsWith('Q')) return '四分之一决赛'
  if (round.startsWith('S')) return '半决赛'
  if (round === 'F') return '决赛'
  if (round === 'P1') {
    // 需要检查是否为热身赛
    const roundData = seasonData.value?.[selectedYear.value]?.rounds?.[round]
    return roundData?.is_warmup ? '热身赛' : '预选赛'
  }
  if (round === 'P2') return '资格赛'
  return ''
}

// 打开Wiki页面
const openWikiPage = () => {
  if (!selectedYear.value || !isWikiAvailable.value) return
  
  const year = parseInt(selectedYear.value)
  const editionNumber = getEditionNumber(year)
  
  let wikiUrl = `https://zh.wiki.marioforever.net/wiki/第${editionNumber}届Mario_Worker杯`
  
  if (selectedRound.value) {
    const stageName = getStageNameForWiki(selectedRound.value)
    if (stageName) {
      wikiUrl += `/${stageName}`
    }
  }
  
  window.open(wikiUrl, '_blank')
}

watch([selectedYear, selectedRound], async () => {
  // 监听变化，可在此处添加其他逻辑
}, { immediate: true })

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
            name: getRoundChineseName(singleRound, { ...roundData as any, year: selectedYear.value })
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
          name: getRoundChineseName(singleRound, { ...roundData as any, year: selectedYear.value })
        });
      }
      continue;
    }
    
    // 处理普通的单轮次
    roundList.push({
      code: roundKey,
      name: getRoundChineseName(roundKey, { ...roundData as any, year: selectedYear.value })
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

async function onYearChange() {
  selectedRound.value = ''
}

async function onRoundChange() {
  // 可以在这里添加其他逻辑
}
</script>

<style scoped>
/* 组件特定样式 - 使用新的CSS类系统 */
/* 大部分样式现在使用全局CSS类，只保留必要的组件特定样式 */

.content-area {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.btn-primary {
  font-size: 14px;
  white-space: nowrap;
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
