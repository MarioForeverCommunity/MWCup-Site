<template>
  <div v-if="loading" class="content-panel animate-fadeInUp">
    <div class="loading-state animate-pulse">
      <div class="loading-spinner"></div>
      <div class="loading-text">正在加载数据<span class="loading-dots"></span></div>
    </div>
  </div>
  <div v-else-if="error" class="content-panel">
    <div class="error-state">
      {{ error }}
    </div>
  </div>
  <div v-else-if="scoreData" class="content-panel animate-fadeInUp">
    <div class="score-header">
      <h3>评分数据
        <FoldButton :is-folded="scoreContentHidden" @toggle="toggleScoreContent" />
      </h3>
    </div>
    <div class="panel-collapse" :class="{'is-expanded': !scoreContentHidden}">
      <!-- 控制面板 -->
      <div class="control-panel">
        <div class="form-group">
          <label class="form-label">搜索选手：</label>
          <input 
            type="text" 
            v-model="searchPlayer" 
            placeholder="输入选手名称..."
            class="form-control hover-scale"
          />
        </div>
        <div class="form-group">
          <label class="form-label">搜索评委：</label>
          <input 
            type="text" 
            v-model="searchJudge" 
            placeholder="输入评委名称..."
            class="form-control hover-scale"
          />
        </div>
      </div>
      <!-- 赛况总表 -->
      <div v-if="filteredOverallRoundData" class="overall-status">
        <h4>赛况总表</h4>
        <div class="table-wrapper">
          <table class="table-base overall-table">
            <thead>
              <tr>
                <th>所在小组</th>
                <th>选手</th>
                <template v-if="filteredOverallRoundData?.roundCodes">
                  <template v-for="(roundCode, index) in filteredOverallRoundData.roundCodes" :key="roundCode">
                    <th>第{{ toChineseNumber(index + 1) }}{{ year === '2012' ? '轮' : isTopicMode(roundCode) ? '题' : '轮' }}得分</th>
                  </template>
                </template>
                <template v-if="filteredOverallRoundData?.isShowValidLevel && filteredOverallRoundData?.validLevelColumns">
                  <th v-for="(col, index) in filteredOverallRoundData.validLevelColumns" :key="'valid-'+index">
                    {{ col.label }}
                  </th>
                </template>
                <th v-if="['2019','2020','2021'].includes(year)">超时扣分</th>
                <th>总得分</th>
                <!-- 2018年单循环赛制特有列 -->
                <th v-if="year === '2018'">胜</th>
                <th v-if="year === '2018'">平</th>
                <th v-if="year === '2018'">负</th>
                <th v-if="year === '2018'">总积分</th>
                <th class="rank-col">小组内排名</th>
                <th class="rank-col">总排名</th>
                <th>是否晋级</th>
              </tr>
            </thead>
            <tbody>
              <template v-if="filteredOverallRoundData?.groups && filteredOverallRoundData?.groupedPlayers">
                <template v-for="(group, groupIndex) in filteredOverallRoundData.groupOrder" :key="group">
                  <template v-for="(player, idx) in filteredOverallRoundData.groupedPlayers[group]" :key="player.playerCode">
                    <tr>
                      <!-- 小组列：只在第一个选手显示，合并单元格 -->
                      <td v-if="idx === 0" :rowspan="filteredOverallRoundData.groupedPlayers[group].length" class="player-cell-merged">{{ group }}</td>
                      <td class="player-name">
                        <span class="player-code">{{ player.playerCode }}</span>
                        <span class="player-name-text">{{ player.playerName }}</span>
                      </td>
                      <td v-for="(score, index) in player.roundScores" :key="index">
                        {{ formatScore(score) }}
                      </td>
                      <template v-if="filteredOverallRoundData?.isShowValidLevel">
                        <td v-for="(validInfo, index) in player.validRounds || []" :key="'valid-'+index" :class="{'valid-level': validInfo?.valid}">
                          {{ validInfo?.label }}<span v-if="validInfo?.exclamation" class="exclamation-mark">（超时）</span>
                        </td>
                      </template>
                      <td v-if="['2019','2020','2021'].includes(year)" class="penalty">
                        {{ player.timeoutPenalty ? '-' + formatScore(player.timeoutPenalty) : '-' }}
                      </td>
                      <td class="total-score">{{ formatScore(player.totalScore) }}</td>
                      <!-- 2018年单循环赛制数据列 -->
                      <td v-if="year === '2018'" class="win-count">{{ player.wins || 0 }}</td>
                      <td v-if="year === '2018'" class="draw-count">{{ player.draws || 0 }}</td>
                      <td v-if="year === '2018'" class="loss-count">{{ player.losses || 0 }}</td>
                      <td v-if="year === '2018'" class="match-points">{{ player.matchPoints || 0 }}</td>
                      <td class="rank-col">{{ player.groupRank }}</td>
                      <td class="rank-col">{{ player.totalRank }}</td>
                      <td :class="{'advanced': isPlayerAdvanced(player.playerName)}">{{ isPlayerAdvanced(player.playerName) ? '是' : '否' }}</td>
                    </tr>
                  </template>
                  <!-- 添加小组间的分隔线 -->
                  <tr v-if="groupIndex < overallRoundData.groupOrder.length - 1" class="group-separator">
                    <td :colspan="overallRoundData.totalColumns" class="separator-cell"></td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 详细评分表 -->
      <div class="detailed-scores">
        <h4>{{ scoreData.scoringScheme === 'E' ? '评委评分' : '详细评分' }}</h4>
        <p class="scheme-info">
          评分标准:
          <template v-if="getSchemeLink(scoreData.scoringScheme)">
            <a 
              :href="getSchemeLink(scoreData.scoringScheme)!" 
              target="_blank" 
              rel="noopener noreferrer"
              class="scheme-link"
            >
              {{ getScoringSchemeDisplayName(scoreData.scoringScheme) }}
            </a>
          </template>
          <template v-else-if="scoreData.scoringScheme === 'C' || 'E'">
            <a 
              href="#" 
              @click.prevent="navigateToDocumentStandard"
              class="scheme-link"
            >
              {{ getScoringSchemeDisplayName(scoreData.scoringScheme) }}
            </a>
          </template>
          <template v-else>
            {{ getScoringSchemeDisplayName(scoreData.scoringScheme) }}
          </template>
        </p>
        <div class="table-wrapper">
          <table class="table-base score-table">
            <thead>
              <!-- 评分方案为C或E时，添加分类行 -->
              <tr v-if="['C', 'E'].includes(scoreData.scoringScheme)">
                <th :colspan="2" class="empty-header">人员</th>
                <th colspan="2" class="category-header">欣赏性</th>
                <th colspan="2" class="category-header">创新性</th>
                <th colspan="3" class="category-header">设计性</th>
                <th colspan="3" class="category-header">游戏性</th>
                <th :colspan="scoreData.columns.length - 10 + 2" class="empty-header">其他项</th>
              </tr>
              <tr v-if="scoreData.scoringScheme === 'S'">
                <th>选手</th>
                <th>最终得分</th>
              </tr>
              <tr v-else>
                <th>选手</th>
                <th>评委</th>
                <th v-for="column in scoreData.columns" :key="column">{{ column }}</th>
                <th>总分</th>
                <th>{{ scoreData.scoringScheme === 'E' ? '评委最终得分' : '最终得分' }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(playerGroup, playerIndex) in groupedDetailRecords" :key="playerGroup.playerCode">
                <template v-for="(record, recordIndex) in playerGroup.records" :key="`${record.playerCode}-${record.judgeCode}`">
                  <!-- S方案的评分记录显示方式与其它评分方案不同 -->
                  <tr v-if="scoreData.scoringScheme === 'S'" :class="{ 'revoked-score': record.isRevoked }">
                    <!-- S方案只显示选手和最终得分 -->
                    <td class="player-name">
                      <span v-if="record.playerCode !== record.playerName && !record.playerCode.startsWith('~')" class="player-code">{{ record.playerCode }}</span>
                      <span class="player-name-text">{{ record.playerName }}</span>
                    </td>
                    <td class="final-score">{{ record.totalScore }}</td>
                  </tr>

                  <!-- 非S方案的正常显示方式 -->
                  <tr v-else :class="{ 'revoked-score': record.isRevoked }">
                    <!-- 只在该选手的第一行显示选手信息，并合并行 -->
                    <td v-if="recordIndex === 0" :rowspan="playerGroup.records.length" class="player-name player-cell-merged">
                      <span v-if="record.playerCode !== record.playerName && !record.playerCode.startsWith('~')" class="player-code">{{ record.playerCode }}</span>
                      <span class="player-name-text">{{ record.playerName }}</span>
                    </td>
                    <!-- 处理取消资格的选手（未上传关卡） -->
                    <td v-if="record.isNoSubmission && record.playerCode.startsWith('~')"
                        :colspan="scoreData.columns.length + 2"
                        class="canceled-score-cell">
                      取消资格
                    </td>
                    <!-- 处理未上传关卡的选手，将评委到总分的所有列合并为一个"未上传"单元格 -->
                    <td v-else-if="record.isNoSubmission"
                        :colspan="scoreData.columns.length + 2"
                        class="no-submission-cell">
                      未上传
                    </td>
                    <!-- 处理成绩无效的选手（已上传关卡） -->
                    <td v-else-if="record.isCanceled"
                        :colspan="scoreData.columns.length + 2"
                        class="canceled-score-cell">
                      成绩无效
                    </td>
                    <!-- 处理无法运行的关卡 -->
                    <td v-else-if="record.isUnworking"
                        :colspan="scoreData.columns.length + 2"
                        class="unworking-level-cell">
                      关卡无法运行
                    </td>
                    
                    <!-- 正常选手的评委和分数显示 -->
                    <template v-else>
                      <td class="judge-name">
                        <!-- 手动处理协商评分的评委 -->
                        <div v-if="record.judgeName && record.judgeName.includes(',')" class="collaborative-judges">
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
                          <!-- 只保留一个预备标签，优先重评，其次预备，其次大众 -->
                          <template v-if="!record.isRevoked">
                            <span v-if="isReEvaluationJudge(record.judgeCode, record)" class="re-evaluation-tag">重评</span>
                            <span v-else-if="record.isBackup" class="backup-tag">预备</span>
                            <span v-else-if="isPublicJudge(record.judgeCode)" class="public-tag">大众</span>
                          </template>
                        </div>
                      </td>
                      <td v-for="column in scoreData.columns" 
                          :key="column" 
                          class="score-cell">
                        {{ formatScore(record.scores[column]) }}
                      </td>
                      <td class="judge-total">{{ formatScore(record.totalScore) }}</td>
                    </template>
                    <td class="final-score" v-if="recordIndex === 0" :rowspan="playerGroup.records.length">
                      {{ getPlayerAverageScore(record.playerCode) }}
                    </td>
                  </tr>
                </template>
                <!-- 添加一个极细的分隔线作为选手间的分隔符 -->
                <tr v-if="playerIndex < groupedDetailRecords.length - 1" class="player-separator">
                  <td :colspan="scoreData.scoringScheme === 'S' ? 2 : scoreData.columns.length + 4" class="separator-cell"></td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        
        <!-- 大众评分表 (仅评分方案E) -->
        <div v-if="scoreData && scoreData.scoringScheme === 'E' && scoreData.publicScores && scoreData.publicScores.length > 0" class="public-scores">
          <h4>大众评分</h4>
          <p class="scheme-info">
          评分标准:
          <a 
            href="https://www.marioforever.net/thread-3479-1-1.html" 
            target="_blank" 
            rel="noopener noreferrer"
            class="scheme-link"
          >
            2025 版大众评选方案
          </a>
        </p>
          <p class="scoring-note">注：基础分按欣赏性得分×1.5、创新性得分×1.5、设计性得分×3、游戏性得分×4的方式计算</p>
          <div class="table-wrapper">
            <table class="table-base score-table">
              <thead>
                <tr>
                  <th>选手</th>
                  <th>大众评分员</th>
                  <th>欣赏性</th>
                  <th>创新性</th>
                  <th>设计性</th>
                  <th>游戏性</th>
                  <th>附加分</th>
                  <th v-if="hasPublicPenalty">扣分</th>
                  <th>换算后总分</th>
                  <th>大众最终得分</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(playerPublicScore, playerIndex) in filteredPublicScoresWithSearch" :key="playerPublicScore.playerCode">
                  <template v-for="(vote, voteIndex) in playerPublicScore.votes" :key="`${playerPublicScore.playerCode}-${vote.voterName}`">
                    <tr>
                      <!-- 只在该选手的第一行显示选手信息，并合并行 -->
                      <td v-if="voteIndex === 0" :rowspan="playerPublicScore.votes.length" class="player-name player-cell-merged">
                        <span v-if="playerPublicScore.playerCode !== playerPublicScore.playerName && !playerPublicScore.playerCode.startsWith('~')" class="player-code">{{ playerPublicScore.playerCode }}</span>
                        <span class="player-name-text">{{ playerPublicScore.playerName }}</span>
                      </td>
                      <td class="voter-name">{{ vote.voterName }}</td>
                      <td class="score-cell">{{ vote.appreciation }} <span class="converted-score">({{ formatScore(vote.appreciation * 1.5) }})</span></td>
                      <td class="score-cell">{{ vote.innovation }} <span class="converted-score">({{ formatScore(vote.innovation * 1.5) }})</span></td>
                      <td class="score-cell">{{ vote.design }} <span class="converted-score">({{ formatScore(vote.design * 3) }})</span></td>
                      <td class="score-cell">{{ vote.gameplay }} <span class="converted-score">({{ formatScore(vote.gameplay * 4) }})</span></td>
                      <td class="score-cell">{{ vote.bonus }} <span v-if="getDisplayedBonus(vote.bonus) !== vote.bonus.toString()" class="converted-score">({{ getDisplayedBonus(vote.bonus) }})</span></td>
                      <td v-if="hasPublicPenalty" class="score-cell">{{ vote.penalty || 0 }}</td>
                      <td class="score-cell">{{ formatScore(vote.totalScore) }}</td>
                      <td v-if="voteIndex === 0" :rowspan="playerPublicScore.votes.length" class="final-score">
                        {{ formatScore(playerPublicScore.finalPublicScore) }}
                        <span v-if="searchJudge && searchJudge.trim()" class="filtered-count">
                          ({{ playerPublicScore.votes.length }}位评委)
                        </span>
                      </td>
                    </tr>
                  </template>
                  <!-- 添加选手间分隔线 -->
                  <tr v-if="playerIndex < filteredPublicScores.length - 1" class="player-separator">
                    <td :colspan="hasPublicPenalty ? 10 : 9" class="separator-cell"></td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
        
        <!-- 总分排名表 -->
        <div class="player-totals">
          <h4>总分排名</h4>
          <p v-if="scoreData && scoreData.scoringScheme === 'E'" class="scoring-note">注：最终得分 = 评委评分×75% + 大众评分×25%</p>
          <div class="table-wrapper">
            <table class="table-base total-table">
              <thead>
                <tr v-if="scoreData.scoringScheme === 'S'">
                  <th>排名</th>
                  <th>选手</th>
                  <th>最终得分</th>
                </tr>
                <tr v-else>
                  <th>排名</th>
                  <th>选手</th>
                  <th>关卡名</th>
                  <th v-if="scoreData.scoringScheme !== 'E'">有效评分次数</th>
                  <template v-if="scoreData.scoringScheme === 'E'">
                    <th>评委评分</th>
                    <th>大众评分</th>
                  </template>
                  <template v-else>
                    <th>总分之和</th>
                  </template>
                  <th>最终得分<span v-if="scoreData.scoringScheme === 'E'" class="special-scheme-indicator">*</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(player, _index) in filteredPlayerScoresWithRank" :key="player.playerCode">
                  <!-- 成绩无效的选手，排名显示为横杠，但得分保持显示原始值 -->
                  <td class="rank">
                    <template v-if="player.records.length > 0 && player.records[0].isCanceled">-</template>
                    <template v-else-if="player.validRecordsCount === 0 && getPlayerLevelFileName(player.playerCode) === '未上传'">-</template>
                    <template v-else>{{ player.displayRank }}</template>
                  </td>
                  <td class="player-name">
                    <span v-if="player.playerCode !== player.playerName && !player.playerCode.startsWith('~')" class="player-code">{{ player.playerCode }}</span>
                    <span class="player-name-text">{{ player.playerName }}</span>
                  </td>

                  <!-- S方案不显示关卡名和评分次数列 -->
                  <template v-if="scoreData.scoringScheme !== 'S'">
                    <td class="level-file">
                      <template v-if="player.playerCode.startsWith('~')">取消资格</template>
                      <template v-else-if="player.records.length > 0 && player.records[0].isUnworking">
                        <span 
                          v-if="getPlayerLevelFile(player.playerCode)" 
                          class="level-file-link unworking-level" 
                          @click="downloadLevelFile(player.playerCode)"
                        >
                          {{ getPlayerLevelFileName(player.playerCode) }}（无法运行）
                        </span>
                        <span v-else class="unworking-level">{{ getPlayerLevelFileName(player.playerCode) }}（无法运行）</span>
                      </template>
                      <template v-else>
                        <span 
                          v-if="getPlayerLevelFile(player.playerCode)" 
                          class="level-file-link" 
                          @click="downloadLevelFile(player.playerCode)"
                        >
                          {{ getPlayerLevelFileName(player.playerCode) }}
                        </span>
                        <span v-else>{{ getPlayerLevelFileName(player.playerCode) }}</span>
                      </template>
                    </td>
                    <td v-if="scoreData.scoringScheme !== 'E'" class="count">{{ player.validRecordsCount }}</td>
                    <template v-if="scoreData.scoringScheme === 'E'">
                      <td class="judge-total">
                        <template v-if="player.records[0]?.isCanceled || (player.validRecordsCount === 0 && getPlayerLevelFileName(player.playerCode) === '未上传')">-</template>
                        <template v-else>{{ formatScore(player.judgeAverage) }}</template>
                      </td>
                      <td class="public-score">
                        <template v-if="player.records[0]?.isCanceled || (player.validRecordsCount === 0 && getPlayerLevelFileName(player.playerCode) === '未上传')">-</template>
                        <template v-else>{{ formatScore(player.publicScore) }}</template>
                      </td>
                    </template>
                    <td v-else class="sum">{{ formatScore(player.totalSum) }}</td>
                  </template>
                  <td class="average">
                    <template v-if="scoreData.scoringScheme === 'E'">
                      {{ formatScore(player.finalScore) }}
                    </template>
                    <template v-else>
                      {{ formatScore(player.averageScore) }}
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 中文数字转换工具
function toChineseNumber(num: number): string {
  const cnNums = ['零','一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十'];
  return cnNums[num] || num.toString();
}
import { ref, watch, onMounted, computed } from 'vue'
import FoldButton from './FoldButton.vue'
import { 
  loadRoundScoreData, 
  type RoundScoreData, 
  type ScoreRecord, 
  buildPlayerJudgeMap,
  type PlayerScore,
} from '../utils/scoreCalculator'
import { fetchMarioWorkerYaml, extractSeasonData } from '../utils/yamlLoader'

import { loadUserMapping, getUserDisplayName, type UserMapping } from '../utils/userMapper'
import { fetchLevelFilesFromLocal, type LevelFile, matchPlayerName } from '../utils/levelFileHelper'
import { loadUserData, type UserData } from '../utils/userDataProcessor'
import { Decimal } from 'decimal.js'
import { 
  calculate2019TotalScore, 
  calculateValidLevelTotalScore, 
  get2019ValidLevelInfo
} from '../utils/totalPointsCalculator';
import { getPreliminaryValidInfoEnhanced } from '../utils/preliminaryValidInfoHelper';

// 通过 NoSubmissionRecord.d.ts 扩展了 ScoreRecord 类型，添加了 isNoSubmission 属性
import '../NoSubmissionRecord.d.ts'

// 设置Decimal的精度和舍入模式
Decimal.set({ precision: 10, rounding: Decimal.ROUND_HALF_UP })

const props = defineProps<{
  year: string
  round: string
}>()

// 控制状态
const scoreContentHidden = ref(false)

// 折叠/展开评分数据内容
const toggleScoreContent = () => {
  scoreContentHidden.value = !scoreContentHidden.value
}

const searchPlayer = ref('')
const searchJudge = ref('')

// 移除未使用的接口定义

const scoreData = ref<RoundScoreData | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const userMapping = ref<UserMapping>({})
const yamlData = ref<any>(null) // 存储原始YAML数据用于查找未上传选手
const maxScoreData = ref<any>(null) // 存储maxScore.json数据
// 移除validLevelData，改用totalPointsCalculator中的逻辑

// 新增：多轮次评分数据缓存
const multiRoundScores = ref<Record<string, RoundScoreData | null>>({})
const multiRoundLoading = ref(false)

// 加载所有子轮次评分数据
async function loadAllRounds(year: string, roundGroupKey: string, yaml: any) {
  multiRoundLoading.value = true
  const roundCodes = roundGroupKey.replace(/\[|\]/g, '').split(',').map(r => r.trim())
  const result: Record<string, RoundScoreData | null> = {}
  for (const roundCode of roundCodes) {
    try {
      result[roundCode] = await loadRoundScoreData(year, roundCode, yaml)
    } catch (e) {
      result[roundCode] = null
    }
  }
  multiRoundScores.value = result
  multiRoundLoading.value = false
}

// 检查是否是题目模式
function isTopicMode(roundCode: string): boolean {
  const year = props.year
  if (year === '2012') return false
  return roundCode.startsWith('I') || (year === '2019' && roundCode.startsWith('G'))
}

// getPlayerGroup 函数已移除，相关功能已迁移到其他位置
const levelFiles = ref<LevelFile[]>([]) // 存储关卡文件数据
const userData = ref<UserData[]>([]) // 存储用户数据用于别名匹配

// 赛况总表数据
// 将overallRoundData改为异步计算
const overallRoundData = ref<any>(null)
const overallDataLoading = ref(false)

// 异步计算赛况总表数据
async function calculateOverallRoundData() {
  if (!scoreData.value || !yamlData.value) return null

  // 检查是否是多轮次比赛阶段
  const season = yamlData.value.season[props.year]
  if (!season || !season.rounds || props.year === '2012') {
    return null
  }

  // 2018年特殊处理：单循环积分制
  const is2018RoundRobin = props.year === '2018';

  // 2018年对阵表定义
  const roundRobinMatches = {
    'A': [
      [['A1', 'A2'], ['A3', 'A4']], // 第一轮
      [['A1', 'A3'], ['A2', 'A4']], // 第二轮
      [['A1', 'A4'], ['A2', 'A3']]  // 第三轮
    ],
    'B': [
      [['B1', 'B4'], ['B2', 'B3']], // 第一轮
      [['B1', 'B3'], ['B2', 'B4']], // 第二轮
      [['B1', 'B2'], ['B3', 'B4']]  // 第三轮
    ],
    'C': [
      [['C1', 'C4'], ['C2', 'C3']], // 第一轮
      [['C1', 'C2'], ['C3', 'C4']], // 第二轮
      [['C1', 'C3'], ['C2', 'C4']]  // 第三轮
    ],
    'D': [
      [['D1', 'D2'], ['D3', 'D4']], // 第一轮
      [['D1', 'D3'], ['D2', 'D4']], // 第二轮
      [['D1', 'D4'], ['D2', 'D3']]  // 第三轮
    ]
  };

  // 胜平负判定函数
  function determineMatchResult(scoreA: number, scoreB: number): { resultA: 'win' | 'draw' | 'loss', resultB: 'win' | 'draw' | 'loss', pointsA: number, pointsB: number } {
    // 特殊情况：0分判负
    if (scoreA === 0 && scoreB === 0) {
      return { resultA: 'loss', resultB: 'loss', pointsA: 0, pointsB: 0 };
    }
    if (scoreA === 0) {
      return { resultA: 'loss', resultB: 'win', pointsA: 0, pointsB: 2 };
    }
    if (scoreB === 0) {
      return { resultA: 'win', resultB: 'loss', pointsA: 2, pointsB: 0 };
    }
    
    // 正常判定：分差大于1分
    const diff = Math.abs(scoreA - scoreB);
    if (diff > 1) {
      if (scoreA > scoreB) {
        return { resultA: 'win', resultB: 'loss', pointsA: 2, pointsB: 0 };
      } else {
        return { resultA: 'loss', resultB: 'win', pointsA: 0, pointsB: 2 };
      }
    } else {
      // 平局：分差不超过1分
      return { resultA: 'draw', resultB: 'draw', pointsA: 1, pointsB: 1 };
    }
  }

  // 查找当前轮次所属的轮次组
  let matchedRoundGroup: [string, any] | undefined;
  for (const [key, value] of Object.entries(season.rounds)) {
    let roundCodes: string[] = [];
    if (key.includes('[') && key.includes(']')) {
      roundCodes = key.replace(/\[|\]/g, '').split(',').map(r => r.trim());
    } else if (key.includes(',')) {
      roundCodes = key.split(',').map(r => r.trim());
    } else {
      roundCodes = [key.trim()];
    }
    if (roundCodes.includes(props.round)) {
      matchedRoundGroup = [key, value];
      break;
    }
  }

  // 判断匹配到的轮次组是否为多轮次（数组轮次）
  const isMultiRound = matchedRoundGroup && 
    (matchedRoundGroup[0].includes('[') && matchedRoundGroup[0].includes(']') || 
     matchedRoundGroup[0].includes(','));

  // 只有多轮次才显示赛况总表
  if (!isMultiRound) return null;

  const rounds = matchedRoundGroup
  if (!rounds) return null

  const roundGroupKey = rounds[0];
  const roundCodes = roundGroupKey.replace(/\[|\]/g, '').split(',').map(r => r.trim());

  // 获取所有选手（包括未上传）
  const playerMapResult = buildPlayerJudgeMap(yamlData.value, props.year, roundGroupKey);
  const allPlayerCodes = Object.keys(playerMapResult.players);

  // 是否是deadline模式
  let hasDeadlines = false;
  if (rounds[1] && typeof rounds[1] === 'object') {
    const roundObj = rounds[1] as any;
    if (roundObj.schedule && typeof roundObj.schedule === 'object' && 'deadlines' in roundObj.schedule) {
      hasDeadlines = Boolean(roundObj.schedule.deadlines);
    } else if ('deadlines' in roundObj) {
      hasDeadlines = Boolean(roundObj.deadlines);
    }
  }

  // 处理选手数据
  const groupMap: Record<string, string[]> = {}
  // 2020年及以后的初赛轮次显示有效题目列
  const isShowValidLevel = ['2020', '2021', '2022', '2023', '2024', '2025'].includes(props.year) && roundCodes.some(code => code.startsWith('I'));
  const is2019 = props.year === '2019' && roundCodes.some(code => code.startsWith('G'));
  
  // 有效题目列内容（2020年及以后初赛）
  // 注意：这里应该基于deadline数量来确定列数，而不是题目数量
  let validLevelColumns: { roundIndex: number, label: string }[] = [];
  if (isShowValidLevel) {
    // 先获取一个示例选手的deadline信息来确定列数
    // 这里暂时使用固定值，后续会在选手数据处理中动态调整
    const preliminaryRoundCount = props.year === '2021' ? 3 : 2; // 基于deadline数量
    validLevelColumns = Array.from({ length: preliminaryRoundCount }, (_, i) => ({
      roundIndex: i + 1,
      label: `第${toChineseNumber(i + 1)}轮有效题目`
    }));
  }

  // 异步处理每个选手的数据
  const playerDataPromises = allPlayerCodes.map(async playerCode => {
    // 基础信息
    const playerName = (playerMapResult.players as Record<string, string>)[playerCode] || playerCode;
    const group = playerMapResult.playerGroups ? playerMapResult.playerGroups[playerCode] : '';
    
    // 每题得分：遍历每个子轮次，查找该选手在该轮的评分数据
    let roundScores: (Decimal | number)[] = roundCodes.map(roundCode => {
      const roundData = multiRoundScores.value[roundCode];
      if (!roundData) return new Decimal(0);
      const player = roundData.playerScores.find(p => p.playerCode === playerCode);
      return player ? player.averageScore : new Decimal(0);
    });

    // 构造playerData格式供totalPointsCalculator使用
    const playerDataForCalculator = {
      playerCodes: [playerCode],
      roundScores: roundCodes.reduce((acc: Record<string, any>, roundCode: string, idx) => {
        const score = roundScores[idx];
        acc[roundCode] = {
          averageScore: score instanceof Decimal ? score.toNumber() : Number(score)
        };
        return acc;
      }, {}),
      participatedRounds: roundCodes.filter((_, idx) => {
        const score = roundScores[idx];
        return (score instanceof Decimal ? score.toNumber() : Number(score)) > 0;
      })
    };

    // 获取有效题目信息和超时扣分
    let validRounds: { round: string, valid: boolean, label: string, exclamation: boolean }[] | undefined;
    // 仅2019~2021年有超时扣分
    let timeoutPenalty = 0;
    const yearNum = parseInt(props.year);
    
    if (is2019) {
      // 2019年小组赛
      const validInfo = await get2019ValidLevelInfo(playerDataForCalculator, yamlData.value);
      timeoutPenalty = validInfo.timeoutPenalty;
      
      // 构造validRounds显示信息
      validRounds = roundCodes.map(roundCode => {
        const isSelected = validInfo.validRounds.includes(roundCode);
        const hasScore = (roundScores[roundCodes.indexOf(roundCode)] as Decimal).toNumber() > 0;
        return {
          round: roundCode,
          valid: isSelected,
          label: hasScore ? roundCode : '未上传',
          exclamation: isSelected && timeoutPenalty > 0
        };
      });
    } else if (isShowValidLevel) {
      // 2020-2024年及以后初赛
      const validInfo = await getPreliminaryValidInfoEnhanced(props.year, playerDataForCalculator, yamlData.value);
      // 仅2020、2021年有超时扣分，2022及以后恒为0
      if (yearNum === 2020 || yearNum === 2021) {
        timeoutPenalty = validInfo.timeoutPenalty;
      } else {
        timeoutPenalty = 0;
      }
      
      // 构造validRounds显示信息（基于轮次选择）
      // 根据年份确定应该显示的轮次数：2021年为3轮，其他为2轮
      const expectedRoundCount = yearNum === 2021 ? 3 : 2;
      validRounds = Array.from({ length: expectedRoundCount }, (_, index) => {
        const roundSelection = validInfo.roundSelections[index];
        const selectedTopic = roundSelection?.selectedTopic;
        const hasScore = selectedTopic && playerDataForCalculator.roundScores[selectedTopic]?.averageScore > 0;
        
        return {
          round: `round${index + 1}`, // 轮次标识
          valid: Boolean(selectedTopic), // 是否有选中的题目
          label: selectedTopic ? (
            hasScore ? `第${toChineseNumber(parseInt(selectedTopic.replace('I', '')))}题` : '未上传'
          ) : '未上传',
          exclamation: roundSelection?.isTimeout || false
        };
      });
      
      // 同时更新validLevelColumns以匹配期望的轮次数
      validLevelColumns = Array.from({ length: expectedRoundCount }, (_, i) => ({
        roundIndex: i + 1,
        label: `第${toChineseNumber(i + 1)}轮有效题目`
      }));
    }

    // 2018年单循环赛制：计算胜平负统计和对阵积分
    let wins = 0, draws = 0, losses = 0, matchPoints = 0;
    let headToHeadPoints: Record<string, number> = {}; // 相互战绩积分
    
    if (is2018RoundRobin && group) {
      const groupMatches = roundRobinMatches[group as keyof typeof roundRobinMatches];
      if (groupMatches) {
        // 遍历3轮比赛
        groupMatches.forEach((roundMatches, roundIndex) => {
          roundMatches.forEach(([playerA, playerB]) => {
            if (playerA === playerCode || playerB === playerCode) {
              const opponent = playerA === playerCode ? playerB : playerA;
              const myScore = roundScores[roundIndex] instanceof Decimal ? 
                (roundScores[roundIndex] as Decimal).toNumber() : Number(roundScores[roundIndex]);
              
              // 获取对手得分
              const opponentRoundData = multiRoundScores.value[roundCodes[roundIndex]];
              const opponentPlayer = opponentRoundData?.playerScores.find(p => p.playerCode === opponent);
              const opponentScore = opponentPlayer ? opponentPlayer.averageScore.toNumber() : 0;
              
              // 判定比赛结果（注意：第一个参数是我的得分，第二个参数是对手得分）
              const result = determineMatchResult(myScore, opponentScore);
              const myResult = result.resultA; // 我的结果总是 resultA，因为 myScore 传给了 scoreA
              const myPoints = result.pointsA; // 我的积分总是 pointsA
              
              // 统计胜平负
              if (myResult === 'win') wins++;
              else if (myResult === 'draw') draws++;
              else losses++;
              
              // 累计对阵积分
              matchPoints += myPoints;
              
              // 记录相互战绩积分（用于排名）
              if (!headToHeadPoints[opponent]) headToHeadPoints[opponent] = 0;
              headToHeadPoints[opponent] += myPoints;
            }
          });
        });
      }
    }

    // 计算总积分
    let totalScore: Decimal;
    if (is2018RoundRobin) {
      // 2018年：总得分（不是对阵积分）
      totalScore = roundScores.reduce((acc: Decimal, curr) => acc.plus(curr instanceof Decimal ? curr : new Decimal(curr)), new Decimal(0));
    } else if (is2019) {
      // 2019年小组赛，使用重构后的计算函数
      totalScore = await calculate2019TotalScore(playerDataForCalculator, yamlData.value);
    } else if (isShowValidLevel) {
      // 2020-2024年初赛，使用重构后的计算函数
      totalScore = await calculateValidLevelTotalScore(props.year, playerDataForCalculator, yamlData.value);
    } else {
      // 其它情况，简单相加
      totalScore = roundScores.reduce((acc: Decimal, curr) => acc.plus(curr instanceof Decimal ? curr : new Decimal(curr)), new Decimal(0));
    }

    // 记录到小组
    if (group) {
      if (!groupMap[group]) {
        groupMap[group] = []
      }
      groupMap[group].push(playerCode)
    }

    return {
      playerCode,
      playerName,
      group,
      roundScores,
      validRounds,
      timeoutPenalty,
      totalScore,
      // 2018年单循环赛制字段
      wins,
      draws,
      losses,
      matchPoints,
      headToHeadPoints
    }
  });

  // 等待所有异步操作完成
  const playerData = await Promise.all(playerDataPromises);

  // 计算排名（考虑并列名次）
  let sortedPlayers = [...playerData]
    .sort((a, b) => b.totalScore.minus(a.totalScore).toNumber());

  // 计算总排名（处理并列情况）
  let currentRank = 1;
  let sameRankCount = 0;
  let lastScore = sortedPlayers[0]?.totalScore;

  const rankedPlayers = sortedPlayers.map((player, idx, arr) => {
    // 如果当前分数与前一个分数不同，更新排名
    if (!player.totalScore.equals(lastScore)) {
      currentRank += sameRankCount + 1;
      sameRankCount = 0;
      lastScore = player.totalScore;
    } else if (idx > 0) {
      sameRankCount++;
    }

    // 计算小组内排名
    const groupPlayers = arr.filter(p => p.group === player.group);
    let groupRank = 1;
    
    if (is2018RoundRobin) {
      // 2018年小组排名规则：总积分>总得分>相互战绩积分
      const sortedGroupPlayers = [...groupPlayers].sort((a, b) => {
        // 1. 总积分（对阵积分）多者，名次列前
        if (a.matchPoints !== b.matchPoints) {
          return b.matchPoints - a.matchPoints;
        }
        
        // 2. 相同总积分下，总得分多者，名次列前
        const scoreDiff = b.totalScore.minus(a.totalScore).toNumber();
        if (Math.abs(scoreDiff) > 0.001) {
          return scoreDiff;
        }
        
        // 3. 相同总积分和总得分下，在相互之间的比赛中总积分多者，名次列前
        // 计算两人之间的相互战绩积分
        const aVsB = a.headToHeadPoints[b.playerCode] || 0;
        const bVsA = b.headToHeadPoints[a.playerCode] || 0;
        return bVsA - aVsB;
      });
      
      groupRank = sortedGroupPlayers.findIndex(p => p.playerCode === player.playerCode) + 1;
    } else {
      // 其他年份的小组排名逻辑（按总得分）
      let groupSameRankCount = 0;
      let lastGroupScore = groupPlayers[0]?.totalScore;

      for (let i = 0; i < groupPlayers.length; i++) {
        const currentPlayer = groupPlayers[i];
        if (currentPlayer.playerCode === player.playerCode) {
          if (!currentPlayer.totalScore.equals(lastGroupScore)) {
            groupRank += groupSameRankCount + 1;
          }
          break;
        }
        if (!currentPlayer.totalScore.equals(lastGroupScore)) {
          groupRank += groupSameRankCount + 1;
          groupSameRankCount = 0;
          lastGroupScore = currentPlayer.totalScore;
        } else if (i > 0) {
          groupSameRankCount++;
        }
      }
    }

    return {
      ...player,
      totalRank: currentRank,
      groupRank,
      isNoSubmission: player.roundScores.every(score => (score instanceof Decimal ? score.equals(0) : score === 0))
    };
  });

  // 按小组组织选手数据
  const groupedPlayers: Record<string, any[]> = {}
  // 保持原始顺序：遍历allPlayerCodes，按顺序分组
  allPlayerCodes.forEach(playerCode => {
    const player = rankedPlayers.find(p => p.playerCode === playerCode);
    if (!player) return;
    const group = player.group || '未分组';
    if (!groupedPlayers[group]) {
      groupedPlayers[group] = [];
    }
    groupedPlayers[group].push(player);
  });

  // 计算总列数
  let totalColumns = 2; // 所在小组 + 选手姓名
  totalColumns += roundCodes.length; // 各轮次得分列
  if (isShowValidLevel) {
    totalColumns += validLevelColumns.length; // 有效题目列
  }
  if (['2019','2020','2021'].includes(props.year)) {
    totalColumns += 1; // 超时扣分列
  }
  totalColumns += 1; // 总得分列
  if (props.year === '2018') {
    totalColumns += 4; // 2018年：胜 + 平 + 负 + 总积分
  }
  totalColumns += 3; // 小组排名 + 总排名 + 是否晋级

  return {
    roundCodes,
    hasDeadlines,
    players: rankedPlayers,
    groups: Object.keys(groupedPlayers).sort(),
    groupedPlayers,
    groupOrder: Object.keys(groupedPlayers).sort(),
    isShowValidLevel,
    validLevelColumns,
    totalColumns
  }
}

// 监听数据变化，重新计算赛况总表
watch([scoreData, yamlData, multiRoundScores], async () => {
  if (scoreData.value && yamlData.value && Object.keys(multiRoundScores.value).length > 0) {
    overallDataLoading.value = true
    try {
      overallRoundData.value = await calculateOverallRoundData()
    } catch (error) {
      console.error('计算赛况总表数据失败:', error)
      overallRoundData.value = null
    } finally {
      overallDataLoading.value = false
    }
  } else {
    // 当条件不满足时，清空赛况总表数据，避免残留
    overallRoundData.value = null
    overallDataLoading.value = false
  }
}, { deep: true })

// 计算未上传关卡的选手
const noSubmissionPlayers = computed(() => {
  if (!scoreData.value || !yamlData.value) return [];
  
  try {
    // 检测是否为特殊格式：检查YAML中对应轮次的players是否为数组
    const seasonData = yamlData.value.season[props.year];
    const roundData = seasonData?.rounds?.[props.round];
    const isSpecialFormat = Array.isArray(roundData?.players);
    
    // 获取原始评分记录中的选手信息
    const existingPlayerSet = new Set();
    
    scoreData.value.allRecords.forEach(record => {
      if (isSpecialFormat) {
        // 对于特殊格式，使用playerName作为唯一标识
        existingPlayerSet.add(record.playerName);
      } else {
        // 对于标准格式，使用playerCode作为唯一标识
        existingPlayerSet.add(record.playerCode);
      }
    });
    
    // 获取成绩无效的选手代码
    const canceledPlayerCodes = new Set(
      scoreData.value.allRecords
        .filter(record => record.isCanceled)
        .map(record => isSpecialFormat ? record.playerName : record.playerCode)
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
      const playerName = String(playerNameValue); // 确保转换为字符串
      
      // 根据格式确定要检查的key
      const checkKey = isSpecialFormat ? playerName : playerCode;
      
      // 排除已有记录和成绩无效的选手
      if (!existingPlayerSet.has(checkKey) && !canceledPlayerCodes.has(checkKey)) {
        // 为未提交关卡的选手创建一个记录
        const noSubmissionRecord: ScoreRecord = {
          playerCode,
          judgeCode: "no_submission",
          originalJudgeCode: "no_submission",
          playerName,
          judgeName: "未上传",
          scores: {},
          totalScore: new Decimal(0),
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

// 判断选手是否晋级到下一阶段
function isPlayerAdvanced(playerName: string): boolean {
  if (!yamlData.value || !props.year || !props.round) return false;

  // 获取当前年份的数据
  const seasonData = yamlData.value.season[props.year];
  if (!seasonData?.rounds) return false;

  // 查找当前轮次所属的轮次组和下一个轮次组
  const rounds = Object.keys(seasonData.rounds);
  let currentRoundIndex = -1;
  
  // 查找包含当前轮次的轮次组
  for (let i = 0; i < rounds.length; i++) {
    const roundKey = rounds[i];
    
    // 检查是否是数组轮次（包含方括号和逗号）
    if (roundKey.includes('[') && roundKey.includes(']')) {
      const roundCodes = roundKey.replace(/\[|\]/g, '').split(',').map(r => r.trim());
      if (roundCodes.includes(props.round)) {
        currentRoundIndex = i;
        break;
      }
    } else if (roundKey.includes(',')) {
      const roundCodes = roundKey.split(',').map(r => r.trim());
      if (roundCodes.includes(props.round)) {
        currentRoundIndex = i;
        break;
      }
    } else if (roundKey === props.round) {
      currentRoundIndex = i;
      break;
    }
  }
  
  // 如果找不到当前轮次或是最后一轮，返回false
  if (currentRoundIndex === -1 || currentRoundIndex === rounds.length - 1) return false;
  
  // 获取下一轮的数据
  const nextRoundKey = rounds[currentRoundIndex + 1];
  const nextRoundData = seasonData.rounds[nextRoundKey];
  
  // 如果没有下一轮的数据，返回false
  if (!nextRoundData?.players) return false;
  
  // 检查选手是否在下一轮的players列表中
  // 遍历所有组和位置
  if (Array.isArray(nextRoundData.players)) {
    // 特殊格式：players是数组
    return nextRoundData.players.includes(playerName);
  } else {
    // 版标准格式：players是对象的嵌套结构
    for (const group of Object.values(nextRoundData.players)) {
      if (typeof group === 'object' && group !== null) {
        for (const position of Object.values(group)) {
          if (position === playerName) {
            return true;
          }
        }
      } else if (group === playerName) {
        // 兼容决赛这种结构
        return true;
      }
    }
  }
  
  return false;
}

// 使用 userMapper.ts 中的 getUserDisplayName 函数来获取评委和选手的名称

function isBackupJudge(judgeCode: string): boolean {
  return judgeCode.includes('JR');
}

function isPublicJudge(judgeCode: string): boolean {
  // 2023 P1轮次的JZ评委是大众评委
  return props.year === '2023' && props.round === 'P1' && judgeCode.startsWith('JZ');
}

function isReEvaluationJudge(judgeCode: string, record: any): boolean {
  // 首先检查是否是JR评委
  if (!isBackupJudge(judgeCode) || !scoreData.value) return false;
  
  // 检查当前选手是否有被作废的评分记录
  return scoreData.value.allRecords.some(r => 
    r.playerCode === record.playerCode && 
    r.isRevoked
  );
}

// 计算是否有大众评分的扣分（用于显示扣分列）
const hasPublicPenalty = computed(() => {
  if (!scoreData.value || !scoreData.value.publicScores) return false;
  return scoreData.value.publicScores.some(
    (player) => player.votes && player.votes.some(v => v.penalty !== undefined && Number(v.penalty) !== 0)
  );
});

// 加载maxScore.json数据
async function loadMaxScoreData() {
  try {
    const response = await fetch('/data/maxScore.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    maxScoreData.value = data;
  } catch (error) {
    console.error('加载maxScore.json失败:', error);
  }
}

// 计算显示的附加分值（考虑bonus_score换算）
function getDisplayedBonus(originalBonus: number): string {
  if (!maxScoreData.value || !props.year || !props.round) {
    return originalBonus.toString();
  }
  
  const yearData = maxScoreData.value.maxScore?.[props.year];
  if (!yearData) {
    return originalBonus.toString();
  }
  
  const roundData = yearData[props.round];
  if (!roundData) {
    return originalBonus.toString();
  }
  
  const bonusFullScore = roundData.bonus_score || 5;
  let adjustedBonus = new Decimal(originalBonus);
  
  if (bonusFullScore === 8) {
    adjustedBonus = adjustedBonus.times(1.6);
  } else if (bonusFullScore === 10) {
    adjustedBonus = adjustedBonus.times(2);
  }
  
  return adjustedBonus.toDecimalPlaces(1).toString();
}

// 过滤和排序大众评分数据，按YAML中的选手顺序排序
const filteredPublicScores = computed(() => {
  if (!scoreData.value || !scoreData.value.publicScores || !yamlData.value) return [];
  
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
    return scoreData.value.publicScores.slice().sort((a, b) => {
      const orderA = playerCodeOrderMap.get(a.playerCode);
      const orderB = playerCodeOrderMap.get(b.playerCode);
      
      // 如果都有序号，按序号排序
      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB;
      }
      // 如果只有一方有序号，有序号的排前面
      else if (orderA !== undefined) return -1;
      else if (orderB !== undefined) return 1;
      // 如果都没有序号，按选手码字母顺序排序作为后备
      else {
        if (a.playerCode < b.playerCode) return -1;
        if (a.playerCode > b.playerCode) return 1;
        return 0;
      }
    });
  } catch (error) {
    console.error('按选手顺序排序大众评分时出错:', error);
    // 出错时回退到字母排序
    return scoreData.value.publicScores.slice().sort((a, b) => {
      if (a.playerCode < b.playerCode) return -1;
      if (a.playerCode > b.playerCode) return 1;
      return 0;
    });
  }
});

// 应用选手和评委搜索过滤的公共评分
const filteredPublicScoresWithSearch = computed(() => {
  let result = [...filteredPublicScores.value];
  
  // 选手筛选
  if (searchPlayer.value.trim()) {
    const searchTerm = searchPlayer.value.trim();
    const isExact = searchTerm.startsWith('"') && searchTerm.endsWith('"');
    const processedKeyword = isExact ? searchTerm.slice(1, -1) : searchTerm;
    
    result = result.filter(p => {
      // 直接匹配选手名或选手码
      if (isExact) {
        return p.playerName.toLowerCase() === processedKeyword.toLowerCase() ||
               p.playerCode.toLowerCase() === processedKeyword.toLowerCase();
      } else {
        return p.playerName.toLowerCase().includes(processedKeyword.toLowerCase()) ||
               p.playerCode.toLowerCase().includes(processedKeyword.toLowerCase()) ||
               matchPlayerName(p.playerName, processedKeyword, userData.value, false);
      }
    });
  }
  
  // 评委筛选
  if (searchJudge.value.trim()) {
    const searchTerm = searchJudge.value.trim().toLowerCase();
    const isExact = searchTerm.startsWith('"') && searchTerm.endsWith('"');
    const processedKeyword = isExact ? searchTerm.slice(1, -1) : searchTerm;
    
    result = result.map(player => {
      if (!player.votes) return player;
      
      // 筛选该选手的投票记录
      const filteredVotes = player.votes.filter(vote => {
        if (isExact) {
          return vote.voterName.toLowerCase() === processedKeyword;
        } else {
          return vote.voterName.toLowerCase().includes(processedKeyword) || 
                 matchPlayerName(vote.voterName, processedKeyword, userData.value, false);
        }
      });
      
      // 返回包含筛选后投票的选手副本
      return {
        ...player,
        votes: filteredVotes,
        // 如果有筛选，更新最终得分为筛选后的平均值（如果适用）
        finalPublicScore: filteredVotes.length > 0 
          ? filteredVotes.reduce((sum, vote) => sum + (vote.totalScore || 0), 0) / filteredVotes.length
          : 0
      };
    }).filter(player => player.votes.length > 0); // 只保留有匹配投票记录的选手
  }
  
  return result;
});

// 格式化分数显示
const formatScore = (score: number | Decimal | null | undefined): string => {
  if (score === null || score === undefined) return '-'
  const decimal = score instanceof Decimal ? score : new Decimal(score)
  const formattedScore = decimal.toFixed(2)
  // 不显示 .00
  if (formattedScore.endsWith('.00')) {
    return decimal.toFixed(0)
  }
  // 如果以0结尾，只显示一位小数
  if (formattedScore.endsWith('0')) {
    return decimal.toFixed(1)
  }
  return formattedScore
}

// 筛选详细评分记录
const filteredDetailRecords = computed(() => {
  if (!scoreData.value || !yamlData.value) return []
  
  // 合并原始评分记录和未提交关卡的选手记录
  let records = [...scoreData.value.allRecords, ...noSubmissionPlayers.value]

  // 按选手名称搜索
  if (searchPlayer.value.trim()) {
    const searchTerm = searchPlayer.value.trim()
    const isExact = searchTerm.startsWith('"') && searchTerm.endsWith('"')
    const processedKeyword = isExact ? searchTerm.slice(1, -1) : searchTerm
    
    records = records.filter(record => {
      // 直接匹配选手名或选手码
      if (isExact) {
        if (record.playerName.toLowerCase() === processedKeyword.toLowerCase() ||
            record.playerCode.toLowerCase() === processedKeyword.toLowerCase()) {
          return true
        }
      } else {
        if (record.playerName.toLowerCase().includes(processedKeyword.toLowerCase()) ||
            record.playerCode.toLowerCase().includes(processedKeyword.toLowerCase())) {
          return true
        }
      }
      
      // 使用别名匹配
      return matchPlayerName(record.playerName, processedKeyword, userData.value, isExact)
    })
  }
  
  // 按评委名称搜索
  if (searchJudge.value.trim()) {
    const searchTerm = searchJudge.value.trim()
    const isExact = searchTerm.startsWith('"') && searchTerm.endsWith('"')
    const processedKeyword = isExact ? searchTerm.slice(1, -1) : searchTerm
    
    records = records.filter(record => {
      // 对于未提交的记录，不进行评委筛选
      if (record.isNoSubmission) return false
      
      // 直接匹配评委名称或评委代码
      if (isExact) {
        if (record.judgeName.toLowerCase() === processedKeyword.toLowerCase() ||
            record.judgeCode.toLowerCase() === processedKeyword.toLowerCase()) {
          return true
        }
      } else {
        if (record.judgeName.toLowerCase().includes(processedKeyword.toLowerCase()) ||
            record.judgeCode.toLowerCase().includes(processedKeyword.toLowerCase())) {
          return true
        }
      }
      
      // 使用别名匹配评委名称
      return matchPlayerName(record.judgeName, processedKeyword, userData.value, isExact)
    })
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
  let players = [...scoreData.value.playerScores];
  
  // 为未上传关卡的选手创建成绩记录
  const noSubmissionPlayerScores = noSubmissionPlayers.value.map(record => {
    return {
      playerCode: record.playerCode,
      playerName: record.playerName,
      records: [record], // 只有一条"未上传"的记录
      totalSum: new Decimal(0),
      averageScore: new Decimal(0), // 未上传关卡选手的平均分为0
      validRecordsCount: 0, // 有效记录数为0
      publicScore: new Decimal(0), // 大众评分为0
      finalScore: new Decimal(0)    // 最终得分为0
    } as PlayerScore;
  });
  
  // 合并已有成绩和未上传关卡的选手
  players = [...players, ...noSubmissionPlayerScores];
  
  // 按选手名称搜索
  if (searchPlayer.value.trim()) {
    const searchTerm = searchPlayer.value.trim()
    const isExact = searchTerm.startsWith('"') && searchTerm.endsWith('"')
    const processedKeyword = isExact ? searchTerm.slice(1, -1) : searchTerm
    
    players = players.filter(player => {
      // 直接匹配选手名或选手码
      if (isExact) {
        if (player.playerName.toLowerCase() === processedKeyword.toLowerCase() ||
            player.playerCode.toLowerCase() === processedKeyword.toLowerCase()) {
          return true
        }
      } else {
        if (player.playerName.toLowerCase().includes(processedKeyword.toLowerCase()) ||
            player.playerCode.toLowerCase().includes(processedKeyword.toLowerCase())) {
          return true
        }
      }
      
      // 使用别名匹配
      return matchPlayerName(player.playerName, processedKeyword, userData.value, isExact)
    })
  }
  
  // 首先把未上传的选手排到最后，其余按最终得分从高到低排序
  players = [...players].sort((a, b) => {
    const aNoSubmission = a.validRecordsCount === 0 && getPlayerLevelFileName(a.playerCode) === '未上传';
    const bNoSubmission = b.validRecordsCount === 0 && getPlayerLevelFileName(b.playerCode) === '未上传';
    if (aNoSubmission && !bNoSubmission) return 1;
    if (!aNoSubmission && bNoSubmission) return -1;
    
    // 使用最终得分排序
    const aScore = a.finalScore || new Decimal(0);
    const bScore = b.finalScore || new Decimal(0);
    return bScore.comparedTo(aScore);
  });
  
  // 然后，对于同分数的选手，按YAML中的选手顺序排序
  try {
    // 从YAML获取选手顺序
    const playerMapResult = buildPlayerJudgeMap(
      yamlData.value, 
      scoreData.value.year, 
      scoreData.value.round
    )
    
    // 创建一个根据YAML中的选手码顺序排序的映射
    const playerCodeOrderMap = new Map(
      Object.keys(playerMapResult.players).map((code, index) => [code, index])
    )
    
    // 二次排序：对于平均分相同的选手，按照YAML中的选手顺序排序，未上传始终排最后
    players = players.sort((a, b) => {
      const aNoSubmission = a.validRecordsCount === 0 && getPlayerLevelFileName(a.playerCode) === '未上传';
      const bNoSubmission = b.validRecordsCount === 0 && getPlayerLevelFileName(b.playerCode) === '未上传';
      if (aNoSubmission && !bNoSubmission) return 1;
      if (!aNoSubmission && bNoSubmission) return -1;
      const aScore = a.averageScore instanceof Decimal ? a.averageScore : new Decimal(a.averageScore)
      const bScore = b.averageScore instanceof Decimal ? b.averageScore : new Decimal(b.averageScore)
      if (!aScore.equals(bScore)) {
        return bScore.comparedTo(aScore)
      }
      const orderA = playerCodeOrderMap.get(a.playerCode)
      const orderB = playerCodeOrderMap.get(b.playerCode)
      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB
      } else if (orderA !== undefined) return -1
      else if (orderB !== undefined) return 1
      else return 0
    })
  } catch (error) {
    console.error('按选手顺序排序时出错:', error);
  }
  
  return players
})

// 总分排名并列排名算法
function assignRankingWithTiesForTotal(players: any[], scoreField: string = 'averageScore', rankField: string = 'displayRank') {
  let lastScore: string | null = null
  let lastRank = 0
  let skip = 0
  for (let i = 0; i < players.length; i++) {
    // 统一格式化分数字符串，避免小数精度误差
    const currScore = players[i][scoreField] instanceof Decimal
      ? players[i][scoreField].toFixed(3)
      : new Decimal(players[i][scoreField]).toFixed(3)
    if (lastScore !== null && currScore === lastScore) {
      players[i][rankField] = lastRank
      skip++
    } else {
      players[i][rankField] = lastRank + 1 + skip
      lastRank = players[i][rankField]
      skip = 0
    }
    lastScore = currScore
  }
}

const filteredPlayerScoresWithRank = computed(() => {
  const arr = filteredPlayerScores.value.slice()
  assignRankingWithTiesForTotal(arr, 'averageScore', 'displayRank')
  return arr
})

// 筛选赛况总表数据
const filteredOverallRoundData = computed(() => {
  if (!overallRoundData.value) return null;
  
  // 如果没有搜索词，直接返回原始数据
  if (!searchPlayer.value.trim()) return overallRoundData.value;
  
  const searchTerm = searchPlayer.value.trim();
  const isExact = searchTerm.startsWith('"') && searchTerm.endsWith('"');
  const processedKeyword = isExact ? searchTerm.slice(1, -1) : searchTerm;
  
  // 创建深拷贝以避免修改原始数据
  const filteredData = JSON.parse(JSON.stringify(overallRoundData.value));
  
  // 过滤每个小组的选手
  if (filteredData.groupedPlayers) {
    Object.keys(filteredData.groupedPlayers).forEach(group => {
      filteredData.groupedPlayers[group] = filteredData.groupedPlayers[group].filter((player: any) => {
        // 直接匹配选手名或选手码
        if (isExact) {
          return player.playerName === processedKeyword ||
                 player.playerCode === processedKeyword;
        } else {
          return player.playerName.toLowerCase().includes(processedKeyword.toLowerCase()) ||
                 player.playerCode.toLowerCase().includes(processedKeyword.toLowerCase()) ||
                 matchPlayerName(player.playerName, processedKeyword, userData.value, false);
        }
      });
    });
    
    // 更新小组顺序，只保留有选手的小组
    filteredData.groupOrder = filteredData.groupOrder.filter((group: string) => 
      filteredData.groupedPlayers[group] && filteredData.groupedPlayers[group].length > 0
    );
  }
  
  return filteredData;
});

async function loadScoreData() {
  if (!props.year || !props.round) {
    console.warn('年份或轮次为空，停止加载')
    return
  }
  
  loading.value = true
  error.value = null
  
  try {
    // 加载YAML数据
    const yamlDoc = await fetchMarioWorkerYaml()
    yamlData.value = yamlDoc // 保存原始的YAML数据，用于获取未上传选手
    const seasonData = extractSeasonData(yamlDoc)

        // 加载用户映射数据、用户数据和maxScore数据
    const [userMappingData, userDataResult] = await Promise.all([
      loadUserMapping(),
      loadUserData(),
      loadMaxScoreData()
    ])
    userMapping.value = userMappingData
    userData.value = userDataResult
    
    // 加载评分数据
    const data = await loadRoundScoreData(props.year, props.round, { season: seasonData })
    scoreData.value = data
    
    // 加载关卡文件数据
    try {
      levelFiles.value = await fetchLevelFilesFromLocal()
    } catch (levelError) {
      console.warn('加载关卡文件失败:', levelError)
      levelFiles.value = []
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
    console.error('加载评分数据失败:', err)
  } finally {
    loading.value = false
  }
}

// 将评分方案字母映射为对应的年份标准
function getScoringSchemeDisplayName(scheme: string | undefined): string {
  if (!scheme) return '未知标准'
  
  const schemeMap: { [key: string]: string } = {
    'A': '2009 版评分标准',
    'B': '2014 版评分标准',
    'C': '2020 版评分标准',
    'D': '2023 版投票评选方案',
    'E': '2020 版评分标准',
    'S': '2015 半决赛'
  }
  
  return schemeMap[scheme] || scheme
}

// 获取评分标准对应的链接
function getSchemeLink(scheme: string | undefined): string | null {
  if (!scheme) return null
  
  const linkMap: { [key: string]: string } = {
    'A': 'https://archive.marioforever.net/post/650057027',
    'B': 'https://archive.marioforever.net/post/2833085201',
    'D': 'https://www.marioforever.net/thread-2530-1-1.html'
  }
  
  return linkMap[scheme] || null
}

// 导航到文档标准页面
function navigateToDocumentStandard(): void {
  // 在新标签页中打开，并设置对应的标签页和文档选择
  const baseUrl = window.location.origin + window.location.pathname
  const url = `${baseUrl}?tab=docs&doc=standard`
  window.open(url, '_blank')
}

// 获取选手的平均分
function getPlayerAverageScore(playerCode: string): string {
  if (!scoreData.value) return '-';
  const playerScore = scoreData.value.playerScores.find(p => p.playerCode === playerCode);
  if (!playerScore) return '-';
  
  // 对于评分方案E，使用judgeAverage（评委平均分）
  const scoreToUse = scoreData.value.scoringScheme === 'E' && playerScore.judgeAverage !== undefined 
    ? playerScore.judgeAverage 
    : playerScore.averageScore;
  
  // 创建Decimal对象，兼容两种类型
  const decimal = typeof scoreToUse === 'object' && 'toFixed' in scoreToUse 
    ? scoreToUse
    : new Decimal(scoreToUse);
    
  // 规范化显示格式
  const formattedScore = decimal.toFixed(2)
  if (formattedScore.endsWith('.00')) {
    return decimal.toFixed(0)
  }
  if (formattedScore.endsWith('0')) {
    return decimal.toFixed(1)
  }
  return formattedScore
}

// 获取选手的关卡文件名
function getPlayerLevelFileName(playerCode: string): string {
  if (!levelFiles.value.length) return '加载中...';
  if (!scoreData.value) return '未上传';
  
  const currentYear = parseInt(scoreData.value.year);
  const currentRound = scoreData.value.round;
  
  // 首先查找多关卡文件夹
  const multiLevelFiles = levelFiles.value.filter(file => {
    return file.playerCode === playerCode &&
           file.year === currentYear &&
           file.roundKey === currentRound &&
           file.isMultiLevel === true;
  });
  
  // 如果找到多关卡文件夹，返回文件夹名称
  if (multiLevelFiles.length > 0 && multiLevelFiles[0].multiLevelFolder) {
    return multiLevelFiles[0].multiLevelFolder.folderName || multiLevelFiles[0].name;
  }
  
  // 如果没有多关卡文件夹，使用单个关卡文件
  const exactMatch = levelFiles.value.find(file => {
    return file.playerCode === playerCode &&
           file.year === currentYear &&
           file.roundKey === currentRound;
  });
  
  if (exactMatch) {
    return exactMatch.name;
  }
  
  return '未上传';
}

// 获取选手的关卡文件对象
function getPlayerLevelFile(playerCode: string): LevelFile | null {
  if (!levelFiles.value.length || !scoreData.value) return null;
  
  const currentYear = parseInt(scoreData.value.year);
  const currentRound = scoreData.value.round;
  
  // 首先查找多关卡文件夹
  const multiLevelFiles = levelFiles.value.filter(file => {
    return file.playerCode === playerCode &&
           file.year === currentYear &&
           file.roundKey === currentRound &&
           file.isMultiLevel === true;
  });
  
  // 如果找到多关卡文件，返回第一个作为代表（包含文件夹信息）
  if (multiLevelFiles.length > 0) {
    return multiLevelFiles[0];
  }
  
  // 如果没有找到多关卡文件，尝试找单个关卡文件
  const exactMatch = levelFiles.value.find(file => {
    return file.playerCode === playerCode &&
           file.year === currentYear &&
           file.roundKey === currentRound;
  });
  
  return exactMatch || null;
}

// 下载关卡文件
function downloadLevelFile(playerCode: string): void {
  const levelFile = getPlayerLevelFile(playerCode);
  if (!levelFile) {
    alert('未找到对应关卡文件');
    return;
  }
  
  const baseUrl = 'https://levels.smwp.marioforever.net/MW杯关卡/';
  
  // 如果是多关卡文件夹
  if (levelFile.isMultiLevel && levelFile.multiLevelFolder) {
    const folderName = levelFile.multiLevelFolder.folderName;
    const folderPath = levelFile.multiLevelFolder.folderPath;
    
    // 确认下载
    if (confirm(`这是多关卡文件夹: ${folderName || '未命名文件夹'}\n是否打开在线查看？`)) {
      // 对于多关卡，打开文件夹页面而不是直接下载
      const folderUrl = baseUrl + (folderPath || levelFile.path.substring(0, levelFile.path.lastIndexOf('/')));
      window.open(folderUrl, '_blank');
    }
  } else {
    // 单个关卡文件正常下载
    const fileName = levelFile.name;
    // 确认下载
    if (confirm(`确认下载关卡文件: ${fileName}？`)) {
      const fileUrl = baseUrl + levelFile.path;
      
      // 创建下载链接并点击
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }
}

// 监听props变化，加载所有子轮次评分数据
watch(
  () => [props.year, props.round, yamlData.value],
  async ([year, round, yaml]) => {
    if (!yaml) return;
    // 查找当前轮次所属的多轮次key
    const season = yaml?.season?.[year];
    if (!season || !season.rounds) return;
    let roundGroupKey = '';
    let isMultiRound = false;
    for (const [key] of Object.entries(season.rounds)) {
      let roundCodes: string[] = [];
      // 只有key以[开头且以]结尾，或key包含逗号且不是P1/P2等，才算多轮次
      if ((key.startsWith('[') && key.endsWith(']')) || (key.includes(',') && !['P1','P2','F','S','Q','R'].includes(key))) {
        roundCodes = key.replace(/\[|\]/g, '').split(',').map(r => r.trim());
        isMultiRound = true;
      } else {
        roundCodes = [key.trim()];
      }
      if (roundCodes.includes(round)) {
        roundGroupKey = key;
        break;
      }
    }
    if (isMultiRound && roundGroupKey) {
      await loadAllRounds(year, roundGroupKey, yaml);
    } else {
      // 切换到单轮次或P1/P2时，清空多轮次评分数据
      multiRoundScores.value = {};
    }
  },
  { immediate: true }
)

// 新增：监听轮次/年份变化，刷新scoreData
watch(
  () => [props.year, props.round],
  () => {
    loadScoreData();
  }
)

onMounted(() => {
  loadScoreData()
})
</script>

<style scoped>
/* 组件特定样式 - 使用新的CSS类系统 */

/* 组件特定样式只保留新的CSS类系统无法覆盖的部分 */
.detailed-scores, .player-totals {
  margin-bottom: var(--spacing-xl);
}

.score-header h3 {
  text-align: center;
  margin: 0;
  color: var(--text-secondary);
  font-size: 22px;
  border-bottom: 2px solid var(--primary-active);
  padding-bottom: var(--spacing-sm);
} 

.detailed-scores h4,
.player-totals h4 {
  text-align: center;
  margin: var(--spacing-lg) 0;
  color: var(--text-secondary);
  font-size: 18px;
  border-bottom: 2px solid var(--primary-active);
  padding-bottom: var(--spacing-sm);
}

.scheme-info {
  color: var(--text-secondary);
  font-size: 13px;
  text-align: center;
}

/* 赛况总表样式 */
.overall-status {
  margin-bottom: var(--spacing-xl);
}

.overall-status h4 {
  text-align: center;
  margin: var(--spacing-lg) 0;
  color: var(--text-secondary);
  font-size: 18px;
  border-bottom: 2px solid var(--primary-active);
  padding-bottom: var(--spacing-sm);
}

.exclamation-mark {
  font-size: 0.8em;
}

.scoring-note {
  color: #e74c3c;
  font-size: 13px;
  text-align: center;
}

/* 控制面板样式 */
.controls-panel {
  background: rgba(255, 245, 230, 0.8);
  border: 1px solid rgba(255, 180, 150, 0.3);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 30px;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 15px rgba(255, 140, 105, 0.1);
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
  background: rgba(255, 250, 245, 0.9);
  backdrop-filter: blur(5px);
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
  background: rgba(255, 245, 230, 0.8);
  border: 1px solid rgba(255, 180, 150, 0.3);
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.page-btn {
  padding: 8px 16px;
  background: linear-gradient(135deg, #ff8c69, #ff6347);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #e55347, #d45537);
  transform: translateY(-1px);
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
  background: rgba(255, 250, 245, 0.9);
}

.score-table, .total-table, .overall-table {
  width: 100%;
  border-collapse: collapse;
  background: rgba(255, 252, 248, 0.9);
  font-size: 14px;
  backdrop-filter: blur(8px);
}

.score-table th, .score-table td,
.total-table th, .total-table td,
.overall-table th, .overall-table td {
  padding: 8px 10px;
  text-align: center;
  border-bottom: 1px solid #eee;
}

.score-table th, .total-table th, .overall-table th {
  background: linear-gradient(135deg, rgba(255, 220, 200, 0.9), rgba(255, 200, 180, 0.8));
  font-weight: 600;
  color: #2c3e50;
  border-bottom: 1px solid rgba(255, 140, 105, 0.3);
  text-align: center;
}

.score-table tbody tr:not(.player-separator):hover,
.total-table tbody tr:hover,
.overall-table tbody tr:not(.group-separator):hover {
  background: rgba(255, 235, 220, 0.7);
}

.category-header {
  background: linear-gradient(135deg, rgba(255, 210, 190, 0.9), rgba(255, 190, 170, 0.8));
  color: #2c3e50;
  font-weight: 500;
  border-bottom: 1px solid rgba(255, 140, 105, 0.3);
}

.empty-header {
  background: rgba(255, 240, 230, 0.9);
}

.player-name {
  font-weight: 500;
  color: #2c3e50;
  text-align: left;
}

.player-cell-merged {
  background: rgba(255, 240, 230, 0.8);
  vertical-align: middle;
  border-right: 1px solid rgba(255, 140, 105, 0.3);
}

.player-separator .separator-cell {
  background: rgba(255, 230, 210, 0.6);
  border-bottom: 1px rgba(255, 140, 105, 0.3);
  padding: 0;
  line-height: 2px;
  height: 2px;
}

.group-separator .separator-cell {
  background: rgba(255, 230, 210, 0.6);
  border-bottom: 1px rgba(255, 140, 105, 0.3);
  padding: 0;
  line-height: 2px;
  height: 2px;
}

.total-score {
  font-weight: 600;
}

/* 2018年单循环赛制列样式 */
.win-count {
  color: #28a745;
  font-weight: 600;
}

.draw-count {
  color: #ffc107;
  font-weight: 600;
}

.loss-count {
  color: #dc3545;
  font-weight: 600;
}

.match-points {
  color: #007bff;
  font-weight: 600;
}

/* 表格和数据显示相关样式 */
.player-code {
  display: inline-block;
  background-color: var(--primary-color);
  color: white;
  padding: 2px 6px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: bold;
  margin-right: 4px;
}

.player-name-text {
  font-weight: 500;
}

.collaborative-tag,
.re-evaluation-tag,
.backup-tag,
.public-tag {
  display: inline-block;
  color: white;
  padding: 2px 6px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: bold;
  margin-left: 2px;
}

.collaborative-tag {
  background-color: #17a2b8;
}

.re-evaluation-tag {
  background-color: #dc3545;
}

.backup-tag {
  background-color: #eba510;
}

.public-tag {
  background-color: #28a745;
}

.score-cell {
  text-align: center;
}

.public-scores {
  margin-bottom: var(--spacing-xl);
}

.public-scores h4 {
  text-align: center;
  margin: var(--spacing-lg) 0;
  color: var(--text-secondary);
  font-size: 18px;
  border-bottom: 2px solid var(--primary-active);
  padding-bottom: var(--spacing-sm);
}

.final-score {
  font-weight: 600;
  color: #e74c3c;
  text-align: center;
  background: rgba(255, 245, 240, 0.8);
}

.special-scheme-indicator {
  color: #e74c3c;
  font-weight: bold;
  margin-left: 2px;
}

/* 完全重构撤销的评分行样式，以分离处理透明度 */
/* 只有评分单元格和总分应用透明度和删除线 */
.revoked-score .score-cell, 
.revoked-score .judge-total {
  text-decoration: line-through;
}

.revoked-score .score-cell, 
.revoked-score .judge-total,
.revoked-score .judge-name {
  background: rgba(248, 215, 218, 0.8);
  opacity: 0.7;
}

.rank {
  text-align: center;
  font-weight: 600;
  color: #495057;
}

.unworking-level {
  font-style: italic;
}

.count, .sum, .average {
  text-align: center;
}

.level-file-link {
  color: var(--primary-color);
  cursor: pointer;
}

.level-file-link:hover {
  color: var(--primary-hover);
  text-decoration: underline;
}

.average {
  font-weight: 600;
  color: #e74c3c;
}

@media (min-width: 768px) {
  .table-wrapper {
    display: flex;
    justify-content: center;
    width: 100%;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .score-table th, .score-table td,
  .total-table th, .total-table td,
  .overall-table th, .overall-table td {
    padding: 6px 4px;
  }

  .score-table, .total-table, .overall-table {
    font-size: 12px;
    white-space: nowrap;
  }

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
  
  .score-cell {
    text-align: center;
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

.no-submission-cell {
  font-style: italic;
  color: #888;
  text-align: center;
  background: rgba(255, 245, 235, 0.8);
}

.canceled-score-cell {
  font-style: italic;
  color: #d9534f;
  text-align: center;
  background: rgba(255, 240, 235, 0.8);
  font-weight: 500;
}

.unworking-level-cell {
  font-style: italic;
  color: #f5a623;
  text-align: center;
  background: rgba(255, 250, 235, 0.8);
  font-weight: 500;
}

/* 评分标准链接样式 */
.scheme-link {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
  transition: all 0.3s ease;
  border-bottom: 1px solid transparent;
}

.scheme-link:hover {
  color: var(--primary-hover);
  border-bottom-color: var(--primary-active);
  text-decoration: none;
}

.scheme-link:focus {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
  border-radius: 2px;
}

.panel-collapse {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  will-change: max-height, opacity;
  transition: max-height 0.6s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.panel-collapse.is-expanded {
  max-height: 4000px;
  opacity: 1;
  pointer-events: auto;
  transition: max-height 1s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 换算后分数样式 */
.converted-score {
  color: #666;
  font-size: 0.85em;
  font-weight: normal;
  margin-left: 4px;
}
</style>