<template>
  <div class="page-header animate-fadeInUp">
    <h2 class="animate-textGlow">Mario Worker 杯各轮比赛详情</h2>
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
      
      <div class="form-group animate-scaleIn" v-if="selectedYear && isWikiAvailable">
        <label for="round-select" class="form-label">Wiki:</label>
        <button @click="openWikiPage" class="btn-primary">
          {{ selectedRound ? `查看${getStageNameForWiki(selectedRound)}词条` : '查看本届主词条' }}
        </button>
      </div>
    </div>
  </div>
  
  <!-- 内容区域，包含试题和评分表格 -->
  <div v-if="displayYear && displayRound" class="content-area">
    <!-- 显示单轮次赛程表 -->
    <ScheduleTable 
      :year="displayYear" 
      :round="displayRound"
      :hide-controls="true"
    />

    <!-- 显示试题内容 -->
    <SubjectDisplay 
      :year="displayYear" 
      :round="displayRound"
    />

    <!-- 显示评分表格 -->
    <ScoreTable 
      :year="displayYear" 
      :round="displayRound"
    />
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
const lastSelectedYear = ref('')
const lastSelectedRound = ref('')
const displayYear = ref('')
const displayRound = ref('')

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
  if (!selectedYear.value || !selectedRound.value) return
  const hasScore = hasScoreData(selectedYear.value, selectedRound.value)
  const hasSubject = await checkSubjectExists(selectedYear.value, selectedRound.value)
  if (hasScore || hasSubject) {
    displayYear.value = selectedYear.value
    displayRound.value = selectedRound.value
  }
  // 否则 displayYear/displayRound 保持不变
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

async function checkSubjectExists(year: string, round: string) {
  const fileName = `${year}${round}.md`
  const filePath = `/data/subjects/${fileName}`
  try {
    const res = await fetch(filePath, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

function hasScoreData(year: string, round: string) {
  if (!seasonData.value?.[year]?.rounds?.[round]) return false
  // 可根据实际数据结构进一步判断
  return true
}

async function onYearChange() {
  if (!selectedYear.value) return
  // 检查该年是否有可用轮次
  const rounds = seasonData.value?.[selectedYear.value]?.rounds
  if (!rounds || Object.keys(rounds).length === 0) {
    alert('该届暂无可用轮次！')
    selectedYear.value = lastSelectedYear.value
    return
  }
  lastSelectedYear.value = selectedYear.value
  selectedRound.value = ''
}

async function onRoundChange() {
  if (!selectedYear.value || !selectedRound.value) return
  // 检查评分数据和试题文件是否存在
  const hasScore = hasScoreData(selectedYear.value, selectedRound.value)
  const hasSubject = await checkSubjectExists(selectedYear.value, selectedRound.value)
  if (!hasScore && !hasSubject) {
    alert('该轮次暂无内容，已为您保留原内容！')
    selectedRound.value = lastSelectedRound.value
    return
  }
  lastSelectedRound.value = selectedRound.value
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
  lastSelectedYear.value = selectedYear.value
  lastSelectedRound.value = selectedRound.value
})
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
