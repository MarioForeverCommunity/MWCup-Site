<template>
  <div class="document-selector">
    <button v-for="doc in availableDocs"
      :key="doc.key"
      @click="selectDocument(doc.key)"
      :class="['doc-btn', 'btn-base', selectedDoc === doc.key ? 'btn-primary' : 'btn-secondary']"
    >
      <span class="doc-text">{{ doc.title }}</span>
    </button>
  </div>
  
  <div v-if="selectedDoc" class="document-content">
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span class="loading-text">加载文档中<span class="loading-dots"></span></span>
    </div>
    
    <div v-else-if="error" class="error-state">
      <i class="error-icon">⚠️</i>
      <span>{{ error }}</span>
    </div>
    <div v-else-if="documentContent" class="document-content-wrapper">
      <div class="markdown-content" v-html="renderedContent"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { marked } from 'marked'

interface DocumentInfo {
  key: string
  title: string
  filename: string
}

const availableDocs: DocumentInfo[] = [
  {
    key: 'regulation',
    title: 'MW杯章程',
    filename: 'regulation.md'
  },
  {
    key: 'standard',
    title: '评分标准（2020版）',
    filename: 'standard2020.md'
  }
]

const documentContent = ref<string>('')
const loading = ref(false)
const error = ref<string>('')
const selectedDoc = ref<string>('')

const renderedContent = computed(() => {
  if (!documentContent.value) return ''
  return marked(documentContent.value)
})

const selectDocument = (docKey: string) => {
  selectedDoc.value = docKey
  loadDocumentContent()
  
  // 文档切换时滚动到顶部
  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, 100)
}

async function loadDocumentContent() {
  if (!selectedDoc.value) {
    documentContent.value = ''
    return
  }

  const docInfo = availableDocs.find(doc => doc.key === selectedDoc.value)
  if (!docInfo) {
    error.value = '未找到对应文档'
    return
  }

  const filePath = `/data/docs/${docInfo.filename}`

  loading.value = true
  error.value = ''

  try {
    const response = await fetch(filePath)
    if (response.ok) {
      documentContent.value = await response.text()
    } else if (response.status === 404) {
      error.value = '文档文件不存在'
    } else {
      error.value = '加载文档失败'
    }
  } catch (err) {
    error.value = '加载文档失败'
    console.error('加载文档失败:', err)
  } finally {
    loading.value = false
  }
}

// 默认选择第一个文档
if (availableDocs.length > 0) {
  selectDocument(availableDocs[0].key)
}
</script>

<style scoped>
.document-selector {
  display: flex;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  flex-wrap: wrap;
  justify-content: center;
}

.document-content {
  padding: var(--spacing-lg);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-large);
  background: var(--bg-panel);
  backdrop-filter: var(--blur-medium);
}

.document-content-wrapper {
  position: relative;
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
  .document-selector {
    flex-direction: column;
    align-items: center;
  }
  
  .markdown-content :deep(img) {
    max-width: 100%;
    height: auto;
    display: block;
  }
}
</style>
