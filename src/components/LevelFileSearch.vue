<template>
  <div class="page-header animate-fadeInUp">
    <h2 class="animate-textGlow">Mario Worker 杯关卡文件查询</h2>
    
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
          <label class="form-label">届次:</label>
          <select v-model="selectedYear" @change="onYearChange" class="form-control hover-scale">
            <option value="">请选择届次</option>
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
        <button @click="searchBySelector" :disabled="!selectedYear" class="btn-primary">
          {{ getSearchButtonText() }}
        </button>
      </div>
    </div>
  </div>
  <!-- 按选手名/文件名搜索 -->
  <div v-if="searchMode === 'search'" class="content-panel animate-fadeInUp">
    <div class="form-group">
      <label class="form-label">搜索关键词:</label>
      <div class="search-input-group">
        <input 
          v-model="searchKeyword" 
          type="text" 
          placeholder="输入选手名或文件名关键词"
          @keyup.enter="searchByKeyword"
          class="form-control"
        >
        <button @click="searchByKeyword" class="btn-primary hover-scale">搜索</button>
      </div>
    </div>
  </div>
  <div v-if="loading" class="loading-state animate-pulse">
    <div class="loading-spinner"></div>
    <div class="loading-text">加载中<span class="loading-dots"></span></div>
  </div>

  <div v-if="error" class="error-state">
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
            class="table-row"
          >
            <td class="filename">{{ file.name }}</td>
            <td class="player-code">{{ file.playerCode || '-' }}</td>
            <td>{{ file.playerName || '-' }}</td>
            <td>{{ file.year || '-' }}</td>
            <td>{{ getRefinedRoundType(file) }}</td>
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
            key: singleRound,
            name: getRoundChineseName(singleRound, Object.assign({}, roundData, { year: String(selectedYear.value) }))
          });
        }
        continue;
      }
      
      // 处理普通的单轮次
      roundList.push({
        key: roundKey,
        name: getRoundChineseName(roundKey, Object.assign({}, roundData, { year: String(selectedYear.value) }))
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

function getSearchButtonText(): string {
  if (selectedPlayer.value) {
    return '查找该选手关卡文件'
  }
  if (selectedRound.value) {
    return '查找该轮次所有文件'
  }
  if (selectedYear.value) {
    return `查找${selectedYear.value}年全部关卡`
  }
  return '查找关卡文件'
}

async function searchBySelector() {
  if (!selectedYear.value) {
    error.value = '请选择届次'
    return
  }

  loading.value = true
  error.value = ''
  searchResults.value = []
  searched.value = false

  try {
    const files = await fetchLevelFilesFromLocal();
    let results = files.filter(file => {
      // 匹配年份
      if (file.year !== parseInt(selectedYear.value)) {
        return false
      }
      
      // 如果选择了轮次，则匹配轮次
      if (selectedRound.value && file.roundKey !== selectedRound.value) {
        return false
      }
      
      // 如果选择了选手，则匹配选手码
      if (selectedPlayer.value && file.playerCode !== selectedPlayer.value) {
        return false
      }
      
      return true
    })
    
    // 对结果进行排序
    const roundOrder = ['P1', 'P2', 'I1', 'I2', 'I3', 'I4', 'G1', 'G2', 'G3', 'G4', 'Q1', 'Q2', 'Q', 'R1', 'R2', 'R3', 'R', 'S1', 'S2', 'S', 'F']
    
    if (selectedRound.value) {
      // 如果选择了轮次，优先按照选手顺序排序
      try {
        const { buildPlayerJudgeMap } = await import('../utils/scoreCalculator')
        const playerMapResult = buildPlayerJudgeMap(
          yamlData, 
          selectedYear.value, 
          selectedRound.value
        )
        
        // 创建选手顺序映射
        const playerCodeOrderMap = new Map(
          Object.keys(playerMapResult.players || {}).map((code, index) => [code, index])
        )
        
        results.sort((a, b) => {
          const orderA = playerCodeOrderMap.get(a.playerCode || '')
          const orderB = playerCodeOrderMap.get(b.playerCode || '')
          
          // 如果都有顺序，按顺序排序
          if (orderA !== undefined && orderB !== undefined && orderA !== orderB) {
            return orderA - orderB
          }
          
          return a.name.localeCompare(b.name)
        })
      } catch (error) {
        console.error('排序时出错:', error)
        results.sort((a, b) => a.name.localeCompare(b.name))
      }
    } else {      // 如果只选择了年份，先按轮次排序，同轮次内按 YAML 中的选手顺序排序
      try {
        // 首先按轮次分组
        const roundGroups = new Map<string, LevelFile[]>()
        results.forEach(file => {
          const round = file.roundKey || ''
          if (!roundGroups.has(round)) {
            roundGroups.set(round, [])
          }
          roundGroups.get(round)?.push(file)
        })

        // 对每个轮次组应用 YAML 中的选手顺序
        const { buildPlayerJudgeMap } = await import('../utils/scoreCalculator')
        for (const [round, files] of roundGroups) {
          if (!round) continue
          try {
            const playerMapResult = buildPlayerJudgeMap(
              yamlData,
              selectedYear.value,
              round
            )
            const playerCodeOrderMap = new Map(
              Object.keys(playerMapResult.players || {}).map((code, index) => [code, index])
            )
            files.sort((a, b) => {
              const orderA = playerCodeOrderMap.get(a.playerCode || '')
              const orderB = playerCodeOrderMap.get(b.playerCode || '')
              if (orderA !== undefined && orderB !== undefined && orderA !== orderB) {
                return orderA - orderB
              }
              return a.name.localeCompare(b.name)
            })
          } catch (error) {
            console.error(`排序轮次 ${round} 时出错:`, error)
            files.sort((a, b) => (a.playerCode || '').localeCompare(b.playerCode || ''))
          }
        }

        // 按轮次顺序重新组合结果
        results = []
        for (const round of roundOrder) {
          if (roundGroups.has(round)) {
            results.push(...(roundGroups.get(round) || []))
          }
        }
        // 添加未知轮次的文件
        const unknownRoundFiles = roundGroups.get('') || []
        if (unknownRoundFiles.length > 0) {
          unknownRoundFiles.sort((a, b) => a.name.localeCompare(b.name))
          results.push(...unknownRoundFiles)
        }
      } catch (error) {
        console.error('按轮次和选手顺序排序时出错:', error)
        // 降级到基础排序
        results.sort((a, b) => {
          const aIndex = roundOrder.indexOf(a.roundKey || '')
          const bIndex = roundOrder.indexOf(b.roundKey || '')
          if (aIndex !== bIndex) {
            if (aIndex === -1) return 1
            if (bIndex === -1) return -1
            return aIndex - bIndex
          }
          return (a.playerCode || '').localeCompare(b.playerCode || '')
        })
      }
    }
    
    searchResults.value = results
    searched.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : '未知错误'
  } finally {
    loading.value = false
  }
}

function searchByKeyword() {
  if (!searchKeyword.value.trim()) {
    error.value = '请输入搜索关键词'
    return
  }

  loading.value = true
  error.value = ''
  searchResults.value = []
  searched.value = false

  // 关键词处理：支持精确查找和模糊查找
  const keyword = searchKeyword.value.trim()
  const isExact = keyword.startsWith('"') && keyword.endsWith('"')
  const processedKeyword = isExact ? keyword.slice(1, -1) : keyword

  try {
    // 从本地加载文件
    fetchLevelFilesFromLocal().then(async files => {
      let results = files.filter(file => {
        // 精确查找
        if (isExact) {
          return file.name === processedKeyword || file.playerCode === processedKeyword
        } else {
          // 模糊查找
          return (
            (file.name && file.name.includes(processedKeyword)) ||
            (file.playerCode && file.playerCode.includes(processedKeyword)) ||
            (file.playerName && file.playerName.includes(processedKeyword))
          )
        }
      })

      // 按照选手顺序排序
      if (yamlData) {
        try {
          const { buildPlayerJudgeMap } = await import('../utils/scoreCalculator')
          const playerMapResult = buildPlayerJudgeMap(yamlData, selectedYear.value, selectedRound.value)
          const playerCodeOrderMap = new Map(Object.keys(playerMapResult.players).map((code, index) => [code, index]))

          results.sort((a, b) => {
            const orderA = playerCodeOrderMap.get(a.playerCode || '')
            const orderB = playerCodeOrderMap.get(b.playerCode || '')
            
            if (orderA !== undefined && orderB !== undefined) {
              if (orderA !== orderB) return orderA - orderB
            }
            else if (orderA !== undefined) return -1
            else if (orderB !== undefined) return 1
            
            return a.name.localeCompare(b.name)
          })
        } catch (error) {
          console.error('排序时出错:', error)
          // 降级到基本排序
          results.sort((a, b) => a.name.localeCompare(b.name))
        }
      } else {
        results.sort((a, b) => a.name.localeCompare(b.name))
      }
      
      searchResults.value = results
      searched.value = true
    })
  } catch (err) {
    error.value = err instanceof Error ? err.message : '未知错误'
  } finally {
    loading.value = false
  }
}

function downloadLevel(file: LevelFile) {
  const url = `${LEVELS_BASE_URL}${file.path}`
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * 判断某年P1是否为热身赛
 * 2013-2015、2017、2018、2020-2025年P1为热身赛，其余为预选赛
 */
function isWarmupRound(year: number, roundKey: string): boolean {
  const warmupYears = [2013, 2014, 2015, 2017, 2018, 2020, 2021, 2022, 2023, 2024, 2025];
  return roundKey === 'P1' && warmupYears.includes(year);
}

function getRefinedRoundType(file: LevelFile): string {
  if (!file.roundKey) return file.roundType || '-';
  const year = file.year;
  const roundKey = file.roundKey;
  // 2019年小组赛特殊处理
  if (year === 2019 && roundKey.startsWith('G')) {
    const idx = parseInt(roundKey.slice(1), 10);
    if (!isNaN(idx)) {
      return `小组赛第${['一','二','三','四'][idx-1]||idx}题`;
    }
  }
  if (roundKey.startsWith('G')) {
    const idx = parseInt(roundKey.slice(1), 10);
    if (!isNaN(idx)) {
      return `小组赛第${['一','二','三','四'][idx-1]||idx}轮`;
    }
  }
  if (year === 2012 && roundKey.startsWith('I')) {
    const idx = parseInt(roundKey.slice(1), 10);
    if (!isNaN(idx)) {
      return `初赛第${['一','二','三','四'][idx-1]||idx}轮`;
    }
  }
  if (roundKey.startsWith('I')) {
    const idx = parseInt(roundKey.slice(1), 10);
    if (!isNaN(idx)) {
      return `初赛第${['一','二','三','四'][idx-1]||idx}题`;
    }
  }
  if (roundKey.startsWith('R')) {
    const idx = parseInt(roundKey.slice(1), 10);
    if (!isNaN(idx)) {
      return `复赛第${['一','二','三'][idx-1]||idx}题`;
    }
  }
  if (roundKey.startsWith('Q')) {
    const idx = parseInt(roundKey.slice(1), 10);
    if (!isNaN(idx)) {
      return `四分之一决赛第${['一','二'][idx-1]||idx}轮`;
    }
  }
  if (roundKey.startsWith('S')) {
    const idx = parseInt(roundKey.slice(1), 10);
    if (!isNaN(idx)) {
      return `半决赛第${['一','二'][idx-1]||idx}轮`;
    }
  }
  // 预赛/热身赛/资格赛判断
  if (roundKey === 'P1') {
    if (typeof year === 'number' && isWarmupRound(year, roundKey)) {
      return '热身赛';
    } else {
      return '预选赛';
    }
  }
  return file.roundType || '-';
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

.search-input-group {
  display: flex;
  width: 100%;
  align-items: stretch; /* 确保高度一致 */
}

.search-input-group .form-control {
  flex: 1;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-right: none;
  margin: 0;
}

.search-input-group .btn-primary {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  padding: 0 16px;
  white-space: nowrap;
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-buttons {
  display: flex;
  gap: var(--spacing-sm);
  margin-left: auto;
}

.filename {
  font-weight: 500;
  color: var(--text-primary);
}

.complete {
  color: #28a745;
  font-weight: 600;
}

.incomplete {
  color: #dc3545;
  font-weight: 600;
}

.player-code {
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
    font-size: 12px;
    white-space: nowrap; /* 防止文件名换行 */
  }
}
</style>
