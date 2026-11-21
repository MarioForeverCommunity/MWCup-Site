/**
 * 回归测试用的 fetch mock：把 /data/... 请求映射到本地 public/data 文件。
 * 所有计算模块均通过 fetch 读取静态数据，这里提供离线等价实现。
 */
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const PUBLIC_DATA = join(PROJECT_ROOT, 'public', 'data')

/**
 * 将 /data/xxx 形式（或完整 URL 中的路径）解析为本地文件路径。
 */
function resolveLocalPath(url: string): string | null {
  let pathname: string
  try {
    pathname = new URL(url, 'http://localhost').pathname
  } catch {
    return null
  }
  if (!pathname.startsWith('/data/')) return null
  // 去掉 /data/ 前缀并做基本安全校验（禁止路径穿越）
  const rel = decodeURIComponent(pathname.slice('/data/'.length))
  if (rel.includes('..')) return null
  return join(PUBLIC_DATA, rel)
}

interface MockResponse {
  ok: boolean
  status: number
  text(): Promise<string>
  json(): Promise<unknown>
}

/**
 * 安装全局 fetch mock。返回恢复原 fetch 的函数。
 */
export function installFetchMock(): () => void {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const localPath = resolveLocalPath(url)
    if (!localPath) {
      throw new Error(`[test mock] 未预期的 fetch 请求: ${url}`)
    }
    try {
      const text = await readFile(localPath, 'utf-8')
      const response: MockResponse = {
        ok: true,
        status: 200,
        text: async () => text,
        json: async () => JSON.parse(text) as unknown,
      }
      return response as unknown as Response
    } catch (error) {
      const response: MockResponse = {
        ok: false,
        status: 404,
        text: async () => { throw error },
        json: async () => { throw error },
      }
      return response as unknown as Response
    }
  }) as typeof fetch

  return () => {
    globalThis.fetch = originalFetch
  }
}
