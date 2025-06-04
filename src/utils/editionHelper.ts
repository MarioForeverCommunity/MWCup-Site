/**
 * 届数计算工具 - 将年份转换为对应的届数（中文数字）
 */

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
