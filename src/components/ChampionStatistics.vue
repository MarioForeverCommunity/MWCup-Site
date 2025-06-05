<template>
  <div class="statistics-container">    <div class="stats-header">
      <h2>Mario Worker 杯历届冠军统计</h2>
      <p>从2013年到2025年的所有决赛冠军信息</p>
    </div>

    <div v-if="loading" class="loading">
      正在加载数据...
    </div>

    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <div v-else class="statistics-content">
      <!-- 冠军列表 -->
      <div class="champions-section">
        <h3>历届决赛排名</h3>
        <div class="table-wrapper">
          <table class="champions-table">
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
              <tr v-for="champion in champions" :key="champion.year">
                <td class="year">{{ champion.year }}年第{{ getEditionNumber(champion.year) }}届</td>
                <td class="champion">{{ champion.first || '-' }}</td>
                <td>{{ champion.second || '-' }}</td>
                <td v-if="hasThirdPrize">{{ champion.third || '-' }}</td>
                <td v-if="hasFourthPrize">{{ champion.fourth || '-' }}</td>
                <td class="host">{{ champion.host || '-' }}</td>
                <td class="judges">{{ champion.chiefJudges?.join('、') || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
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
.statistics-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.stats-header {
  text-align: center;
  margin-bottom: 30px;
}

.stats-header h2 {
  color: #2c3e50;
  margin: 0 0 10px 0;
  font-size: 28px;
}

.stats-header p {
  color: #7f8c8d;
  margin: 0;
  font-size: 16px;
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

.champions-section, .stats-section {
  margin-bottom: 40px;
}

.champions-section h3, .stats-section h3 {
  margin: 0 0 20px 0;
  color: #34495e;
  font-size: 20px;
  border-bottom: 2px solid #3498db;
  padding-bottom: 8px;
}

.table-wrapper {
  overflow-x: auto;
  border: 1px solid #ddd;
  border-radius: 6px;
}

.champions-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.champions-table th, .champions-table td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.champions-table th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #495057;
  border-bottom: 2px solid #dee2e6;
}

.champions-table tbody tr:hover {
  background-color: #f1f1f1;
}

.year {
  font-weight: 600;
  color: #2c3e50;
  text-align: center;
}

.champion {
  color: #3498db;
  font-weight: 500;
}

.host {
  color: #27ae60;
}

.judges {
  color: #8e44ad;
  font-size: 14px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.stat-card {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.stat-card h4 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 16px;
}

.stat-value {
  font-size: 36px;
  font-weight: bold;
  color: #3498db;
  margin: 0;
  text-align: center;
}

.player {
  font-weight: 500;
  color: #2c3e50;
}

.count {
  background-color: #3498db;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .statistics-container {
    padding: 15px;
  }
  
  .champions-table th, .champions-table td {
    padding: 8px 10px;
    font-size: 14px;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-header h2 {
    font-size: 24px;
  }
}
</style>
