<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { fetchMWCupYaml, getYearSchedules } from '../utils/mwcupYaml';
import type { YearSchedule } from '../utils/mwcupYaml';

const schedules = ref<YearSchedule[]>([]);

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
    <div v-for="ys in schedules" :key="ys.year" style="margin-bottom:2em;">
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
          <tr v-for="item in ys.items" :key="item.stage + item.content + (item.start||'')">
            <td>{{ item.stage }}</td>
            <td>{{ item.content }}</td>
            <template v-if="item.start && item.end">
              <td>{{ formatTime(item.start) }}</td>
              <td>{{ formatTime(item.end) }}</td>
            </template>
            <template v-else>
              <td colspan="2">{{ formatTime(item.start) || formatTime(item.end) || '——' }}</td>
            </template>
            <td>
              <a v-if="item.link" :href="item.link" target="_blank">链接</a>
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
</style>
