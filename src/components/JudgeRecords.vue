<template>
  <div class="judge-records animate-fadeInUp">
    <div class="page-header">
      <div class="control-panel">
        <div class="form-group">
          <label class="form-label">搜索评委：</label>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="输入评委名称..."
            class="form-control hover-scale"
          />
        </div>
        <div class="form-group">
          <label class="form-label">排序方式：</label>
          <select v-model="sortBy" class="form-control hover-scale">
            <option value="totalLevels">按参评关卡数排序</option>
            <option value="totalRounds">按参评轮数排序</option>
            <option value="participatedYears">按参评届数排序</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-state animate-pulse">
      <div class="loading-spinner"></div>
      <div class="loading-text">正在分析评委数据<span class="loading-dots">...</span></div>
    </div>

    <div v-else-if="error" class="error-state animate-shake">
      <p>{{ error }}</p>
      <button @click="refreshData" class="btn-secondary hover-scale">重试</button>
    </div>

    <div v-else class="content-panel animate-fadeInUp">
      <!-- 评委数据表格 -->
      <div class="section-header">
         <h3>评委详细数据</h3>
      </div>
        
      <div class="table-wrapper">
        <table class="table-base records-table">
          <thead>
            <tr>
              <th>评委名称</th>
              <th>参评届数</th>
              <th>参评轮数</th>
              <th>参评关卡数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="record in paginatedRecords" :key="record.judgeName">
              <!-- 评委信息行 -->
              <tr class="record-row" :class="{ 'active-row': expandedJudge === record.judgeName }">
                <td class="judge-cell">
                  <div class="judge-info">
                    <span class="judge-name">{{ record.judgeName }}</span>
                  </div>
                </td>
                <td class="years-cell">
                  <div class="participation-display">
                    <span class="participation-count">{{ record.participatedYears.length }}届</span>
                    <div class="participation-years">{{ record.participatedYears.join(', ') }}</div>
                  </div>
                </td>
                <td class="rounds-cell">
                  <div class="count-display">
                    <span class="count-number">{{ record.totalRounds }}</span>
                  </div>
                </td>
                <td class="levels-cell">
                  <div class="count-display">
                    <span class="count-number">{{ record.totalLevels }}</span>
                  </div>
                </td>
                <td class="action-cell">
                  <button 
                    @click="toggleDetails(record.judgeName)" 
                    class="detail-btn hover-scale"
                    :class="{
                      'btn-secondary': expandedJudge === record.judgeName
                    }"
                  >
                    {{ expandedJudge === record.judgeName ? '收起' : '详情' }}
                  </button>
                </td>
              </tr>
              
              <!-- 详细信息展开行 -->
              <tr v-if="expandedJudge === record.judgeName" :key="`${record.judgeName}-details`" class="details-row animate-fadeInUp">
                <td colspan="5">
                  <div class="yearly-details">
                    <div class="details-header">
                      <h4>{{ record.judgeName }} 的年度详细数据</h4>
                    </div>
                    <div class="yearly-data">
                      <div 
                        v-for="(data, year) in getExpandedJudgeData()?.yearlyData" 
                        :key="year"
                        class="year-card"
                      >
                        <div class="year-label">{{ year }}年</div>
                        <div class="year-stats">
                          <div class="stat-item">
                            <span class="stat-label">轮数</span>
                            <span class="stat-value">{{ data.rounds }}</span>
                          </div>
                          <div class="stat-item">
                            <span class="stat-label">关卡</span>
                            <span class="stat-value">{{ data.levels }}</span>
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
import { analyzeJudgeRecords } from '../utils/dataAnalyzer'
import { type JudgeRecord } from '../utils/userDataProcessor'
import { matchPlayerName } from '../utils/levelFileHelper'
import { loadUserData, type UserData } from '../utils/userDataProcessor'

const records = ref<JudgeRecord[]>([])
const users = ref<UserData[]>([])
const loading = ref(false)
const error = ref('')
const searchQuery = ref('')
const sortBy = ref('totalLevels')
const expandedJudge = ref<string | null>(null)

// 筛选和排序后的记录
const filteredRecords = computed(() => {
  let filtered = records.value
  // 搜索过滤
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.trim()
    const isExact = query.startsWith('"') && query.endsWith('"')
    const processedKeyword = isExact ? query.slice(1, -1) : query
    
    filtered = filtered.filter(record => {
      // 直接匹配评委名
      if (isExact) {
        if (record.judgeName.toLowerCase() === processedKeyword.toLowerCase()) {
          return true
        }
      } else {
        if (record.judgeName.toLowerCase().includes(processedKeyword.toLowerCase())) {
          return true
        }
      }
      
      // 使用别名匹配
      return matchPlayerName(record.judgeName, processedKeyword, users.value, isExact)
    })
  }

  // 排序
  filtered.sort((a, b) => {
    switch (sortBy.value) {
      case 'totalLevels':
        return b.totalLevels - a.totalLevels
      case 'totalRounds':
        return b.totalRounds - a.totalRounds
      case 'participatedYears':
        return b.participatedYears.length - a.participatedYears.length
      default:
        return 0
    }
  })

  return filtered
})

// 分页后的记录
const paginatedRecords = filteredRecords;

// 切换详细信息显示
const toggleDetails = (judgeName: string) => {
  expandedJudge.value = expandedJudge.value === judgeName ? null : judgeName
}

// 获取展开的评委数据
const getExpandedJudgeData = () => {
  if (!expandedJudge.value) return null
  return records.value.find(record => record.judgeName === expandedJudge.value)
}

// 刷新数据
const refreshData = async () => {
  loading.value = true
  error.value = ''
  expandedJudge.value = null
  
  try {
    const [judgeRecords, userData] = await Promise.all([
      analyzeJudgeRecords(),
      loadUserData()
    ])
    records.value = judgeRecords
    users.value = userData
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
.judge-records {
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
}

@media (max-width: 480px) {
  .participation-years {
    display: none;
  }
}
</style>
