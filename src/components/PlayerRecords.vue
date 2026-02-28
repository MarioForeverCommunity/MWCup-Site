<template>
  <div class="player-records animate-fadeInUp">
    <div class="page-header">
      <div class="control-panel">
        <div class="form-group">
          <label class="form-label">搜索选手：</label>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="输入选手名称..."
            class="form-control hover-scale"
          />
        </div>
        <div class="form-group">
          <label class="form-label">排序方式：</label>
          <select v-model="sortBy" class="form-control hover-scale">
            <option value="totalLevels">按关卡数排序</option>
            <option value="participatedYears">按参赛届数排序</option>
            <option value="bestRank">按最高总积分排名排序</option>
            <option value="championCount">按冠亚季军次数排序</option>
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
              <th class="levels-col">关卡数</th>
              <th class="stage-col">最佳战绩</th>
              <th class="rank-col">最高总积分排名</th>
              <th class="medal-col">🥇</th>
              <th class="medal-col">🥈</th>
              <th class="medal-col">🥉</th>
              <th class="action-col">操作</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="record in filteredRecords" :key="record.userId">
              <!-- 选手信息行 -->
              <tr class="record-row" :class="{ 'active-row': expandedPlayer === record.userId }">
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
                    <span class="main-event-count">（正赛{{ record.mainEventYears.length }}届）</span>
                    <div class="participation-years">
                      <span 
                        v-for="year in record.participatedYears" 
                        :key="year"
                        :class="{ 'preliminary-only': !record.mainEventYears.includes(year) }"
                      >{{ year }}</span>
                    </div>
                  </div>
                </td>
                <td class="levels-cell">
                  <div class="count-display">
                    <span class="count-number">{{ record.totalLevels }}</span>
                  </div>
                </td>
                <td class="stage-cell">
                  {{ formatBestStageDisplay(record) }}
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
                <td class="action-cell">
                  <button 
                    @click="toggleDetails(record.userId)" 
                    class="detail-btn hover-scale"
                    :class="{
                      'btn-secondary': expandedPlayer === record.userId
                    }"
                  >
                    {{ expandedPlayer === record.userId ? '收起' : '详情' }}
                  </button>
                </td>
              </tr>
              
              <!-- 详细信息展开行 -->
              <tr v-if="expandedPlayer === record.userId" :key="`${record.userId}-details`" class="details-row animate-fadeInUp">
                <td colspan="10">
                  <div class="yearly-details">
                    <div class="details-header">
                      <h4>{{ getPlayerName(record.userId) }} 的年度详细战绩（正赛）</h4>
                    </div>
                    <div class="yearly-data">
                      <div 
                        v-for="yearData in getExpandedPlayerData(record.userId)" 
                        :key="yearData.year"
                        class="year-card"
                      >
                        <div class="year-label">{{ yearData.year }}年</div>
                        <div class="year-stats">
                          <div class="stat-item">
                            <span class="stat-label">排名</span>
                            <span class="stat-value">{{ yearData.rank || '未知' }}</span>
                          </div>
                          <div class="stat-item">
                            <span class="stat-label">成绩</span>
                            <span class="stat-value">{{ yearData.bestResult || '未知' }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>


    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { analyzePlayerRecords } from '../utils/dataAnalyzer'
import { loadUserData, type PlayerRecord, type UserData } from '../utils/userDataProcessor'
import { matchPlayerName } from '../utils/levelFileHelper'
import { fetchMarioWorkerYaml } from '../utils/yamlLoader'
import { formatResultDisplay } from '../utils/resultFormatter'
import { loadTotalPointsData } from '../utils/totalPointsCalculator'

// 年度战绩数据接口
interface YearlyPlayerData {
  year: number;
  rank: number;
  totalPoints: number;
  bestResult: string;
}

const records = ref<PlayerRecord[]>([])
const users = ref<UserData[]>([])
const yamlData = ref<any>(null)
const loading = ref(false)
const error = ref('')
const searchQuery = ref('')
const sortBy = ref('totalLevels')
const expandedPlayer = ref<number | null>(null)
const playerYearlyData = ref<{ [userId: number]: YearlyPlayerData[] }>({})

// 切换详细信息显示
const toggleDetails = async (userId: number) => {
  if (expandedPlayer.value === userId) {
    expandedPlayer.value = null
  } else {
    expandedPlayer.value = userId
    if (!playerYearlyData.value[userId]) {
      await loadPlayerYearlyData(userId)
    }
  }
}

// 获取展开的选手年度数据
const getExpandedPlayerData = (userId: number): YearlyPlayerData[] => {
  return playerYearlyData.value[userId] || []
}

// 获取用户的所有可能用户名
const getAllPlayerNames = (userId: number): string[] => {
  const user = users.value.find(u => u.序号 === userId)
  if (!user) return [`用户${userId}`]
  
  const names: string[] = []
  
  // 收集当前用户的用户名
  const collectUserNames = (userData: UserData) => {
    if (userData.百度用户名?.trim()) names.push(userData.百度用户名.trim())
    if (userData.社区用户名?.trim()) names.push(userData.社区用户名.trim())
    if (userData.社区曾用名?.trim()) names.push(userData.社区曾用名.trim())
  }
  
  // 添加当前用户的用户名
  collectUserNames(user)
  
  // 如果有社区UID，查找所有相同社区UID的用户的用户名
  if (user.社区UID?.trim()) {
    const sameUidUsers = users.value.filter(u => 
      u.社区UID?.trim() === user.社区UID?.trim() && u.序号 !== userId
    )
    sameUidUsers.forEach(collectUserNames)
  }
  
  // 去重并过滤空字符串
  return [...new Set(names)].filter(name => name)
}

// 加载选手年度数据
const loadPlayerYearlyData = async (userId: number) => {
  if (!yamlData.value) return
  
  const playerRecord = records.value.find(r => r.userId === userId)
  if (!playerRecord) return
  
  const allPlayerNames = getAllPlayerNames(userId)
  const yearlyData: YearlyPlayerData[] = []
  
  // 过滤掉只参加预选赛/热身赛/资格赛的年份
  for (const year of playerRecord.participatedYears) {
    try {
      const totalPointsData = await loadTotalPointsData(year.toString(), yamlData.value)
      if (!totalPointsData.hasData || totalPointsData.players.length === 0) {
        continue // 该年份没有正式比赛数据，跳过
      }
      
      // 查找该选手在当年的排名和积分 - 使用所有可能的用户名进行匹配
      const playerData = totalPointsData.players.find(p => {
        // 检查选手名是否匹配任何一个可能的用户名
        if (allPlayerNames.includes(p.playerName)) return true
        
        // 检查选手码是否包含任何一个可能的用户名
        return p.playerCodes.some(code => 
          allPlayerNames.some(name => code.includes(name))
        )
      })
      
      if (playerData) {
        const rank = totalPointsData.players.indexOf(playerData) + 1
        yearlyData.push({
          year,
          rank,
          totalPoints: Number(playerData.totalPoints),
          bestResult: formatResultDisplay(playerData.bestResult, {
            year: year.toString(),
            yamlData: yamlData.value
          })
        })
      }
    } catch (error) {
      console.warn(`加载${year}年数据失败:`, error)
    }
  }
  
  playerYearlyData.value[userId] = yearlyData.sort((a, b) => b.year - a.year)
}

// 格式化战绩显示函数（直接使用TotalPointsRanking.vue的成绩显示格式）
const formatBestStageDisplay = (record: PlayerRecord) => {
  const bestStage = record.bestStage;
  const bestYear = record.bestStageYear || Math.max(...record.participatedYears);
  
  // 特殊处理2012年：如果选手参加了2012年且没有明确的bestStage，显示为初赛/15强
  if (record.participatedYears.includes(2012) && (!bestStage || bestStage === '' || bestStage === '无' || bestStage === '未知' || bestStage === '小组赛/初赛')) {
    return '初赛/15强';
  }
  
  if (!bestStage || bestStage === '无' || bestStage === '未知') {
    return formatResultDisplay('仅报名', {
      year: bestYear.toString(),
      yamlData: yamlData.value
    });
  }
  
  return formatResultDisplay(bestStage, {
    year: bestYear.toString(),
    yamlData: yamlData.value
  });
}

// 筛选和排序后的记录
const filteredRecords = computed(() => {
  let filtered = records.value
  // 搜索过滤
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.trim()
    const isExact = query.startsWith('"') && query.endsWith('"')
    const processedKeyword = isExact ? query.slice(1, -1) : query
    
    filtered = filtered.filter(record => {
      const playerName = getPlayerName(record.userId)
      
      // 直接匹配选手名或用户ID
      if (isExact) {
        if (playerName.toLowerCase() === processedKeyword.toLowerCase() || 
            record.userId.toString() === processedKeyword) {
          return true
        }
      } else {
        if (playerName.toLowerCase().includes(processedKeyword.toLowerCase()) || 
            record.userId.toString().includes(processedKeyword)) {
          return true
        }
      }
      
      // 使用别名匹配
      return matchPlayerName(playerName, processedKeyword, users.value, isExact)
    })
  }

  // 排序
  filtered.sort((a, b) => {
    switch (sortBy.value) {
      case 'totalLevels':
        return b.totalLevels - a.totalLevels
      case 'participatedYears':
        return b.participatedYears.length - a.participatedYears.length
      case 'bestRank':
        if (a.bestRank === 0 && b.bestRank === 0) return 0
        if (a.bestRank === 0) return 1
        if (b.bestRank === 0) return -1
        return a.bestRank - b.bestRank
      case 'championCount':
        // 按冠亚季军次数排序，优先冠军，其次亚军，再其次季军
        const aTotal = (a.championCount || 0) * 10000 + (a.runnerUpCount || 0) * 100 + (a.thirdPlaceCount || 0)
        const bTotal = (b.championCount || 0) * 10000 + (b.runnerUpCount || 0) * 100 + (b.thirdPlaceCount || 0)
        return bTotal - aTotal
      default:
        return 0
    }
  })

  return filtered
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
  expandedPlayer.value = null
  playerYearlyData.value = {}
  
  try {
    const [playerRecords, userData, yaml] = await Promise.all([
      analyzePlayerRecords(),
      loadUserData(),
      fetchMarioWorkerYaml()
    ])
    
    records.value = playerRecords
    users.value = userData
    yamlData.value = yaml
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

.participation-years span:not(:last-child)::after {
  content: ', ';
}

.preliminary-only {
  font-style: italic;
  color: var(--text-muted);
}

.main-event-count {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-weight: normal;
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

/* 选中行样式 */
.active-row {
  background-color: rgba(var(--primary-rgb), 0.05);
}

/* yearly-details 相关样式 */
.yearly-details {
  background: var(--bg-card);
  border-radius: var(--radius-large);
  box-shadow: var(--shadow-soft);
  padding: var(--spacing-lg);
  margin: var(--spacing-md);
  box-shadow: var(--shadow-medium);
}

.detail-btn {
  padding: 4px 8px;
  background: linear-gradient(135deg, var(--primary-hover), var(--primary-color));
  color: white;
  border: none;
  border-radius: var(--radius-medium);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: var(--transition-normal);
  min-width: 44px;
  white-space: nowrap;
}

.detail-btn.btn-secondary {
  background: var(--bg-button);
  color: var(--text-primary);
  border: 1px solid var(--primary-hover);
}

.detail-btn.btn-secondary:hover {
  background: var(--bg-button);
  filter: brightness(0.95);
}

.detail-btn:hover {
  background: linear-gradient(135deg, var(--primary-active), var(--primary-dark));
  transform: translateY(-1px);
  box-shadow: var(--shadow-button);
}

/* 详情行样式 */
.details-row {
  background-color: var(--bg-hover);
}

.details-row td {
  padding: 0;
}

.details-header h4 {
  margin: 0 0 var(--spacing-lg) 0;
  color: var(--text-secondary);
  font-size: 18px;
  border-bottom: 2px solid var(--primary-active);
  padding-bottom: var(--spacing-sm);
}

/* 年度详情样式 */
.yearly-data {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
}

.year-card {
  background: var(--bg-card);
  border-radius: var(--radius-medium);
  padding: var(--spacing-md);
  transition: background 0.3s, box-shadow 0.3s;
  box-shadow: var(--shadow-light);
}

.year-card:hover {
  background: var(--bg-button-hover);
  box-shadow: var(--shadow-medium);
}

.year-label {
  font-weight: 600;
  color: var(--primary-color);
  font-size: var(--text-base);
  margin-bottom: var(--spacing-sm);
  text-align: center;
}

.year-stats {
  display: flex;
  justify-content: space-around;
  gap: var(--spacing-sm);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.stat-value {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
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

/* 年度卡片布局优化 */
@media (min-width: 992px) {
  .yearly-data {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    padding: var(--spacing-md);
  }
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
  .records-table {
    min-width: 600px;
    white-space: nowrap;
  }

  .summary-cards {
    grid-template-columns: 1fr;
  }
  
  .yearly-data {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  
  .yearly-details {
    padding: var(--spacing-md);
    margin: var(--spacing-sm);
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
  .participation-years {
    display: none;
  }
}
</style>
