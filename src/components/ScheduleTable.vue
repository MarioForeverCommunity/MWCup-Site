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
    <h2>历届比赛日程表</h2>
    
    <div class="year-selector">
      <label for="year-select">选择年份：</label>
      <select id="year-select" v-model="selectedYear" class="year-select">
        <option v-for="year in years" :key="year" :value="year">{{ year }} 年</option>
      </select>
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

.year-selector {
  margin: 1.5rem 0;
  text-align: center;
}

.year-select {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: 1px solid #ddd;
  background-color: #fff;
  font-size: 1rem;
  margin-left: 0.5rem;
  cursor: pointer;
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
  background-color: #4CAF50;
  color: white;
  text-align: center;
  padding: 12px;
  font-weight: bold;
  border: none;
}

.schedule-table td {
  padding: 10px 12px;
  border: 1px solid #e0e0e0;
  text-align: center;
}

.schedule-row:nth-child(odd) {
  background-color: #f9f9f9;
}

.schedule-row:hover {
  background-color: #f1f1f1;
}

.stage-cell {
  font-weight: bold;
  background-color: #e8f5e9;
}

.content-cell {
  text-align: left;
}

.time-cell {
  font-family: monospace;
  white-space: nowrap;
}

.link-cell {
  text-align: center;
}

.link-btn {
  display: inline-block;
  padding: 3px 8px;
  margin: 1px 0;
  background-color: #1976D2;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  font-size: 0.9rem;
  transition: background-color 0.3s ease;
}

.link-btn:hover {
  background-color: #1565C0;
}

.multi-link-container {
  margin: 4px 0;
}

/* 移除多余的样式，统一使用链接按钮样式 */
</style>

<!-- 移除重复的样式 -->
