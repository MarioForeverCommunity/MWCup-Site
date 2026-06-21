// ysepan 网盘链接（需要访问密码）
interface YsepanUrl {
  url: string
  password: string
}

// URL 映射类型：比赛系统为字符串，ysepan 网盘为包含密码的对象
export type UploadUrlItem = string | YsepanUrl

export const uploadUrlMap: Record<string, UploadUrlItem> = {
  '2026': 'https://mwcup2026.marioforever.net',
  '2025': 'https://mwcup2025.marioforever.net',
  '2024': 'https://mwcup2024.marioforever.net',
  '2023': 'https://mwcup2023.marioforever.net',
  '2022': 'https://mwcup2022.marioforever.net',
  '2021': { url: 'http://2021mwcup.ysepan.com/', password: 'mwcup2021' },
  '2020': { url: 'http://mwcup2020.ysepan.com/', password: 'mwcup2020' },
  '2019': { url: 'http://mwcup2019.ysepan.com/', password: 'mwcup2019' },
  '2018': { url: 'http://mwcup2018.ysepan.com/', password: 'mwcup2018' },
  '2017': { url: 'http://2017mwcup.ysepan.com/', password: 'mwcup2017' },
  '2016': { url: 'http://mwcup2016.ysepan.com/', password: 'mwcup2016' },
  '2015': { url: 'http://mwcup2015.ysepan.com/', password: 'mwcup2015' },
  '2014': { url: 'http://mwcup3--2014.ysepan.com/', password: 'mwcup2014' },
  '2013': { url: 'http://2013mwcup.ysepan.com/', password: 'mwcup2013' },
  '2012': { url: 'http://mwcup.ysepan.com/', password: 'MWCUP' }
}

// 获取 URL 字符串
export function getUploadUrl(year: string): string | undefined {
  const item = uploadUrlMap[year]
  if (!item) return undefined
  return typeof item === 'string' ? item : item.url
}

// 获取 ysepan 网盘密码
export function getYsepanPassword(year: string): string | undefined {
  const item = uploadUrlMap[year]
  if (!item || typeof item === 'string') return undefined
  return item.password
}
