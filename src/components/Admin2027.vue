<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import FoldButton from './FoldButton.vue'
import * as api from '../utils/contestAdminApi2027'

/**
 * 2027 管理后台（完全 API 化，不使用 iframe）。
 * 入口 /admin/2027/<secret>（secret 即 manage_url）：Nginx rewrite 到比赛系统
 * /admin_gate/<secret>；该 secret 仅作隐藏入口（防猜），错误时 FastAPI 返回 404。
 * 进入本页后仍需输入 config.ini 的 manage_pass，由 /api/manage_login 建立 session。
 * 分区与字段对齐比赛系统原管理后台（manage_panel.html）。
 */

type Tab = 'global' | 'matches' | 'scores' | 'files' | 'votes'

const authed = ref(false)
const checking = ref(true)
const password = ref('')
const loginError = ref('')
const activeTab = ref<Tab>('global')
const globalMsg = ref('')

// 分区折叠状态
const folded = ref<Record<string, boolean>>({})
const toggleFold = (key: string): void => { folded.value[key] = !folded.value[key] }
const isFolded = (key: string): boolean => folded.value[key] === true

const checkAuth = async (): Promise<void> => {
  try {
    const res = await api.getAdminStatus()
    if (res.logged_in === true) {
      authed.value = true
      await loadAll()
    }
  } catch {
    // 未登录：显示密码框
  } finally {
    checking.value = false
  }
}

const doLogin = async (): Promise<void> => {
  loginError.value = ''
  if (!password.value) { loginError.value = '请输入管理密码'; return }
  try {
    const res = await api.adminLogin(password.value)
    if (res.status === 0) {
      authed.value = true
      password.value = ''
      await loadAll()
    } else {
      loginError.value = res.msg ?? '密码错误'
    }
  } catch (err) {
    loginError.value = err instanceof Error ? err.message : '登录请求失败'
  }
}

const doLogout = async (): Promise<void> => {
  try { await api.adminLogout() } catch { /* 忽略退出请求异常 */ }
  // 无论请求结果如何，都回到未登录态并清空已加载数据
  authed.value = false
  password.value = ''
  globalMsg.value = ''
  loginError.value = ''
  activeTab.value = 'global'
  notices.value = []
  currentRound.value = { use_round: -1, name: '', link: '', deadlines: [] }
  scoreManager.value = ''
  scoreBlacklist.value = ''
  reviewers.value = ''
  reports.value = ''
  voteConfig.value = { disable: '', start: '', end: '' }
  adminPerms.value = {}
  allowFreeUpload.value = 0
  allowSignUp.value = 0
  matchList.value = []
  contestants.value = []
  audienceVotes.value = []
  freeLevels.value = []
  collections.value = []
  quizQuestions.value = []
  voters.value = []
  // 用后端真实状态校正，避免退出失败时误判已退出
  try {
    const res = await api.getAdminStatus()
    if (res.logged_in === true) {
      authed.value = true
      loginError.value = '退出失败，请重试'
    }
  } catch { /* 忽略状态查询异常 */ }
}

const flash = (message: string): void => { globalMsg.value = message }

// ===== 全局信息 =====
interface NoticeItem { title: string; content: string }
interface DeadlineItem { name: string; time: string }
interface AdminPerms { [uid: string]: string[] }

const PERM_SECTIONS = [
  { key: 'match', label: '管理轮次关卡' },
  { key: 'vote', label: '管理大众评分' },
  { key: 'free', label: '管理自由传关' },
  { key: 'final_vote', label: '管理评选投票' },
  { key: 'collection', label: '管理关卡汇总' },
] as const

const notices = ref<NoticeItem[]>([])
const currentRound = ref<{ use_round: number; name: string; link: string; deadlines: DeadlineItem[] }>({
  use_round: -1, name: '', link: '', deadlines: [],
})
const scoreManager = ref('')
const scoreBlacklist = ref('')
const reviewers = ref('')
const reports = ref('')
const voteConfig = ref<{ disable: string; start: string; end: string }>({ disable: '', start: '', end: '' })
const adminPerms = ref<AdminPerms>({})
const allowFreeUpload = ref(0)
const allowSignUp = ref(0)

const loadGlobal = async (): Promise<void> => {
  const [n, r, s, rv, rp, v, a, c] = await Promise.all([
    api.getNotices(), api.getCurrentRound(), api.getScoreConfig(), api.getReviewers(),
    api.getReports(), api.getVoteConfig(), api.getAdminConfig(), api.getConfig(),
  ])
  notices.value = Array.isArray(n) ? n as NoticeItem[] : []
  const round = (r ?? {}) as Record<string, unknown>
  currentRound.value = {
    use_round: Number(round.use_round ?? -1),
    name: String(round.name ?? ''),
    link: String(round.link ?? ''),
    deadlines: Array.isArray(round.deadlines) ? round.deadlines as DeadlineItem[] : [],
  }
  const sc = (s ?? {}) as Record<string, unknown>
  scoreManager.value = String(sc.manager ?? '')
  scoreBlacklist.value = String(sc.blacklist ?? '')
  reviewers.value = typeof rv === 'string' ? rv : Array.isArray(rv) ? (rv as unknown[]).join('\n') : ''
  reports.value = typeof rp === 'string' ? rp : Array.isArray(rp) ? (rp as unknown[]).join('\n') : ''
  const vc = (v ?? {}) as Record<string, unknown>
  voteConfig.value = {
    disable: String(vc.disable ?? ''),
    start: String(vc.start ?? ''),
    end: String(vc.end ?? ''),
  }
  // get_admin_config 返回 {status, data}
  const adminResp = a as { status?: number; data?: AdminPerms }
  adminPerms.value = adminResp?.data ?? (a as AdminPerms) ?? {}
  const cfg = (c ?? {}) as Record<string, unknown>
  allowFreeUpload.value = Number(cfg.enable_free_upload ?? 0)
  allowSignUp.value = Number(cfg.allow_sign_up ?? 0)
}

const saveNotices = async (): Promise<void> => { await api.updateNotices(notices.value); flash('公告已保存') }
const addNotice = (): void => { notices.value.push({ title: '', content: '' }) }
const removeNotice = (i: number): void => { notices.value.splice(i, 1) }
const addDeadline = (): void => { currentRound.value.deadlines.push({ name: '', time: '' }) }
const removeDeadline = (i: number): void => { currentRound.value.deadlines.splice(i, 1) }
const saveRound = async (): Promise<void> => { await api.updateCurrentRound(currentRound.value); flash('当前轮次已保存') }
const saveScoreConfig = async (): Promise<void> => {
  await api.updateScoreConfig(scoreManager.value, scoreBlacklist.value)
  flash('大众评分名单已保存')
}
const saveReviewers = async (): Promise<void> => { await api.updateReviewers(reviewers.value); flash('评委名单已保存') }
const saveReports = async (): Promise<void> => { await api.updateReports(reports.value); flash('评分报告已保存') }
const saveVoteConfig = async (): Promise<void> => {
  await api.updateVoteConfig(voteConfig.value.disable, voteConfig.value.start, voteConfig.value.end)
  flash('奖项投票设置已保存')
}
const saveConfig = async (): Promise<void> => {
  await api.updateConfig(allowFreeUpload.value, allowSignUp.value)
  flash('其他设置已保存')
}

// 管理员权限：勾选表格
const adminUids = computed<string[]>(() => Object.keys(adminPerms.value ?? {}))
const addAdminUid = (): void => {
  const uid = window.prompt('请输入管理员的论坛 UID')
  if (!uid?.trim()) return
  if (!adminPerms.value[uid.trim()]) adminPerms.value[uid.trim()] = []
}
const removeAdminUid = (uid: string): void => { delete adminPerms.value[uid] }
const togglePerm = (uid: string, perm: string): void => {
  const list = adminPerms.value[uid] ?? []
  adminPerms.value[uid] = list.includes(perm) ? list.filter(p => p !== perm) : [...list, perm]
}
const saveAdminConfig = async (): Promise<void> => {
  await api.updateAdminConfig(JSON.stringify(adminPerms.value))
  flash('管理员权限已保存')
}

// ===== 轮次 =====
interface MatchItem { rid: number; name: string }
const matchList = ref<MatchItem[]>([])
const selectedRid = ref(-1)
const matchForm = ref({
  rid: 0, name: '', link: 0, startline: '', deadline: '', options: '', postfix: 'smwl', active: 1,
})

const loadMatches = async (): Promise<void> => {
  matchList.value = (await api.getMatchList() as MatchItem[]) ?? []
  if (selectedRid.value < 0 && matchList.value.length) selectedRid.value = matchList.value[0].rid
}

const pickMatch = async (): Promise<void> => {
  if (selectedRid.value < 0) {
    matchForm.value = { rid: 0, name: '', link: 0, startline: '', deadline: '', options: '', postfix: 'smwl', active: 1 }
    return
  }
  const detail = await api.getMatch(selectedRid.value) as Record<string, unknown>
  matchForm.value = {
    rid: Number(detail.rid ?? selectedRid.value),
    name: String(detail.name ?? ''),
    link: Number(detail.link ?? 0),
    startline: String(detail.startline ?? ''),
    deadline: String(detail.deadline ?? ''),
    options: String(detail.options ?? ''),
    postfix: String(detail.postfix ?? 'smwl'),
    active: Number(detail.active ?? 1),
  }
}

const saveMatch = async (): Promise<void> => {
  await api.setMatch(matchForm.value)
  await loadMatches()
  flash('轮次信息已保存')
}

// ===== 选手 =====
interface ContestantRow {
  sid: number; cid: number; nickname: string; uid: number; priority: number
  gcode: string | null; pcode: number; lvid: number | null; approved: number
  processed_level_filename?: string | null; video?: string | null
  no_bonus?: number; penalty?: number
}
const contestants = ref<ContestantRow[]>([])
const loadContestants = async (): Promise<void> => {
  if (selectedRid.value < 0) { contestants.value = []; return }
  const res = await api.getContestants(selectedRid.value) as { list?: ContestantRow[] }
  contestants.value = Array.isArray(res?.list) ? res.list : []
}
const newContestantForm = ref({ nick: '', uid: 0, gcode: '', pcode: '0', priority: 0 })
const createContestant = async (): Promise<void> => {
  if (selectedRid.value < 0) { flash('请先选择轮次'); return }
  await api.newContestant({ ...newContestantForm.value, rid: selectedRid.value })
  await loadContestants()
  newContestantForm.value = { nick: '', uid: 0, gcode: '', pcode: '0', priority: 0 }
  flash('选手已新增')
}
const importFile = ref<File | null>(null)
const onImportFile = (e: Event): void => {
  importFile.value = (e.target as HTMLInputElement).files?.[0] ?? null
}
const doImport = async (): Promise<void> => {
  if (selectedRid.value < 0 || !importFile.value) { flash('请先选择轮次与文件'); return }
  const res = await api.importContestants(selectedRid.value, importFile.value)
  flash(res.msg ?? '导入完成')
  await loadContestants()
}
const approveContestant = async (c: ContestantRow): Promise<void> => {
  await api.approve(c.cid, selectedRid.value)
  await loadContestants()
  flash('已通过声明')
}
const declineContestant = async (c: ContestantRow): Promise<void> => {
  await api.decline(c.cid, selectedRid.value)
  await loadContestants()
  flash('已取消声明')
}
const downloadTemplate = (): void => {
  window.open(`${location.origin}/api/2027/import_template.csv`, '_blank', 'noopener,noreferrer')
}

// ===== 大众评分 =====
interface VoteRound {
  srid: number; name: string; start: string; end: string; valid: number
  extrascore?: number | string; managers?: string; blacklist?: string
}
const audienceVotes = ref<VoteRound[]>([])
const loadVotes = async (): Promise<void> => {
  audienceVotes.value = (await api.getAudienceVotes() as VoteRound[]) ?? []
}
const newVote = ref({ name: '', start: '', end: '', extrascore: '5' })
const createVote = async (): Promise<void> => {
  await api.newAudienceVote({ ...newVote.value, managers: '', blacklist: '' })
  await loadVotes()
  newVote.value = { name: '', start: '', end: '', extrascore: '5' }
  flash('大众评选轮次已创建')
}
const toggleVoteValid = async (v: VoteRound): Promise<void> => {
  if (v.valid === 1) await api.disableAudienceVote(v.srid)
  else await api.enableAudienceVote(v.srid)
  await loadVotes()
  flash('已更新评选轮次状态')
}
const audienceScoreUrl = (srid: number): string => api.downloadAudienceScore(srid)

// ===== 自由上传 / 合集 =====
interface FreeItem { fid: number; name: string; comment: string; size: number; time: string; valid: number }
interface CollectionItem { coid: number; name: string; size: number; time: string; valid: number }
const freeLevels = ref<FreeItem[]>([])
const collections = ref<CollectionItem[]>([])
const loadFiles = async (): Promise<void> => {
  freeLevels.value = (await api.getFreeLevels() as FreeItem[]) ?? []
  collections.value = (await api.getCollections() as CollectionItem[]) ?? []
}
const toggleFree = async (f: FreeItem): Promise<void> => {
  if (f.valid === 1) await api.hideFreeFile(f.fid)
  else await api.showFreeFile(f.fid)
  await loadFiles()
  flash('已更新自由上传状态')
}
const toggleCollection = async (c: CollectionItem): Promise<void> => {
  if (c.valid === 1) await api.hideCollection(c.coid)
  else await api.showCollection(c.coid)
  await loadFiles()
  flash('已更新关卡汇总状态')
}

// ===== 奖项投票 =====
interface QuizQuestion { vqid: number; name: string; type: number; choice_min: number; choice_num: number; valid: number }
interface Voter { vtid: number; uid: number; uname: string; valid: number }
const quizQuestions = ref<QuizQuestion[]>([])
const voters = ref<Voter[]>([])
const loadQuiz = async (): Promise<void> => {
  quizQuestions.value = (await api.getQuizQuestions() as QuizQuestion[]) ?? []
  const v = await api.getVoters() as { list?: Voter[] } | Voter[]
  voters.value = Array.isArray(v) ? v : (v?.list ?? [])
}
const toggleVoter = async (v: Voter): Promise<void> => {
  if (v.valid === 0) await api.enableVoter(v.vtid)
  else await api.disableVoter(v.vtid)
  await loadQuiz()
  flash('已更新投票人状态')
}

const loadAll = async (): Promise<void> => {
  await Promise.allSettled([loadGlobal(), loadMatches(), loadVotes(), loadFiles(), loadQuiz()])
  await loadContestants()
}

const formatSize = (size: number): string => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KiB`
  return `${(size / 1024 / 1024).toFixed(1)} MiB`
}

onMounted(async () => { await checkAuth() })

defineOptions({ inheritAttrs: false })
</script>

<template>
  <div class="admin-2027-root">
    <div class="section-title">
      <h3>2027 年第十六届 MW 杯 · 管理后台</h3>
      <button v-if="authed" class="header-action-btn admin-act" @click="doLogout">退出</button>
    </div>

    <div v-if="checking" class="content-panel"><div class="loading-state">正在检查登录状态…</div></div>

    <div v-else-if="!authed" class="content-panel">
      <div class="section-title"><h4>超级管理员登录</h4></div>
      <div class="login-box">
        <p>请输入管理密码。</p>
        <input
          v-model="password"
          type="password"
          class="form-control"
          placeholder="管理密码"
          @keyup.enter="doLogin"
        />
        <button class="btn-base btn-primary" @click="doLogin">登录</button>
        <p v-if="loginError" class="error-text">{{ loginError }}</p>
      </div>
    </div>

    <div v-else>
      <div class="tab-panel">
        <div class="tab-bar">
          <button
            v-for="t in (['global','matches','scores','files','votes'] as Tab[])"
            :key="t"
            :class="['tab-btn', 'btn-base', activeTab === t ? 'btn-primary' : 'btn-secondary']"
            @click="activeTab = t"
          >
            {{ { global: '全局信息', matches: '轮次与选手', scores: '大众评分', files: '上传与合集', votes: '奖项投票' }[t] }}
          </button>
        </div>
        <div v-if="globalMsg" class="msg">{{ globalMsg }}</div>
      </div>

      <!-- ===== 全局信息 ===== -->
      <div v-if="activeTab === 'global'" class="content-area">
        <div class="content-panel">
          <div class="section-title">
            <h4>比赛公告</h4>
            <FoldButton :is-folded="isFolded('notices')" @toggle="toggleFold('notices')" />
          </div>
          <div class="panel-collapse" :class="{ 'is-expanded': !isFolded('notices') }">
            <div v-for="(n, i) in notices" :key="i" class="field-block">
              <div class="field-head">公告标题：<input v-model="n.title" class="form-control inline-input" /></div>
              <div class="field-head">公告内容：</div>
              <textarea v-model="n.content" class="form-control block-textarea" rows="6"></textarea>
              <button class="btn-base btn-secondary" @click="removeNotice(i)">删除</button>
            </div>
            <div v-if="!notices.length" class="desc">暂无公告，点击下方"新增公告"添加。</div>
            <div class="btn-group">
              <button class="btn-base btn-secondary" @click="addNotice">新增公告</button>
              <button class="btn-base btn-primary" @click="saveNotices">保存公告</button>
            </div>
          </div>
        </div>

        <div class="content-panel">
          <div class="section-title">
            <h4>当前轮次展示</h4>

            <FoldButton :is-folded="isFolded('round')" @toggle="toggleFold('round')" />
          </div>
          <div class="panel-collapse" :class="{ 'is-expanded': !isFolded('round') }">
            <div class="desc">
              可复用已有轮次信息（单轮次情形，如热身赛/资格赛/决赛），或手动设定（如初赛）。
            </div>
            <div class="edit-row"><label>使用数据库轮次 rid</label>
              <input v-model.number="currentRound.use_round" type="number" class="form-control" />
              <span class="desc">≤0 表示手动设定</span>
            </div>
            <div class="edit-row"><label>当前轮次名称</label><input v-model="currentRound.name" class="form-control" /></div>
            <div class="edit-row"><label>帖子链接</label><input v-model="currentRound.link" class="form-control" /></div>
            <div class="config-heading">截止时间</div>
            <div v-for="(d, i) in currentRound.deadlines" :key="i" class="edit-row">
              <input v-model="d.name" class="form-control" placeholder="截止时间名称" />
              <input v-model="d.time" class="form-control" placeholder="2027-07-01T20:00" />
              <button class="btn-base btn-secondary" @click="removeDeadline(i)">删除</button>
            </div>
            <div class="btn-group">
              <button class="btn-base btn-secondary" @click="addDeadline">新增截止时间</button>
              <button class="btn-base btn-primary" @click="saveRound">保存</button>
            </div>
          </div>
        </div>

        <div class="content-panel">
          <div class="section-title">
            <h4>管理员及权限设置</h4>
            <FoldButton :is-folded="isFolded('admins')" @toggle="toggleFold('admins')" />
          </div>
          <div class="panel-collapse" :class="{ 'is-expanded': !isFolded('admins') }">
            <div class="desc">勾选各 UID 的分项权限；权限仅用于管理后台功能授权。</div>
            <div class="table-wrapper">
              <table class="table-base">
                <thead>
                  <tr>
                    <th>UID</th>
                    <th v-for="p in PERM_SECTIONS" :key="p.key">{{ p.label }}</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="uid in adminUids" :key="uid">
                    <td>{{ uid }}</td>
                    <td v-for="p in PERM_SECTIONS" :key="p.key">
                      <input
                        type="checkbox"
                        :checked="(adminPerms[uid] ?? []).includes(p.key)"
                        @change="togglePerm(uid, p.key)"
                      />
                    </td>
                    <td><button class="btn-base btn-secondary" @click="removeAdminUid(uid)">删除</button></td>
                  </tr>
                  <tr v-if="!adminUids.length">
                    <td :colspan="PERM_SECTIONS.length + 2">暂无管理员，点击下方"新增管理员"添加。</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="btn-group">
              <button class="btn-base btn-secondary" @click="addAdminUid">新增管理员</button>
              <button class="btn-base btn-primary" @click="saveAdminConfig">保存权限</button>
            </div>
          </div>
        </div>

        <div class="content-panel">
          <div class="section-title">
            <h4>大众评分名单</h4>

            <FoldButton :is-folded="isFolded('scorelist')" @toggle="toggleFold('scorelist')" />
          </div>
          <div class="panel-collapse" :class="{ 'is-expanded': !isFolded('scorelist') }">
            <div class="desc">
              全局评分组名单（该名单内的用户在本届所有轮次均无法进行评分，且可以实时看到和管理评分情况）。请输入 UID，用半角逗号隔开。
            </div>
            <input v-model="scoreManager" class="form-control block-input" />
            <div class="desc">禁止投票名单（该名单内的用户在本届所有轮次均无法进行投票）。</div>
            <input v-model="scoreBlacklist" class="form-control block-input" />
            <div class="btn-group">
              <button class="btn-base btn-primary" @click="saveScoreConfig">保存</button>
            </div>
          </div>
        </div>

        <div class="content-panel">
          <div class="section-title"><h4>评委名单</h4>
            <FoldButton :is-folded="isFolded('reviewers')" @toggle="toggleFold('reviewers')" />
          </div>
          <div class="panel-collapse" :class="{ 'is-expanded': !isFolded('reviewers') }">
            <div class="desc">本列表用于奖项评选。将评委名称输入在下方栏中，一行输入一个 UID。</div>
            <textarea v-model="reviewers" class="form-control block-textarea" rows="4"></textarea>
            <div class="btn-group">
              <button class="btn-base btn-primary" @click="saveReviewers">保存</button>
            </div>
          </div>
        </div>

        <div class="content-panel">
          <div class="section-title"><h4>评分报告列表</h4>
            <FoldButton :is-folded="isFolded('reports')" @toggle="toggleFold('reports')" />
          </div>
          <div class="panel-collapse" :class="{ 'is-expanded': !isFolded('reports') }">
            <div class="desc">
              本列表用于奖项评选。一行一个评分报告名称；可在名称中加入 [link] 以插入一条论坛链接。
            </div>
            <textarea v-model="reports" class="form-control block-textarea" rows="4"></textarea>
            <div class="btn-group">
              <button class="btn-base btn-primary" @click="saveReports">保存</button>
            </div>
          </div>
        </div>

        <div class="content-panel">
          <div class="section-title"><h4>奖项评选设置</h4>
            <FoldButton :is-folded="isFolded('voteconf')" @toggle="toggleFold('voteconf')" />
          </div>
          <div class="panel-collapse" :class="{ 'is-expanded': !isFolded('voteconf') }">
            <div class="edit-row"><label>禁止投票的 UID 列表</label><input v-model="voteConfig.disable" class="form-control" /></div>
            <div class="edit-row"><label>投票开始时间</label><input v-model="voteConfig.start" class="form-control" placeholder="2027-08-07 22:00:00" /></div>
            <div class="edit-row"><label>投票结束时间</label><input v-model="voteConfig.end" class="form-control" placeholder="2027-08-15 22:00:00" /></div>
            <div class="btn-group">
              <button class="btn-base btn-primary" @click="saveVoteConfig">保存</button>
            </div>
          </div>
        </div>

        <div class="content-panel">
          <div class="section-title"><h4>其他设置</h4>
            <FoldButton :is-folded="isFolded('others')" @toggle="toggleFold('others')" />
          </div>
          <div class="panel-collapse" :class="{ 'is-expanded': !isFolded('others') }">
            <div class="edit-row"><label>是否允许自由传关</label>
              <select v-model.number="allowFreeUpload" class="form-control">
                <option :value="0">否</option>
                <option :value="1">是</option>
              </select>
            </div>
            <div class="edit-row"><label>是否允许免报名参赛</label>
              <select v-model.number="allowSignUp" class="form-control">
                <option :value="0">否</option>
                <option :value="1">是</option>
              </select>
            </div>
            <div class="btn-group">
              <button class="btn-base btn-primary" @click="saveConfig">保存</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 轮次与选手 ===== -->
      <div v-else-if="activeTab === 'matches'" class="content-area">
        <div class="content-panel">
          <div class="section-title"><h4>设定轮次信息</h4>
            <FoldButton :is-folded="isFolded('matchform')" @toggle="toggleFold('matchform')" />
          </div>
          <div class="panel-collapse" :class="{ 'is-expanded': !isFolded('matchform') }">
            <div class="edit-row"><label>选择轮次</label>
              <select v-model.number="selectedRid" class="form-control" @change="pickMatch(); loadContestants()">
                <option :value="-1">新增轮次</option>
                <option v-for="m in matchList" :key="m.rid" :value="m.rid">{{ m.name }}</option>
              </select>
            </div>
            <div class="edit-row"><label>轮次名称</label><input v-model="matchForm.name" class="form-control" /></div>
            <div class="edit-row"><label>帖子链接(TID)</label>
              <input v-model.number="matchForm.link" type="number" class="form-control" />
              <span class="desc">用于自动声明，不可为空；未开赛可设为 0。</span>
            </div>
            <div class="edit-row"><label>开始时间</label><input v-model="matchForm.startline" class="form-control" placeholder="2027-07-01 20:00:00" /></div>
            <div class="edit-row"><label>截止时间</label><input v-model="matchForm.deadline" class="form-control" placeholder="2027-07-05 20:00:00" /></div>
            <div class="edit-row"><label>选项</label>
              <input v-model="matchForm.options" class="form-control" />
              <span class="desc">可留空；如填写则用半角逗号分隔。</span>
            </div>
            <div class="edit-row"><label>允许的文件后缀</label><input v-model="matchForm.postfix" class="form-control" /></div>
            <div class="edit-row"><label>是否有效</label>
              <select v-model.number="matchForm.active" class="form-control">
                <option :value="1">有效</option>
                <option :value="0">无效</option>
              </select>
            </div>
            <div class="btn-group">
              <button class="btn-base btn-primary" @click="saveMatch">保存轮次信息</button>
            </div>
          </div>
        </div>

        <div class="content-panel">
          <div class="section-title">
            <h4>设定比赛选手信息</h4>
            <FoldButton :is-folded="isFolded('contestants')" @toggle="toggleFold('contestants')" />
          </div>
          <div class="panel-collapse" :class="{ 'is-expanded': !isFolded('contestants') }">
            <div class="edit-row"><label>选择轮次</label>
              <select v-model.number="selectedRid" class="form-control" @change="loadContestants()">
                <option :value="-1">未选择</option>
                <option v-for="m in matchList" :key="m.rid" :value="m.rid">{{ m.name }}</option>
              </select>
            </div>

            <div class="config-heading">新增选手</div>
            <div class="edit-row">
              <input v-model="newContestantForm.nick" class="form-control" placeholder="昵称" />
              <input
                v-model.number="newContestantForm.uid"
                type="number"
                class="form-control"
                placeholder="UID"
              />
              <input v-model="newContestantForm.gcode" class="form-control" placeholder="组号" />
              <input v-model="newContestantForm.pcode" class="form-control" placeholder="选手号" />
              <input
                v-model.number="newContestantForm.priority"
                type="number"
                class="form-control"
                placeholder="优先级"
              />
              <button class="btn-base btn-primary" @click="createContestant">新增选手</button>
            </div>

            <div class="config-heading">批量新增</div>
            <div class="edit-row">
              <input type="file" accept=".csv" @change="onImportFile" />
              <button class="btn-base btn-secondary" @click="downloadTemplate">下载模板</button>
              <button class="btn-base btn-primary" @click="doImport">上传导入</button>
            </div>
            <div class="desc">
              说明：组号可为空，代表不分组的轮次；选手号不含组号，为 0 代表未报名选手；由于 uid 是主键，请务必确保 uid 正确。
            </div>

            <div v-if="contestants.length" class="table-wrapper">
              <table class="table-base">
                <thead>
                  <tr>
                    <th>组号</th><th>选手号</th><th>昵称</th><th>UID</th><th>优先级</th><th>声明状态</th><th>关卡</th><th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in contestants" :key="c.sid">
                    <td>{{ c.gcode ?? '—' }}</td>
                    <td>{{ c.pcode }}</td>
                    <td>{{ c.nickname }}</td>
                    <td>{{ c.uid }}</td>
                    <td>{{ c.priority }}</td>
                    <td>{{ c.approved === 1 ? '已声明' : c.lvid ? '已上传' : '未上传' }}</td>
                    <td>{{ c.processed_level_filename ?? '—' }}</td>
                    <td class="ops">
                      <button class="btn-base btn-secondary" @click="approveContestant(c)">声明</button>
                      <button class="btn-base btn-secondary" @click="declineContestant(c)">取消声明</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="desc">该轮次暂无选手数据。</div>
          </div>
        </div>
      </div>

      <!-- ===== 大众评分 ===== -->
      <div v-else-if="activeTab === 'scores'" class="content-area">
        <div class="content-panel">
          <div class="section-title"><h4>新增大众评选轮次</h4>
            <FoldButton :is-folded="isFolded('newvote')" @toggle="toggleFold('newvote')" />
          </div>
          <div class="panel-collapse" :class="{ 'is-expanded': !isFolded('newvote') }">
            <div class="edit-row"><label>名称</label><input v-model="newVote.name" class="form-control" /></div>
            <div class="edit-row"><label>开始时间</label><input v-model="newVote.start" class="form-control" placeholder="2027-08-01 20:00:00" /></div>
            <div class="edit-row"><label>结束时间</label><input v-model="newVote.end" class="form-control" placeholder="2027-08-07 22:00:00" /></div>
            <div class="edit-row"><label>附加分满分</label><input v-model="newVote.extrascore" class="form-control" /></div>
            <div class="btn-group">
              <button class="btn-base btn-primary" @click="createVote">创建</button>
            </div>
          </div>
        </div>

        <div class="content-panel">
          <div class="section-title"><h4>评选轮次列表</h4>
            <FoldButton :is-folded="isFolded('votelist')" @toggle="toggleFold('votelist')" />
          </div>
          <div class="panel-collapse" :class="{ 'is-expanded': !isFolded('votelist') }">
            <div v-if="audienceVotes.length" class="table-wrapper">
              <table class="table-base">
                <thead>
                  <tr><th>名称</th><th>开始时间</th><th>结束时间</th><th>状态</th><th>评分下载</th><th>操作</th></tr>
                </thead>
                <tbody>
                  <tr v-for="v in audienceVotes" :key="v.srid">
                    <td>{{ v.name }}</td>
                    <td>{{ v.start }}</td>
                    <td>{{ v.end }}</td>
                    <td>{{ v.valid === 1 ? '有效' : '无效' }}</td>
                    <td><a
                      class="btn-base btn-secondary"
                      :href="audienceScoreUrl(v.srid)"
                      target="_blank"
                      rel="noopener noreferrer"
                    >下载评分</a></td>
                    <td class="ops">
                      <button class="btn-base btn-secondary" @click="toggleVoteValid(v)">
                        {{ v.valid === 1 ? '设为无效' : '设为有效' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="desc">暂无评选轮次。</div>
          </div>
        </div>
      </div>

      <!-- ===== 上传与合集 ===== -->
      <div v-else-if="activeTab === 'files'" class="content-area">
        <div class="content-panel">
          <div class="section-title"><h4>自由上传区</h4>
            <FoldButton :is-folded="isFolded('free')" @toggle="toggleFold('free')" />
          </div>
          <div class="panel-collapse" :class="{ 'is-expanded': !isFolded('free') }">
            <div v-if="freeLevels.length" class="table-wrapper">
              <table class="table-base">
                <thead><tr><th>文件名</th><th>备注</th><th>大小</th><th>时间</th><th>状态</th><th>操作</th></tr></thead>
                <tbody>
                  <tr v-for="f in freeLevels" :key="f.fid">
                    <td>{{ f.name }}</td>
                    <td>{{ f.comment }}</td>
                    <td>{{ formatSize(f.size) }}</td>
                    <td>{{ f.time }}</td>
                    <td>{{ f.valid === 1 ? '已公开' : '已隐藏' }}</td>
                    <td class="ops">
                      <button class="btn-base btn-secondary" @click="toggleFree(f)">
                        {{ f.valid === 1 ? '隐藏' : '公开' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="desc">暂无自由上传文件。</div>
          </div>
        </div>

        <div class="content-panel">
          <div class="section-title"><h4>关卡汇总</h4>
            <FoldButton :is-folded="isFolded('collections')" @toggle="toggleFold('collections')" />
          </div>
          <div class="panel-collapse" :class="{ 'is-expanded': !isFolded('collections') }">
            <div v-if="collections.length" class="table-wrapper">
              <table class="table-base">
                <thead><tr><th>文件名</th><th>大小</th><th>时间</th><th>状态</th><th>操作</th></tr></thead>
                <tbody>
                  <tr v-for="c in collections" :key="c.coid">
                    <td>{{ c.name }}</td>
                    <td>{{ formatSize(c.size) }}</td>
                    <td>{{ c.time }}</td>
                    <td>{{ c.valid === 1 ? '已公开' : '已隐藏' }}</td>
                    <td class="ops">
                      <button class="btn-base btn-secondary" @click="toggleCollection(c)">
                        {{ c.valid === 1 ? '隐藏' : '公开' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="desc">暂无关卡汇总。</div>
          </div>
        </div>
      </div>

      <!-- ===== 奖项投票 ===== -->
      <div v-else-if="activeTab === 'votes'" class="content-area">
        <div class="content-panel">
          <div class="section-title"><h4>评选题目</h4>
            <FoldButton :is-folded="isFolded('quiz')" @toggle="toggleFold('quiz')" />
          </div>
          <div class="panel-collapse" :class="{ 'is-expanded': !isFolded('quiz') }">
            <div v-if="quizQuestions.length" class="table-wrapper">
              <table class="table-base">
                <thead><tr><th>题目</th><th>类型</th><th>最少选择</th><th>可选数量</th><th>状态</th></tr></thead>
                <tbody>
                  <tr v-for="q in quizQuestions" :key="q.vqid">
                    <td>{{ q.name }}</td>
                    <td>{{ ['关卡类', '选手类', '评委类', '评分报告类'][q.type] ?? q.type }}</td>
                    <td>{{ q.choice_min }}</td>
                    <td>{{ q.choice_num }}</td>
                    <td>{{ q.valid === 1 ? '有效' : '无效' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="desc">暂无评选题目。题目编辑与拖拽排序仍在适配中。</div>
          </div>
        </div>

        <div class="content-panel">
          <div class="section-title"><h4>查看投票人</h4>
            <FoldButton :is-folded="isFolded('voters')" @toggle="toggleFold('voters')" />
          </div>
          <div class="panel-collapse" :class="{ 'is-expanded': !isFolded('voters') }">
            <div class="desc">
              "有效"指将投票人的投票纳入统计，同时禁止其修改投票；"无效"指不纳入统计，同时允许其修改投票。
            </div>
            <div v-if="voters.length" class="table-wrapper">
              <table class="table-base">
                <thead><tr><th>UID</th><th>用户名</th><th>状态</th><th>操作</th></tr></thead>
                <tbody>
                  <tr v-for="v in voters" :key="v.vtid">
                    <td>{{ v.uid }}</td>
                    <td>{{ v.uname }}</td>
                    <td>{{ v.valid === 0 ? '已投票（有效）' : '未投票/无效' }}</td>
                    <td class="ops">
                      <button class="btn-base btn-secondary" @click="toggleVoter(v)">
                        {{ v.valid === 0 ? '设为无效' : '设为有效' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="desc">暂无投票人记录。</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-box { max-width: 440px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
/* 顶部按钮组：无背景，仅保留边距；对齐数据统计页的 .tab-bar/.tab-btn */
.tab-panel { padding: var(--spacing-md) 0; }
.tab-bar { display: flex; gap: var(--spacing-sm); flex-wrap: wrap; justify-content: center; align-items: center; }
.tab-btn { min-height: 38px; padding: 8px 18px; font-size: 14px; }
.msg { color: var(--primary-color); font-size: 14px; text-align: center; margin-top: 8px; }
.content-area { display: flex; flex-direction: column; gap: var(--spacing-lg); }
/* 统一表单行：标签定宽、控件对齐 */
.edit-row { display: flex; align-items: center; gap: var(--spacing-sm); flex-wrap: wrap; margin: var(--spacing-sm) 0; }
.edit-row label { min-width: 160px; color: var(--text-secondary); font-size: 14px; }
.edit-row > .form-control { min-width: 180px; }
.error-text { color: var(--color-error, #e53935); }
.btn-group { display: flex; gap: var(--spacing-md); margin-top: var(--spacing-md); flex-wrap: wrap; }
.config-heading { font-weight: 600; color: var(--text-secondary); font-size: 15px; margin: var(--spacing-lg) 0 var(--spacing-sm); }
.field-block { display: flex; flex-direction: column; align-items: stretch; gap: 6px; padding: var(--spacing-md) 0; border-bottom: 1px solid var(--border-light); }
.field-block:last-of-type { border-bottom: none; }
.field-head { color: var(--text-secondary); font-size: 14px; display: flex; align-items: center; gap: var(--spacing-sm); flex-wrap: wrap; }
.inline-input { display: inline-block; width: auto; min-width: 240px; }
.block-input { width: 100%; margin-bottom: var(--spacing-sm); }
.block-textarea { width: 100%; min-height: 120px; resize: vertical; line-height: 1.6; }
.ops { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
/* 表格在面板内居中，避免贴边 */
.content-panel .table-wrapper { margin: var(--spacing-md) auto; }
.content-panel .table-base { margin: 0 auto; }
/* 标题右侧操作按钮：复用官网 .header-action-btn 的 absolute 右对齐，
   叠加 primary 视觉；右移 64px 以避让同区的折叠按钮 */
.header-action-btn.admin-act {
  right: 64px;
  padding: 4px 8px;
  font-size: 14px;
  font-weight: 500;
  border-radius: var(--radius-medium);
  border: 1px solid var(--primary-hover);
  color: white;
  background: linear-gradient(135deg, var(--primary-hover), var(--primary-color));
  cursor: pointer;
  transition: var(--transition-fast);
}
.header-action-btn.admin-act:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--primary-active), var(--primary-dark));
  transform: translateY(-1px);
  box-shadow: var(--shadow-button);
}
/* 若该标题没有折叠按钮，操作按钮贴右 */
.section-title:not(:has(.fold-btn)) .header-action-btn.admin-act { right: 0; }
/* 折叠动画：与官网其他页面 panel-collapse 一致 */
.panel-collapse {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  will-change: max-height, opacity;
  transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.panel-collapse.is-expanded {
  overflow: visible;
  max-height: 4000px;
  opacity: 1;
  pointer-events: auto;
  transition: max-height 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
