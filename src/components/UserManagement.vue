<template>
  <div class="user-management animate-fadeInUp">
    <div class="page-header animate-fadeInDown">
      <div class="control-panel">
        <div class="form-group">
          <label class="form-label">搜索用户</label>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="输入用户名或UID..."
            class="form-control hover-scale"
          />
        </div>
        <div class="form-group">
          <label class="form-label">用户筛选</label>
          <select v-model="filterType" class="form-control hover-scale">
            <option value="">全部用户</option>
            <option value="both">有百度+社区账号</option>
            <option value="baidu-only">仅百度账号</option>
            <option value="community-only">仅社区账号</option>
            <option value="has-old-name">有曾用名</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-state animate-pulse">
      <div class="loading-spinner"></div>
      <div class="loading-text">正在加载用户数据<span class="loading-dots">...</span></div>
    </div>

    <div v-else-if="error" class="error-state animate-shake">
      <p>{{ error }}</p>
      <button @click="refreshData" class="btn-secondary hover-scale">重试</button>
    </div>

    <div v-else class="content-panel animate-fadeInUp">
      <!-- 统计概览卡片 -->
      <div class="summary-cards">
        <div class="stat-card hover-lift">
          <h3>总用户数</h3>
          <div class="stat-value">{{ filteredUsers.length }}</div>
          <div class="stat-icon">👥</div>
        </div>
        <div class="stat-card hover-lift">
          <h3>双平台用户</h3>
          <div class="stat-value">{{ bothPlatformUsers }}</div>
          <div class="stat-icon">🔗</div>
        </div>
        <div class="stat-card hover-lift">
          <h3>仅百度用户</h3>
          <div class="stat-value">{{ baiduOnlyUsers }}</div>
          <div class="stat-icon">🅱️</div>
        </div>
        <div class="stat-card hover-lift">
          <h3>仅社区用户</h3>
          <div class="stat-value">{{ communityOnlyUsers }}</div>
          <div class="stat-icon">🏠</div>
        </div>
        <div class="stat-card hover-lift">
          <h3>有曾用名</h3>
          <div class="stat-value">{{ hasOldNameUsers }}</div>
          <div class="stat-icon">📝</div>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="table-base user-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>百度用户名</th>
              <th>社区用户名</th>
              <th>社区UID</th>
              <th>社区曾用名</th>
              <th>平台状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in paginatedUsers" :key="user.序号" class="user-row hover-row animate-fadeInLeft">
              <td class="user-id">{{ user.序号 }}</td>
              <td class="baidu-name">
                <span v-if="user.百度用户名" class="username">{{ user.百度用户名 }}</span>
                <span v-else class="no-data">-</span>
              </td>
              <td class="community-name">
                <span v-if="user.社区用户名" class="username">{{ user.社区用户名 }}</span>
                <span v-else class="no-data">-</span>
              </td>
              <td class="community-uid">
                <span v-if="user.社区UID" class="uid">{{ user.社区UID }}</span>
                <span v-else class="no-data">-</span>
              </td>
              <td class="old-name">
                <span v-if="user.社区曾用名" class="old-username">{{ user.社区曾用名 }}</span>
                <span v-else class="no-data">-</span>
              </td>
              <td class="platform-status">
                <span class="status-badge" :class="getPlatformStatusClass(user)">
                  {{ getPlatformStatus(user) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

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
          <span class="separator">/</span>
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

    <div class="help-section animate-fadeInUp">
      <h3>说明</h3>
      <div class="help-content">
        <p><strong>用户名对应关系说明：</strong></p>
        <ul>
          <li>MW杯2012~2019年在百度Marioworker吧举办，2020年之后在Mario Forever社区举办</li>
          <li>部分百度用户没有注册社区账号，部分社区用户也没有百度账号</li>
          <li>社区用户可以更改用户名，CSV中的“社区曾用名”与“社区用户名”对应同一用户</li>
          <li>序号作为用户在本站的标识符，用于战绩统计等功能</li>
          <li>社区UID是社区平台的唯一用户标识</li>
        </ul>
        <p><strong>平台状态：</strong></p>
        <ul>
          <li><span class="status-badge both">双平台</span> - 同时拥有百度和社区账号</li>
          <li><span class="status-badge baidu-only">仅百度</span> - 只有百度账号</li>
          <li><span class="status-badge community-only">仅社区</span> - 只有社区账号</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { loadUserData, type UserData } from '../utils/userDataProcessor'

const users = ref<UserData[]>([])
const loading = ref(false)
const error = ref('')
const searchQuery = ref('')
const filterType = ref('')
const currentPage = ref(1)
const itemsPerPage = 20

// 筛选后的用户
const filteredUsers = computed(() => {
  let filtered = users.value

  // 搜索过滤
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(user => {
      return user.序号.toString().includes(query) ||
             user.百度用户名.toLowerCase().includes(query) ||
             user.社区用户名.toLowerCase().includes(query) ||
             user.社区UID.toLowerCase().includes(query) ||
             user.社区曾用名.toLowerCase().includes(query)
    })
  }

  // 类型过滤
  if (filterType.value) {
    filtered = filtered.filter(user => {
      switch (filterType.value) {
        case 'both':
          return user.百度用户名 && user.社区用户名
        case 'baidu-only':
          return user.百度用户名 && !user.社区用户名
        case 'community-only':
          return !user.百度用户名 && user.社区用户名
        case 'has-old-name':
          return user.社区曾用名
        default:
          return true
      }
    })
  }

  return filtered
})

// 分页后的用户
const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredUsers.value.slice(start, end)
})

// 总页数
const totalPages = computed(() => {
  return Math.ceil(filteredUsers.value.length / itemsPerPage)
})

// 监听总页数变化，如果当前页数超过最大页数，则调整到最大页数
watch(totalPages, (newTotalPages) => {
  if (currentPage.value > newTotalPages && newTotalPages > 0) {
    currentPage.value = newTotalPages
  }
}, { immediate: true })

// 统计数据
const bothPlatformUsers = computed(() => {
  return users.value.filter(user => user.百度用户名 && user.社区用户名).length
})

const baiduOnlyUsers = computed(() => {
  return users.value.filter(user => user.百度用户名 && !user.社区用户名).length
})

const communityOnlyUsers = computed(() => {
  return users.value.filter(user => !user.百度用户名 && user.社区用户名).length
})

const hasOldNameUsers = computed(() => {
  return users.value.filter(user => user.社区曾用名).length
})

// 获取平台状态
const getPlatformStatus = (user: UserData): string => {
  if (user.百度用户名 && user.社区用户名) return '双平台'
  if (user.百度用户名 && !user.社区用户名) return '仅百度'
  if (!user.百度用户名 && user.社区用户名) return '仅社区'
  return '未知'
}

// 获取平台状态样式类
const getPlatformStatusClass = (user: UserData): string => {
  if (user.百度用户名 && user.社区用户名) return 'both'
  if (user.百度用户名 && !user.社区用户名) return 'baidu-only'
  if (!user.百度用户名 && user.社区用户名) return 'community-only'
  return 'unknown'
}

// 刷新数据
const refreshData = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const userData = await loadUserData()
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
/* 主容器 */
.user-management {
  padding: var(--spacing-lg);
  max-width: 1400px;
  background: var(--bg-primary);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-subtle);
}

.form-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: 500;
}

/* 统计卡片 */

/* 加载和错误状态 */

/* 表格容器 */

.user-row {
  transition: all var(--transition-fast);
}

.hover-row:hover {
  background: rgba(255, 235, 220, 0.7);
  transform: translateX(2px);
}

.user-row:nth-child(even) {
  background: rgba(255, 248, 240, 0.5);
}

.user-row:nth-child(even):hover {
  background: rgba(255, 235, 220, 0.7);
}

/* 表格内容样式 */
.user-id {
  font-weight: 600;
  color: var(--primary-color);
}

.username {
  font-weight: 500;
  color: var(--text-primary);
}

.uid {
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
}

.old-username {
  font-style: italic;
  color: var(--text-muted);
}

.no-data {
  color: var(--text-muted);
  font-style: italic;
}

/* 状态徽章 */
.status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge.both {
  background: rgba(46, 204, 113, 0.1);
  color: var(--success-color);
  border: 1px solid rgba(46, 204, 113, 0.2);
}

.status-badge.baidu-only {
  background: rgba(255, 152, 0, 0.1);
  color: var(--warning-color);
  border: 1px solid rgba(255, 152, 0, 0.2);
}

.status-badge.community-only {
  background: rgba(52, 152, 219, 0.1);
  color: var(--info-color);
  border: 1px solid rgba(52, 152, 219, 0.2);
}

.status-badge.unknown {
  background: rgba(231, 76, 60, 0.1);
  color: var(--error-color);
  border: 1px solid rgba(231, 76, 60, 0.2);
}

/* 用户身份信息 */
.identity-info {
  max-width: 220px;
}

.primary-name {
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.alt-names {
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.4;
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

.separator {
  color: var(--text-muted);
  margin: 0 var(--spacing-xs);
}

.total-pages {
  color: var(--text-secondary);
}

/* 帮助部分 */
.help-section {
  background: var(--bg-content);
  border-radius: var(--radius-xl);
  padding: var(--spacing-lg);
  margin: var(--spacing-lg) 0;
  box-shadow: var(--shadow-medium);
  border: 1px solid var(--border-primary);
  backdrop-filter: var(--blur-medium);
  box-shadow: var(--shadow-card);
}

.help-section h3 {
  margin: 0 0 var(--spacing-md) 0;
  color: var(--text-primary);
  font-size: 1.125rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.help-section h3::before {
  content: "💡";
  font-size: 1rem;
}

.help-content {
  color: var(--text-secondary);
  line-height: 1.6;
}

.help-content p {
  margin: 0 0 var(--spacing-md) 0;
}

.help-content ul {
  margin: var(--spacing-sm) 0 var(--spacing-md) 0;
  padding-left: var(--spacing-lg);
}

.help-content li {
  margin: var(--spacing-xs) 0;
  color: var(--text-secondary);
}

.help-content .status-badge {
  margin: 0 var(--spacing-xs);
  display: inline-block;
}

.user-table {
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
  .user-table {
    font-size: 12px;
    white-space: nowrap;
  }

  .user-management {
    padding: var(--spacing-md);
  }
  
  .summary-cards {
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
  }
  
  .pagination-controls {
    flex-direction: column;
    gap: var(--spacing-md);
  }
}
</style>
