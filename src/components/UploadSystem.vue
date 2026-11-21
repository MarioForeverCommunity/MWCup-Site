<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getEditionOptions } from '../utils/editionHelper'
import { COMPETITION_YEARS, ARCHIVE_YEARS } from '../utils/editionHelper'
import { uploadUrlMap as urlMap, getYsepanPassword } from '../utils/urlMap'

const route = useRoute()
const router = useRouter()

// 所有支持的年份，分为比赛系统和网盘两部分
const competitionYears = COMPETITION_YEARS
const archiveYears = ARCHIVE_YEARS
const years = [...competitionYears, ...archiveYears] as const

type Year = (typeof years)[number]
const activeYear = ref<Year>(competitionYears[0]) // 默认显示最新一年

// 监听路由参数变化
watch(() => route.params, (newParams) => {
  if (newParams.year) {
    const year = newParams.year as string
    if (years.includes(year as Year)) {
      activeYear.value = year as Year
    }
  }
}, { immediate: true })

// 当年份改变时更新路由
const onYearChange = () => {
  if (activeYear.value) {
    router.push(`/upload/${activeYear.value}`)
  } else {
    router.push('/upload')
  }
}

// 年份变化时重置 iframe 加载状态
watch(activeYear, () => {
  resetIframeState()
})

onBeforeUnmount(() => {
  if (iframeTimer) clearTimeout(iframeTimer)
})

// 使用 getEditionOptions 生成带有届数的选项
const competitionOptions = getEditionOptions([...competitionYears])

// 2012年特殊显示文字
const isTotalArchive = computed(() => activeYear.value === '2012')

// 动态按钮文字
const buttonText = computed(() => {
  if (isTotalArchive.value) return '前往MW杯总网盘'
  return showIframe.value ? '在新标签页打开上传系统' : '前往本届MW杯网盘'
})

// 下拉菜单选项（2012年特殊处理）
const archiveOptions = getEditionOptions([...archiveYears]).map(opt =>
  opt.value === '2012' ? { ...opt, label: 'MW杯总网盘' } : opt
)

// 构建URL映射

// 当前显示的URL
const currentUrl = computed(() => {
  const item = urlMap[activeYear.value]
  if (!item) return ''
  return typeof item === 'string' ? item : item.url
})

// ysepan 网盘访问密码
const ysepanPassword = computed(() => getYsepanPassword(activeYear.value))

// 判断是否显示iframe（只有比赛系统显示）
const showIframe = computed(() => competitionYears.includes(activeYear.value))

// iframe 加载状态：加载中 / 加载失败（跨域 iframe 的 onerror 不可靠，用超时兜底）
const iframeLoading = ref(false)
const iframeFailed = ref(false)
let iframeTimer: ReturnType<typeof setTimeout> | undefined
const IFRAME_TIMEOUT = 15000

const onIframeLoad = () => {
  if (iframeTimer) clearTimeout(iframeTimer)
  iframeLoading.value = false
  iframeFailed.value = false
}

const resetIframeState = () => {
  if (iframeTimer) clearTimeout(iframeTimer)
  iframeFailed.value = false
  iframeLoading.value = showIframe.value
  if (showIframe.value) {
    iframeTimer = setTimeout(() => {
      if (iframeLoading.value) {
        iframeLoading.value = false
        iframeFailed.value = true
      }
    }, IFRAME_TIMEOUT)
  }
}

const retryIframe = () => {
  resetIframeState()
}

onMounted(() => {
  resetIframeState()
})

// 临时禁用的年份列表（后续如需禁用某个年份，可在此添加）
const disabledYears: readonly string[] = ['']

// 判断是否显示工事中提示
const showConstructionNotice = computed(() => disabledYears.includes(activeYear.value))

// 打开链接（比赛系统新窗口不带referrer，其他正常）
const openUrl = () => {
  if (showIframe.value) {
    window.open(currentUrl.value, '_blank', 'noopener,noreferrer')
  } else {
    window.open(currentUrl.value, '_blank')
  }
}
</script>

<template>
  <div class="upload-system-container">
    <div class="year-selector">
      <select
        v-model="activeYear"
        @change="onYearChange"
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

    <!-- ysepan 网盘访问密码提示 -->
    <div v-if="ysepanPassword" class="password-notice">
      <span class="password-label">访问密码：</span>
      <span class="password-value">{{ ysepanPassword }}</span>
    </div>

    <div v-if="showConstructionNotice" class="construction-notice">
      <div class="notice-content">
        <div class="notice-icon">🚧</div>
        <div class="notice-text">工事中，请打开上传系统操作</div>
      </div>
    </div>

    <div v-else-if="showIframe" class="iframe-container">
      <iframe
        :key="currentUrl"
        :src="currentUrl"
        frameborder="0"
        class="upload-iframe"
        title="Mario Worker Cup 上传系统"
        sandbox="allow-same-origin allow-scripts allow-forms allow-downloads allow-popups allow-modals"
        loading="lazy"
        @load="onIframeLoad"
      ></iframe>
      <div v-if="iframeLoading" class="iframe-overlay">
        <div class="iframe-hint">上传系统加载中…</div>
      </div>
      <div v-if="iframeFailed" class="iframe-overlay iframe-error">
        <div class="notice-content">
          <div class="notice-text">上传系统加载超时或未响应</div>
          <div class="iframe-error-actions">
            <button class="btn-base btn-primary" @click="retryIframe">重新加载</button>
            <button class="btn-base" @click="openUrl">在新标签页打开</button>
          </div>
        </div>
      </div>
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

.year-selector {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
  justify-content: center;
  align-items: center;
}

.password-notice {
  text-align: center;
  padding: 10px 20px;
  background-color: var(--background-secondary);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin: 0 auto;
}

.password-label {
  color: var(--text-secondary);
  font-size: 14px;
}

.password-value {
  color: var(--primary-color);
  font-weight: 600;
  font-size: 16px;
  margin-left: 8px;
  font-family: monospace;
  user-select: all;
}

.iframe-container {
  position: relative;
  flex: 1;
  width: 100%;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  background-color: var(--background-secondary);
  display: flex;
  flex-direction: column;
}

.construction-notice {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--background-secondary);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  min-height: 760px;
}

.notice-content {
  text-align: center;
  padding: 40px;
}

.notice-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.notice-text {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}

.upload-iframe {
  width: 100%;
  height: 100%;
  min-height: 760px;
  border-top: 2px solid var(--primary-hover);
  flex: 1;
}

.iframe-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--background-secondary);
  z-index: 1;
}

.iframe-hint {
  color: var(--text-secondary);
  font-size: 16px;
}

.iframe-error .notice-text {
  margin-bottom: var(--spacing-md);
}

.iframe-error-actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: center;
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
