<template>
  <div class="page-header animate-fadeInUp">
    <h2 class="animate-textGlow">Mario Worker 杯历届冠军统计</h2>
    <p>从2013年到2025年的所有决赛冠军信息</p>
  </div>
  <div v-if="loading" class="loading-state animate-pulse">
    <div class="loading-spinner"></div>
    <div class="loading-text">正在加载数据<span class="loading-dots"></span></div>
  </div>

  <div v-else-if="error" class="error-state animate-pulse">
    {{ error }}
  </div>

  <div v-else class="content-panel animate-fadeInUp">
    <!-- 冠军列表 -->
    <div class="section-header">
      <h3>历届决赛排名</h3>
      <div class="table-wrapper">
        <table class="table-base champions-table">
          <thead>
            <tr>
              <th>年份</th>
              <th>冠军</th>
              <th>亚军</th>
              <th v-if="hasThirdPrize">季军</th>
              <th v-if="hasFourthPrize">第四名</th>
              <th>主办人</th>
              <th>总评委</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="(champion) in champions" 
              :key="champion.year"
              class="champion-row"
            >
              <td class="year">{{ champion.year }}年第{{ getEditionNumber(champion.year) }}届</td>
              <td class="champion">{{ champion.first || '-' }}</td>
              <td class="second">{{ champion.second || '-' }}</td>
              <td v-if="hasThirdPrize" class="third">{{ champion.third || '-' }}</td>
              <td v-if="hasFourthPrize" class="fourth">{{ champion.fourth || '-' }}</td>
              <td class="host">{{ champion.host || '-' }}</td>
              <td class="judges">{{ champion.chiefJudges?.join('、') || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { fetchMarioWorkerYaml, extractSeasonData } from '../utils/yamlLoader'
import { getEditionNumber } from '../utils/editionHelper'
import { loadRoundScoreData } from '../utils/scoreCalculator'

interface ChampionInfo {
  year: string
  first?: string
  second?: string
  third?: string
  fourth?: string
  host?: string
  chiefJudges?: string[]
}

const champions = ref<ChampionInfo[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const hasThirdPrize = computed(() => parseInt(champions.value[0]?.year || '0') >= 2020)
const hasFourthPrize = computed(() => parseInt(champions.value[0]?.year || '0') >= 2020)
async function loadChampions() {
  loading.value = true
  error.value = null
  
  try {
    const yamlDoc = await fetchMarioWorkerYaml()
    const seasonData = extractSeasonData(yamlDoc)
    const championList: ChampionInfo[] = []
    
    for (const [year, yearData] of Object.entries(seasonData)) {
      if (typeof yearData === 'object' && yearData !== null) {
        const data = yearData as any
        
        const championInfo: ChampionInfo = {
          year,
          host: data.host,
          chiefJudges: Array.isArray(data.chief_judge) ? data.chief_judge : 
                       data.chief_judge ? [data.chief_judge] : undefined
        }
        
        try {
          // 尝试加载并使用决赛评分数据
          const scoreData = await loadRoundScoreData(year, 'F', yamlDoc)
          if (scoreData?.playerScores?.length > 0) {
            // 按平均分排序
            const sortedPlayers = [...scoreData.playerScores].sort(
              (a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0)
            )
            
            // 分配名次
            championInfo.first = sortedPlayers[0].playerName
            if (sortedPlayers.length > 1) championInfo.second = sortedPlayers[1].playerName
            if (parseInt(year) >= 2020) {
              if (sortedPlayers.length > 2) championInfo.third = sortedPlayers[2].playerName
              if (sortedPlayers.length > 3) championInfo.fourth = sortedPlayers[3].playerName
            }
            championList.push(championInfo)
            continue
          }
          throw new Error('评分数据不完整')
        } catch (err) {
          console.warn(`${year} 年决赛评分数据加载失败:`, err)
          
          // 使用 yaml 中的记录作为备选
          const finalRound = data.rounds?.F
          if (!finalRound?.players) {
            console.warn(`${year} 年决赛选手记录不存在，跳过`)
            continue
          }
          
          // 确定冠亚军
          if (finalRound.players.S) {
            championInfo.first = finalRound.players.S
            championInfo.second = finalRound.players.M || finalRound.players.W
          } else if (finalRound.players.M) {
            championInfo.first = finalRound.players.M
            championInfo.second = finalRound.players.W
          }
          
          // 2020年及之后的比赛额外记录季军和第四名
          if (parseInt(year) >= 2020) {
            if (!championInfo.second && finalRound.players.W) {
              championInfo.third = finalRound.players.W
            }
            if (finalRound.players.P) {
              championInfo.fourth = finalRound.players.P
            }
          }
          
          championList.push(championInfo)
        }
      }
    }
    
    // 按年份降序排序
    championList.sort((a, b) => parseInt(b.year) - parseInt(a.year))
    champions.value = championList
    
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
    console.error('加载冠军数据失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadChampions()
})
</script>

<style scoped>
/* 组件特定样式 - 使用新的CSS类系统 */
.champions-table {
  width: 100%;
}

.year {
  color: var(--text-primary);
}

.champion {
  color: #e67e22; /* 冠军：橙色 */
}

.second {
  color: #3498db; /* 亚军：蓝色 */
}

.third {
  color: #9b59b6; /* 季军：紫色 */
}

.fourth {
  color: #6cc1c7; /* 第四名：灰蓝色 */
}

.host {
  color: #27ae60;
}

.judges {
  color: #e63fbc;
  font-size: 14px;
}

/* 表格行动画效果 */
.champion-row {
  transition: all 0.3s ease;
  cursor: pointer;
}

.champion-row:hover {
  background-color: rgba(255, 99, 71, 0.05);
}

/* 年份列特殊样式 */
.year {
  background: linear-gradient(135deg, var(--primary-color), #ff8a65);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: 700;
}

/* 渐变动画 */
@keyframes gradientMove {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
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
  .champions-table {
    font-size: 14px;
    min-width: 800px; /* 确保表格有足够宽度触发横向滚动 */
    table-layout: fixed; /* 防止单元格内容影响表格布局 */
  }
  
  .year {
    font-size: 13px;
  }
  
  .judges {
    font-size: 12px;
  }
}
</style>