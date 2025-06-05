<template>
  <div class="score-table-container">
    <div v-if="loading" class="loading">
      正在加载评分数据...
    </div>
    
    <div v-else-if="error" class="error">
      {{ error }}
    </div>      <div v-else-if="scoreData" class="score-content">      <div class="score-header">
        <h3>{{ scoreData.year }}年第{{ getEditionNumber(scoreData.year) }}届MW杯{{ roundDisplayName }}评分结果</h3>
        <p class="scheme-info">评分方案: {{ scoreData.scoringScheme }}</p>
      </div>

      <!-- 控制面板 -->      <div class="controls-panel">
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
          <div class="search-controls">
          <label>搜索选手:</label>
          <input 
            type="text" 
            v-model="searchPlayer" 
            placeholder="输入选手名称..."
          />
        </div>
  
      </div>

      <!-- 详细评分表 -->      <div class="detailed-scores">
        <h4>详细评分 ({{ filteredDetailRecords.length }} 条记录)</h4>
        <p v-if="scoreData && scoreData.scoringScheme === 'E'" class="scoring-note">注：最终得分 = 评委评分×75% + 换算后大众评分×25%</p>
        
        <!-- 删除分页相关控件和 pageSize 选择器 -->
        <!-- <div class="pagination-controls" v-if="totalPages > 1"> ... </div> -->
        <div class="table-wrapper">
          <table class="score-table">
            <thead>              <!-- 评分方案为C或E时，添加分类行 -->              <tr v-if="['C', 'E'].includes(scoreData.scoringScheme)">
                <th :colspan="2" class="empty-header">人员</th>
                <th colspan="2" class="category-header">欣赏性</th>
                <th colspan="2" class="category-header">创新性</th>
                <th colspan="3" class="category-header">设计性</th>
                <th colspan="3" class="category-header">游戏性</th>
                <th :colspan="scoreData.columns.length - 10 + 2" class="empty-header">其他项</th>
              </tr>
              <tr>
                <th>选手</th>
                <th>评委</th>
                <th v-for="column in scoreData.columns" :key="column">{{ column }}</th>
                <th>{{ scoreData.scoringScheme === 'E' ? '评委评分' : '总分' }}</th>
                <th>最终得分<span v-if="scoreData.scoringScheme === 'E'" class="special-scheme-indicator">*</span></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(playerGroup, playerIndex) in groupedDetailRecords" :key="playerGroup.playerCode">
                <template v-for="(record, recordIndex) in playerGroup.records" :key="`${record.playerCode}-${record.judgeCode}`">
                  <tr :class="{ 'revoked-score': record.isRevoked }">
                    <!-- 只在该选手的第一行显示选手信息，并合并行 -->
                    <td v-if="recordIndex === 0" :rowspan="playerGroup.records.length" class="player-name player-cell-merged">
                      <span v-if="record.playerCode !== record.playerName" class="player-code">{{ record.playerCode }}</span>
                      <span class="player-name-text">{{ record.playerName }}</span>
                    </td>                      <!-- 处理未上传关卡的选手，将评委到总分的所有列合并为一个"未上传"单元格 -->
                    <td v-if="record.isNoSubmission" 
                        :colspan="scoreData.columns.length + 2"
                        class="no-submission-cell">
                      未上传
                    </td>
                    
                    <!-- 处理成绩无效的选手 -->
                    <td v-else-if="record.isCanceled"
                        :colspan="scoreData.columns.length + 2"
                        class="canceled-score-cell">
                      成绩无效
                    </td>
                    
                    <!-- 正常选手的评委和分数显示 -->
                    <template v-else>
                      <td class="judge-name">
                        <!-- 手动处理协商评分的评委 -->                        <div v-if="record.judgeName && record.judgeName.includes(',')" class="collaborative-judges">
                          <div 
                            v-for="(judgeCode, index) in record.judgeName.split(',').map((j: string) => j.trim())" 
                            :key="index"
                            class="collaborative-judge-item"
                          >
                            <!-- 显示评委名 -->
                            {{ getUserDisplayName(judgeCode, userMapping) }}
                            <span class="collaborative-tag">协商</span>
                            
                            <!-- 显示重评、预备或大众评委标签 -->
                            <span v-if="isBackupJudge(judgeCode)" class="backup-tag">预备</span>
                            <span v-else-if="isPublicJudge(judgeCode)" class="public-tag">大众</span>
                          </div>
                        </div>
                        
                        <!-- 处理正常评委 -->
                        <div v-else>
                          <!-- 显示评委名称，使用judgeName而不是judgeCode查询用户映射 -->
                          {{ record.judgeName.replace(/（[^）]*）/g, '').trim() }}
                          <!-- 显示协商标签 -->
                          <span v-if="record.isCollaborative" class="collaborative-tag">协商</span>
                          <!-- 只保留一个预备标签，优先重评，其次预备，其次大众 -->
                          <span v-if="isReEvaluationJudge(record.judgeCode, record)" class="re-evaluation-tag">重评</span>
                          <span v-else-if="record.isBackup" class="backup-tag">预备</span>
                          <span v-else-if="isPublicJudge(record.judgeCode)" class="public-tag">大众</span>
                        </div>
                      </td>
                      <td 
                        v-for="column in scoreData.columns" 
                        :key="column"
                        class="score-cell"
                      >
                        {{ formatScore(record.scores[column]) }}
                      </td>
                      <td class="total-score">{{ record.totalScore }}</td>
                    </template>
                    <td class="final-score" v-if="recordIndex === 0" :rowspan="playerGroup.records.length">
                      {{ getPlayerAverageScore(record.playerCode) }}
                    </td>
                  </tr>                </template>                <!-- 添加一个极细的分隔线作为选手间的分隔符 -->
                <tr v-if="playerIndex < groupedDetailRecords.length - 1" class="player-separator">
                  <td :colspan="scoreData.columns.length + 4" class="separator-cell"></td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div><!-- 总分排名表 -->
      <div class="player-totals">
        <h4>总分排名 ({{ filteredPlayerScores.length }} 名选手)</h4>
        <p v-if="scoreData && scoreData.scoringScheme === 'E'" class="scoring-note">注：最终得分 = 评委评分×75% + 换算后大众评分×25%</p>
        <div class="table-wrapper">
          <table class="total-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>选手</th>
                <th>有效评分次数</th>
                <th v-if="scoreData.scoringScheme !== 'E'">总分之和</th>
                <th>最终得分<span v-if="scoreData.scoringScheme === 'E'" class="special-scheme-indicator">*</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(player, index) in filteredPlayerScores" :key="player.playerCode">
                <!-- 成绩无效的选手，排名显示为横杠，但得分保持显示原始值 -->
                <td class="rank">
                  <template v-if="player.records.length > 0 && player.records[0].isCanceled">-</template>
                  <template v-else>{{ index + 1 }}</template>
                </td>
                <td class="player-name">
                  <span v-if="player.playerCode !== player.playerName" class="player-code">{{ player.playerCode }}</span>
                  <span class="player-name-text">{{ player.playerName }}</span>
                </td>
                <td class="count">{{ player.validRecordsCount }}</td>
                <td v-if="scoreData.scoringScheme !== 'E'" class="sum">{{ player.totalSum }}</td>
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
import { loadRoundScoreData, type RoundScoreData, type ScoreRecord, buildPlayerJudgeMap } from '../utils/scoreCalculator'
import { fetchMarioWorkerYaml, extractSeasonData } from '../utils/yamlLoader'
import { getEditionNumber } from '../utils/editionHelper'
import { loadUserMapping, getUserDisplayName, type UserMapping } from '../utils/userMapper'

// 通过 NoSubmissionRecord.d.ts 扩展了 ScoreRecord 类型，添加了 isNoSubmission 属性
import '../NoSubmissionRecord.d.ts'

const props = defineProps<{
  year: string
  round: string
}>()

// 控制状态
const filterJudgeType = ref<'all' | 'normal' | 'backup' | 'collaborative' | 'revoked'>('all')
const searchPlayer = ref('')

const scoreData = ref<RoundScoreData | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const roundDisplayName = ref<string>('')
const userMapping = ref<UserMapping>({})
const yamlData = ref<any>(null) // 存储原始YAML数据用于查找未上传选手

// 计算未上传关卡的选手
const noSubmissionPlayers = computed(() => {
  if (!scoreData.value || !yamlData.value) return [];
  
  try {
    // 获取原始评分记录中的选手代码
    const existingPlayerCodes = new Set(
      scoreData.value.allRecords.map(record => record.playerCode)
    );
    
    // 获取成绩无效的选手代码
    const canceledPlayerCodes = new Set(
      scoreData.value.allRecords
        .filter(record => record.isCanceled)
        .map(record => record.playerCode)
    );
    
    // 从 YAML 获取全部选手信息
    const playerMapResult = buildPlayerJudgeMap(
      yamlData.value, 
      scoreData.value.year, 
      scoreData.value.round
    );
    
    // 找出未上传关卡的选手
    const noSubmissionRecords: ScoreRecord[] = [];
    
    // 按照 YAML 文件中选手码的顺序创建未提交记录
    for (const [playerCode, playerNameValue] of Object.entries(playerMapResult.players)) {
      // 排除已有记录和成绩无效的选手
      if (!existingPlayerCodes.has(playerCode) && !canceledPlayerCodes.has(playerCode)) {
        // 为未提交关卡的选手创建一个记录
        const noSubmissionRecord: ScoreRecord = {
          playerCode,
          judgeCode: "no_submission",
          originalJudgeCode: "no_submission",
          playerName: String(playerNameValue), // 确保转换为字符串
          judgeName: "未上传",
          scores: {},
          totalScore: 0,
          isNoSubmission: true
        };
        noSubmissionRecords.push(noSubmissionRecord);
      }
    }
    
    return noSubmissionRecords;
  } catch (error) {
    console.error('处理未上传关卡选手时出错:', error);
    return [];
  }
});

// 使用 userMapper.ts 中的 getUserDisplayName 函数来获取评委和选手的名称

function isBackupJudge(judgeCode: string): boolean {
  return judgeCode.includes('JR');
}

function isPublicJudge(judgeCode: string): boolean {
  // 2023 P1轮次的JZ评委是大众评委
  return props.year === '2023' && props.round === 'P1' && judgeCode.startsWith('JZ');
}

function isReEvaluationJudge(judgeCode: string, record: any): boolean {
  if (!isBackupJudge(judgeCode) || !scoreData.value) return false;
  
  // 检查是否有对应的作废评分来判断是重评还是预备
  const baseJudgeCode = judgeCode.replace('JR', 'J');
  
  return scoreData.value.allRecords.some(r => 
    r.playerCode === record.playerCode && 
    r.isRevoked && 
    r.judgeCode.replace(/^~/, '') === baseJudgeCode
  );
}

// 筛选详细评分记录
const filteredDetailRecords = computed(() => {
  if (!scoreData.value || !yamlData.value) return []
  
  // 合并原始评分记录和未提交关卡的选手记录
  let records = [...scoreData.value.allRecords]
  
  // 根据筛选条件决定是否加入未提交记录
  if (filterJudgeType.value === 'all' || filterJudgeType.value === 'normal') {
    // 只有在显示全部或普通评分时才加入未提交记录
    records = [...records, ...noSubmissionPlayers.value]
  }
  
  // 按评委类型筛选
  if (filterJudgeType.value !== 'all') {
    records = records.filter(record => {
      // 对未提交选手和成绩无效选手的特殊处理
      if (record.isNoSubmission || record.isCanceled) {
        return filterJudgeType.value === 'normal'
      }
      
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
  
  // 按YAML中的选手顺序对所有记录进行排序
  if (yamlData.value) {
    try {
      // 从YAML获取选手顺序
      const playerMapResult = buildPlayerJudgeMap(
        yamlData.value, 
        scoreData.value.year, 
        scoreData.value.round
      );
      
      // 创建一个根据YAML中的选手码顺序排序的映射
      const playerCodeOrderMap = new Map(
        Object.keys(playerMapResult.players).map((code, index) => [code, index])
      );
      
      // 按照YAML中的选手顺序排序
      records.sort((a, b) => {
        const orderA = playerCodeOrderMap.get(a.playerCode);
        const orderB = playerCodeOrderMap.get(b.playerCode);
        
        // 如果都有序号，按序号排序
        if (orderA !== undefined && orderB !== undefined) {
          return orderA - orderB;
        }
        // 如果只有一方有序号，有序号的排前面
        else if (orderA !== undefined) return -1;
        else if (orderB !== undefined) return 1;
        // 都没有序号，维持原来的顺序
        else return 0;
      });
    } catch (error) {
      console.error('按选手顺序排序时出错:', error);
    }
  }
  
  return records
})

// groupedDetailRecords 直接基于 filteredDetailRecords
const groupedDetailRecords = computed(() => {
  if (!filteredDetailRecords.value.length) return []

  // 先按选手代码对记录进行分组
  const groups: { [key: string]: any } = {}

  // 直接用全部 filteredDetailRecords
  const recordsToDisplay = filteredDetailRecords.value

  recordsToDisplay.forEach((record) => {
    const key = record.playerCode
    if (!groups[key]) {
      groups[key] = {
        playerCode: record.playerCode,
        playerName: record.playerName,
        records: []
      }
    }
    groups[key].records.push(record)
  })

  // 合并内容完全相同的评分项（协商评分合并）
  Object.values(groups).forEach((group: any) => {
    const merged: any[] = []
    const mergedMap: Record<string, any> = {}
    group.records.forEach((rec: any) => {
      // 生成评分内容指纹（不含评委信息）
      const scoreFingerprint = JSON.stringify({
        scores: rec.scores,
        totalScore: rec.totalScore
      })
      if (!mergedMap[scoreFingerprint]) {
        // 新分组
        mergedMap[scoreFingerprint] = {
          ...rec,
          judgeName: rec.judgeName,
          judgeCodes: [rec.judgeCode],
          judgeNames: [rec.judgeName],
          _mergeCount: 1
        }
      } else {
        // 合并评委
        mergedMap[scoreFingerprint].judgeCodes.push(rec.judgeCode)
        mergedMap[scoreFingerprint].judgeNames.push(rec.judgeName)
        mergedMap[scoreFingerprint]._mergeCount++
      }
    })
    // 合并评委名显示
    for (const item of Object.values(mergedMap)) {
      if (item._mergeCount > 1) {
        // 合并评委名（去重）
        const judgeNames = Array.from(new Set(item.judgeNames.join(',').split(',').map((j: string) => j.trim()))).join(', ')
        item.judgeName = judgeNames
        item.isCollaborative = true
      }
      merged.push(item)
    }
    group.records = merged
  })

  // 转换为数组格式
  return Object.values(groups)
})

// 筛选选手总分
const filteredPlayerScores = computed(() => {
  if (!scoreData.value || !yamlData.value) return []
  
  // 基于现有的选手分数
  let players = [...scoreData.value.playerScores]
  
  // 为未上传关卡的选手创建成绩记录
  const noSubmissionPlayerScores = noSubmissionPlayers.value.map(record => {
    return {
      playerCode: record.playerCode,
      playerName: record.playerName,
      records: [record], // 只有一条"未上传"的记录
      totalSum: 0,
      averageScore: 0, // 未上传关卡选手的平均分为0
      validRecordsCount: 0 // 有效记录数为0
    }
  });
  
  // 合并已有成绩和未上传关卡的选手
  players = [...players, ...noSubmissionPlayerScores];
  
  // 按选手名称搜索
  if (searchPlayer.value.trim()) {
    const searchTerm = searchPlayer.value.trim().toLowerCase()
    players = players.filter(player => 
      player.playerName.toLowerCase().includes(searchTerm) ||
      player.playerCode.toLowerCase().includes(searchTerm)
    )
  }
  
  // 首先按平均分从高到低排序
  players = [...players].sort((a, b) => b.averageScore - a.averageScore)
  
  // 然后，对于同分数的选手，按YAML中的选手顺序排序
  try {
    // 从YAML获取选手顺序
    const playerMapResult = buildPlayerJudgeMap(
      yamlData.value, 
      scoreData.value.year, 
      scoreData.value.round
    );
    
    // 创建一个根据YAML中的选手码顺序排序的映射
    const playerCodeOrderMap = new Map(
      Object.keys(playerMapResult.players).map((code, index) => [code, index])
    );
    
    // 二次排序：对于平均分相同的选手，按照YAML中的选手顺序排序
    players = players.sort((a, b) => {
      // 如果分数不同，保持原来的分数排序
      if (a.averageScore !== b.averageScore) {
        return b.averageScore - a.averageScore;
      }
      
      // 如果分数相同，按照YAML中的选手顺序排序
      const orderA = playerCodeOrderMap.get(a.playerCode);
      const orderB = playerCodeOrderMap.get(b.playerCode);
      
      // 如果都有序号，按序号排序
      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB;
      }
      // 如果只有一方有序号，有序号的排前面
      else if (orderA !== undefined) return -1;
      else if (orderB !== undefined) return 1;
      // 都没有序号，维持原来的顺序
      else return 0;
    });
  } catch (error) {
    console.error('按选手顺序排序时出错:', error);
  }
  
  return players
})

async function loadScoreData() {
  if (!props.year || !props.round) {
    return
  }
  
  loading.value = true
  error.value = null
  
  try {
    // 加载YAML数据
    const yamlDoc = await fetchMarioWorkerYaml()
    yamlData.value = yamlDoc // 保存原始的YAML数据，用于获取未上传选手
    const seasonData = extractSeasonData(yamlDoc)
    
    // 加载用户映射数据
    userMapping.value = await loadUserMapping()
    
    // 获取轮次显示名称
    const roundData = seasonData[props.year]?.rounds?.[props.round]
    if (props.round === 'P1') {
      roundDisplayName.value = roundData?.is_warmup ? '热身赛' : '预选赛'
    } else {
      const roundNames: { [key: string]: string } = {
        'P2': '资格赛',
        'I1': '初赛第一轮',
        'I2': '初赛第二轮', 
        'I3': '初赛第三轮',
        'I4': '初赛第四轮',
        'G1': '小组赛第一轮',
        'G2': '小组赛第二轮',
        'G3': '小组赛第三轮',
        'G4': '小组赛第四轮',
        'Q1': '四分之一决赛第一轮',
        'Q2': '四分之一决赛第二轮',
        'Q': '四分之一决赛',
        'R1': '复赛第一轮',
        'R2': '复赛第二轮',
        'R3': '复赛第三轮',
        'R': '复赛',
        'S1': '半决赛第一轮',
        'S2': '半决赛第二轮',
        'S': '半决赛',
        'F': '决赛'
      }
      roundDisplayName.value = roundNames[props.round] || props.round
    }
    
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
  // 对数字类型进行格式化，保留一位小数
  if (typeof score === 'number') {
    return score.toFixed(1)
  } else if (typeof score === 'string') {
    return score
  } else {
    return '-'
  }
}

// 获取选手的平均分
function getPlayerAverageScore(playerCode: string): string {
  if (!scoreData.value) return '-';
  
  const playerScore = scoreData.value.playerScores.find(p => p.playerCode === playerCode);
  if (!playerScore) return '-';
  
  // 返回四舍五入到小数点后1位的分数
  return playerScore.averageScore.toFixed(1);
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

.scoring-note {
  margin: 5px 0 10px;
  color: #e74c3c;
  font-size: 13px;
  font-style: italic;
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

.filter-controls, .search-controls {
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

.scoring-note {
  margin: 0 0 10px 0;
  color: #e74c3c;
  font-size: 14px;
  font-style: italic;
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
  font-size: 14px;
}

.score-table th, .score-table td,
.total-table th, .total-table td {
  padding: 8px 10px;
  text-align: center;
  border-bottom: 1px solid #eee;
}

.score-table th, .total-table th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #495057;
  border-bottom: 2px solid #dee2e6;
  text-align: center;
}

.score-table tbody tr:not(.player-separator):hover,
.total-table tbody tr:hover {
  background-color: #f1f1f1;
}

.category-header {
  background-color: #e9ecef;
  color: #343a40;
  font-weight: 500;
  border-bottom: 1px solid #dee2e6;
}

.empty-header {
  background-color: #f8f9fa;
}

.player-name {
  font-weight: 500;
  color: #2c3e50;
  text-align: left;
}

.player-cell-merged {
  background-color: #f8f9fa;
  vertical-align: middle;
  border-right: 2px solid #dee2e6;
}

.player-separator .separator-cell {
  background-color: #f8f9fa;
  border-bottom: 2px #dee2e6;
  padding: 0;
  line-height: 2px;
  height: 2px;
}

.player-code {
  display: inline-block;
  background-color: #3498db;
  color: white;
  padding: 2px 5px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: bold;
  margin-right: 6px;
  font-family: 'Courier New', monospace;
}

.player-name-text {
  font-weight: 500;
}

.judge-name {
  color: #34495e;
  position: relative;
  text-align: left;
}

.collaborative-judge-item {
  margin-bottom: 4px;
}

.collaborative-judge-item:last-child {
  margin-bottom: 0;
}

.collaborative-tag {
  display: inline-block;
  background-color: #17a2b8;
  color: white;
  font-size: 9px;
  padding: 1px 3px;
  border-radius: 2px;
  margin-left: 4px;
}

.re-evaluation-tag {
  display: inline-block;
  background-color: #dc3545;
  color: white;
  font-size: 9px;
  padding: 1px 3px;
  border-radius: 2px;
  margin-left: 4px;
}

.backup-tag {
  display: inline-block;
  background-color: #6c757d;
  color: white;
  font-size: 9px;
  padding: 1px 3px;
  border-radius: 2px;
  margin-left: 4px;
}

.public-tag {
  display: inline-block;
  background-color: #28a745;
  color: white;
  font-size: 9px;
  padding: 1px 3px;
  border-radius: 2px;
  margin-left: 4px;
}

.score-cell {
  text-align: center;
  font-family: 'Courier New', monospace;
  font-size: 13px;
}

.total-score {
  font-weight: 600;
  text-align: center;
  font-size: 13px;
}

.final-score {
  font-weight: 600;
  color: #e74c3c;
  text-align: center;
  background-color: #f8f9fa;
  font-size: 13px;
}

.special-scheme-indicator {
  color: #e74c3c;
  font-weight: bold;
  margin-left: 2px;
}

/* 完全重构撤销的评分行样式，以分离处理透明度 */
.revoked-score {
  background-color: #f8d7da;
}

/* 只有评分单元格和总分应用透明度和删除线 */
.revoked-score .score-cell, 
.revoked-score .total-score {
  text-decoration: line-through;
  opacity: 0.7;
}

/* 确保选手名称、评委名称和最终得分不会应用删除线效果 */
.revoked-score .player-name,
.revoked-score .judge-name,
.revoked-score .final-score {
  text-decoration: none;
  opacity: 1;
}

.rank {
  text-align: center;
  font-weight: 600;
  color: #495057;
}

.count, .sum, .average {
  text-align: center;
  font-family: 'Courier New', monospace;
  font-size: 13px;
}

.average {
  font-weight: 600;
  color: #e74c3c;
  font-size: 14px;
}

/* 移除排名前三的特殊样式 */

/* 响应式设计 */
@media (max-width: 768px) {
  .score-table-container {
    padding: 10px;
  }
  
  .score-table th, .score-table td,
  .total-table th, .total-table td {
    padding: 6px 4px;
    font-size: 12px;
  }
  
  .score-header h3 {
    font-size: 20px;
  }
}

.no-submission-cell {
  font-style: italic;
  color: #888;
  text-align: center;
  background-color: #f8f8f8;
}

.canceled-score-cell {
  font-style: italic;
  color: #d9534f;
  text-align: center;
  background-color: #f8f8f8;
  font-weight: 500;
}
</style>
