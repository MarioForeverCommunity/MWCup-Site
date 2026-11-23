/**
 * 2027 比赛系统「管理后台」API 客户端（完全 API 化，不使用 iframe 管理页）。
 *
 * 与用户侧 API 一样走官网同源 /api/2027/*，由 Nginx 代理到 127.0.0.1:7227。
 * 鉴权依赖 FastAPI 的 cookie session（admin_key / mode），同源下自动携带。
 *
 * 权限：所有管理 API 由服务端 @auth_admin / @auth_match / @auth_vote / @auth_free
 * / @auth_collection / @auth_final_vote 校验；本客户端不做权限判断，只负责请求。
 * 前端可用 canManage.* 做功能开关（仅 UI 提示，不构成鉴权）。
 */

const API_BASE = '/api/2027'

export interface ApiResult {
  status?: number
  msg?: string
  [key: string]: unknown
}

async function get(path: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`请求失败: ${res.status}`)
  return await res.json()
}

async function post(path: string, fields: Record<string, string | number | File>): Promise<ApiResult> {
  const body = new FormData()
  for (const [k, v] of Object.entries(fields)) body.append(k, String(v))
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body, credentials: 'same-origin' })
  if (!res.ok) throw new Error(`请求失败: ${res.status}`)
  return await res.json() as ApiResult
}

// ===== 超管登录 =====
export const adminLogin = (key: string) => post('/manage_login', { key })
/** 管理后台登录态查询 */
export const getAdminStatus = (): Promise<{ logged_in: boolean }> =>
  get('/admin_status') as Promise<{ logged_in: boolean }>
/** 退出管理后台（清除 session 中的 admin_key） */
export async function adminLogout(): Promise<void> {
  // 服务端会 307 重定向到管理入口；只需确保请求送达并清除 session
  await fetch(`${API_BASE}/manage_logout`, { credentials: 'same-origin' })
}

// ===== 全局信息（@auth_admin）=====
export const getNotices = () => get('/manage_notices')
export const updateNotices = (notices: unknown[]) => post('/update_notices', { new_notices: JSON.stringify(notices) })
export const getCurrentRound = () => get('/get_current_round')
export const updateCurrentRound = (round: unknown) => post('/update_current_round', { new_round: JSON.stringify(round) })
export const getScoreConfig = () => get('/get_score_config')
export const updateScoreConfig = (manager: string, blacklist: string) => post('/update_score_config', { manager, blacklist })
export const getReviewers = () => get('/get_reviewers')
export const updateReviewers = (reviewers: string) => post('/update_reviewers', { reviewers })
export const getReports = () => get('/get_reports')
export const updateReports = (reports: string) => post('/update_reports', { reports })
export const getVoteConfig = () => get('/get_vote_config')
export const updateVoteConfig = (disable: string, start: string, end: string) => post('/update_vote_config', { disable, start, end })
export const getAdminConfig = () => get('/get_admin_config')
export const updateAdminConfig = (auth: string) => post('/update_admin_config', { auth })
export const getConfig = () => get('/get_config')
export const updateConfig = (enableFreeUpload: number, allowSignUp: number) =>
  post('/update_config', { enable_free_upload: enableFreeUpload, allow_sign_up: allowSignUp })

// ===== 轮次与选手（@auth_match）=====
export const getMatchList = () => get('/get_match_list')
export const getMatch = (rid: number) => get(`/manage_match?rid=${rid}`)
export const setMatch = (f: {
  rid: number; name: string; link: number; startline: string; deadline: string
  options?: string; postfix: string; active: number
}) => post('/manage_match', f)
export const getContestants = (rid: number) => get(`/get_contestants?rid=${rid}`)
export const importContestants = (rid: number, file: File) => {
  const body = new FormData()
  body.append('file', file)
  return fetch(`${API_BASE}/import_contestants/${rid}`, { method: 'POST', body, credentials: 'same-origin' })
    .then(r => r.json() as Promise<ApiResult>)
}
export const setContestant = (cid: number, nick: string, uid: number) => post('/manage_contestant', { cid, nick, uid })
export const setContestantSubmit = (cid: number, gcode: string, pcode: string, priority: number, rid: number) =>
  post('/manage_submit', { cid, gcode, pcode, priority, rid })
export const newContestant = (f: { nick: string; uid: number; priority: number; gcode?: string; pcode?: string; rid: number }) =>
  post('/new_contestant', f)
export const setSubmitExtra = (sid: number, video: string, noBonus: number, penalty: number) =>
  post('/manage_submit_extra', { sid, video, no_bonus: noBonus, penalty })
export const getContestantLevels = (rid: number, cid: number) => post('/manage_levels', { rid, cid })
export const setLevel = (lvid: number, name: string, comment: string) => post('/edit_level', { lvid, name, comment })
export const newLevel = (file: File, comment: string, cid: number, rid: number) => {
  const body = new FormData()
  body.append('file', file); body.append('comment', comment)
  body.append('cid', String(cid)); body.append('rid', String(rid))
  return fetch(`${API_BASE}/new_level`, { method: 'POST', body, credentials: 'same-origin' })
    .then(r => r.json() as Promise<ApiResult>)
}
export const forceClaim = (cid: number, lvid: number, rid: number) => post('/force_claim', { cid, lvid, rid })
export const approve = (cid: number, rid: number) => post('/approve', { cid, rid })
export const decline = (cid: number, rid: number) => post('/decline', { cid, rid })
export const getMusicList = () => get('/get_music_list')

// ===== 大众评分（@auth_vote）=====
export const getAudienceVotes = () => get('/get_vote_list')
export const getDragLevels = () => get('/get_drag_levels')
export const updateAudienceVote = (f: {
  srid: number; name: string; start: string; end: string
  managers?: string; blacklist?: string; extrascore: string
}) => post('/update_audience_vote', f)
export const newAudienceVote = (f: {
  name: string; start: string; end: string
  managers?: string; blacklist?: string; extrascore: string
}) => post('/new_audience_vote', f)
export const getAudienceVoteLevels = (srid: number) => get(`/get_audience_vote_levels?srid=${srid}`)
export const updateAudienceVoteLevels = (srid: number, levels: unknown[]) =>
  post('/update_audience_vote_levels', { srid, levels: JSON.stringify(levels) })
export const disableAudienceVote = (srid: number) => post('/disable_audience_vote', { srid })
export const enableAudienceVote = (srid: number) => post('/enable_audience_vote', { srid })
export const downloadAudienceScore = (srid: number) =>
  `${API_BASE}/download_audience_score?srid=${srid}`

// ===== 自由上传 / 合集 =====
export const getFreeLevels = () => get('/get_free_levels')
export const showFreeFile = (fid: number) => post('/show_free_file', { fid })
export const hideFreeFile = (fid: number) => post('/hide_free_file', { fid })
export const getCollections = () => get('/get_collections')
export const showCollection = (coid: number) => post('/show_collection', { coid })
export const hideCollection = (coid: number) => post('/hide_collection', { coid })

// ===== 奖项投票（@auth_final_vote）=====
export const getQuizQuestions = () => get('/manage_quiz_questions')
export const updateQuizQuestions = (newVotes: unknown[], editVotes: unknown[], removedVotes: number[]) =>
  post('/update_quiz_questions', {
    new_votes: JSON.stringify(newVotes),
    edit_votes: JSON.stringify(editVotes),
    removed_votes: JSON.stringify(removedVotes),
  })
export const viewQuizResult = (vqid: number) => post('/view_quiz_result', { vqid })
export const getVoters = () => get('/get_voters')
export const enableVoter = (vtid: number) => post('/enable_voter', { vtid })
export const disableVoter = (vtid: number) => post('/disable_voter', { vtid })
