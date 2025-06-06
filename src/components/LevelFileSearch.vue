<template>
  <div class="page-header animate-fadeInUp">
    <h2 class="animate-textGlow">关卡文件查询</h2>
    
    <!-- 搜索方式选择 -->
    <div class="control-panel">
      <label class="form-label">
        <input type="radio" v-model="searchMode" value="selector">
        按年份-轮次-选手选择
      </label>
      <label class="form-label">
        <input type="radio" v-model="searchMode" value="search">
        按选手名/文件名搜索
      </label>
    </div>

    <!-- 按年份-轮次-选手选择 -->
    <div v-if="searchMode === 'selector'" class="content-panel">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">年份:</label>
          <select v-model="selectedYear" @change="onYearChange" class="form-control hover-scale">
            <option value="">请选择年份</option>
            <option v-for="year in availableYears" :key="year" :value="year">
              {{ year }}年第{{ getEditionNumber(year) }}届
            </option>
          </select>
        </div>
        
        <div class="form-group animate-scaleIn" v-if="selectedYear">
          <label class="form-label">轮次:</label>
          <select v-model="selectedRound" @change="onRoundChange" class="form-control hover-scale">
            <option value="">请选择轮次</option>
            <option v-for="round in availableRounds" :key="round.key" :value="round.key">
              {{ round.name }}
            </option>
          </select>
        </div>
        
        <div class="form-group animate-scaleIn" v-if="selectedRound">
          <label class="form-label">选手:</label>
          <select v-model="selectedPlayer" class="form-control hover-scale">
            <option value="">全部选手</option>
            <option v-for="player in availablePlayers" :key="player.code" :value="player.code">
              {{ player.code }} - {{ player.name }}
            </option>
          </select>
        </div>
      </div>
      
      <div class="button-container">
        <button @click="searchBySelector" :disabled="!selectedRound" class="btn-primary">
          {{ selectedPlayer ? '查找该选手关卡文件' : '查找该轮次所有文件' }}
        </button>
      </div>
    </div>
  </div>

  <!-- 按选手名/文件名搜索 -->
  <div v-if="searchMode === 'search'" class="content-panel animate-fadeInUp">
    <div class="form-group">
      <label class="form-label">搜索关键词:</label>
      <input 
        v-model="searchKeyword" 
        type="text" 
        placeholder="输入选手名或文件名关键词"
        @keyup.enter="searchByKeyword"
        class="form-control"
      >
    </div>
    <button @click="searchByKeyword" class="btn-primary hover-scale">搜索</button>
  </div>

  <div v-if="loading" class="loading-state animate-pulse">
    <div class="loading-spinner"></div>
    <span class="loading-dots">加载中</span>
  </div>

  <div v-if="error" class="error-state animate-pulse">
    错误: {{ error }}
  </div>
  <!-- 结果表格 -->
    <div v-if="searchResults && searchResults.length > 0" class="content-panel animate-fadeInUp">
    <div class="section-header">
      <h3>找到的关卡文件 ({{ searchResults.length }} 个):</h3>
    </div>
    <div class="table-wrapper">
      <table class="table-base file-table">
        <thead>
          <tr>
            <th>文件名</th>
            <th>选手码</th>
            <th>选手名</th>
            <th>年份</th>
            <th>轮次</th>
            <th>分组</th>
            <th>文件大小</th>
            <th>修改时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="(file) in searchResults" 
            :key="file.path" 
            @click="showFileDetails(file)" 
            class="clickable-row"
          >
            <td class="filename">{{ file.name }}</td>
            <td class="player-code">{{ file.playerCode || '-' }}</td>
            <td>{{ file.playerName || '-' }}</td>
            <td>{{ file.year || '-' }}</td>
            <td>{{ file.roundType || '-' }}</td>
            <td>{{ file.groupCode ? getGroupDisplayName(file.groupCode) : '-' }}</td>
            <td class="file-size">{{ formatFileSize(file.size) }}</td>
            <td>{{ formatDate(file.mtime) }}</td>
            <td class="actions">
              <button @click.stop="downloadLevel(file)" class="download-btn hover-scale" title="下载关卡文件">
                下载
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- 文件详情弹窗 -->
  <div v-if="showingFileDetails" class="modal-overlay animate-fadeIn" @click="closeFileDetails">
    <div class="modal-content animate-scaleIn" @click.stop>
      <div class="modal-header">
        <h3>文件详情</h3>
      </div>
      <div class="modal-body" v-if="selectedFileDetails">
        <div class="detail-item">
          <label>文件名：</label>
          <span>{{ selectedFileDetails.name }}</span>
        </div>
        <div class="detail-item">
          <label>文件路径：</label>
          <span>{{ selectedFileDetails.path }}</span>
        </div>
        <div class="detail-item">
          <label>选手码：</label>
          <span>{{ selectedFileDetails.playerCode || '未知' }}</span>
        </div>
        <div class="detail-item">
          <label>选手名：</label>
          <span>{{ selectedFileDetails.playerName || '未知' }}</span>
        </div>
        <div class="detail-item">
          <label>年份：</label>
          <span>{{ selectedFileDetails.year || '未知' }}</span>
        </div>
        <div class="detail-item">
          <label>轮次：</label>
          <span>{{ selectedFileDetails.roundType || '未知' }}</span>
        </div>
        <div class="detail-item">
          <label>分组：</label>
          <span>{{ selectedFileDetails.groupCode ? getGroupDisplayName(selectedFileDetails.groupCode) : '无' }}</span>
        </div>
        <div class="detail-item">
          <label>文件大小：</label>
          <span>{{ formatFileSize(selectedFileDetails.size) }}</span>
        </div>
        <div class="detail-item">
          <label>修改时间：</label>
          <span>{{ formatDate(selectedFileDetails.mtime) }}</span>
        </div>
        <div class="detail-item">
          <label>数据完整性：</label>
          <span :class="{ 'complete': selectedFileDetails.hasPlayerInfo, 'incomplete': !selectedFileDetails.hasPlayerInfo }">
            {{ selectedFileDetails.hasPlayerInfo ? '完整' : '不完整' }}
          </span>
        </div>
      </div>
    </div>
  </div>

  <div v-if="searched && (!searchResults || searchResults.length === 0)" class="no-result">
    没有找到符合条件的关卡文件
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { 
  fetchLevelFilesFromLocal,
  type LevelFile
} from '../utils/levelFileHelper'
import { fetchMarioWorkerYaml } from '../utils/yamlLoader'
import { getRoundChineseName } from '../utils/roundNames'
import { getGroupDisplayName } from '../utils/levelMatcher'
import { getEditionNumber } from '../utils/editionHelper'

// 关卡下载基础URL
const LEVELS_BASE_URL = 'https://levels.smwp.marioforever.net/MW杯关卡/'

// 搜索模式
const searchMode = ref<'selector' | 'search'>('selector')

// 选择器模式的数据
const selectedYear = ref('')
const selectedRound = ref('')
const selectedPlayer = ref('')
const availableYears = ref<number[]>([])
const availableRounds = ref<{ key: string; name: string }[]>([])
const availablePlayers = ref<{ code: string; name: string }[]>([])

// 搜索模式的数据
const searchKeyword = ref('')

// 通用数据
const loading = ref(false)
const error = ref('')
const searchResults = ref<LevelFile[]>([])
const searched = ref(false)

// 文件详情弹窗
const showingFileDetails = ref(false)
const selectedFileDetails = ref<LevelFile | null>(null)

// 缓存的 YAML 数据
let yamlData: any = null

onMounted(() => {
  loadYamlData()
})

async function loadYamlData() {
  try {
    yamlData = await fetchMarioWorkerYaml()
    if (yamlData?.season) {
      availableYears.value = Object.keys(yamlData.season)
        .map(year => parseInt(year))
        .sort((a, b) => b - a) // 降序排列
    }
  } catch (err) {
    console.error('Failed to load YAML data:', err)  }
}

function onYearChange() {
  selectedRound.value = ''
  selectedPlayer.value = ''
  availableRounds.value = []
  availablePlayers.value = []
  
  if (selectedYear.value && yamlData?.season?.[selectedYear.value]?.rounds) {
    const rounds = yamlData.season[selectedYear.value].rounds
    const roundList: { key: string; name: string }[] = []
    
    for (const [roundKey, roundData] of Object.entries(rounds)) {
      // 检查是否是数组表示的轮次（如 "[G1, G2, G3, G4]"）
      if (roundKey.startsWith('[') && roundKey.endsWith(']')) {
        try {
          const parsedKey = JSON.parse(roundKey);
          if (Array.isArray(parsedKey)) {
            for (const singleRound of parsedKey) {
              roundList.push({
                key: singleRound,
                name: getRoundChineseName(singleRound, roundData)
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
            key: singleRound,
            name: getRoundChineseName(singleRound, roundData)
          });
        }
        continue;
      }
      
      // 处理普通的单轮次
      roundList.push({
        key: roundKey,
        name: getRoundChineseName(roundKey, roundData)
      });
    }
    
    // 按轮次类型排序
    roundList.sort((a, b) => {
      const order = ['P1', 'P2', 'I1', 'I2', 'I3', 'I4', 'G1', 'G2', 'G3', 'G4', 'Q1', 'Q2', 'Q', 'R1', 'R2', 'R3', 'R', 'S1', 'S2', 'S', 'F']
      const aIndex = order.indexOf(a.key)
      const bIndex = order.indexOf(b.key)
      if (aIndex === -1 && bIndex === -1) return a.key.localeCompare(b.key)
      if (aIndex === -1) return 1
      if (bIndex === -1) return -1
      return aIndex - bIndex
    })
    
    availableRounds.value = roundList
  }
}

function onRoundChange() {
  selectedPlayer.value = ''
  availablePlayers.value = []
  
  if (selectedYear.value && selectedRound.value && yamlData?.season?.[selectedYear.value]?.rounds) {
    const rounds = yamlData.season[selectedYear.value].rounds
    let targetRoundData: any = null
    
    // 查找包含当前选中轮次的轮次数据
    for (const [roundKey, roundData] of Object.entries(rounds)) {
      // 检查是否是数组表示的轮次
      if (roundKey.startsWith('[') && roundKey.endsWith(']')) {
        try {
          const parsedKey = JSON.parse(roundKey);
          if (Array.isArray(parsedKey) && parsedKey.includes(selectedRound.value)) {
            targetRoundData = roundData;
            break;
          }
        } catch {
          // JSON解析失败，继续下一个
        }
      }
      
      // 检查是否是逗号分隔的多轮次
      else if (roundKey.includes(',')) {
        const singleRounds = roundKey.split(',').map(r => r.trim());
        if (singleRounds.includes(selectedRound.value)) {
          targetRoundData = roundData;
          break;
        }
      }
      
      // 直接匹配单轮次
      else if (roundKey === selectedRound.value) {
        targetRoundData = roundData;
        break;
      }
    }
    
    if (targetRoundData && targetRoundData.players) {
      const playerList: { code: string; name: string }[] = []
      
      // 检查选手数据格式
      if (Array.isArray(targetRoundData.players)) {
        // 数组格式（如P2轮次）：[选手名1, 选手名2, ...]
        // 对于数组格式，直接使用选手名作为code，不添加编号
        targetRoundData.players.forEach((playerName: string) => {
          if (typeof playerName === 'string') {
            playerList.push({ 
              code: playerName, 
              name: playerName 
            })
          }
        })
      } else if (typeof targetRoundData.players === 'object') {
        // 对象格式：分组结构
        for (const [groupKey, group] of Object.entries(targetRoundData.players)) {
          if (group && typeof group === 'object') {
            // 嵌套分组格式
            if (!Array.isArray(group)) {
              for (const [code, name] of Object.entries(group)) {
                if (typeof name === 'string') {
                  playerList.push({ code, name })
                }
              }
            }
          } else if (typeof group === 'string') {
            // 直接的 code: name 格式
            playerList.push({ code: groupKey, name: group })
          }
        }
      }
      
      // 过滤掉选手码以波浪号（~）开头的选手
      availablePlayers.value = playerList.filter(player => !player.code.startsWith('~'))
    }
  }
}

async function searchBySelector() {
  if (!selectedRound.value) {
    error.value = '请选择轮次'
    return
  }

  loading.value = true
  error.value = ''
  searchResults.value = []
  searched.value = false

  try {
    const files = await fetchLevelFiles()
    const results = files.filter(file => {
      // 匹配年份
      if (selectedYear.value && file.year !== parseInt(selectedYear.value)) {
        return false
      }
      
      // 匹配轮次
      if (selectedRound.value && file.roundKey !== selectedRound.value) {
        return false
      }
      
      // 如果选择了选手，则匹配选手码；否则显示所有选手
      if (selectedPlayer.value && file.playerCode !== selectedPlayer.value) {
        return false
      }
      
      return true
    })
      // 按YAML中的选手顺序排序，然后按文件名排序
    if (yamlData && selectedYear.value && selectedRound.value) {
      try {
        // 从YAML获取选手顺序
        const { buildPlayerJudgeMap } = await import('../utils/scoreCalculator')
        const playerMapResult = buildPlayerJudgeMap(
          yamlData, 
          selectedYear.value, 
          selectedRound.value
        );
        
        // 创建一个根据YAML中的选手码顺序排序的映射
        const playerCodeOrderMap = new Map(
          Object.keys(playerMapResult.players).map((code, index) => [code, index])
        );
        
        // 按照YAML中的选手顺序排序
        results.sort((a, b) => {
          const orderA = playerCodeOrderMap.get(a.playerCode || '');
          const orderB = playerCodeOrderMap.get(b.playerCode || '');
          
          // 如果都有序号，按序号排序
          if (orderA !== undefined && orderB !== undefined) {
            if (orderA !== orderB) return orderA - orderB;
          }
          // 如果只有一方有序号，有序号的排前面
          else if (orderA !== undefined) return -1;
          else if (orderB !== undefined) return 1;
          
          // 如果都没有序号或序号相同，按文件名排序
          return a.name.localeCompare(b.name)
        })
      } catch (error) {
        console.error('按选手顺序排序时出错:', error);
        // 降级到按选手码字母顺序排序
        results.sort((a, b) => {
          const playerCompare = (a.playerCode || '').localeCompare(b.playerCode || '')
          if (playerCompare !== 0) return playerCompare
          return a.name.localeCompare(b.name)
        })
      }
    } else {
      // 如果没有YAML数据，按选手码字母顺序排序
      results.sort((a, b) => {
        const playerCompare = (a.playerCode || '').localeCompare(b.playerCode || '')
        if (playerCompare !== 0) return playerCompare
        return a.name.localeCompare(b.name)
      })
    }
    
    searchResults.value = results
    searched.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : '未知错误'
  } finally {
    loading.value = false
  }
}

async function searchByKeyword() {
  if (!searchKeyword.value.trim()) {
    error.value = '请输入搜索关键词'
    return
  }

  loading.value = true
  error.value = ''
  searchResults.value = []
  searched.value = false

  try {
    const files = await fetchLevelFiles()
    const keyword = searchKeyword.value.trim().toLowerCase()
    
    const results = files.filter(file => {
      return (
        file.name.toLowerCase().includes(keyword) ||
        (file.playerName && file.playerName.toLowerCase().includes(keyword)) ||
        (file.playerCode && file.playerCode.toLowerCase().includes(keyword))
      )
    })
    
    // 按相关性排序：优先显示选手名完全匹配的，然后是选手码匹配的，最后是文件名匹配的
    results.sort((a, b) => {
      const aPlayerNameMatch = a.playerName && a.playerName.toLowerCase().includes(keyword)
      const bPlayerNameMatch = b.playerName && b.playerName.toLowerCase().includes(keyword)
      const aPlayerCodeMatch = a.playerCode && a.playerCode.toLowerCase().includes(keyword)
      const bPlayerCodeMatch = b.playerCode && b.playerCode.toLowerCase().includes(keyword)
      
      if (aPlayerNameMatch && !bPlayerNameMatch) return -1
      if (!aPlayerNameMatch && bPlayerNameMatch) return 1
      if (aPlayerCodeMatch && !bPlayerCodeMatch) return -1
      if (!aPlayerCodeMatch && bPlayerCodeMatch) return 1
      
      // 如果相关性相同，按年份降序，然后按文件名升序
      if (a.year !== b.year) {
        return (b.year || 0) - (a.year || 0)
      }
      return a.name.localeCompare(b.name)
    })
    
    searchResults.value = results
    searched.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : '未知错误'
  } finally {
    loading.value = false
  }
}

async function fetchLevelFiles(): Promise<LevelFile[]> {
  return await fetchLevelFilesFromLocal()
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN')
}


function showFileDetails(file: LevelFile) {
  selectedFileDetails.value = file
  showingFileDetails.value = true
}

function downloadLevel(file: LevelFile) {
  try {
    const downloadUrl = LEVELS_BASE_URL + file.path
    // 使用 window.open 在新标签页中打开下载链接
    const newWindow = window.open(downloadUrl, '_blank')
    
    // 检查是否被弹窗拦截
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      // 如果被拦截，提示用户
      alert('下载可能被浏览器拦截，请允许弹窗或手动复制链接：\n' + downloadUrl)
    }
  } catch (err) {
    console.error('下载失败:', err)
    alert('下载失败，请稍后重试')
  }
}

function closeFileDetails() {
  showingFileDetails.value = false
  selectedFileDetails.value = null
}
</script>

<style scoped>
/* 组件特定样式 - 使用新的CSS类系统 */
.button-container {
  display: flex;
  justify-content: center;
  margin-top: var(--spacing-lg);
}

.form-grid {
  display: flex;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: var(--spacing-lg);
}

.action-buttons {
  display: flex;
  gap: var(--spacing-sm);
  margin-left: auto;
}

.filename {
  font-weight: 500;
  color: var(--text-primary);
  text-align: left;
  font-family: 'Courier New', monospace;
}

.complete {
  color: #28a745;
  font-weight: 600;
}

.incomplete {
  color: #dc3545;
  font-weight: 600;
}

.file-size {
  font-family: 'Courier New', monospace;
  font-size: 13px;
}

.player-code {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: var(--text-secondary);
}

.download-btn {
  padding: 4px 8px;
  background: linear-gradient(135deg, var(--primary-hover), var(--primary-color));
  color: white;
  border: none;
  border-radius: var(--radius-medium);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: var(--transition-normal);
  min-width: 50px;
  white-space: nowrap;
}

.download-btn:hover {
  background: linear-gradient(135deg, var(--primary-active), var(--primary-dark));
  transform: translateY(-1px);
  box-shadow: var(--shadow-button);
}

.clickable-row {
  cursor: pointer;
}

.clickable-row:hover {
  background: rgba(255, 235, 220, 0.8);
}

.file-table {
  width: 100%;
  border-collapse: collapse;
  background: rgba(255, 252, 248, 0.9);
  font-size: 14px;
  backdrop-filter: blur(8px);
}

.no-result {
  text-align: center;
  margin: 32px 0;
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 16px;
}

@media (min-width: 768px) {
  .table-wrapper {
    display: flex;
    justify-content: center;
    width: 100%;
  }
}

/* 移动端样式 */
@media (max-width: 768px) {
  .file-table {
    font-size: 14px;
    min-width: 800px; /* 确保表格有足够宽度触发横向滚动 */
    table-layout: fixed; /* 防止单元格内容影响表格布局 */
  }
}
</style>
