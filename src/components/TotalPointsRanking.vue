<template>
  <div class="total-points-ranking animate-fadeInUp">
    <div class="page-header">
      <div class="control-panel">
        <div class="form-group">
          <label for="year-select" class="form-label">选择届次：</label>
          <select id="year-select" v-model="selectedYear" @change="loadData" class="form-control hover-scale">
            <option v-for="option in availableEditionOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="isLoading" class="loading-state animate-pulse">
      <div class="loading-spinner"></div>
      <div class="loading-text">正在加载数据<span class="loading-dots"></span></div>
    </div>

    <div v-else-if="!data.hasData" class="error-state animate-shake">
      <p>暂无{{ selectedYear }}年的数据</p>
    </div>
    <div v-else class="content-panel animate-fadeInUp">
      <!-- 统计信息 -->
      <div class="summary-cards">
        <div class="stat-card hover-lift">
          <h3>本年度参与选手</h3>
          <div class="stat-value">{{ data.players.length }}人</div>
          <div class="stat-icon">👥</div>
        </div>
        <div class="stat-card hover-lift">
          <h3>统计轮次</h3>
          <div class="stat-value">
            {{ formatAvailableRoundsDisplay(data.availableRounds) }}
          </div>
          <div class="stat-icon">🔂</div>
        </div>
      </div>
      <!-- 排行榜表格 -->
      <div class="table-wrapper">
        <table class="table-base ranking-table">
          <thead>
            <tr>
              <th class="rank-col">排名</th>
              <th class="player-col">选手名</th>
              <th class="rounds-col">参加比赛轮次</th>
              <th class="result-col">成绩</th>
              <th class="total-col">总积分</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="player in playersWithRank" 
              :key="player.playerName"
              class="ranking-row"
              :class="getRankingClass(player.displayRank)"
            >
              <td class="rank-cell">
                <span class="rank-number">{{ player.displayRank }}</span>
              </td>
              <td class="player-cell">
                <div class="player-info">
                  <span class="player-name">{{ player.playerName }}</span>
                </div>
              </td>
              <td class="rounds-cell">
                <span class="rounds-list">{{ formatRoundsDisplay(player.participatedRounds) }}</span>
                <div class="rounds-count">({{ player.validRoundsCount }}轮)</div>
              </td>
              <td class="result-cell">
                <span class="best-result">{{ formatResultDisplay(player.bestResult) }}</span>
              </td>
              <td class="total-cell">
                <span class="total-points">{{ player.totalPoints }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- 说明信息 -->
      <div class="notes-section animate-fadeInUp">
        <h3>说明</h3>
        <div class="notes-content">
          <ul>
            <li>总积分为选手在各轮次得分的累积总和</li>
            <li>排名按总积分降序排列，总积分相同时按参与轮次数排序</li>
            <li>已排除预选赛/热身赛/资格赛轮次，仅统计正式比赛轮次</li>
            <li>相同用户名的不同选手码已自动合并统计</li>
            <li>成绩显示该选手达到的最好轮次成绩</li>
            <li><strong>特殊年份规则：</strong>
              <ul>
                <li>2019年：小组赛4关取最高3关总分</li>
                <li>2020-2021年：初赛有效关卡制，未上传/超时上传扣5分</li>
                <li>2022-2025年：初赛有效关卡制，未上传不扣分</li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, computed } from 'vue';
import { loadTotalPointsData, type TotalPointsData } from '../utils/totalPointsCalculator';
import { fetchMarioWorkerYaml } from '../utils/yamlLoader';
import { getRoundChineseName } from '../utils/roundNames';
import { getEditionOptions } from '../utils/editionHelper';
import { formatResultDisplay as formatResult } from '../utils/resultFormatter';

export default defineComponent({
  name: 'TotalPointsRanking',
  setup() {
    const selectedYear = ref('2025');
    const data = ref<TotalPointsData>({
      year: '',
      players: [],
      availableRounds: [],
      hasData: false
    });
    const isLoading = ref(false);
    const availableYears = ref<string[]>([]);
    const yamlData = ref<any>(null);    // 获取可用年度列表
    const getAvailableYears = () => {
      const currentYear = new Date().getFullYear();
      const years: string[] = [];
      for (let year = 2013; year <= currentYear; year++) {
        years.push(year.toString());
      }
      return years.reverse(); // 最新年份在前
    };

    // 可用届次选项
    const availableEditionOptions = computed(() => {
      return getEditionOptions(availableYears.value);
    });

    // 加载数据
    const loadData = async () => {
      if (!yamlData.value) return;
      
      isLoading.value = true;
      try {
        const result = await loadTotalPointsData(selectedYear.value, yamlData.value);
        data.value = result;
      } catch (error) {
        data.value = {
          year: selectedYear.value,
          players: [],
          availableRounds: [],
          hasData: false
        };
      } finally {
        isLoading.value = false;
      }
    };

    // 获取排名样式类
    const getRankingClass = (rank: number) => {
      if (rank === 1) return 'rank-first';
      if (rank === 2) return 'rank-second';
      if (rank === 3) return 'rank-third';
      if (rank <= 10) return 'rank-top10';
      return '';
    };
    // 获取奖牌图标
    const getMedalIcon = (index: number) => {
      const medals = ['🥇', '🥈', '🥉'];
      return medals[index] || '';
    };
    // 格式化轮次显示（将轮次代号转换为中文名称）
    const formatRoundsDisplay = (rounds: string[]) => {
      if (!yamlData.value) return rounds.join(', ');
      const year = Number(selectedYear.value);
      const yearRoundsData = yamlData.value.season?.[selectedYear.value]?.rounds;
      if (year === 2019) {
        const numMap: Record<string, string> = { '1': '一', '2': '二', '3': '三', '4': '四' };
        return rounds.map(round => {
          if (/^G[1-4]$/.test(round)) {
            const num = round[1] as keyof typeof numMap;
            return `小组赛第${numMap[num]}题`;
          } else {
            return getRoundChineseName(round, { ...yearRoundsData?.[round], year: selectedYear.value });
          }
        }).join(', ');
      } else {
        return rounds.map(round => getRoundChineseName(round, { ...yearRoundsData?.[round], year: selectedYear.value })).join(', ');
      }
    };
    // 格式化可用轮次显示（将轮次代号转换为中文名称，2019年小组赛特殊处理）
    const formatAvailableRoundsDisplay = (rounds: string[]) => {
      if (!yamlData.value) return rounds.join(', ');
      const year = Number(selectedYear.value);
      const yearRoundsData = yamlData.value.season?.[selectedYear.value]?.rounds;
      if (year === 2019) {
        // 2019年小组赛G1~G4显示为“小组赛第X题”（X为中文数字）
        const numMap: Record<string, string> = { '1': '一', '2': '二', '3': '三', '4': '四' };
        return rounds.map(round => {
          if (/^G[1-4]$/.test(round)) {
            const num = round[1] as keyof typeof numMap;
            return `小组赛第${numMap[num]}题`;
          } else {
            return getRoundChineseName(round, { ...yearRoundsData?.[round], year: selectedYear.value });
          }
        }).join(', ');
      } else {
        // 其它年份
        return rounds.map(round => getRoundChineseName(round, { ...yearRoundsData?.[round], year: selectedYear.value })).join(', ');
      }
    };
    // 获取特定轮次的选手数量
    const getPlayerCountForRound = (roundCode: string): number => {
      if (!yamlData.value?.season?.[selectedYear.value]?.rounds) return 0;
      
      const rounds = yamlData.value.season[selectedYear.value].rounds;
      let playerCount = 0;
      
      // 查找对应轮次的配置
      const roundData = rounds[roundCode] || 
                       rounds[`[${roundCode}]`] || 
                       rounds[`${roundCode}`] ||
                       Object.entries(rounds).find(([key]) => key.includes(roundCode))?.[1];
      
      if (!roundData?.players) return 0;
      
      // 计算选手数量（每个组的选手总和）
      Object.values(roundData.players).forEach((group: any) => {
        if (typeof group === 'object') {
          playerCount += Object.keys(group).length;
        }
      });
      
      return playerCount;
    };
    
    // 格式化成绩显示
    const formatResultDisplay = (bestResult: string) => {
      return formatResult(bestResult, {
        year: selectedYear.value,
        yamlData: yamlData.value
      });
    };

    // 并列排名算法，支持总积分、参与轮次数并列
    function assignRankingWithTiesForTotal(players: any[], scoreField: string = 'totalPoints', secondaryField: string = 'validRoundsCount', rankField: string = 'displayRank') {
      let lastScore: string | null = null
      let lastSecondary: number | null = null
      let lastRank = 0
      let skip = 0
      for (let i = 0; i < players.length; i++) {
        // 统一格式化分数字符串，避免小数精度误差
        const currScore = players[i][scoreField]?.toFixed ? players[i][scoreField].toFixed(3) : String(players[i][scoreField])
        const currSecondary = players[i][secondaryField]
        if (
          lastScore !== null && currScore === lastScore &&
          lastSecondary !== null && currSecondary === lastSecondary
        ) {
          players[i][rankField] = lastRank
          skip++
        } else {
          players[i][rankField] = lastRank + 1 + skip
          lastRank = players[i][rankField]
          skip = 0
        }
        lastScore = currScore
        lastSecondary = currSecondary
      }
    }

    // 计算带并列排名的players
    const playersWithRank = computed(() => {
      if (!data.value.players) return []
      // 按总积分降序，参与轮次数降序
      const arr = [...data.value.players].sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return Number(b.totalPoints) - Number(a.totalPoints)
        return b.validRoundsCount - a.validRoundsCount
      })
      assignRankingWithTiesForTotal(arr, 'totalPoints', 'validRoundsCount', 'displayRank')
      // 添加缺失的 displayRank 属性到每个 player 对象
      return arr.map((player, index) => ({
        ...player,
        displayRank: index + 1
      }));
    })

    // 初始化
    onMounted(async () => {
      availableYears.value = getAvailableYears();
      try {
        yamlData.value = await fetchMarioWorkerYaml();
        await loadData();
      } catch (error) {
      }
    });    return {
      selectedYear,
      data,
      isLoading,
      availableYears,
      availableEditionOptions,
      loadData,
      getRankingClass,
      getMedalIcon,
      formatRoundsDisplay,
      formatResultDisplay,
      getPlayerCountForRound,
      formatAvailableRoundsDisplay,
      playersWithRank
    };
  }
});
</script>

<style scoped>
/* 使用主题CSS变量和统一样式 */
.total-points-ranking {
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

.ranking-row:hover {
  background: rgba(255, 235, 220, 0.7) !important;
}

.rank-col { width: 80px; }
.player-col { width: 200px; }
.rounds-col { width: 250px; }
.result-col { width: 150px; }
.total-col { width: 120px; }

.rank-number {
  font-weight: 600;
  color: var(--text-primary);
}

.player-name {
  color: var(--text-primary);
}

.rounds-list {
  color: var(--text-primary);
  line-height: 1.4;
}

.rounds-count {
  color: var(--text-secondary);
  font-size: 0.7rem;
  margin-top: var(--spacing-xs);
}

.best-result {
  color: var(--primary-color);
  font-weight: 600;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--primary-color-light);
  border-radius: var(--radius-small);
  display: inline-block;
}

.total-points {
  font-weight: 600;
  color: var(--success-color);
}

/* 排名特殊样式 */

.rank-first .rank-number {
  color: var(--primary-color);
  text-shadow: 0 0 10px rgba(255, 193, 7, 0.5);
}

.rank-second .rank-number {
  color: #6c757d;
}

.rank-third .rank-number {
  color: var(--primary-color);
}

.notes-section {
  background: var(--bg-card);
  padding: var(--spacing-lg);
  border-radius: var(--radius-large);
  box-shadow: var(--shadow-sm);
  border-left: 4px solid var(--info-color);
}

.notes-section h3 {
  margin: 0 0 var(--spacing-md) 0;
  color: var(--text-primary);
  font-size: 1.2rem;
  font-weight: 600;
}

.notes-content ul {
  margin: 0;
  padding-left: var(--spacing-lg);
  color: var(--text-secondary);
  line-height: 1.6;
}

.notes-content li {
  margin-bottom: var(--spacing-sm);
}

.notes-content li strong {
  color: var(--text-primary);
}

.notes-content ul ul {
  margin-top: var(--spacing-xs);
}

.ranking-table {
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
  .ranking-table {
    font-size: 12px;
    white-space: nowrap;
  }

  .total-points-ranking {
    padding: var(--spacing-md);
  }
  
  .player-col {
    width: 120px;
  }
  
  .rounds-col {
    width: 180px;
  }
  
  .result-col {
    width: 100px;
  }
  
  .total-col {
    width: 80px;
  }
}
</style>
