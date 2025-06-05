<template>
  <div class="level-file-test">
    <h2>关卡文件查询测试</h2>
    
    <div class="search-section">
      <label>
        选手码:
        <input 
          v-model="searchCode" 
          type="text" 
          placeholder="输入选手码，如 A1, B2, M, W 等"
          @keyup.enter="searchLevelFile"
        >
      </label>
      <button @click="searchLevelFile">查找关卡</button>
      <button @click="searchAllFiles">查找所有相关文件</button>
    </div>

    <div class="source-selector">
      <label>
        <input type="radio" v-model="useNginx" :value="false">
        使用本地文件 (开发环境)
      </label>
      <label>
        <input type="radio" v-model="useNginx" :value="true">
        使用 nginx autoindex (生产环境)
      </label>
    </div>

    <div v-if="loading" class="loading">
      加载中...
    </div>

    <div v-if="error" class="error">
      错误: {{ error }}
    </div>

    <div v-if="singleResult" class="result single-result">
      <h3>找到的关卡文件:</h3>
      <div class="file-item">
        <strong>{{ singleResult.name }}</strong>
        <div class="file-details">
          <p>选手码: {{ singleResult.playerCode }}</p>
          <p v-if="singleResult.playerName">选手姓名: {{ singleResult.playerName }}</p>
          <p v-if="singleResult.year">年份: {{ singleResult.year }}</p>
          <p v-if="singleResult.roundType">轮次: {{ singleResult.roundType }}</p>
          <p v-if="singleResult.groupCode">分组: {{ singleResult.groupCode }}</p>
          <p>路径: {{ singleResult.path }}</p>
          <p>大小: {{ formatFileSize(singleResult.size) }}</p>
          <p>修改时间: {{ formatDate(singleResult.mtime) }}</p>
          <p>数据完整性: {{ singleResult.hasPlayerInfo ? '完整' : '不完整' }}</p>
        </div>
      </div>
    </div>

    <div v-if="multipleResults && multipleResults.length > 0" class="result multiple-results">
      <h3>找到的所有相关文件 ({{ multipleResults.length }} 个):</h3>
      <div class="file-list">
        <div v-for="file in multipleResults" :key="file.path" class="file-item">
          <strong>{{ file.name }}</strong>
          <div class="file-details">
            <p>选手码: {{ file.playerCode }}</p>
            <p v-if="file.playerName">选手姓名: {{ file.playerName }}</p>
            <p v-if="file.year">年份: {{ file.year }}</p>
            <p v-if="file.roundType">轮次: {{ file.roundType }}</p>
            <p v-if="file.groupCode">分组: {{ file.groupCode }}</p>
            <p>路径: {{ file.path }}</p>
            <p>大小: {{ formatFileSize(file.size) }}</p>
            <p>修改时间: {{ formatDate(file.mtime) }}</p>
            <p>数据完整性: {{ file.hasPlayerInfo ? '完整' : '不完整' }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="searched && !singleResult && (!multipleResults || multipleResults.length === 0)" class="no-result">
      没有找到选手码为 "{{ searchCode }}" 的关卡文件
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { 
  getLevelFileByPlayerCode, 
  getLevelFilesByPlayerCode, 
  type LevelFile,
  NGINX_LEVELS_URL 
} from '../utils/levelFileHelper'

const searchCode = ref('')
const useNginx = ref(false)
const loading = ref(false)
const error = ref('')
const singleResult = ref<LevelFile | null>(null)
const multipleResults = ref<LevelFile[]>([])
const searched = ref(false)

async function searchLevelFile() {
  if (!searchCode.value.trim()) {
    error.value = '请输入选手码'
    return
  }

  loading.value = true
  error.value = ''
  singleResult.value = null
  multipleResults.value = []
  searched.value = false

  try {
    const result = await getLevelFileByPlayerCode(
      searchCode.value.trim(),
      useNginx.value,
      useNginx.value ? NGINX_LEVELS_URL : undefined
    )
    singleResult.value = result
    searched.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : '未知错误'
  } finally {
    loading.value = false
  }
}

async function searchAllFiles() {
  if (!searchCode.value.trim()) {
    error.value = '请输入选手码'
    return
  }

  loading.value = true
  error.value = ''
  singleResult.value = null
  multipleResults.value = []
  searched.value = false

  try {
    const results = await getLevelFilesByPlayerCode(
      searchCode.value.trim(),
      useNginx.value,
      useNginx.value ? NGINX_LEVELS_URL : undefined
    )
    multipleResults.value = results
    searched.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : '未知错误'
  } finally {
    loading.value = false
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN')
}
</script>

<style scoped>
.level-file-test {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.search-section {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
  align-items: center;
}

.search-section input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 250px;
}

.search-section button {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.search-section button:hover {
  background: #0056b3;
}

.source-selector {
  margin-bottom: 20px;
  display: flex;
  gap: 20px;
}

.source-selector label {
  display: flex;
  align-items: center;
  gap: 5px;
}

.loading {
  text-align: center;
  padding: 20px;
  color: #666;
}

.error {
  background: #f8d7da;
  color: #721c24;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.result {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 20px;
}

.file-item {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 10px;
}

.file-item:last-child {
  margin-bottom: 0;
}

.file-details {
  margin-top: 10px;
  font-size: 0.9em;
  color: #666;
}

.file-details p {
  margin: 5px 0;
}

.file-list {
  max-height: 400px;
  overflow-y: auto;
}

.no-result {
  text-align: center;
  padding: 20px;
  color: #666;
  background: #f8f9fa;
  border-radius: 4px;
}
</style>
