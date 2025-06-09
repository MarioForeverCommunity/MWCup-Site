<template>
  <div v-if="showSubject" class="content-panel animate-fadeInUp">
    <div class="subject-header">
      <h3 class="subject-title">
        比赛试题
      </h3>
    </div>
    
    <div v-if="isExpanded" class="subject-content">
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <span class="loading-text">加载试题中<span class="loading-dots"></span></span>
      </div>
      
      <div v-else-if="error" class="error-state">
        <i class="error-icon">⚠️</i>
        <span>{{ error }}</span>
      </div>
      
      <div v-else-if="subjectContent" class="markdown-content" v-html="renderedContent"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { marked } from 'marked'

interface Props {
  year: string
  round: string
}

const props = defineProps<Props>()

const subjectContent = ref<string>('')
const loading = ref(false)
const error = ref<string>('')
const isExpanded = ref(true)

const showSubject = computed(() => {
  return props.year && props.round
})

const renderedContent = computed(() => {
  if (!subjectContent.value) return ''
  return marked(subjectContent.value)
})

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
      error.value = '该轮次暂无试题文件'
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
}, { immediate: true })
</script>

<style scoped>
/* 使用通用样式，只保留必要的组件特定样式 */

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

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-icon {
  font-size: 1.2rem;
}

.markdown-content {
  color: var(--text-primary);
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

@media (max-width: 768px) {
  .markdown-content :deep(img) {
    max-width: 100%;
    height: auto;
    display: block;
  }
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
</style>
