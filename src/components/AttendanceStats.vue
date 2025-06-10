<template>
  <div class="attendance-stats animate-fadeInUp">
    <div class="page-header animate-fadeInDown">
      <div class="control-panel">
        <div class="form-group">
          <label class="form-label">选择届次</label>
          <select v-model="selectedYear" class="form-control hover-scale">
            <option value="">全部届次</option>
            <option v-for="option in availableEditionOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">排序方式</label>
          <select v-model="sortBy" class="form-control hover-scale">
            <option value="year">按年份排序</option>
            <option value="attendanceRate">按出勤率排序</option>
            <option value="totalPlayers">按参赛人数排序</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-state animate-pulse">
      <div class="loading-spinner"></div>
      <div class="loading-text">正在分析出勤率数据<span class="loading-dots">...</span></div>
    </div>

    <div v-else-if="error" class="error-state animate-shake">
      <p>{{ error }}</p>
      <button @click="refreshData" class="btn-secondary hover-scale">重试</button>
    </div>

    <div v-else class="content-panel animate-fadeInUp">
      <!-- 统计概览卡片 -->
      <div class="summary-cards">
        <div class="stat-card hover-lift">
          <h3>平均出勤率</h3>
          <div class="stat-value">{{ averageAttendance.toFixed(1) }}%</div>
          <div class="stat-icon">
            <span :class="averageAttendance >= 80 ? 'trend-up' : 'trend-down'">
              {{ averageAttendance >= 80 ? '📈' : '📉' }}
            </span>
          </div>
        </div>
        <div class="stat-card hover-lift">
          <h3>最高出勤率</h3>
          <div class="stat-value">{{ maxAttendance.toFixed(1) }}%</div>
          <div class="stat-icon">🏆</div>
        </div>
        <div class="stat-card hover-lift">
          <h3>最低出勤率</h3>
          <div class="stat-value">{{ minAttendance.toFixed(1) }}%</div>
          <div class="stat-icon">⚠️</div>
        </div>
      </div>

      <!-- 数据表格 -->
      <div class="section-header">
        <h3>详细出勤数据</h3>
      </div>
      <div class="table-wrapper">
        <table class="table-base attendance-table">
          <thead>
            <tr>
              <th class="year-col">年份</th>
              <th class="round-col">轮次</th>
              <th class="players-col">参赛选手</th>
              <th class="submissions-col">有效上传</th>
              <th class="rate-col">出勤率</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="(item, index) in paginatedData" 
              :key="`${item.year}-${item.round}`" 
              class="attendance-row"
              :style="{ animationDelay: `${index * 0.05}s` }"
            >
              <td class="year-cell">
                <span class="year-badge">{{ item.year }}</span>
              </td>
              <td class="round-cell">
                <span class="round-name">{{ item.roundChineseName }}</span>
              </td>
              <td class="players-count">
                <div class="count-display">
                  <span class="count-number">{{ item.totalPlayers }}</span>
                </div>
              </td>
              <td class="submissions-count">
                <div class="count-display">
                  <span class="count-number">{{ item.validSubmissions }}</span>
                </div>
              </td>
              <td class="attendance-rate">
                <div class="rate-display">
                  <div class="rate-bar">
                    <div 
                      class="rate-fill animate-slideInLeft" 
                      :style="{ width: `${item.attendanceRate}%` }"
                      :class="getAttendanceClass(item.attendanceRate)"
                    ></div>
                  </div>
                  <span class="rate-text">{{ item.attendanceRate.toFixed(1) }}%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页控件 -->
      <div class="pagination-controls animate-fadeInUp">
        <button 
          @click="currentPage = Math.max(1, currentPage - 1)" 
          :disabled="currentPage === 1"
          class="btn-secondary hover-scale"
        >
          ← 上一页
        </button>
        <div class="page-info">
          <span class="current-page">{{ currentPage }}</span>
          <span class="page-separator">/</span>
          <span class="total-pages">{{ totalPages }}</span>
        </div>
        <button 
          @click="currentPage = Math.min(totalPages, currentPage + 1)" 
          :disabled="currentPage === totalPages"
          class="btn-secondary hover-scale"
        >
          下一页 →
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { analyzeAttendanceData } from '../utils/dataAnalyzer'
import { type AttendanceData } from '../utils/userDataProcessor'
import { getEditionOptions } from '../utils/editionHelper'

const attendanceData = ref<AttendanceData[]>([])
const loading = ref(false)
const error = ref('')
const selectedYear = ref('')
const sortBy = ref('year')
const currentPage = ref(1)
const itemsPerPage = 20

// 可用年份
const availableYears = computed(() => {
  const years = [...new Set(attendanceData.value.map(item => item.year))]
  return years.sort((a, b) => b - a) // 新到旧
})

// 可用届次选项
const availableEditionOptions = computed(() => {
  return getEditionOptions(availableYears.value);
})

// 轮次排序顺序
const roundOrder = [
  'P1', 'P2',
  'G1', 'G2', 'G3', 'G4',
  'I1', 'I2', 'I3', 'I4',
  'Q1', 'Q2', 'Q',
  'R1', 'R2', 'R3', 'R',
  'S1', 'S2', 'S',
  'F'
]

// 筛选和排序后的数据
const filteredData = computed(() => {
  let filtered = attendanceData.value

  // 年份筛选
  if (selectedYear.value) {
    filtered = filtered.filter(item => item.year === parseInt(selectedYear.value))
  }

  // 排序
  filtered.sort((a, b) => {
    switch (sortBy.value) {
      case 'year':
        if (a.year !== b.year) return b.year - a.year // 新到旧
        // 同一年份内按轮次顺序排序
        const idxA = roundOrder.indexOf(a.round)
        const idxB = roundOrder.indexOf(b.round)
        if (idxA !== -1 && idxB !== -1) return idxA - idxB
        if (idxA !== -1) return -1
        if (idxB !== -1) return 1
        // 都不在顺序表里，按字母顺序
        return a.round.localeCompare(b.round)
      case 'attendanceRate':
        return b.attendanceRate - a.attendanceRate
      case 'totalPlayers':
        return b.totalPlayers - a.totalPlayers
      default:
        return 0
    }
  })

  return filtered
})

// 分页后的数据
const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredData.value.slice(start, end)
})

// 总页数
const totalPages = computed(() => {
  return Math.ceil(filteredData.value.length / itemsPerPage)
})

// 监听总页数变化，如果当前页数超过最大页数，则调整到最大页数
watch(totalPages, (newTotalPages) => {
  if (currentPage.value > newTotalPages && newTotalPages > 0) {
    currentPage.value = newTotalPages
  }
}, { immediate: true })

// 平均出勤率
const averageAttendance = computed(() => {
  if (filteredData.value.length === 0) return 0
  const total = filteredData.value.reduce((sum, item) => sum + item.attendanceRate, 0)
  return total / filteredData.value.length
})

// 最高出勤率
const maxAttendance = computed(() => {
  if (filteredData.value.length === 0) return 0
  return Math.max(...filteredData.value.map(item => item.attendanceRate))
})

// 最低出勤率
const minAttendance = computed(() => {
  if (filteredData.value.length === 0) return 0
  return Math.min(...filteredData.value.map(item => item.attendanceRate))
})

// 获取出勤率样式类
const getAttendanceClass = (rate: number): string => {
  if (rate >= 90) return 'excellent'
  if (rate >= 75) return 'good'
  if (rate >= 60) return 'average'
  return 'poor'
}

// 刷新数据
const refreshData = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const data = await analyzeAttendanceData()
    attendanceData.value = data
    currentPage.value = 1
  } catch (err) {
    error.value = '加载数据失败: ' + (err instanceof Error ? err.message : '未知错误')  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refreshData()
})

</script>

<style scoped>
/* 使用主题CSS变量和统一样式 */
.attendance-stats {
  padding: var(--spacing-lg);
  max-width: 1400px;
  margin: 0 auto;
  background: var(--bg-primary);
  min-height: 100vh;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.form-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: 500;
}

/* 统计卡片 */

.trend-up {
  color: var(--success-color);
}

.trend-down {
  color: var(--danger-color);
}

.legend-item {
  font-size: 0.8rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.legend-item.excellent { color: var(--success-color); }
.legend-item.good { color: var(--warning-color); }
.legend-item.average { color: var(--info-color); }
.legend-item.poor { color: var(--danger-color); }


.bar-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: space-between;
  padding: var(--spacing-xs);
}

.bar-value {
  color: white;
  font-size: 0.8rem;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

.bar-label {
  position: absolute;
  bottom: -40px;
  font-size: 0.7rem;
  color: var(--text-secondary);
  text-align: center;
  white-space: nowrap;
  line-height: 1.2;
}

.attendance-row:hover {
  background: rgba(255, 235, 220, 0.7) !important;
}

.year-col { width: 80px; }
.round-col { width: 120px; }
.players-col { width: 100px; }
.submissions-col { width: 100px; }
.rate-col { width: 200px; }

.year-badge {
  background: var(--primary-color-light);
  color: var(--primary-color);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-small);
  font-weight: 600;
  font-size: 0.9rem;
}

.round-name {
  color: var(--text-primary);
  font-weight: 500;
}

.count-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.rate-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
}

.rate-bar {
  position: relative;
  background: var(--bg-secondary);
  height: 14px;
  border-radius: var(--radius-medium);
  overflow: hidden;
  width: 160px;
  border: 1px solid var(--border-color);
}

.rate-fill {
  height: 100%;
  border-radius: var(--radius-medium);
  transition: width 0.8s ease;
  animation-fill-mode: both;
}

.rate-fill.excellent {
  background: linear-gradient(to right, #27ae60);
}

.rate-fill.good {
  background: linear-gradient(to right, #5dade2);
}

.rate-fill.average {
  background: linear-gradient(to right, #f1c40f);
}

.rate-fill.poor {
  background: linear-gradient(to right, #ec7063);
}

.rate-text {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
}

.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-lg);
  margin-top: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--bg-card);
  border-radius: var(--radius-large);
  box-shadow: var(--shadow-soft);
}

.pagination-controls button[disabled] {
  display: none;
}

.page-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--text-base);
  color: var(--text-secondary);
}

.current-page {
  font-weight: 600;
  color: var(--primary-color);
}

.page-separator {
  color: var(--text-disabled);
}

.total-pages {
  color: var(--text-secondary);
}

/* 动画关键帧 */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes slideInUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes fadeInUp {
  from {
    transform: translateY(10px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.attendance-table {
  width: 100%;
  border-collapse: collapse;
  background: rgba(255, 252, 248, 0.9);
  backdrop-filter: blur(8px);
}

/* 响应式设计 */

@media (min-width: 768px) {
  .table-wrapper {
    display: flex;
    justify-content: center;
    width: 100%;
  }
}

@media (max-width: 768px) {
  .attendance-table {
    font-size: 12px;
    white-space: nowrap;
  }

  .header {
    flex-direction: column;
    align-items: stretch;
  }

  .filters {
    justify-content: stretch;
  }

  .attendance-stats {
    padding: var(--spacing-md);
  }
  
  .summary-cards {
    grid-template-columns: 1fr;
  }
  
  .stat-card .stat-value {
    font-size: 1.5rem;
  }
  
  .rate-bar {
    display: none;
  }
  
  .pagination-controls {
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .bar-label {
    font-size: 8px;
  }
}
</style>
