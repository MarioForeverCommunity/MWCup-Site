<template>
  <div class="control-panel animate-fadeInUp">
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">届次：</label>
        <select v-model="selectedYear" @change="onYearChange" class="form-control hover-scale">
          <option value="">请选择届次</option>
          <option v-for="year in availableYears" :key="year" :value="year">
            {{ year }}年第{{ getEditionNumber(year) }}届
          </option>
        </select>
      </div>
      <div class="form-group animate-scaleIn" v-if="selectedYear">
        <label class="form-label">轮次：</label>
        <select v-model="selectedRound" @change="onRoundChange" class="form-control hover-scale">
          <option value="">全部轮次</option>
          <option v-for="round in availableRounds" :key="round.key" :value="round.key">
            {{ round.name }}
          </option>
        </select>
      </div>
      <div class="form-group" style="min-width:220px;flex:1;">
        <label class="form-label">关键词：</label>
        <div class="search-input-group">
          <input 
            v-model="searchKeyword" 
            type="text" 
            placeholder="输入选手名或文件名关键词"
            class="form-control hover-scale"
          >
        </div>
      </div>
    </div>
  </div>
  <div v-if="loading" class="loading-state animate-pulse">
    <div class="loading-spinner"></div>
    <div class="loading-text">{{ getLoadingText() }}<span class="loading-dots"></span></div>
  </div>
  <div v-if="error" class="error-state">
    错误: {{ error }}
  </div>
  <div v-if="searchResults && searchResults.length > 0" class="content-panel animate-fadeInUp">
    <div class="section-header">
      <h3>找到的关卡文件 ({{ searchResults.length }} 个)</h3>
    </div>
    <div class="table-wrapper">
      <table class="table-base file-table">
        <thead>
          <tr>
            <th>选手码</th>
            <th>选手名</th>
            <th>文件名</th>
            <th>年份</th>
            <th>轮次</th>
            <th>分组</th>
            <th>上传时间</th>
            <th>文件大小</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="(file) in searchResults" 
            :key="file.path" 
            class="table-row"
          >
            <td class="player-code">{{ (file.playerCode === file.playerName) ? '-' : (file.playerCode || '-') }}</td>
            <td>{{ file.playerName || '-' }}</td>
            <td class="filename">{{ file.name }}</td>
            <td>{{ file.year || '-' }}</td>
            <td>{{ getRefinedRoundType(file) }}</td>
            <td>{{ file.groupCode ? getGroupDisplayName(file.groupCode) : '-' }}</td>
            <td>{{ formatDate(file.mtime) }}</td>
            <td class="file-size">{{ formatFileSize(file.size) }}</td>
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
import { ref, onMounted, watch } from 'vue'
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

// 选择器模式的数据
const selectedYear = ref('')
const selectedRound = ref('')
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
  availableRounds.value = []
  
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

function getLoadingText(): string {
  if (selectedRound.value) {
    return '正在加载该轮次所有文件...'
  }
  if (selectedYear.value) {
    return `正在加载${selectedYear.value}年全部关卡...`
  }
  return '正在加载关卡文件...'
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

// 防抖定时器
let searchDebounceTimer: number | null = null

// 自动搜索：监听所有筛选项和关键词变化
watch([selectedYear, selectedRound, searchKeyword], ([year, , keyword]) => {
  // 没有任何条件时清空
  if (!year && !keyword) {
    searchResults.value = [];
    searched.value = false;
    return;
  }
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = window.setTimeout(() => {
    searchBySelectorAndKeyword();
  }, 200);
});

function searchBySelectorAndKeyword() {
  // 允许未选届次时关键词全局搜索
  const keyword = searchKeyword.value.trim();
  if (!selectedYear.value && !keyword) {
    searchResults.value = [];
    searched.value = false;
    return;
  }
  loading.value = true;
  error.value = '';
  searchResults.value = [];
  searched.value = false;
  fetchLevelFilesFromLocal().then(async files => {
    let results = files;
    // 先按筛选条件过滤（如果有）
    if (selectedYear.value) {
      results = results.filter(file => {
        if (file.year !== parseInt(selectedYear.value)) return false;
        if (selectedRound.value && file.roundKey !== selectedRound.value) return false;
        return true;
      });
    }
    // 再按关键词过滤（如果有）
    if (keyword) {
      const isExact = keyword.startsWith('"') && keyword.endsWith('"');
      const processedKeyword = isExact ? keyword.slice(1, -1) : keyword;
      const lowerKeyword = processedKeyword.toLowerCase();
      results = results.filter(file => {
        if (isExact) {
          return (file.name && file.name.toLowerCase() === lowerKeyword) ||
                 (file.playerCode && file.playerCode.toLowerCase() === lowerKeyword);
        } else {
          return (
            (file.name && file.name.toLowerCase().includes(lowerKeyword)) ||
            (file.playerCode && file.playerCode.toLowerCase().includes(lowerKeyword)) ||
            (file.playerName && file.playerName.toLowerCase().includes(lowerKeyword))
          );
        }
      });
    }
    // 排序逻辑
    const roundOrder = ['P1', 'P2', 'I1', 'I2', 'I3', 'I4', 'G1', 'G2', 'G3', 'G4', 'Q1', 'Q2', 'Q', 'R1', 'R2', 'R3', 'R', 'S1', 'S2', 'S', 'F'];
    if (selectedYear.value && selectedRound.value) {
      try {
        const { buildPlayerJudgeMap } = await import('../utils/scoreCalculator');
        const playerMapResult = buildPlayerJudgeMap(yamlData, selectedYear.value, selectedRound.value);
        const playerCodeOrderMap = new Map(Object.keys(playerMapResult.players || {}).map((code, index) => [code, index]));
        results.sort((a, b) => {
          const orderA = playerCodeOrderMap.get(a.playerCode || '');
          const orderB = playerCodeOrderMap.get(b.playerCode || '');
          if (orderA !== undefined && orderB !== undefined && orderA !== orderB) {
            return orderA - orderB;
          }
          return a.name.localeCompare(b.name);
        });
      } catch (error) {
        results.sort((a, b) => a.name.localeCompare(b.name));
      }
    } else if (selectedYear.value) {
      try {
        const roundGroups = new Map<string, LevelFile[]>();
        results.forEach(file => {
          const round = file.roundKey || '';
          if (!roundGroups.has(round)) {
            roundGroups.set(round, []);
          }
          roundGroups.get(round)?.push(file);
        });
        const { buildPlayerJudgeMap } = await import('../utils/scoreCalculator');
        for (const [round, files] of roundGroups) {
          if (!round) continue;
          try {
            const playerMapResult = buildPlayerJudgeMap(yamlData, selectedYear.value, round);
            const playerCodeOrderMap = new Map(Object.keys(playerMapResult.players || {}).map((code, index) => [code, index]));
            files.sort((a, b) => {
              const orderA = playerCodeOrderMap.get(a.playerCode || '');
              const orderB = playerCodeOrderMap.get(b.playerCode || '');
              if (orderA !== undefined && orderB !== undefined && orderA !== orderB) {
                return orderA - orderB;
              }
              return a.name.localeCompare(b.name);
            });
          } catch (error) {
            files.sort((a, b) => (a.playerCode || '').localeCompare(b.playerCode || ''));
          }
        }
        results = [];
        for (const round of roundOrder) {
          if (roundGroups.has(round)) {
            results.push(...(roundGroups.get(round) || []));
          }
        }
        const unknownRoundFiles = roundGroups.get('') || [];
        if (unknownRoundFiles.length > 0) {
          unknownRoundFiles.sort((a, b) => a.name.localeCompare(b.name));
          results.push(...unknownRoundFiles);
        }
      } catch (error) {
        results.sort((a, b) => {
          const aIndex = roundOrder.indexOf(a.roundKey || '');
          const bIndex = roundOrder.indexOf(b.roundKey || '');
          if (aIndex !== bIndex) {
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
          }
          return (a.playerCode || '').localeCompare(b.playerCode || '');
        });
      }
    } else {
      // 未选届次时，先按年份降序，再按 roundOrder 排序，每个 round 内按 playerCode 排序
      const yearGroups = new Map<number, LevelFile[]>();
      results.forEach(file => {
        const year = file.year || 0;
        if (!yearGroups.has(year)) {
          yearGroups.set(year, []);
        }
        yearGroups.get(year)!.push(file);
      });
      const sortedYears = Array.from(yearGroups.keys()).sort((a, b) => b - a); // 年份降序
      const roundOrder = ['P1', 'P2', 'I1', 'I2', 'I3', 'I4', 'G1', 'G2', 'G3', 'G4', 'Q1', 'Q2', 'Q', 'R1', 'R2', 'R3', 'R', 'S1', 'S2', 'S', 'F'];
      results = [];
      for (const year of sortedYears) {
        const filesOfYear = yearGroups.get(year)!;
        // 按 round 分组
        const roundGroups = new Map<string, LevelFile[]>();
        filesOfYear.forEach(file => {
          const round = file.roundKey || '';
          if (!roundGroups.has(round)) {
            roundGroups.set(round, []);
          }
          roundGroups.get(round)!.push(file);
        });
        // 每个 round 内部排序：先按 playerCode，再按 name
        for (const files of roundGroups.values()) {
          files.sort((a: LevelFile, b: LevelFile) => {
            if (a.playerCode && b.playerCode && a.playerCode !== b.playerCode) {
              return a.playerCode.localeCompare(b.playerCode);
            }
            return a.name.localeCompare(b.name);
          });
        }
        // 按 roundOrder 排序
        for (const round of roundOrder) {
          if (roundGroups.has(round)) {
            results.push(...roundGroups.get(round)!);
          }
        }
        // 未知轮次的放最后
        const unknownRoundFiles = roundGroups.get('') || [];
        if (unknownRoundFiles.length > 0) {
          unknownRoundFiles.sort((a: LevelFile, b: LevelFile) => a.name.localeCompare(b.name));
          results.push(...unknownRoundFiles);
        }
      }
    }
    searchResults.value = results;
    searched.value = true;
    loading.value = false;
  }).catch(err => {
    error.value = err instanceof Error ? err.message : '未知错误';
    loading.value = false;
  });
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
  margin: 0;
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
