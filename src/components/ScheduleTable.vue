<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { fetchMarioWorkerYaml, getYearSchedules } from '../utils/scheduleYaml';
import type { YearSchedule } from '../utils/scheduleYaml';

const schedules = ref<YearSchedule[]>([]);
const selectedYear = ref<string>('');
const years = ref<string[]>([]);

// 计算每个阶段的行数，用于rowspan
function calculateRowspans(items: YearSchedule['items']) {
  const rowspans = new Map<string, number>();
  const currentStage = { value: '', count: 0 };
  
  items.forEach((item, index) => {
    if (item.stage === currentStage.value) {
      currentStage.count++;
    } else {
      if (currentStage.value) {
        rowspans.set(currentStage.value + '_' + (index - currentStage.count), currentStage.count);
      }
      currentStage.value = item.stage;
      currentStage.count = 1;
    }
  });
  
  // 处理最后一组
  if (currentStage.value) {
    rowspans.set(currentStage.value + '_' + (items.length - currentStage.count), currentStage.count);
  }
  
  return rowspans;
}

// 为选中年份的数据计算rowspan
const filteredSchedule = computed(() => {
  if (!selectedYear.value) {
    return schedules.value.length > 0 ? schedules.value[0] : null;
  }
  return schedules.value.find(ys => ys.year === selectedYear.value) || null;
});

const scheduleWithRowspans = computed(() => {
  if (!filteredSchedule.value) return null;
  return {
    ...filteredSchedule.value,
    rowspans: calculateRowspans(filteredSchedule.value.items)
  };
});

function formatTime(time?: string) {
  if (!time) return '';
  // 兼容 YYYY-MM-DDTHH:mm 或 YYYY-MM-DD HH:mm
  const t = time.replace('T', ' ');
  // 只显示日期和时间
  return t.length > 16 ? t.slice(0, 16) : t;
}

onMounted(async () => {
  const doc = await fetchMarioWorkerYaml();
  schedules.value = getYearSchedules(doc);
  
  // 获取所有年份并排序（从新到旧）
  years.value = schedules.value.map(ys => ys.year).sort((a, b) => Number(b) - Number(a));
  
  // 默认选择最近一年
  if (years.value.length > 0) {
    selectedYear.value = years.value[0];
  }
});

// 工具函数：从HTML字符串中提取href和文本
function getLinkHref(link: string) {
  const match = link.match(/href=["']([^"']+)["']/);
  return match ? match[1] : '#';
}
function getLinkText(link: string) {
  const match = link.match(/>([^<]*)<\/a>/);
  return match ? match[1] : '链接';
}
</script>

<template>
  <div class="schedule-container">
    <div class="schedule-header">
      <h3>比赛日程表</h3>
      
      <div class="year-selector">
        <label for="year-select">选择年份：</label>
        <select id="year-select" v-model="selectedYear" class="year-select">
          <option v-for="year in years" :key="year" :value="year">{{ year }} 年</option>
        </select>
      </div>
    </div>
    
    <div v-if="scheduleWithRowspans" class="schedule-table-container">
      <table class="schedule-table">
        <thead>
          <tr>
            <th>比赛阶段</th>
            <th>内容</th>
            <th>开始时间</th>
            <th>结束时间</th>
            <th>链接</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!scheduleWithRowspans.items || scheduleWithRowspans.items.length === 0">
            <td colspan="5">无日程数据</td>
          </tr>
          <tr 
            v-for="(item, index) in scheduleWithRowspans.items" 
            :key="item.stage + item.content + (item.start||'') + index"
            class="schedule-row"
          >
            <td 
              v-if="scheduleWithRowspans.rowspans.has(item.stage + '_' + index)" 
              :rowspan="scheduleWithRowspans.rowspans.get(item.stage + '_' + index)"
              class="stage-cell"
            >
              {{ item.stage }}
            </td>
            <td class="content-cell">{{ item.content }}</td>
            <template v-if="item.start === item.end">
              <td colspan="2" class="time-cell">{{ formatTime(item.start) }}</td>
            </template>
            <template v-else-if="item.start && item.end">
              <td class="time-cell">{{ formatTime(item.start) }}</td>
              <td class="time-cell">{{ formatTime(item.end) }}</td>
            </template>
            <template v-else>
              <td colspan="2" class="time-cell">{{ formatTime(item.start) || formatTime(item.end) || '——' }}</td>
            </template>
            <td class="link-cell">
              <template v-if="item.multipleLinks">
                <div v-for="(link, idx) in item.multipleLinks" :key="link + idx" class="multi-link-container">
                  <a :href="getLinkHref(link)" target="_blank" class="link-btn" v-text="getLinkText(link)"></a>
                </div>
              </template>
              <a v-else-if="item.link" :href="item.link" target="_blank" class="link-btn">链接</a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.schedule-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1rem;
}

.schedule-header {
  margin-bottom: 1.5rem;
  text-align: center;
}

.schedule-header h3 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: #2c3e50;
}

.year-selector {
  margin: 1.5rem 0;
  text-align: center;
}

.year-selector label {
  font-weight: 500;
  color: #34495e;
  font-size: 14px;
}

.year-select {
  padding: 10px 12px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 16px;
  background-color: white;
  color: #2c3e50;
  margin-left: 0.5rem;
  cursor: pointer;
  transition: border-color 0.3s ease;
}

.year-select:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.year-select:hover {
  border-color: #3498db;
}

.schedule-table-container {
  overflow-x: auto;
  margin-bottom: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}

.schedule-table {
  width: 100%;
  border-collapse: collapse;
  background-color: white;
}

.schedule-table th {
  background-color: #f8f9fa;
  color: #495057;
  text-align: center;
  padding: 8px 10px;
  font-weight: 600;
  border-bottom: 2px solid #dee2e6;
}

.schedule-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #eee;
  text-align: center;
}

.schedule-row:nth-child(odd) {
  background-color: #ffffff;
}

.schedule-row:nth-child(even) {
  background-color: #f9fafb;
}

.schedule-row:hover {
  background-color: #f1f1f1;
}

.stage-cell {
  font-weight: 500;
  background-color: #f8f9fa;
  vertical-align: middle;
  border-right: 2px solid #dee2e6;
  color: #2c3e50;
}

.content-cell {
  text-align: left;
  color: #34495e;
}

.time-cell {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  white-space: nowrap;
}

.link-cell {
  text-align: center;
}

.link-btn {
  display: inline-block;
  padding: 3px 8px;
  margin: 1px 0;
  background-color: #3498db;
  color: white;
  text-decoration: none;
  border-radius: 3px;
  font-size: 0.9rem;
  transition: background-color 0.3s ease;
}

.link-btn:hover {
  background-color: #2980b9;
}

.multi-link-container {
  margin: 4px 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .schedule-container {
    padding: 10px;
  }
  
  .schedule-table th, .schedule-table td {
    padding: 6px 4px;
    font-size: 12px;
  }
  
  .schedule-header h3 {
    font-size: 20px;
  }
}
</style>

<!-- 移除重复的样式 -->
