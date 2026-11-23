/**
 * 2027 比赛系统 API 客户端（完全 API 化，不使用 iframe）。
 *
 * 所有请求走官网同源路径 /api/2027/*，由 Nginx 代理到 127.0.0.1:7227 的 FastAPI。
 * 身份依赖 MF 社区 Cookie（父域 .marioforever.net），同源下浏览器自动携带。
 * 后端返回体约定：{ status: 0 为成功，负数失败，msg: 中文提示 }。
 */

const API_BASE = '/api/2027'

export interface ContestApiResult {
  status: number
  msg?: string
  [key: string]: unknown
}

async function request(path: string, init?: RequestInit): Promise<ContestApiResult> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'same-origin',
    ...init,
  })
  if (!response.ok) {
    throw new Error(`网络错误: ${response.status} ${response.statusText}`)
  }
  return await response.json() as ContestApiResult
}

/** 首页聚合数据：公告、当前轮次、用户状态、自由上传、合集、音乐包标志 */
export function getInfo(): Promise<ContestApiResult> {
  return request('/info')
}

/** 选手登录（获取选手详情与该轮已上传关卡） */
export function login(rid: number): Promise<ContestApiResult> {
  const body = new FormData()
  body.append('rid', String(rid))
  return request('/login', { method: 'POST', body })
}

/**
 * 免报名参赛。nick/uid 来自 /api/info 的论坛身份（自动填入，不由用户手输）。
 * 正常报名在 MF 论坛完成，这里仅服务于免报名轮次。
 */
export function signup(nick: string): Promise<ContestApiResult> {
  const body = new FormData()
  body.append('nick', nick)
  return request('/signup', { method: 'POST', body })
}

/** 声明关卡（锁定题目，锁定后不可再上传） */
export function claim(rid: number, lvid: number): Promise<ContestApiResult> {
  const body = new FormData()
  body.append('rid', String(rid))
  body.append('lvid', String(lvid))
  return request('/claim', { method: 'POST', body })
}

export interface UploadPayload {
  rid: number
  file: File
  comment?: string
  option?: string
  musicIds?: string[]
  musicFiles?: File[]
}

/** 上传关卡（含可选附加音乐文件） */
export function upload(payload: UploadPayload): Promise<ContestApiResult> {
  const body = new FormData()
  body.append('file', payload.file)
  body.append('rid', String(payload.rid))
  body.append('comment', payload.comment ?? '')
  if (payload.option) body.append('option', payload.option)
  payload.musicIds?.forEach(id => body.append('music_ids', id))
  payload.musicFiles?.forEach(file => body.append('music_files', file))
  return request('/upload', { method: 'POST', body })
}

/** 下载区文件列表 */
export function getDownloadList(rid: number): Promise<ContestApiResult> {
  return request(`/download?rid=${rid}`)
}

/** 免报名自由上传 */
export function freeUpload(file: File, comment: string): Promise<ContestApiResult> {
  const body = new FormData()
  body.append('file', file)
  body.append('comment', comment)
  return request('/freeupload', { method: 'POST', body })
}

/** 下载关卡文件的完整 URL（经官网代理转发） */
export function downloadUrl(fileName: string): string {
  return `${API_BASE}/download/${encodeURIComponent(fileName)}`
}

/** 音乐包下载 URL */
export const MUSIC_PACK_URL = `${API_BASE}/download/mwcup_music_pack.zip`
