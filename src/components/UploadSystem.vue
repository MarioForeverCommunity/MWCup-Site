<script setup lang="ts">
import { ref, computed } from 'vue'
import { getEditionOptions } from '../utils/editionHelper'

// 所有支持的年份，分为比赛系统和网盘两部分
const competitionYears = ['2025', '2024', '2023', '2022']
const archiveYears = ['2021', '2020', '2019', '2018', '2017', '2016', '2015', '2014', '2013', '2012']
const years = [...competitionYears, ...archiveYears] as const

type Year = (typeof years)[number]
const activeYear = ref<Year>(competitionYears[0]) // 默认显示最新一年

// 使用 getEditionOptions 生成带有届数的选项
const competitionOptions = getEditionOptions([...competitionYears])

// 2012年特殊显示文字
const isTotalArchive = computed(() => activeYear.value === '2012')

// 动态按钮文字
const buttonText = computed(() => {
  if (isTotalArchive.value) return '前往MW杯总网盘'
  return showIframe.value ? '在新窗口打开比赛系统' : '前往本届MW杯网盘'
})

// 下拉菜单选项（2012年特殊处理）
const archiveOptions = getEditionOptions([...archiveYears]).map(opt =>
  opt.value === '2012' ? { ...opt, label: 'MW杯总网盘' } : opt
)

// 构建URL映射
const urlMap: Record<Year, string> = {
  '2025': 'https://mwcup2025.marioforever.net',
  '2024': 'https://mwcup2024.marioforever.net',
  '2023': 'https://mwcup2023.marioforever.net',
  '2022': 'https://mwcup2022.marioforever.net',
  '2021': 'http://2021mwcup.yspean.com/',
  '2020': 'http://mwcup2020.yspean.com/',
  '2019': 'http://mwcup2019.yspean.com/',
  '2018': 'http://mwcup2018.yspean.com/',
  '2017': 'http://2017mwcup.yspean.com/',
  '2016': 'http://mwcup2016.yspean.com/',
  '2015': 'http://mwcup2015.yspean.com/',
  '2014': 'http://mwcup3--2014.yspean.com/',
  '2013': 'http://2013mwcup.yspean.com/',
  '2012': 'http://mwcup.yspean.com/'
}

// 当前显示的URL
const currentUrl = computed(() => urlMap[activeYear.value])

// 判断是否显示iframe（只有比赛系统显示）
const showIframe = computed(() => competitionYears.includes(activeYear.value))

// 打开链接
const openUrl = () => {
  window.open(currentUrl.value, '_blank')
}
</script>

<template>
  <div class="upload-system-container">
    <div class="year-selector">
      <select 
        v-model="activeYear" 
        class="form-control hover-scale"
        :class="{ 'archive': !showIframe }"
      >
        <optgroup label="比赛系统">
          <option 
            v-for="option in competitionOptions" 
            :key="option.value" 
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </optgroup>
        <optgroup label="历届网盘">
          <option 
            v-for="option in archiveOptions" 
            :key="option.value" 
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </optgroup>
      </select>
      
      <button 
        class="btn-base btn-primary"
        @click="openUrl"
      >
        {{ buttonText }}
      </button>
    </div>
    
    <div v-if="showIframe" class="iframe-container">
      <iframe 
        :src="currentUrl" 
        frameborder="0" 
        class="upload-iframe"
        title="Mario Worker Cup 上传系统"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        loading="lazy"
      ></iframe>
    </div>
  </div>
</template>

<style scoped>
.upload-system-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.module-title {
  margin: 0 0 10px 0;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--border-color);
  font-size: 24px;
  color: var(--text-primary);
}

.year-selector {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
  justify-content: center;
  align-items: center;
}

.iframe-container {
  flex: 1;
  width: 100%;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  background-color: var(--background-secondary);
  display: flex;
  flex-direction: column;
}

.upload-iframe {
  width: 100%;
  height: 100%;
  min-height: 760px;
  border-top: 2px solid var(--primary-hover);
  flex: 1;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .year-selector {
    flex-wrap: wrap;
    margin: var(--spacing-md) var(--spacing-md) 0 var(--spacing-md);
  }
  
  .year-selector button {
    text-align: center;
    font-size: 14px;
  }
  
  .upload-iframe {
    min-height: 600px;
  }
}
</style>
