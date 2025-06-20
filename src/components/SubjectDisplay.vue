<template>
  <div v-if="showSubject" class="content-panel animate-fadeInUp">
    <div class="subject-header">
      <h3 class="subject-title">
        比赛试题
        <FoldButton :is-folded="!isExpanded" @toggle="toggleExpand" />
      </h3>
    </div>
    
    <div class="panel-collapse" :class="{'is-expanded': isExpanded}">
      <div class="subject-content">
        <div v-if="loading" class="loading-state">
          <div class="loading-spinner"></div>
          <span class="loading-text">加载试题中<span class="loading-dots"></span></span>
        </div>
        
        <div v-else-if="error" class="error-state">
          <span>{{ error }}</span>
        </div>
        
        <div v-else-if="subjectContent" class="subject-content-wrapper">
          <div class="markdown-content" v-html="renderedContent"></div>
          <div v-if="smwpVersion" class="smwp-version">
            <div class="smwp-version-text">{{ smwpVersion }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import FoldButton from './FoldButton.vue'
import { marked } from 'marked'
import { fetchMarioWorkerYaml, extractSeasonData } from '../utils/yamlLoader'

interface Props {
  year: string
  round: string
}

const props = defineProps<Props>()

const subjectContent = ref<string>('')
const loading = ref(false)
const error = ref<string>('')
const isExpanded = ref(true)
const smwpVersion = ref<string>('')

// 切换展开/折叠状态
function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

const showSubject = computed(() => {
  return props.year && props.round
})

const renderedContent = computed(() => {
  if (!subjectContent.value) return ''
  return marked(subjectContent.value)
})

// 获取比赛阶段名称（不显示第几轮）
const getStageDisplayName = (round: string): string => {
  if (round.startsWith('G')) return '小组赛'
  if (round.startsWith('I')) return '初赛'
  if (round.startsWith('R')) return '复赛'
  if (round.startsWith('Q')) return '四分之一决赛'
  if (round.startsWith('S')) return '半决赛'
  if (round === 'F') return '决赛'
  if (round === 'P2') return '资格赛'
  // P1的处理需要特殊判断是热身赛还是预选赛
  if (round === 'P1') return '预选赛' // 默认为预选赛，后续会根据YAML数据修正
  return round
}

// 格式化SMWP版本显示文案
const formatSmwpVersionText = (version: any, stage: string): string => {
  if (!version) return ''
  
  if (Array.isArray(version)) {
    // 数组格式：SMWP v1.7.8 或 v1.7.9
    const formattedVersions = version.map(v => `v${v}`).join('或')
    return `${stage}期间使用的SMWP版本为：SMWP ${formattedVersions}`
  } else if (typeof version === 'string') {
    if (version.endsWith('+')) {
      // 带加号：SMWP v1.7.9 及以上版本
      const baseVersion = version.slice(0, -1)
      return `${stage}期间使用的SMWP版本为：SMWP v${baseVersion}及以上版本`
    } else {
      // 普通版本：SMWP v1.7.9
      return `${stage}期间使用的SMWP版本为：SMWP v${version}`
    }
  }
  
  return ''
}

// 从YAML获取SMWP版本信息
async function loadSmwpVersion() {
  if (!props.year || !props.round) {
    smwpVersion.value = ''
    return
  }

  try {
    const yamlDoc = await fetchMarioWorkerYaml()
    const seasonData = extractSeasonData(yamlDoc)
    const yearData = seasonData[props.year]
    
    if (!yearData?.rounds) {
      smwpVersion.value = ''
      return
    }

    // 查找对应轮次的数据
    let roundData = yearData.rounds[props.round]
    
    // 如果直接查找失败，尝试在组合轮次中查找
    if (!roundData) {
      for (const [roundKey, data] of Object.entries(yearData.rounds)) {
        // 检查是否是数组表示的轮次（如 "[G1, G2, G3, G4]"）
        if (roundKey.startsWith('[') && roundKey.endsWith(']')) {
          try {
            const parsedKey = JSON.parse(roundKey)
            if (Array.isArray(parsedKey) && parsedKey.includes(props.round)) {
              roundData = data
              break
            }
          } catch {
            // JSON解析失败，继续下一个
          }
        }
        
        // 检查是否是逗号分隔的多轮次（如 "G1,G2,G3,G4"）
        if (roundKey.includes(',')) {
          const singleRounds = roundKey.split(',').map(r => r.trim())
          if (singleRounds.includes(props.round)) {
            roundData = data
            break
          }
        }
      }
    }
    // 获取SMWP版本，优先使用轮次级别的，如果没有则使用年份级别的
    let versionToUse = roundData?.smwp_version || yearData.smwp_version
    
    if (versionToUse) {
      let stageName = getStageDisplayName(props.round)
      
      // 特殊处理P1轮次的热身赛情况
      if (props.round === 'P1' && roundData?.is_warmup) {
        stageName = '热身赛'
      }
      
      smwpVersion.value = formatSmwpVersionText(versionToUse, stageName)
    } else {
      smwpVersion.value = ''
    }
  } catch (err) {
    console.error('加载SMWP版本失败:', err)
    smwpVersion.value = ''
  }
}

async function loadSubjectContent() {
  if (!props.year || !props.round) {
    subjectContent.value = ''
    return
  }

  const fileName = `${props.year}${props.round}.md`
  const filePath = `/data/subjects/${fileName}`

  loading.value = true
  error.value = ''

  try {
    const response = await fetch(filePath)
    if (response.ok) {
      subjectContent.value = await response.text()
    } else if (response.status === 404) {
      error.value = '该轮次暂无试题'
    } else {
      error.value = '加载试题失败'
    }
  } catch (err) {
    error.value = '加载试题失败'
    console.error('加载试题失败:', err)
  } finally {
    loading.value = false
  }
}

// 监听属性变化
watch(() => [props.year, props.round], () => {
  loadSubjectContent()
  loadSmwpVersion()
}, { immediate: true })
</script>

<style scoped>
.subject-header h3 {
  margin: 0 0 var(--spacing-lg) 0;
  color: var(--text-secondary);
  font-size: 22px;
  border-bottom: 2px solid var(--primary-active);
  padding-bottom: var(--spacing-sm);
  text-align: center;
}

.icon {
  font-size: 1.2rem;
}

.toggle-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.arrow {
  transition: transform 0.3s ease;
  font-size: 0.8rem;
}

.arrow.expanded {
  transform: rotate(180deg);
}

.subject-content {
  padding: var(--spacing-lg);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-large);
  background: var(--bg-panel);
  backdrop-filter: var(--blur-medium);
}

.markdown-content {
  color: var(--text-primary);
}

.smwp-version {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--bg-input);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-medium);
  border-left: 4px solid var(--primary-color);
}

.smwp-version-text {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

/* Markdown 内容样式 */
.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  margin-top: 1.5rem;
  margin-bottom: 0.8rem;
  font-weight: 600;
}

.markdown-content :deep(h1) {
  margin-top: 0.5rem;
  font-size: 1.8rem;
  padding-bottom: 0.5rem;
}

.markdown-content :deep(h2) {
  font-size: 1.4rem;
}

.markdown-content :deep(h3) {
  font-size: 1.2rem;
}

.markdown-content :deep(p) {
  margin: 0.4em 0;
}

.markdown-content :deep(ul) {
  margin-bottom: 0.5em 0;
}

.markdown-content :deep(ol),
.markdown-content :deep(li) {
  margin: 0.2em 0;
}

.markdown-content :deep(strong) {
  color: var(--text-primary);
  font-weight: 600;
}

.markdown-content :deep(em) {
  color: var(--primary-color);
  font-style: italic;
}

.markdown-content :deep(code) {
  background: var(--bg-input);
  padding: 0.2rem 0.4rem;
  border-radius: var(--radius-small);
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
  color: var(--accent-color);
  border: 1px solid var(--border-light);
}

.markdown-content :deep(pre) {
  background: var(--bg-input);
  padding: 1rem;
  border-radius: var(--radius-medium);
  overflow-x: auto;
  margin-bottom: 0.5rem;
  border-left: 4px solid var(--primary-color);
  border: 1px solid var(--border-medium);
}

.markdown-content :deep(blockquote) {
  border-left: 4px solid var(--primary-color);
  color: var(--text-secondary);
  background: var(--bg-input);
  padding: 0.5rem 0.5rem 0.5rem 1rem;
  border-radius: var(--radius-small);
}

.markdown-content :deep(img) {
  max-width: 100%;
  margin-left: 0;
  margin-right: auto;
  vertical-align: text-bottom;
}

/* 只修改嵌套有序列表为 (1) (2) ...，顶级仍为 1. 2. 3. */
.markdown-content :deep(ol ol) {
  list-style: none;
}
.markdown-content :deep(ol ol > li) {
  counter-increment: custom-ol-n2;
  position: relative;
}
.markdown-content :deep(ol ol > li::before) {
  content: "(" counter(custom-ol-n2) ")";
  position: absolute;
  left: -1.5em;
}

@media (max-width: 768px) {
  .markdown-content :deep(img) {
    max-width: 100%;
    height: auto;
    display: block;
  }
}

.panel-collapse {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: max-height 0.6s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.panel-collapse.is-expanded {
  max-height: 22000px; /* 设置足够大的值以容纳内容 */
  opacity: 1;
  transition: max-height 0.6s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
