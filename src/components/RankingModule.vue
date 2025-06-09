<!-- 排名模块主组件 -->
<template>
  <div class="content-panel animate-fadeInUp">
    <div class="ranking-tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab.key"
        class="ranking-tab-btn btn-base"
        :class="{ 'btn-primary': activeTab === tab.key, 'btn-secondary': activeTab !== tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>
    <!-- 过滤器 -->
    <div class="filters">
      <div class="form-group">
        <label class="form-label">搜索选手名：</label>
        <input 
          v-model="filters.searchPlayer" 
          type="text" 
          placeholder="输入选手名..."
          class="form-control hover-scale"
          @input="handleFilterChange"
        />
      </div>
      
      <div class="form-group">
        <label class="form-label">搜索关卡名：</label>
        <input 
          v-model="filters.searchLevel" 
          type="text" 
          :placeholder="'输入关卡名...'"
          class="form-control hover-scale"
          @input="handleFilterChange"
        />
      </div>
      
      <div class="form-group">
        <label class="form-label">筛选届次：</label>
        <select v-model="filters.selectedYear" class="form-control hover-scale" @change="handleFilterChange">
          <option value="">全部届次</option>
          <option v-for="year in availableYearsFiltered" :key="year" :value="year.toString()">
            {{ getEditionString(year) }}
          </option>
        </select>
      </div>
      
      <div class="form-group scoring-scheme-filters">
        <label class="form-label">筛选：</label>
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="filters.scoringSchemes.A" @change="handleFilterChange">
            <span class="checkbox-text">2009 标准</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="filters.scoringSchemes.B" @change="handleFilterChange">
            <span class="checkbox-text">2014 标准</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="filters.scoringSchemes.C" @change="handleFilterChange">
            <span class="checkbox-text">2020 标准</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="filters.scoringSchemes.D" @change="handleFilterChange">
            <span class="checkbox-text">2023 大众评分标准</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="filters.scoringSchemes.E" @change="handleFilterChange">
            <span class="checkbox-text">2025 大众评分标准</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="filters.onlyHighScore" @change="handleFilterChange">
            <span class="checkbox-text">仅显示得分率高于 87%</span>
          </label>
        </div>
      </div>
      <p class="scoring-note">注：榜单不含 2012 年关卡；由于 2025 年新大众评分方案不兼容，原始得分率榜单暂时剔除了使用新方案评分的关卡。</p>
    </div>
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state animate-pulse">
      <div class="loading-spinner"></div>
      <div class="loading-text">正在加载排名数据<span class="loading-dots"></span></div>
    </div>

    <!-- 错误状态 -->
    <div v-if="error" class="error-state">
      {{ error }}
    </div>

    <!-- 排名表格 -->
    <div v-if="!loading && !error">
      <!-- 单关排名 -->
      <div v-if="activeTab === 'single'" class="animate-fadeInUp">
      <div class="section-header">
        <h3>单关排名 ({{ filteredSingleLevelRanking.length }} 条记录)</h3>
      </div>
        <div class="table-wrapper">
          <table class="table-base ranking-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>关卡名</th>
                <th>作者</th>
                <th>最终得分</th>
                <th>届次</th>
                <th>轮次</th>
                <th>满分</th>
                <th>得分率</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredSingleLevelRanking" :key="`${item.year}-${item.roundKey}-${item.playerCode}`">
                <td :class="getRankClass(item.rank)">{{ item.rank }}</td>
                <td>{{ item.levelName }}</td>
                <td>{{ item.author }}</td>
                <td>{{ formatScore(item.finalScore) }}</td>
                <td>{{ item.edition }}</td>
                <td>{{ item.round }}</td>
                <td>{{ item.maxScore }}</td>
                <td class="score-rate">{{ item.scoreRate.toFixed(3) }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <!-- 多关排名 -->
      <div v-if="activeTab === 'multi'" class="animate-fadeInUp">
      <div class="section-header">
        <h3>多关排名 ({{ filteredMultiLevelRanking.length }} 条记录)</h3>
      </div>
        <div class="table-wrapper">
          <table class="table-base ranking-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>关卡名</th>
                <th>作者</th>
                <th>最终得分</th>
                <th>届次</th>
                <th>轮次</th>
                <th>满分</th>
                <th>得分率</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredMultiLevelRanking" :key="`${item.year}-${item.roundKey}-${item.playerCode}`">
                <td :class="getRankClass(item.rank)">{{ item.rank }}</td>
                <td>{{ item.levelName }}</td>
                <td>{{ item.author }}</td>
                <td>{{ formatScore(item.finalScore) }}</td>
                <td>{{ item.edition }}</td>
                <td>{{ item.round }}</td>
                <td>{{ item.maxScore }}</td>
                <td class="score-rate">{{ item.scoreRate.toFixed(3) }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <!-- 原始得分率排名 -->
      <div v-if="activeTab === 'original'" class="animate-fadeInUp">
      <div class="section-header">
        <h3>原始得分率排名 ({{ filteredOriginalScoreRanking.length }} 条记录)</h3>
      </div>
        <div class="table-wrapper">
          <table class="table-base ranking-table">
            <thead>
              <tr>
                <th>原始分排名</th>
                <th>得分率排名</th>
                <th>排名升降</th>
                <th>关卡名</th>
                <th>作者</th>
                <th>最终得分</th>
                <th>届次</th>
                <th>轮次</th>
                <th>满分</th>
                <th>得分率</th>
                <th>原始分</th>
                <th>上升/下降</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredOriginalScoreRanking.slice().sort((a, b) => a.originalRank - b.originalRank)" :key="`${item.year}-${item.roundKey}-${item.playerCode}`">
                <td :class="getRankClass(item.originalRank)">{{ item.originalRank }}</td>
                <td :class="getRankClass(item.scoreRateRank)">{{ item.scoreRateRank }}</td>
                <td :class="getRankChangeClass(item.rankChange)">
                  {{ formatRankChange(item.rankChange) }}
                </td>
                <td>{{ item.levelName }}</td>
                <td>{{ item.author }}</td>
                <td>{{ formatScore(item.finalScore) }}</td>
                <td>{{ item.edition }}</td>
                <td>{{ item.round }}</td>
                <td>{{ item.maxScore }}</td>
                <td class="score-rate">{{ item.scoreRate.toFixed(3) }}%</td>
                <td>{{ formatScore(item.originalScore) }}</td>
                <td :class="getScoreChangeClass(item.changeType)">
                  {{ formatScoreChange(item.scoreChange, item.changeType) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import type { 
  LevelRankingItem, 
  MultiLevelRankingItem, 
  OriginalScoreRankingItem,
  RankingFilters 
} from '../types/ranking'
import { Decimal } from 'decimal.js'
import { 
  calculateSingleLevelRanking,
  calculateMultiLevelRanking,
  calculateOriginalScoreRanking,
  getAvailableYears
} from '../utils/rankingCalculator'

// 响应式状态
const activeTab = ref<'single' | 'multi' | 'original'>('single')
const loading = ref(false)
const error = ref<string | null>(null)

const singleLevelRanking = ref<LevelRankingItem[]>([])
const multiLevelRanking = ref<MultiLevelRankingItem[]>([])
const originalScoreRanking = ref<OriginalScoreRankingItem[]>([])
const availableYears = ref<number[]>([])

// 过滤器
const filters = reactive<RankingFilters>({
  searchPlayer: '',
  searchLevel: '',
  selectedYear: '',
  scoringSchemes: {
    A: true,
    B: true,
    C: true,
    D: true,
    E: true
  },
  onlyHighScore: true
})

// 标签页配置
const tabs = [
  { key: 'single' as const, label: '单关排名' },
  { key: 'multi' as const, label: '多关排名' },
  { key: 'original' as const, label: '原始得分率排名' }
]

// 并列排名算法，支持动态字段赋值
function assignRankingWithTies<T extends Record<string, any>>(items: T[], rankField: string = 'rank') {
  let lastScore = null
  let lastRank = 0
  let skip = 0
  for (let i = 0; i < items.length; i++) {
    const currScore = Number(items[i].scoreRate)
    if (lastScore !== null && Math.abs(currScore - lastScore) < 1e-6) {
      (items[i] as any)[rankField] = lastRank
      skip++
    } else {
      (items[i] as any)[rankField] = lastRank + 1 + skip
      lastRank = (items[i] as any)[rankField]
      skip = 0
    }
    lastScore = currScore
  }
}

// 计算属性：过滤后的数据
const filteredSingleLevelRanking = computed(() => {
  const arr = applySingleLevelFilters(singleLevelRanking.value, filters)
  assignRankingWithTies(arr, 'rank')
  return arr
})

const filteredMultiLevelRanking = computed(() => {
  const arr = applyMultiLevelFilters(multiLevelRanking.value, filters)
  assignRankingWithTies(arr, 'rank')
  return arr
})

const filteredOriginalScoreRanking = computed(() => {
  const arr = applyOriginalScoreFilters(originalScoreRanking.value, filters)
  // 原始分排名
  arr.sort((a, b) => b.originalScoreRate - a.originalScoreRate)
  assignRankingWithTies(arr, 'originalRank')
  // 得分率排名
  arr.sort((a, b) => b.scoreRate - a.scoreRate)
  assignRankingWithTies(arr, 'scoreRateRank')
  return arr
})

// 初始化
onMounted(async () => {
  await loadInitialData()
})

// 加载初始数据
async function loadInitialData() {
  try {
    loading.value = true
    error.value = null
    
    console.log('开始加载排名数据...')
    
    // 并行加载所有数据
    const [years, singleData, multiData, originalData] = await Promise.all([
      getAvailableYears(),
      calculateSingleLevelRanking(),
      calculateMultiLevelRanking(),
      calculateOriginalScoreRanking()
    ])
    
    console.log('数据加载完成:', {
      years: years.length,
      singleData: singleData.length,
      multiData: multiData.length,
      originalData: originalData.length
    })
    
    availableYears.value = years
    singleLevelRanking.value = singleData
    multiLevelRanking.value = multiData
    originalScoreRanking.value = originalData
    
    // 如果没有数据，显示提示信息
    if (singleData.length === 0 && multiData.length === 0 && originalData.length === 0) {
      error.value = '暂无排名数据，请确保数据文件已正确加载'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载数据时发生未知错误'
    console.error('Failed to load ranking data:', err)
  } finally {
    loading.value = false
  }
}

// 处理过滤器变化
function handleFilterChange() {
  // 过滤器变化时，计算属性会自动重新计算
}

// 获取届次字符串
function getEditionString(year: number): string {
  const editionMap: { [key: number]: string } = {
    2012: '2012年第一届',
    2013: '2013年第二届',
    2014: '2014年第三届',
    2015: '2015年第四届',
    2016: '2016年第五届',
    2017: '2017年第六届',
    2018: '2018年第七届',
    2019: '2019年第八届',
    2020: '2020年第九届',
    2021: '2021年第十届',
    2022: '2022年第十一届',
    2023: '2023年第十二届',
    2024: '2024年第十三届',
    2025: '2025年第十四届'
  }
  return editionMap[year] || `${year}年`
}

// 可用届次（移除2012）
const availableYearsFiltered = computed(() => availableYears.value.filter(y => y !== 2012))

// 过滤器函数
function applySingleLevelFilters(items: LevelRankingItem[], filters: RankingFilters): LevelRankingItem[] {
  let filtered = items
  // 剔除2012年关卡
  filtered = filtered.filter(item => item.year !== 2012)
  
  if (filters.searchPlayer) {
    const searchTerm = filters.searchPlayer.toLowerCase()
    filtered = filtered.filter(item => 
      item.author.toLowerCase().includes(searchTerm)
    )
  }
  
  if (filters.searchLevel) {
    const searchTerm = filters.searchLevel.toLowerCase()
    filtered = filtered.filter(item => 
      item.levelName.toLowerCase().includes(searchTerm)
    )
  }
  
  if (filters.selectedYear) {
    filtered = filtered.filter(item => 
      item.year.toString() === filters.selectedYear
    )
  }
  
  // 评分方案筛选
  if (filters.scoringSchemes) {
    const enabledSchemes = Object.entries(filters.scoringSchemes)
      .filter(([_, enabled]) => enabled)
      .map(([scheme]) => scheme)
    if (enabledSchemes.length > 0) {
      filtered = filtered.filter(item => enabledSchemes.includes(item.scoringScheme))
    }
  }

  // 仅显示得分率高于87%
  if (filters.onlyHighScore) {
    filtered = filtered.filter(item => item.scoreRate > 87)
  }
  
  return filtered
}

function applyMultiLevelFilters(items: MultiLevelRankingItem[], filters: RankingFilters): MultiLevelRankingItem[] {
  let filtered = items
  // 剔除2012年关卡
  filtered = filtered.filter(item => item.year !== 2012)
  
  if (filters.searchPlayer) {
    const searchTerm = filters.searchPlayer.toLowerCase()
    filtered = filtered.filter(item => 
      item.author.toLowerCase().includes(searchTerm)
    )
  }
  
  if (filters.searchLevel) {
    const searchTerm = filters.searchLevel.toLowerCase()
    filtered = filtered.filter(item => 
      item.levelName.toLowerCase().includes(searchTerm)
    )
  }
  
  if (filters.selectedYear) {
    filtered = filtered.filter(item => 
      item.year.toString() === filters.selectedYear
    )
  }
  
  // 评分方案筛选
  if (filters.scoringSchemes) {
    const enabledSchemes = Object.entries(filters.scoringSchemes)
      .filter(([_, enabled]) => enabled)
      .map(([scheme]) => scheme)
    if (enabledSchemes.length > 0) {
      filtered = filtered.filter(item => enabledSchemes.includes(item.scoringScheme))
    }
  }

  // 仅显示得分率高于87%
  if (filters.onlyHighScore) {
    filtered = filtered.filter(item => item.scoreRate > 87)
  }
  
  return filtered
}

function applyOriginalScoreFilters(items: OriginalScoreRankingItem[], filters: RankingFilters): OriginalScoreRankingItem[] {
  let filtered = items
  // 剔除2012年关卡和评分方案为E的关卡
  filtered = filtered.filter(item => item.year !== 2012 && item.scoringScheme !== 'E')
  
  if (filters.searchPlayer) {
    const searchTerm = filters.searchPlayer.toLowerCase()
    filtered = filtered.filter(item => 
      item.author.toLowerCase().includes(searchTerm)
    )
  }
  
  if (filters.searchLevel) {
    const searchTerm = filters.searchLevel.toLowerCase()
    filtered = filtered.filter(item => 
      item.levelName.toLowerCase().includes(searchTerm)
    )
  }
  
  if (filters.selectedYear) {
    filtered = filtered.filter(item => 
      item.year.toString() === filters.selectedYear
    )
  }
  
  // 评分方案筛选
  if (filters.scoringSchemes) {
    const enabledSchemes = Object.entries(filters.scoringSchemes)
      .filter(([_, enabled]) => enabled)
      .map(([scheme]) => scheme)
    if (enabledSchemes.length > 0) {
      filtered = filtered.filter(item => enabledSchemes.includes(item.scoringScheme))
    }
  }

  // 仅显示得分率高于87%
  if (filters.onlyHighScore) {
    filtered = filtered.filter(item => item.scoreRate > 87)
  }
  
  return filtered
}

// 格式化排名变化
function formatRankChange(change: number): string {
  if (change === 0) return '-'
  if (change > 0) return `↓${change}`
  return `↑${Math.abs(change)}`
}

// 获取排名变化的CSS类
function getRankChangeClass(change: number): string {
  if (change > 0) return 'rank-down'
  if (change < 0) return 'rank-up'
  return 'rank-same'
}

// 格式化得分变化
function formatScoreChange(change: number, type: 'up' | 'down' | 'same'): string {
  if (type === 'same') return '-'
  const prefix = type === 'up' ? '↑' : '↓'
  return `${prefix}${change.toFixed(3)}`
}

// 获取得分变化的CSS类
function getScoreChangeClass(type: 'up' | 'down' | 'same'): string {
  return `score-${type}`
}

// 获取排名样式类
function getRankClass(rank: number): string {
  if (rank === 1) return 'rank-first'
  if (rank === 2) return 'rank-second'
  if (rank === 3) return 'rank-third'
  return ''
}

// 格式化最终得分和原始分，整数则不显示小数点后部分
function formatScore(score: number): string {
  const decimal = new Decimal(score)
  const formattedScore = decimal.toFixed(1)
  if (formattedScore.endsWith('.0')) {
    return decimal.toFixed(0)
  }
  return formattedScore
}
</script>

<style scoped>
.ranking-header {
  margin-bottom: var(--spacing-lg);
}

.ranking-tabs {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
  flex-wrap: wrap;
}

/* 使用components.css中定义的全局按钮样式，只添加一些额外的特定调整 */
.ranking-tab-btn {
  min-width: 100px;
}

.filters {
  background: var(--bg-panel);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-large);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  display: flex;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
  backdrop-filter: var(--blur-medium);
  box-shadow: var(--shadow-light);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 200px;
}

.filter-group label {
  font-weight: 500;
  color: var(--text-secondary);
  font-size: 14px;
}

.filter-group input,
.filter-group select {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 2px solid var(--border-medium);
  border-radius: var(--radius-medium);
  font-size: 14px;
  background: var(--bg-input);
  color: var(--text-primary);
  transition: var(--transition-normal);
  backdrop-filter: var(--blur-light);
}

.filter-group input:focus,
.filter-group select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(255, 99, 71, 0.2);
}

.filter-group input:hover:not(:focus),
.filter-group select:hover:not(:focus) {
  border-color: var(--primary-hover);
}

thead {
  background: linear-gradient(135deg, rgba(255, 220, 200, 0.9), rgba(255, 200, 180, 0.8));
}

th,
td {
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: center;
  border-bottom: 1px solid #eee;
  vertical-align: middle;
}

th {
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 2px solid var(--border-strong);
  position: sticky;
  top: 0;
  z-index: 10;
}

tbody tr {
  transition: var(--transition-fast);
}

tbody tr:hover {
  background: rgba(255, 235, 220, 0.7);
}

tbody tr:nth-child(even) {
  background: rgba(255, 248, 240, 0.5);
}

tbody tr:nth-child(even):hover {
  background: rgba(255, 230, 210, 0.8);
}

/* 排名列特殊样式 */
td:first-child {
  font-weight: 600;
  color: var(--text-primary);
  background: linear-gradient(135deg, rgba(255, 235, 220, 0.8), rgba(255, 220, 200, 0.6));
}

/* 前三名特殊样式 - 基于实际排名 */
.rank-first {
  background: linear-gradient(135deg, #f1c40f 0%, #f39c12 100%) !important;
  color: white !important;
  font-weight: 700 !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3) !important;
}

.rank-second {
  background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%) !important;
  color: white !important;
  font-weight: 700 !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3) !important;
}

.rank-third {
  background: linear-gradient(135deg, #e67e22 0%, #d35400 100%) !important;
  color: white !important;
  font-weight: 700 !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3) !important;
}

.score-rate {
  font-weight: 600;
  color: var(--primary-color);
}

.rank-up {
  color: #27ae60;
  font-weight: 600;
}

.rank-down {
  color: #e74c3c;
  font-weight: 600;
}

.rank-same {
  color: var(--text-muted);
}

.score-up {
  color: #27ae60;
  font-weight: 600;
}

.score-down {
  color: #e74c3c;
  font-weight: 600;
}

.score-same {
  color: var(--text-muted);
}

/* 复选框组样式 */
.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-top: 4px;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-medium);
  background: var(--bg-panel-light);
  border: 1px solid var(--border-light);
  transition: var(--transition-fast);
}

.checkbox-label:hover {
  background: var(--bg-panel-hover);
  border-color: var(--border-medium);
}

.checkbox-label input[type="checkbox"] {
  margin-right: 6px;
  accent-color: var(--primary-color);
}

.checkbox-text {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.scoring-scheme-filters {
  width: 100%;
  margin-top: var(--spacing-sm);
}

.ranking-table {
  width: 100%;
  border-collapse: collapse;
  background: rgba(255, 252, 248, 0.9);
  backdrop-filter: blur(8px);
}

.scoring-note {
  color: #e74c3c;
  font-size: 14px;
}

@media (min-width: 768px) {
  .table-wrapper {
    display: flex;
    justify-content: center;
    width: 100%;
  }
}

/* 响应式设计 */
@media (max-width: 1200px) {
  table {
    font-size: 13px;
  }
  
  th,
  td {
    padding: 6px 8px;
  }
}

@media (max-width: 768px) {
  .filters {
    flex-direction: column;
    gap: var(--spacing-md);
  }
  
  .filter-group {
    min-width: 100%;
  }
  
  .ranking-tabs {
    flex-direction: column;
    width: 100%;
  }
  
  .ranking-tab-btn {
    width: 100%;
    text-align: center;
    margin: 3px 0;
  }
  
  table {
    font-size: 12px;
  }
  
  th,
  td {
    padding: 4px 6px;
  }
  
  table {
    min-width: 800px;
  }
}
</style>
