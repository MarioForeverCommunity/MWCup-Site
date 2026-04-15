export const uploadUrlMap: Record<string, string> = {
  '2026': 'https://mwcup2026.marioforever.net',
  '2025': 'https://mwcup2025.marioforever.net',
  '2024': 'https://mwcup2024.marioforever.net',
  '2023': 'https://mwcup2023.marioforever.net',
  '2022': 'https://mwcup2022.marioforever.net',
  '2021': 'http://2021mwcup.ysepan.com/',
  '2020': 'http://mwcup2020.ysepan.com/',
  '2019': 'http://mwcup2019.ysepan.com/',
  '2018': 'http://mwcup2018.ysepan.com/',
  '2017': 'http://2017mwcup.ysepan.com/',
  '2016': 'http://mwcup2016.ysepan.com/',
  '2015': 'http://mwcup2015.ysepan.com/',
  '2014': 'http://mwcup3--2014.ysepan.com/',
  '2013': 'http://2013mwcup.ysepan.com/',
  '2012': 'http://mwcup.ysepan.com/'
}

export function getUploadUrl(year: string): string | undefined {
  return uploadUrlMap[year]
}
