<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import FoldButton from './FoldButton.vue';
import { fetchMarioWorkerYaml, getYearSchedules } from '../utils/scheduleHelper';
import type { YearSchedule } from '../utils/scheduleHelper';

// 定义props，支持外部传入年份和轮次
interface Props {
  year?: string;
  round?: string;
}

const props = withDefaults(defineProps<Props>(), {
  year: '',
  round: '',
});

const schedules = ref<YearSchedule[]>([]);
const selectedYear = ref<string>('');
const years = ref<string[]>([]);
const scheduleContentHidden = ref(false);

// 折叠/展开赛程内容
function toggleScheduleContent() {
  scheduleContentHidden.value = !scheduleContentHidden.value;
}

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
  const yearToUse = props.year || selectedYear.value;
  if (!yearToUse) {
    return schedules.value.length > 0 ? schedules.value[0] : null;
  }
  const yearSchedule = schedules.value.find(ys => ys.year === yearToUse) || null;
  
  // 如果指定了轮次，则过滤相关的赛程项
  if (yearSchedule && props.round) {
    const roundItems = yearSchedule.items.filter(item => {
      // 根据轮次过滤赛程项
      // 如果是小组赛轮次（G1、G2等），显示所有小组赛阶段
      if (props.round.startsWith('G')) {
        return item.stage === '小组赛';
      }
      // 如果是初赛轮次（I1、I2等），显示所有初赛阶段
      if (props.round.startsWith('I')) {
        return item.stage === '初赛';
      }
      // 如果是复赛轮次（R1、R2等），显示所有复赛阶段
      if (props.round.startsWith('R')) {
        return item.stage === '复赛';
      }
      // 如果是四分之一决赛轮次（Q1、Q2等），显示所有四分之一决赛阶段
      if (props.round.startsWith('Q')) {
        return item.stage === '四分之一决赛';
      }
      // 如果是半决赛轮次（S1、S2等），显示所有半决赛阶段
      if (props.round.startsWith('S')) {
        return item.stage === '半决赛';
      }
      // 如果是决赛轮次（F），显示所有决赛阶段
      if (props.round === 'F') {
        return item.stage === '决赛';
      }
      // 如果是预选赛或资格赛轮次
      if (props.round === 'P1') {
        return item.stage === '预选赛' || item.stage === '热身赛';
      }
      if (props.round === 'P2') {
        return item.stage === '资格赛';
      }
      return false;
    });
    
    return {
      ...yearSchedule,
      items: roundItems
    };
  }
  
  return yearSchedule;
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
  // 将日期中的 - 替换为 /
  const formatted = t.replace(/-/g, '/');
  // 只显示日期和时间
  return formatted.length > 16 ? formatted.slice(0, 16) : formatted;
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
function getLinkText(link: string, useSimpleText = false) {
  if (useSimpleText) {
    return '链接';
  }
  const match = link.match(/>([^<]*)<\/a>/);
  return match ? match[1] : '链接';
}

// 工具函数：根据轮次过滤多链接
function filterMultipleLinks(links: string[], round?: string): string[] {
  if (!round || !links) return links;
  
  // 如果没有指定轮次，显示所有链接
  if (!round) return links;
  
  // 提取轮次中的数字（如 G1 -> 1, I2 -> 2）
  const roundMatch = round.match(/[GIQSR](\d+)/);
  if (!roundMatch) return links;
  
  const roundNum = roundMatch[1];
  const cnNum = ['零','一','二','三','四','五','六','七','八','九','十'][Number(roundNum)] || roundNum;
  const targetText = `第${cnNum}题`;
  
  // 过滤出包含目标题目的链接
  return links.filter(link => {
    const linkText = getLinkText(link, false);
    return linkText.includes(targetText);
  });
}
</script>

<template>
  <div v-if="scheduleWithRowspans" class="content-panel animate-fadeInUp">
    <div class="schedule-header">
      <h3 class="schedule-title">
        赛程安排
        <FoldButton :is-folded="scheduleContentHidden" @toggle="toggleScheduleContent" />
      </h3>
    </div>
    <div class="panel-collapse" :class="{'is-expanded': !scheduleContentHidden}">
      <div class="table-container">
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
                    <div v-for="(link, idx) in filterMultipleLinks(item.multipleLinks, props.round)" :key="link + idx" class="multi-link-container">
                      <a :href="getLinkHref(link)" target="_blank" class="link-btn hover-scale" v-text="getLinkText(link, !!props.round)"></a>
                    </div>
                  </template>
                  <a v-else-if="item.link" :href="item.link" target="_blank" class="link-btn hover-scale">链接</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 组件特定样式 - 使用新的CSS类系统 */
.content-panel {
  display: flex;
  flex-direction: column;
}

.table-container {
  display: flex;
  justify-content: center; /* 表格容器水平居中 */
}

.schedule-table {
  width: auto; /* 表格自适应宽度 */
  table-layout: auto; /* 让表格根据内容调整列宽 */
  white-space: nowrap;
}

.schedule-header h3 {
  margin: 0;
  color: var(--text-secondary);
  font-size: 22px;
  border-bottom: 2px solid var(--primary-active);
  padding-bottom: var(--spacing-sm);
  text-align: center;
}

.stage-cell {
  font-weight: 600;
  background: rgba(255, 240, 230, 0.9);
  border-right: 1px solid var(--border-medium);
  color: var(--text-primary);
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
  margin-bottom: var(--spacing-sm);  /* 增加每个容器之间的垂直间距 */
}

.multi-link-container:last-child {
  margin-bottom: 0;  /* 最后一个容器不需要底部间距 */
}

.panel-collapse {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.panel-collapse.is-expanded {
  max-height: 2000px;
  opacity: 1;
  transition: max-height 0.6s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

</style>
