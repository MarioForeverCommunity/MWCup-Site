<script setup lang="ts">
import { ref, } from 'vue'

// 可以通过选项卡选择不同年份的上传系统
const years = ['2025', '2024', '2023', '2022']
const activeYear = ref('2025') // 默认显示2025年

// 构建上传系统URL
const getUploadSystemUrl = (year: string) => {
  return `https://mwcup${year}.marioforever.net`
}

// 当前显示的URL
const currentUrl = ref(getUploadSystemUrl(activeYear.value))

// 更新显示的年份和URL
const changeYear = (year: string) => {
  activeYear.value = year
  currentUrl.value = getUploadSystemUrl(year)
}
</script>

<template>
  <div class="upload-system-container">
    <div class="year-selector">
      <button 
        v-for="year in years" 
        :key="year"
        @click="changeYear(year)"
        :class="{ 
          'btn-base': true,
          'btn-primary': activeYear === year, 
          'btn-secondary': activeYear !== year 
        }"
      >
        {{ year }}
      </button>
    </div>
    
    <div class="iframe-container">
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
  margin-bottom: var(--spacing-lg);
  justify-content: center;
}

/* 使用 components.css 中的按钮样式代替自定义样式 */

.iframe-container {
  flex: 1;
  width: 100%;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  background-color: var(--background-secondary);
  /* 让iframe容器撑满可用空间 */
  display: flex;
  flex-direction: column;
}

.upload-iframe {
  width: 100%;
  height: 100%;
  min-height: 760px;
  border: none;
  /* 撑满父容器，并且保持比例 */
  flex: 1;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .year-selector {
    flex-wrap: wrap;
  }
  
  .year-selector button {
    flex: 1;
    min-width: 70px;
    text-align: center;
    font-size: 14px;
  }
  
  .upload-iframe {
    min-height: 600px;
  }
}
</style>
