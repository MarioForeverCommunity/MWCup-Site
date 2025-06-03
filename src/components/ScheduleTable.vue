<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { fetchMWCupYaml, getYearSchedules } from '../utils/mwcupYaml';
import type { YearSchedule } from '../utils/mwcupYaml';

const schedules = ref<YearSchedule[]>([]);

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

// 为每个年份的数据计算rowspan
const schedulesWithRowspans = computed(() => {
  return schedules.value.map(ys => ({
    ...ys,
    rowspans: calculateRowspans(ys.items)
  }));
});

function formatTime(time?: string) {
  if (!time) return '';
  // 兼容 YYYY-MM-DDTHH:mm 或 YYYY-MM-DD HH:mm
  const t = time.replace('T', ' ');
  // 只显示日期和时间
  return t.length > 16 ? t.slice(0, 16) : t;
}

onMounted(async () => {
  const doc = await fetchMWCupYaml();
  schedules.value = getYearSchedules(doc);
});
</script>

<template>
  <div>
    <h2>历届比赛日程表</h2>
    <div v-for="ys in schedulesWithRowspans" :key="ys.year" style="margin-bottom:2em;">
      <h3>{{ ys.year }} 年</h3>
      <table border="1" cellspacing="0" cellpadding="6">
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
          <tr v-if="!ys.items || ys.items.length === 0">
            <td colspan="5">无日程数据</td>
          </tr>
          <tr v-for="(item, index) in ys.items" :key="item.stage + item.content + (item.start||'') + index">
            <td v-if="ys.rowspans.has(item.stage + '_' + index)" :rowspan="ys.rowspans.get(item.stage + '_' + index)">
              {{ item.stage }}
            </td>
            <td>{{ item.content }}</td>
            <template v-if="item.start === item.end">
              <td colspan="2" class="time-cell">{{ formatTime(item.start) }}</td>
            </template>
            <template v-else-if="item.start && item.end">
              <td>{{ formatTime(item.start) }}</td>
              <td>{{ formatTime(item.end) }}</td>
            </template>
            <template v-else>
              <td colspan="2" class="time-cell">{{ formatTime(item.start) || formatTime(item.end) || '——' }}</td>
            </template>
            <td>
              <template v-if="item.multipleLinks">
                <div v-for="link in item.multipleLinks" :key="link" v-html="link"></div>
              </template>
              <a v-else-if="item.link" :href="item.link" target="_blank">链接</a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  text-align: center;
}
.time-cell {
  text-align: center;
}
.multiple-links {
  text-align: left;
  margin: 2px 0;
}
.multiple-links :deep(a) {
  color: #0066cc;
  text-decoration: none;
}
.multiple-links :deep(a):hover {
  text-decoration: underline;
}
</style>
