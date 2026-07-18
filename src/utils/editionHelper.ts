/**
 * 届数计算工具 - 将年份转换为对应的届数（中文数字）
 */

/** 比赛系统年份（最新一届在最前） */
export const COMPETITION_YEARS = ['2026', '2025', '2024', '2023', '2022']
/** 历届网盘年份 */
export const ARCHIVE_YEARS = ['2021', '2020', '2019', '2018', '2017', '2016', '2015', '2014', '2013', '2012']

const chineseNumbers = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];

/**
 * 根据年份计算届数（2012年为第一届）
 */
export function getEditionNumber(year: string | number): string {
  const yearNum = typeof year === 'string' ? parseInt(year) : year;
  const edition = yearNum - 2012 + 1;

  if (edition <= 0) return '零';
  if (edition <= 20) return chineseNumbers[edition];

  // 处理20以上的数字
  if (edition < 100) {
    const tens = Math.floor(edition / 10);
    const ones = edition % 10;

    if (tens <= 2) {
      if (ones === 0) {
        return tens === 1 ? '十' : '二十';
      } else {
        return (tens === 1 ? '十' : '二十') + chineseNumbers[ones];
      }
    }
  }

  // 对于更大的数字，返回阿拉伯数字
  return edition.toString();
}

/**
 * 获取年份和届数的显示文本
 */
export function getEditionDisplayText(year: string | number): string {
  const yearNum = typeof year === 'string' ? parseInt(year) : year;
  const editionNumber = getEditionNumber(year);
  return `${yearNum}年第${editionNumber}届`;
}

/**
 * 从年份数组生成届次选项
 */
export function getEditionOptions(years: (string | number)[]): Array<{ value: string; label: string }> {
  return years.map(year => {
    const yearStr = year.toString();
    return {
      value: yearStr,
      label: getEditionDisplayText(year)
    };
  });
}
