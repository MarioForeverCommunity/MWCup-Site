<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import FoldButton from './FoldButton.vue'
import {
  getInfo,
  login,
  signup,
  claim,
  upload,
  getDownloadList,
  freeUpload,
  downloadUrl,
  MUSIC_PACK_URL,
  type ContestApiResult,
} from '../utils/contestApi2027'

const loading = ref(true)
const error = ref('')
const info = ref<ContestApiResult | null>(null)

interface Notice { title: string; content: string }
interface MatchItem { rid: number; name: string }
interface RoundInfo { name?: string; link?: string; deadlines?: Array<{ name: string; time: string }> }
interface UserInfo {
  status: number
  uid?: number
  uname?: string
  nickname?: string
  code?: string
  lvid?: number
  approved?: number
  matches?: MatchItem[]
  levels?: PlayerLevel[]
}
interface PlayerLevel { lvid: number; name: string; time: string; size: number; comment?: string; file_name: string }
interface DownloadLevel { name: string; file_name: string; code: string; size: number; time: string; comment?: string }
interface FreeItem { name: string; comment: string; filename: string; size: number; time: string }
interface CollectionItem { name: string; filename: string; size: number; time: string }

function toArray<T>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : [] }

const notices = computed<Notice[]>(() => toArray(info.value?.notices))
const matches = computed<MatchItem[]>(() => toArray(info.value?.matches))
const freeUploads = computed<FreeItem[]>(() => toArray(info.value?.freeuploads))
const collections = computed<CollectionItem[]>(() => toArray(info.value?.collections))
const roundInfo = computed<RoundInfo | null>(() => (info.value?.match_info as RoundInfo) ?? null)
const user = computed<UserInfo | null>(() => (info.value?.user as UserInfo) ?? null)
const hasMusicPack = computed(() => info.value?.musicpack === true)
const signUpEnabled = computed(() => info.value?.sign_up === true || info.value?.sign_up === 1)
const freeUploadEnabled = computed(() => {
  const cfg = info.value?.config as Record<string, unknown> | undefined
  return cfg?.enable_free_upload === true || cfg?.enable_free_upload === 1
})

/** 选手码徽章配色（按首字母），对齐上传系统里彩色代号的感觉 */
const codeColor = (code: string): string => {
  const c = (code || '').charAt(0).toUpperCase()
  const map: Record<string, string> = {
    A: '#42a5f5', B: '#42a5f5', C: '#66bb6a', D: '#66bb6a',
    E: '#ffa726', F: '#ffa726', G: '#26a69a', H: '#26a69a',
    I: '#ab47bc', J: '#ab47bc',
  }
  return map[c] ?? 'var(--primary-color)'
}

const folded = ref<Record<string, boolean>>({ notice: false, current: false, download: false, free: true, collection: true })
const toggleFold = (key: string) => { folded.value[key] = !folded.value[key] }

const now = ref(Date.now())
let clockTimer: ReturnType<typeof setInterval> | undefined
const deadlines = computed<Array<{ name: string; time: number }>>(() => {
  const list = roundInfo.value?.deadlines ?? []
  return list.map(d => ({ name: d.name, time: new Date(d.time.replace(' ', 'T')).getTime() }))
    .filter(d => !Number.isNaN(d.time))
})
const formatRemain = (target: number): string => {
  const diff = target - now.value
  if (diff <= 0) return '已结束'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  return `${days}天 ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}
const formatSize = (size: number): string => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KiB`
  return `${(size / 1024 / 1024).toFixed(1)} MiB`
}

const submitRid = ref<number>(-1)
const playerInfo = ref<UserInfo | null>(null)
const playerLevels = computed<PlayerLevel[]>(() => toArray(playerInfo.value?.levels))
const choices = computed<string[]>(() => toArray((playerInfo.value as unknown as Record<string, unknown>)?.options))
const selectedChoice = ref<string>('')

const loadInfo = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await getInfo()
    info.value = res
    const eligible = user.value?.matches ?? []
    submitRid.value = eligible.length > 0 ? eligible[0].rid : (matches.value[0]?.rid ?? -1)
    if (user.value && user.value.status >= 1) await doLogin()
    if (matches.value.length > 0) await loadDownloads(matches.value[0].rid)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '网络错误，无法加载上传系统数据'
  } finally {
    loading.value = false
  }
}

const doLogin = async () => {
  if (submitRid.value < 0) return
  error.value = ''
  try {
    const res = await login(submitRid.value)
    if (res.status < 0) error.value = res.msg ?? '查询参赛信息失败'
    else playerInfo.value = res.user as UserInfo
  } catch (err) {
    error.value = err instanceof Error ? err.message : '查询参赛信息失败'
  }
}

const chooseRound = (rid: number) => {
  submitRid.value = rid
  doLogin()
  loadDownloads(rid)
}

const levelFile = ref<File | null>(null)
const fileComment = ref('')
const musicFiles = ref<File[]>([])
const uploading = ref(false)
const uploadHint = ref('')
const onLevelFile = (e: Event) => { levelFile.value = (e.target as HTMLInputElement).files?.[0] ?? null }
const onMusicFolder = (e: Event) => { musicFiles.value = Array.from((e.target as HTMLInputElement).files ?? []) }

const doUpload = async () => {
  if (!levelFile.value) { uploadHint.value = '请先选择关卡文件'; return }
  uploading.value = true
  uploadHint.value = '开始上传…'
  error.value = ''
  try {
    const res = await upload({
      rid: submitRid.value,
      file: levelFile.value,
      comment: fileComment.value,
      option: selectedChoice.value || undefined,
      musicIds: musicFiles.value.map((_, i) => String(i + 1)),
      musicFiles: musicFiles.value,
    })
    uploadHint.value = res.msg ?? (res.status === 0 ? '上传成功' : '上传失败')
    if (res.status === 0) {
      levelFile.value = null
      musicFiles.value = []
      fileComment.value = ''
      await doLogin()
    }
  } catch (err) {
    uploadHint.value = `上传失败：${err instanceof Error ? err.message : '服务器错误'}`
  } finally {
    uploading.value = false
  }
}

const claimError = ref('')
const doClaim = async (lvid: number) => {
  if (!window.confirm('锁定后将无法继续提交或修改关卡，确认锁定？')) return
  claimError.value = ''
  try {
    const res = await claim(submitRid.value, lvid)
    if (res.status < 0) claimError.value = `声明失败：${res.msg ?? ''}`
    else await doLogin()
  } catch (err) {
    claimError.value = `声明失败：${err instanceof Error ? err.message : '服务器错误'}`
  }
}

const doSignup = async () => {
  error.value = ''
  try {
    const res = await signup(user.value?.uname ?? user.value?.nickname ?? '')
    if (res.status < 0) error.value = `报名失败：${res.msg ?? ''}`
    else await loadInfo()
  } catch (err) {
    error.value = `报名失败：${err instanceof Error ? err.message : '服务器错误'}`
  }
}

const downloadRid = ref<number>(-1)
const downloadLevels = ref<DownloadLevel[]>([])
const downloadSortAsc = ref(false)
const loadDownloads = async (rid: number) => {
  downloadRid.value = rid
  try {
    const res = await getDownloadList(rid)
    downloadLevels.value = toArray<DownloadLevel>(res.levels)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载下载列表失败'
  }
}
const sortedDownloads = computed(() => {
  const list = [...downloadLevels.value]
  list.sort((a, b) => {
    const cmp = a.code < b.code ? -1 : a.code > b.code ? 1 : 0
    return downloadSortAsc.value ? cmp : -cmp
  })
  return list
})

const freeFile = ref<File | null>(null)
const freeComment = ref('')
const freeHint = ref('')
const onFreeFile = (e: Event) => { freeFile.value = (e.target as HTMLInputElement).files?.[0] ?? null }
const doFreeUpload = async () => {
  if (!freeFile.value) { freeHint.value = '请先选择文件'; return }
  freeHint.value = '开始上传…'
  try {
    const res = await freeUpload(freeFile.value, freeComment.value)
    freeHint.value = res.msg ?? (res.status === 0 ? '上传成功' : '上传失败')
    if (res.status === 0) { freeFile.value = null; freeComment.value = ''; await loadInfo() }
  } catch (err) {
    freeHint.value = `上传失败：${err instanceof Error ? err.message : '服务器错误'}`
  }
}

const openForumLogin = () => {
  window.open('https://www.marioforever.net/member.php?mod=logging&action=login', '_blank', 'noopener,noreferrer')
}

onMounted(() => {
  loadInfo()
  clockTimer = setInterval(() => { now.value = Date.now() }, 1000)
})
onBeforeUnmount(() => { if (clockTimer) clearInterval(clockTimer) })

defineOptions({ inheritAttrs: false })
</script>

<template>
  <div class="upload-2027">
    <div v-if="loading" class="content-area"></div>
    <div v-else-if="error" class="content-area"><div class="error-state">{{ error }}</div></div>

    <div v-else class="content-area">
      <!-- 公告 -->
      <div class="content-panel animate-fadeInUp">
        <div class="section-title">
          <h3>公告</h3>
          <FoldButton :is-folded="folded.notice" @toggle="toggleFold('notice')" />
        </div>
        <div class="panel-collapse" :class="{ 'is-expanded': !folded.notice }">
          <div v-for="(n, i) in notices" :key="i" class="notice-card">
            <h3 class="notice-title">{{ n.title }}</h3>
            <p>{{ n.content }}</p>
          </div>
        </div>
      </div>

      <!-- 当前比赛 -->
      <div class="content-panel animate-fadeInUp">
        <div class="section-title">
          <h3>当前比赛</h3>
          <FoldButton :is-folded="folded.current" @toggle="toggleFold('current')" />
        </div>
        <div class="panel-collapse" :class="{ 'is-expanded': !folded.current }">
          <div class="info-box">
            <div>当前比赛轮次：<span class="hl">{{ roundInfo?.name ?? '待公布' }}</span>
              <a
                v-if="roundInfo?.link"
                class="btn-small btn-primary"
                :href="roundInfo.link"
                target="_blank"
                rel="noopener noreferrer"
              >查看比赛帖子</a>
            </div>
            <div v-for="(d, i) in deadlines" :key="i">
              距离{{ d.name }}：<span :class="d.time - now <= 0 ? 'expired' : 'hl'">{{ formatRemain(d.time) }}</span>
            </div>
            <hr class="sep" />
            <div v-if="user?.status === 0" class="status-block">
              您当前未登录，可自由下载已声明关卡及自由传关区内容；
              <button class="btn-small btn-primary" @click="openForumLogin">登录</button>后可参赛与上传。
            </div>
            <div v-else-if="user?.status === 1 || user?.status === 2" class="status-block">
              您好，{{ user.nickname ?? user.uname }}！
              <button v-if="user.status === 2 && signUpEnabled" class="btn-small btn-primary" @click="doSignup">免报名参赛</button>
              <span v-else-if="user.status === 1">，请先在 MF 社区报名参赛。</span>
            </div>
            <div v-else-if="user?.status === 3">
              <div class="status-block">欢迎，{{ playerInfo?.nickname ?? user.code }}！</div>
              <div v-if="(user.matches?.length ?? 0) > 1" class="status-block">
                请选择要上传的轮次：
                <select class="form-control" :value="submitRid" @change="chooseRound(Number(($event.target as HTMLSelectElement).value))">
                  <option v-for="m in user.matches" :key="m.rid" :value="m.rid">{{ m.name }}</option>
                </select>
              </div>
              <div class="upload-grid">
                <div v-if="choices.length" class="choice-row">
                  <span>选择题目：</span>
                  <label v-for="c in choices" :key="c" class="choice-label">
                    <input
                      type="radio"
                      name="choice2027"
                      :value="c"
                      v-model="selectedChoice"
                    /> {{ c }}
                  </label>
                </div>
                <div>关卡文件<span class="expired">*</span>：<input type="file" @change="onLevelFile" /></div>
                <div>音乐包文件夹：<input
                  type="file"
                  webkitdirectory
                  directory
                  multiple
                  @change="onMusicFolder"
                />
                  <span class="desc">如使用自定义音乐，请选择音乐包文件夹。</span>
                </div>
                <div>文件备注：<input
                  type="text"
                  class="form-control"
                  maxlength="50"
                  v-model="fileComment"
                /></div>
                <div>
                  <button class="btn-base btn-primary" :disabled="uploading || playerInfo?.approved === 1" @click="doUpload">
                    {{ uploading ? '上传中…' : '上传关卡' }}
                  </button>
                  <span v-if="playerInfo?.approved === 1" class="desc">您已完成声明，不可再上传关卡。</span>
                </div>
                <div v-if="uploadHint" class="hl">{{ uploadHint }}</div>
                <div v-if="claimError" class="expired">{{ claimError }}</div>
              </div>
              <div v-if="playerLevels.length" class="sub-block">
                <div class="sub-title">我的关卡</div>
                <div v-for="lv in playerLevels" :key="lv.lvid" class="file-card">
                  <div class="file-actions">
                    <a
                      class="btn-small btn-primary"
                      :href="downloadUrl(lv.file_name)"
                      target="_blank"
                      rel="noopener noreferrer"
                    >下载</a>
                    <button v-if="playerInfo?.approved !== 1 && lv.lvid !== playerInfo?.lvid" class="btn-small btn-secondary" @click="doClaim(lv.lvid)">声明</button>
                  </div>
                  <div class="file-meta">
                    <span class="hl">{{ lv.name }}</span>
                    <span class="desc">{{ formatSize(lv.size) }} · {{ lv.time }} {{ lv.comment ?? '' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 下载区 -->
      <div class="content-panel animate-fadeInUp">
        <div class="section-title">
          <h3>下载区</h3>
          <FoldButton :is-folded="folded.download" @toggle="toggleFold('download')" />
        </div>
        <div class="panel-collapse" :class="{ 'is-expanded': !folded.download }">
          <div class="info-box">
            <div v-if="hasMusicPack">下载赛事音乐包（随选手上传动态更新）：<a class="btn-small btn-primary" :href="MUSIC_PACK_URL" target="_blank">下载</a></div>
            <hr v-if="hasMusicPack" class="sep" />
            <div v-if="matches.length">
              <div class="desc">选择下载的轮次 / 题目：</div>
              <div class="tab-row">
                <button
                  v-for="m in matches"
                  :key="m.rid"
                  :class="['btn-small', downloadRid === m.rid ? 'btn-primary' : 'btn-secondary']"
                  @click="loadDownloads(m.rid)"
                >{{ m.name }}</button>
              </div>
            </div>
            <div>当前已有 {{ downloadLevels.length }} 个关卡。
              <button class="btn-small btn-primary" @click="downloadSortAsc = !downloadSortAsc">
                {{ downloadSortAsc ? '按选手号升序' : '按选手号降序' }}
              </button>
            </div>
            <div v-for="(lv, i) in sortedDownloads" :key="i" class="file-card">
              <div class="file-actions">
                <a
                  class="btn-small btn-primary"
                  :href="downloadUrl(lv.file_name)"
                  target="_blank"
                  rel="noopener noreferrer"
                >下载</a>
                <span v-if="lv.code" class="code-badge" :style="{ background: codeColor(lv.code) }">{{ lv.code }}</span>
              </div>
              <div class="file-meta">
                <span class="hl">{{ lv.name }}</span>
                <span class="desc">{{ formatSize(lv.size) }} · {{ lv.time }} {{ lv.comment ?? '' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 自由上传区 -->
      <div class="content-panel animate-fadeInUp">
        <div class="section-title">
          <h3>自由上传区 [{{ freeUploads.length }}]</h3>
          <FoldButton :is-folded="folded.free" @toggle="toggleFold('free')" />
        </div>
        <div class="panel-collapse" :class="{ 'is-expanded': !folded.free }">
          <div class="info-box">
            <div>当前已有 {{ freeUploads.length }} 个文件。</div>
            <div v-if="freeUploadEnabled && user && user.status > 0" class="upload-grid">
              <div><input type="file" @change="onFreeFile" /></div>
              <div><input
                type="text"
                class="form-control"
                maxlength="50"
                placeholder="可在上传前填写文件备注"
                v-model="freeComment"
              /></div>
              <div><button class="btn-base btn-primary" :disabled="!freeFile" @click="doFreeUpload">上传文件</button></div>
              <div v-if="freeHint" class="hl">{{ freeHint }}</div>
            </div>
            <div class="desc">提示：自由上传区并非匿名上传，管理员可以查看文件的上传者。</div>
            <div v-for="(f, i) in freeUploads" :key="i" class="file-card">
              <div class="file-actions">
                <a
                  class="btn-small btn-primary"
                  :href="downloadUrl(f.filename)"
                  target="_blank"
                  rel="noopener noreferrer"
                >下载</a>
              </div>
              <div class="file-meta">
                <span class="hl">{{ f.name }}</span>
                <span class="desc">{{ formatSize(f.size) }} · {{ f.time }} {{ f.comment ?? '' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 关卡汇总 -->
      <div class="content-panel animate-fadeInUp">
        <div class="section-title">
          <h3>关卡汇总 [{{ collections.length }}]</h3>
          <FoldButton :is-folded="folded.collection" @toggle="toggleFold('collection')" />
        </div>
        <div class="panel-collapse" :class="{ 'is-expanded': !folded.collection }">
          <div class="info-box">
            <div v-for="(c, i) in collections" :key="i" class="file-card">
              <div class="file-actions">
                <a
                  class="btn-small btn-primary"
                  :href="downloadUrl(c.filename)"
                  target="_blank"
                  rel="noopener noreferrer"
                >下载</a>
              </div>
              <div class="file-meta">
                <span class="hl">{{ c.name }}</span>
                <span class="desc">{{ formatSize(c.size) }} · {{ c.time }}</span>
              </div>
            </div>
            <div v-if="collections.length === 0" class="desc">暂无关卡汇总。</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.upload-2027 { display: flex; flex-direction: column; flex: 1; min-height: 0; }
/* 对齐 iframe 的 .btn-small（官网无此类）：padding 4px 8px、14px、白色文字 */
.upload-2027 :deep(.btn-small) {
  padding: 4px 8px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  border-radius: var(--radius-medium);
  cursor: pointer;
}
/* 对齐 2026 的 iframe 容器：无自身 padding（各 content-panel 自带 padding）、顶部 2px 边框 */
/* 用视口高度约束使内容独立滚动，年份选择器（sticky）保持在顶部 */
.content-area {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  border-top: 2px solid var(--primary-hover);
  background-color: var(--background-secondary);
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
/* 折叠动画：与官网 ScheduleTable/ScoreTable 的 panel-collapse 一致 */
.panel-collapse {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  will-change: max-height, opacity;
  transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.panel-collapse.is-expanded {
  overflow: visible;
  max-height: 3000px;
  opacity: 1;
  pointer-events: auto;
  transition: max-height 0.6s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.info-box { display: flex; flex-direction: column; gap: 8px; line-height: 1.9; padding: 4px 8px; }
/* 对齐 iframe 的 .info-sec：--bg-card 背景、4px 左边框、18px 标题 */
.notice-card { border: 1px solid var(--border-light); border-left: 4px solid var(--primary-color); background: var(--bg-card); border-radius: var(--radius-medium); padding: var(--spacing-lg); margin-bottom: var(--spacing-md); }
.notice-card:last-child { margin-bottom: 0; }
.notice-title { margin: 0 0 var(--spacing-md) 0; color: var(--text-primary); font-size: 18px; font-weight: 600; }
.notice-card p { white-space: pre-wrap; margin: 0; color: var(--text-primary); }
.sep { border: none; border-top: 1px solid var(--border-medium); margin: 10px 0; }
.status-block { margin: 2px 0; }
.upload-grid { display: flex; flex-direction: column; gap: 8px; margin: 8px 0; align-items: flex-start; }
.choice-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.choice-label { display: inline-flex; align-items: center; gap: 4px; }
.sub-block { margin-top: 10px; }
.sub-title { font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; }
.tab-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0; }
.file-card { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 8px 12px; border: 1px solid var(--border-light); border-radius: var(--radius-medium); background: var(--bg-panel); }
.file-actions { display: flex; align-items: center; gap: 8px; }
.file-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.code-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 24px; padding: 0 6px; border-radius: var(--radius-small); color: #fff; font-size: 13px; font-weight: 600; }
.expired { color: var(--color-error, #e53935); font-weight: 600; }
</style>
