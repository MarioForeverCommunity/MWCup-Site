<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { fetchMarioWorkerYaml, getYearSchedules } from '../utils/scheduleYaml';
import type { YearSchedule } from '../utils/scheduleYaml';
import { getEditionDisplayText } from '../utils/editionHelper';

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
  <div class="page-header animate-fadeInUp">
    <h2>Mario Worker 杯赛程表</h2>
    
    <div class="control-panel">
      <div class="form-group">
        <label for="year-select" class="form-label">选择届次：</label>
        <select id="year-select" v-model="selectedYear" class="form-control">
          <option v-for="year in years" :key="year" :value="year">{{ getEditionDisplayText(year) }}</option>
        </select>
      </div>
    </div>
  </div>
  
  <div v-if="scheduleWithRowspans" class="content-panel animate-fadeInUp">
    <div class="table-wrapper shimmer-effect">
      <table class="table-base schedule-table">
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
                <a :href="getLinkHref(link)" target="_blank" class="link-btn hover-scale" v-text="getLinkText(link)"></a>
              </div>
            </template>
            <a v-else-if="item.link" :href="item.link" target="_blank" class="link-btn hover-scale">链接</a>
          </td>
        </tr>
      </tbody>
    </table>
    </div>
  </div>
</template>

<style scoped>
/* 组件特定样式 - 使用新的CSS类系统 */
.content-panel {
  display: flex;
}

.schedule-table {
  width: auto; /* 表格自适应宽度 */
  table-layout: auto; /* 让表格根据内容调整列宽 */
  white-space: nowrap;
}

.link-btn {
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

.link-btn:hover {
  background: linear-gradient(135deg, var(--primary-active), var(--primary-dark));
  transform: translateY(-1px);
  box-shadow: var(--shadow-button);
}

.multi-link-container {
  margin: 4px 0;
}
</style>
