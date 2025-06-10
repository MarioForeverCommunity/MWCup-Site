<template>
  <div class="player-records animate-fadeInUp">
    <div class="page-header animate-fadeInDown">
      <div class="control-panel">
        <div class="form-group">
          <label class="form-label">搜索选手</label>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="输入选手名称..."
            class="form-control hover-scale"
          />
        </div>
        <div class="form-group">
          <label class="form-label">排序方式</label>
          <select v-model="sortBy" class="form-control hover-scale">
            <option value="totalLevels">按上传关卡数排序</option>
            <option value="maxScore">按最高得分排序</option>
            <option value="participatedYears">按参赛届数排序</option>
            <option value="bestRank">按最佳名次排序</option>
            <option value="championCount">按冠军次数排序</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-state animate-pulse">
      <div class="loading-spinner"></div>
      <div class="loading-text">正在分析选手战绩数据<span class="loading-dots">...</span></div>
    </div>

    <div v-else-if="error" class="error-state animate-shake">
      <p>{{ error }}</p>
      <button @click="refreshData" class="btn-secondary hover-scale">重试</button>
    </div>

    <div v-else class="content-panel animate-fadeInUp">
      <!-- 统计概览卡片 -->
      <div class="summary-cards">
        <div class="stat-card hover-lift">
          <h3>总选手数</h3>
          <div class="stat-value">{{ filteredRecords.length }}</div>
          <div class="stat-icon">👥</div>
        </div>
        <div class="stat-card hover-lift">
          <h3>活跃选手数</h3>
          <div class="stat-value">{{ activePlayersCount }}</div>
          <div class="stat-icon">⚡</div>
        </div>
        <div class="stat-card hover-lift">
          <h3>平均参赛届数</h3>
          <div class="stat-value">{{ averageParticipation.toFixed(1) }}</div>
          <div class="stat-icon">📊</div>
        </div>
        <div class="stat-card hover-lift">
          <h3>冠军选手数</h3>
          <div class="stat-value">{{ championPlayersCount }}</div>
          <div class="stat-icon">🏆</div>
        </div>
      </div>

      <!-- 选手战绩表格 -->
      <div class="section-header">
        <h3>选手详细战绩</h3>
      </div>
      <div class="table-wrapper">
        <table class="table-base records-table">
          <thead>
            <tr>
              <th class="uid-col">社区UID</th>
              <th class="name-col">用户名</th>
              <th class="years-col">参赛届数</th>
              <th class="levels-col">上传关卡</th>
              <th class="score-col">最高得分</th>
              <th class="rate-col">得分率</th>
              <th class="stage-col">最佳战绩</th>
              <th class="rank-col">最佳名次</th>
              <th class="medal-col">🥇</th>
              <th class="medal-col">🥈</th>
              <th class="medal-col">🥉</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="(record, index) in paginatedRecords" 
              :key="record.userId" 
              class="record-row"
              :style="{ animationDelay: `${index * 0.05}s` }"
            >
              <td class="uid-cell">
                <span class="uid-badge">{{ getCommunityUid(record.userId) }}</span>
              </td>
              <td class="name-cell">
                <div class="player-info">
                  <span class="player-name">{{ getPlayerName(record.userId) }}</span>
                </div>
              </td>
              <td class="years-cell">
                <div class="participation-display">
                  <span class="participation-count">{{ record.participatedYears.length }}届</span>
                  <div class="participation-years">{{ record.participatedYears.join(', ') }}</div>
                </div>
              </td>
              <td class="levels-cell">
                <div class="count-display">
                  <span class="count-number">{{ record.totalLevels }}</span>
                </div>
              </td>
              <td class="score-cell">
                <div class="score-display">
                  <span class="score-value">{{ record.maxScore.toFixed(2) }}</span>
                </div>
              </td>
              <td class="rate-cell">
                <div class="rate-display">
                  <span class="rate-text">{{ record.maxScoreRate.toFixed(1) }}%</span>
                </div>
              </td>
              <td class="stage-cell">
                {{ record.bestStage || '无' }}
              </td>
              <td class="rank-cell">
                {{ record.bestRank > 0 ? `${record.bestRank}` : '无' }}
              </td>
              <td class="medal-cell gold">
                <span class="medal-count">{{ record.championCount || '-' }}</span>
              </td>
              <td class="medal-cell silver">
                <span class="medal-count">{{ record.runnerUpCount || '-' }}</span>
              </td>
              <td class="medal-cell bronze">
                <span class="medal-count">{{ record.thirdPlaceCount || '-' }}</span>
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
import { ref, computed, onMounted } from 'vue'
import { analyzePlayerRecords } from '../utils/dataAnalyzer'
import { loadUserData, type PlayerRecord, type UserData } from '../utils/userDataProcessor'

const records = ref<PlayerRecord[]>([])
const users = ref<UserData[]>([])
const loading = ref(false)
const error = ref('')
const searchQuery = ref('')
const sortBy = ref('totalLevels')
const currentPage = ref(1)
const itemsPerPage = 20

// 筛选和排序后的记录
const filteredRecords = computed(() => {
  let filtered = records.value

  // 搜索过滤
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(record => {
      const playerName = getPlayerName(record.userId).toLowerCase()
      return playerName.includes(query) || record.userId.toString().includes(query)
    })
  }

  // 排序
  filtered.sort((a, b) => {
    switch (sortBy.value) {
      case 'totalLevels':
        return b.totalLevels - a.totalLevels
      case 'maxScore':
        return b.maxScore - a.maxScore
      case 'participatedYears':
        return b.participatedYears.length - a.participatedYears.length
      case 'bestRank':
        if (a.bestRank === 0 && b.bestRank === 0) return 0
        if (a.bestRank === 0) return 1
        if (b.bestRank === 0) return -1
        return a.bestRank - b.bestRank
      case 'championCount':
        return b.championCount - a.championCount
      default:
        return 0
    }
  })

  return filtered
})

// 分页后的记录
const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredRecords.value.slice(start, end)
})

// 总页数
const totalPages = computed(() => {
  return Math.ceil(filteredRecords.value.length / itemsPerPage)
})

// 活跃选手数（参加过3届以上）
const activePlayersCount = computed(() => {
  return records.value.filter(record => record.participatedYears.length >= 3).length
})

// 平均参赛届数
const averageParticipation = computed(() => {
  if (records.value.length === 0) return 0
  const total = records.value.reduce((sum, record) => sum + record.participatedYears.length, 0)
  return total / records.value.length
})

// 冠军选手数
const championPlayersCount = computed(() => {
  return records.value.filter(record => record.championCount > 0).length
})

// 获取选手用户名
const getPlayerName = (userId: number): string => {
  const user = users.value.find(u => u.序号 === userId)
  if (!user) return `用户${userId}`
  
  // 优先显示社区用户名，其次百度用户名
  return user.社区用户名 || user.百度用户名 || `用户${userId}`
}

// 获取社区UID
const getCommunityUid = (userId: number): string => {
  const user = users.value.find(u => u.序号 === userId)
  if (!user || !user.社区UID) return '-'
  return user.社区UID.toString()
}

// 刷新数据
const refreshData = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const [playerRecords, userData] = await Promise.all([
      analyzePlayerRecords(),
      loadUserData()
    ])
    
    records.value = playerRecords
    users.value = userData
    currentPage.value = 1
  } catch (err) {
    error.value = '加载数据失败: ' + (err instanceof Error ? err.message : '未知错误')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refreshData()
})
</script>

<style scoped>
/* 基础容器 */
.player-records {
  padding: var(--spacing-lg);
  max-width: 1400px;
  margin: 0 auto;
  min-height: 100vh;
  background: var(--bg-secondary);
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

/* 表格容器 */

.table-stats {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

/* 表格样式 */

.record-row {
  transition: all var(--transition-fast);
}

.record-row:hover {
  background: rgba(255, 235, 220, 0.7);
}

/* 玩家信息 */
.player-info .player-name {
  color: var(--text-primary);
  font-size: var(--text-base);
}

/* 参赛信息 */
.participation-display {
  text-align: center;
}

.participation-count {
  font-weight: 600;
  color: var(--primary-color);
  font-size: var(--text-base);
  display: block;
}

.participation-years {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-top: var(--spacing-xs);
  line-height: 1.2;
}

/* 计数显示 */
.count-display {
  text-align: center;
}

.count-number {
  font-weight: 600;
  color: var(--accent-color);
  font-size: var(--text-lg);
}

.count-label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-left: 2px;
}

.score-value {
  font-weight: 600;
  color: var(--success-color);
  font-size: var(--text-base);
}

.rate-bar {
  flex: 1;
  height: 6px;
  background: var(--border-light);
  border-radius: var(--radius-small);
  overflow: hidden;
}

.rate-text {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  min-width: 40px;
  text-align: right;
}

.medal-count {
  font-weight: 600;
  font-size: var(--text-base);
}

.medal-cell.gold .medal-count {
  color: #FFD700;
}

.medal-cell.silver .medal-count {
  color: #C0C0C0;
}

.medal-cell.bronze .medal-count {
  color: #CD7F32;
}

/* 分页控件 */
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
  color: var(--border-dark);
}

.total-pages {
  color: var(--text-secondary);
}

.records-table {
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

@media (max-width: 1024px) {
  .records-table {
    min-width: 800px;
  }
}

@media (max-width: 768px) {
  .player-records {
    padding: var(--spacing-md);
  }
  
  .summary-cards {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-sm);
  }
  
  .stat-card {
    padding: var(--spacing-md);
  }
  
  .records-table {
    min-width: 600px;
    white-space: nowrap;
  }
  
  .records-table th,
  .records-table td {
    padding: var(--spacing-sm);
    font-size: var(--text-sm);
  }
  
  .pagination-controls {
    flex-direction: column;
    gap: var(--spacing-md);
  }
}

@media (max-width: 480px) {
  .summary-cards {
    grid-template-columns: 1fr;
  }
  
  .rate-display {
    flex-direction: column;
    gap: var(--spacing-xs);
  }
  
  .rate-bar {
    width: 100%;
  }
  
  .participation-years {
    display: none;
  }
}

/* 动画效果 */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes dots {
  0%, 20% { opacity: 0; }
  50% { opacity: 1; }
  80%, 100% { opacity: 0; }
}
</style>
