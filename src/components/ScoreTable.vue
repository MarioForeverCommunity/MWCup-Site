<template>
  <div class="score-table-container">
    <div v-if="loading" class="loading">
      正在加载评分数据...
    </div>
    
    <div v-else-if="error" class="error">
      {{ error }}
    </div>
      <div v-else-if="scoreData" class="score-content">
      <div class="score-header">
        <h3>{{ scoreData.year }}年 {{ scoreData.round }} 评分结果</h3>
        <p class="scheme-info">评分方案: {{ scoreData.scoringScheme }}</p>
      </div>

      <!-- 控制面板 -->
      <div class="controls-panel">
        <div class="filter-controls">
          <label>筛选评委类型:</label>
          <select v-model="filterJudgeType">
            <option value="all">全部</option>
            <option value="normal">正常评分</option>
            <option value="backup">预备评委</option>
            <option value="collaborative">协商评分</option>
            <option value="revoked">撤销评分</option>
          </select>
        </div>
        
        <div class="sort-controls">
          <label>排序方式:</label>
          <select v-model="sortBy">
            <option value="player">按选手</option>
            <option value="judge">按评委</option>
            <option value="total">按总分</option>
            <option value="average">按平均分</option>
          </select>
          <select v-model="sortOrder">
            <option value="asc">升序</option>
            <option value="desc">降序</option>
          </select>
        </div>
          <div class="search-controls">
          <label>搜索选手:</label>
          <input 
            type="text" 
            v-model="searchPlayer" 
            placeholder="输入选手名称..."
          />
        </div>
        
        <div class="export-controls">
          <button @click="exportToCSV" class="export-btn">
            导出CSV
          </button>
          <button @click="exportToJSON" class="export-btn">
            导出JSON
          </button>
        </div>
      </div>

      <!-- 详细评分表 -->
      <div class="detailed-scores">
        <h4>详细评分 ({{ filteredDetailRecords.length }} 条记录)</h4>
        
        <!-- 分页控制 -->
        <div class="pagination-controls" v-if="totalPages > 1">
          <button 
            @click="currentPage = Math.max(1, currentPage - 1)"
            :disabled="currentPage === 1"
            class="page-btn"
          >
            上一页
          </button>
          <span class="page-info">
            第 {{ currentPage }} / {{ totalPages }} 页
          </span>
          <button 
            @click="currentPage = Math.min(totalPages, currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="page-btn"
          >
            下一页
          </button>
          <select v-model="pageSize" class="page-size-select">
            <option :value="25">25条/页</option>
            <option :value="50">50条/页</option>
            <option :value="100">100条/页</option>
          </select>
        </div>

        <div class="table-wrapper">
          <table class="score-table">
            <thead>
              <tr>
                <th>选手</th>
                <th>评委</th>
                <th v-for="column in scoreData.columns" :key="column">{{ column }}</th>
                <th>总分</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="record in paginatedDetailRecords" 
                :key="`${record.playerCode}-${record.judgeCode}`"
                :class="{ 'revoked-score': record.isRevoked }"
              >
                <td class="player-name">{{ record.playerName }}</td>                <td class="judge-name">
                  {{ record.judgeName }}
                  <span v-if="record.isCollaborative" class="collaborative-tag">协商</span>
                  <span v-if="record.isBackup && record.judgeName.includes('重评')" class="re-evaluation-tag">重评</span>
                  <span v-else-if="record.isBackup" class="backup-tag">预备</span>
                </td>
                <td 
                  v-for="column in scoreData.columns" 
                  :key="column"
                  class="score-cell"
                >
                  {{ formatScore(record.scores[column]) }}
                </td>
                <td class="total-score">{{ record.totalScore }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>      <!-- 选手总分表 -->
      <div class="player-totals">
        <h4>选手总分 ({{ filteredPlayerScores.length }} 名选手)</h4>
        <div class="table-wrapper">
          <table class="total-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>选手</th>
                <th>有效评分次数</th>
                <th>总分之和</th>
                <th>平均分</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(player, index) in filteredPlayerScores" :key="player.playerCode">
                <td class="rank">{{ index + 1 }}</td>
                <td class="player-name">{{ player.playerName }}</td>
                <td class="count">{{ player.validRecordsCount }}</td>
                <td class="sum">{{ player.totalSum }}</td>
                <td class="average">{{ player.averageScore }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { loadRoundScoreData, type RoundScoreData } from '../utils/scoreCalculator'
import { fetchMarioWorkerYaml, extractSeasonData } from '../utils/yamlLoader'

const props = defineProps<{
  year: string
  round: string
}>()

// 控制状态
const sortBy = ref<'player' | 'judge' | 'total' | 'average'>('average')
const sortOrder = ref<'asc' | 'desc'>('desc')
const filterJudgeType = ref<'all' | 'normal' | 'backup' | 'collaborative' | 'revoked'>('all')
const searchPlayer = ref('')

const scoreData = ref<RoundScoreData | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

// 筛选详细评分记录
const filteredDetailRecords = computed(() => {
  if (!scoreData.value) return []
  
  let records = scoreData.value.allRecords
  
  // 按评委类型筛选
  if (filterJudgeType.value !== 'all') {
    records = records.filter(record => {
      switch (filterJudgeType.value) {
        case 'normal':
          return !record.isRevoked && !record.isBackup && !record.isCollaborative
        case 'backup':
          return record.isBackup && !record.isRevoked
        case 'collaborative':
          return record.isCollaborative && !record.isRevoked
        case 'revoked':
          return record.isRevoked
        default:
          return true
      }
    })
  }
  
  // 按选手名称搜索
  if (searchPlayer.value.trim()) {
    const searchTerm = searchPlayer.value.trim().toLowerCase()
    records = records.filter(record => 
      record.playerName.toLowerCase().includes(searchTerm) ||
      record.playerCode.toLowerCase().includes(searchTerm)
    )
  }
  
  // 排序
  records.sort((a, b) => {
    let compareValue = 0
    
    switch (sortBy.value) {
      case 'player':
        compareValue = a.playerName.localeCompare(b.playerName, 'zh-CN')
        break
      case 'judge':
        compareValue = a.judgeName.localeCompare(b.judgeName, 'zh-CN')
        break
      case 'total':
        compareValue = (a.totalScore || 0) - (b.totalScore || 0)
        break
      case 'average':
        compareValue = (a.totalScore || 0) - (b.totalScore || 0)
        break
    }
    
    return sortOrder.value === 'asc' ? compareValue : -compareValue
  })
  
  return records
})

// 分页功能
const pageSize = ref(50)
const currentPage = ref(1)

const paginatedDetailRecords = computed(() => {
  const startIndex = (currentPage.value - 1) * pageSize.value
  const endIndex = startIndex + pageSize.value
  return filteredDetailRecords.value.slice(startIndex, endIndex)
})

const totalPages = computed(() => {
  return Math.ceil(filteredDetailRecords.value.length / pageSize.value)
})

// 重置分页当筛选条件改变时
watch([filterJudgeType, searchPlayer, sortBy, sortOrder], () => {
  currentPage.value = 1
})

// 分页大小变化时重置到第一页
watch(pageSize, () => {
  currentPage.value = 1
})

// 筛选选手总分
const filteredPlayerScores = computed(() => {
  if (!scoreData.value) return []
  
  let players = scoreData.value.playerScores
  
  // 按选手名称搜索
  if (searchPlayer.value.trim()) {
    const searchTerm = searchPlayer.value.trim().toLowerCase()
    players = players.filter(player => 
      player.playerName.toLowerCase().includes(searchTerm) ||
      player.playerCode.toLowerCase().includes(searchTerm)
    )
  }
  
  // 排序
  players.sort((a, b) => {
    let compareValue = 0
    
    switch (sortBy.value) {
      case 'player':
        compareValue = a.playerName.localeCompare(b.playerName, 'zh-CN')
        break
      case 'total':
        compareValue = a.totalSum - b.totalSum
        break
      case 'average':
        compareValue = a.averageScore - b.averageScore
        break
      default:
        compareValue = a.averageScore - b.averageScore
    }
    
    return sortOrder.value === 'asc' ? compareValue : -compareValue
  })
  
  return players
})

async function loadScoreData() {
  if (!props.year || !props.round) {
    return
  }
  
  loading.value = true
  error.value = null
  
  try {    // 加载YAML数据
    const yamlDoc = await fetchMarioWorkerYaml()
    const seasonData = extractSeasonData(yamlDoc)
    
    // 加载评分数据
    const data = await loadRoundScoreData(props.year, props.round, { season: seasonData })
    scoreData.value = data
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
    console.error('加载评分数据失败:', err)
  } finally {
    loading.value = false
  }
}

function formatScore(score: number | undefined): string {
  if (score === undefined || score === null) {
    return '-'
  }
  return score.toString()
}

// 导出功能
function exportToCSV() {
  if (!scoreData.value) return
  
  const filename = `${scoreData.value.year}${scoreData.value.round}_评分数据.csv`
  
  // 创建CSV内容
  let csvContent = '\uFEFF' // BOM for UTF-8
  
  // 详细评分表头
  csvContent += '选手代码,选手姓名,评委代码,评委姓名'
  for (const column of scoreData.value.columns) {
    csvContent += `,${column}`
  }
  csvContent += ',总分,状态\n'
  
  // 详细评分数据
  for (const record of filteredDetailRecords.value) {
    const status = []
    if (record.isRevoked) status.push('撤销')
    if (record.isBackup) status.push('预备')
    if (record.isCollaborative) status.push('协商')
    
    csvContent += `${record.playerCode},${record.playerName},${record.judgeCode},${record.judgeName}`
    for (const column of scoreData.value.columns) {
      csvContent += `,${formatScore(record.scores[column])}`
    }
    csvContent += `,${record.totalScore},"${status.join('|')}"\n`
  }
  
  // 空行分隔
  csvContent += '\n'
  
  // 选手总分表头
  csvContent += '排名,选手代码,选手姓名,有效评分次数,总分之和,平均分\n'
  
  // 选手总分数据
  filteredPlayerScores.value.forEach((player, index) => {
    csvContent += `${index + 1},${player.playerCode},${player.playerName},${player.validRecordsCount},${player.totalSum},${player.averageScore}\n`
  })
  
  downloadFile(csvContent, filename, 'text/csv')
}

function exportToJSON() {
  if (!scoreData.value) return
  
  const filename = `${scoreData.value.year}${scoreData.value.round}_评分数据.json`
  
  const exportData = {
    metadata: {
      year: scoreData.value.year,
      round: scoreData.value.round,
      scoringScheme: scoreData.value.scoringScheme,
      exportTime: new Date().toISOString(),
      totalRecords: filteredDetailRecords.value.length,
      totalPlayers: filteredPlayerScores.value.length
    },
    columns: scoreData.value.columns,
    detailRecords: filteredDetailRecords.value,
    playerScores: filteredPlayerScores.value
  }
  
  const jsonContent = JSON.stringify(exportData, null, 2)
  downloadFile(jsonContent, filename, 'application/json')
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}

// 监听props变化
watch(() => [props.year, props.round], loadScoreData, { immediate: true })

onMounted(() => {
  loadScoreData()
})
</script>

<style scoped>
.score-table-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.loading, .error {
  text-align: center;
  padding: 40px;
  font-size: 16px;
}

.error {
  color: #e74c3c;
  background-color: #ffeaea;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
}

.score-header {
  margin-bottom: 30px;
  text-align: center;
}

.score-header h3 {
  margin: 0 0 10px 0;
  color: #2c3e50;
  font-size: 24px;
}

.scheme-info {
  margin: 0;
  color: #7f8c8d;
  font-size: 14px;
}

/* 控制面板样式 */
.controls-panel {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 30px;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
}

.filter-controls, .sort-controls, .search-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.controls-panel label {
  font-weight: 500;
  color: #495057;
  white-space: nowrap;
}

.controls-panel select, .controls-panel input {
  padding: 6px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
  background: white;
}

.controls-panel select:focus, .controls-panel input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.search-controls input {
  width: 200px;
}

.export-controls {
  display: flex;
  gap: 10px;
}

.export-btn {
  padding: 8px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.export-btn:hover {
  background: #2980b9;
}

.export-btn:active {
  background: #21618c;
}

/* 分页控制样式 */
.pagination-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  margin-bottom: 15px;
  padding: 15px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
}

.page-btn {
  padding: 8px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #2980b9;
}

.page-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.page-info {
  font-weight: 500;
  color: #495057;
  font-size: 14px;
}

.page-size-select {
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
  background: white;
}

@media (max-width: 768px) {
  .controls-panel {
    flex-direction: column;
    align-items: stretch;
    gap: 15px;
  }
  
  .filter-controls, .sort-controls, .search-controls {
    justify-content: space-between;
  }
  
  .search-controls input {
    width: 100%;
  }
  
  .export-controls {
    justify-content: center;
  }
  
  .export-btn {
    flex: 1;
    max-width: 120px;
  }
  
  .table-wrapper {
    font-size: 14px;
  }
  
  .score-table th, .score-table td,
  .total-table th, .total-table td {
    padding: 8px 6px;
  }
  
  .judge-name {
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .score-cell {
    text-align: center;
    min-width: 50px;
  }
  
  .pagination-controls {
    flex-wrap: wrap;
    gap: 10px;
  }
  
  .page-btn {
    font-size: 12px;
    padding: 6px 12px;
  }
}

.detailed-scores, .player-totals {
  margin-bottom: 40px;
}

.detailed-scores h4, .player-totals h4 {
  margin: 0 0 15px 0;
  color: #34495e;
  font-size: 18px;
  border-bottom: 2px solid #3498db;
  padding-bottom: 5px;
}

.table-wrapper {
  overflow-x: auto;
  border: 1px solid #ddd;
  border-radius: 6px;
}

.score-table, .total-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.score-table th, .score-table td,
.total-table th, .total-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.score-table th, .total-table th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #495057;
  border-bottom: 2px solid #dee2e6;
}

.player-name {
  font-weight: 500;
  color: #2c3e50;
}

.judge-name {
  color: #34495e;
  position: relative;
}

.collaborative-tag {
  display: inline-block;
  background-color: #17a2b8;
  color: white;
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 3px;
  margin-left: 5px;
}

.re-evaluation-tag {
  display: inline-block;
  background-color: #dc3545;
  color: white;
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 3px;
  margin-left: 5px;
}

.backup-tag {
  display: inline-block;
  background-color: #6c757d;
  color: white;
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 3px;
  margin-left: 5px;
}

.score-cell {
  text-align: center;
  font-family: 'Courier New', monospace;
}

.total-score {
  font-weight: 600;
  color: #e74c3c;
  text-align: center;
}

.revoked-score {
  background-color: #f8d7da;
  opacity: 0.7;
  text-decoration: line-through;
}

.rank {
  text-align: center;
  font-weight: 600;
  color: #495057;
}

.count, .sum, .average {
  text-align: center;
  font-family: 'Courier New', monospace;
}

.average {
  font-weight: 600;
  color: #e74c3c;
  font-size: 16px;
}

/* 排名前三的特殊样式 */
.total-table tbody tr:nth-child(1) .rank {
  color: #f39c12;
  font-size: 18px;
}

.total-table tbody tr:nth-child(2) .rank {
  color: #95a5a6;
  font-size: 16px;
}

.total-table tbody tr:nth-child(3) .rank {
  color: #e67e22;
  font-size: 16px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .score-table-container {
    padding: 10px;
  }
  
  .score-table th, .score-table td,
  .total-table th, .total-table td {
    padding: 8px 6px;
    font-size: 14px;
  }
  
  .score-header h3 {
    font-size: 20px;
  }
}
</style>
