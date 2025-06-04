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
        <h3>历届冠军</h3>
        <div class="table-wrapper">
          <table class="champions-table">
            <thead>
              <tr>
                <th>年份</th>
                <th>男子组冠军</th>
                <th>女子组冠军</th>
                <th>主办人</th>
                <th>总评委</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="champion in champions" :key="champion.year">
                <td class="year">{{ champion.year }}</td>
                <td class="champion male">{{ champion.maleChampion || '-' }}</td>
                <td class="champion female">{{ champion.femaleChampion || '-' }}</td>
                <td class="host">{{ champion.host || '-' }}</td>
                <td class="judges">{{ champion.chiefJudges?.join('、') || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 统计信息 -->
      <div class="stats-section">
        <h3>统计信息</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <h4>总届数</h4>
            <p class="stat-value">{{ champions.length }}</p>
          </div>
          <div class="stat-card">
            <h4>多次夺冠选手</h4>
            <div class="multi-champion-list">
              <div v-for="(count, player) in multipleChampions" :key="player" class="multi-champion-item">
                <span class="player">{{ player }}</span>
                <span class="count">{{ count }}次</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { fetchMarioWorkerYaml, extractSeasonData } from '../utils/yamlLoader'

interface ChampionInfo {
  year: string
  maleChampion?: string
  femaleChampion?: string
  host?: string
  chiefJudges?: string[]
}

const champions = ref<ChampionInfo[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const multipleChampions = computed(() => {
  const championCounts: { [key: string]: number } = {}
  
  champions.value.forEach(c => {
    if (c.maleChampion) {
      championCounts[c.maleChampion] = (championCounts[c.maleChampion] || 0) + 1
    }
    if (c.femaleChampion) {
      championCounts[c.femaleChampion] = (championCounts[c.femaleChampion] || 0) + 1
    }
  })
  
  // 过滤出多次夺冠的选手
  const multiple: { [key: string]: number } = {}
  for (const [player, count] of Object.entries(championCounts)) {
    if (count > 1) {
      multiple[player] = count
    }
  }
  
  return multiple
})

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
        const finalRound = data.rounds?.F
        
        if (finalRound?.players) {
          const championInfo: ChampionInfo = {
            year,
            host: data.host,
            chiefJudges: Array.isArray(data.chief_judge) ? data.chief_judge : 
                         data.chief_judge ? [data.chief_judge] : undefined
          }
          
          // 提取冠军信息
          if (finalRound.players.M) {
            championInfo.maleChampion = finalRound.players.M
          }
          if (finalRound.players.W) {
            championInfo.femaleChampion = finalRound.players.W
          }
          
          championList.push(championInfo)
        }
      }
    }
    
    // 按年份排序
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

.year {
  font-weight: 600;
  color: #2c3e50;
  text-align: center;
}

.champion.male {
  color: #3498db;
  font-weight: 500;
}

.champion.female {
  color: #e91e63;
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

.multi-champion-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.multi-champion-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #f8f9fa;
  border-radius: 4px;
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
