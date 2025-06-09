/**
 * 轮次名称映射工具
 */

/**
 * 获取轮次中文显示名称
 */
export function getRoundChineseName(roundCode: string, roundData?: any): string {
  // 检查轮次数据是否有 deadlines（表示这是题目模式而不是轮次模式）
  const hasDeadlines = roundData?.schedule?.deadlines || roundData?.deadlines
  
  // 获取年份（从roundData中）
  const year = roundData?.year || ''
  
  const roundNames: { [key: string]: string } = {
    'P2': '资格赛',
    'I1': year === '2012' ? '初赛第一轮' : '初赛第一题',
    'I2': year === '2012' ? '初赛第二轮' : '初赛第二题', 
    'I3': '初赛第三题',
    'I4': '初赛第四题',
    'G1': hasDeadlines ? '小组赛第一题' : '小组赛第一轮',
    'G2': hasDeadlines ? '小组赛第二题' : '小组赛第二轮',
    'G3': hasDeadlines ? '小组赛第三题' : '小组赛第三轮',
    'G4': hasDeadlines ? '小组赛第四题' : '小组赛第四轮',
    'Q1': '四分之一决赛第一轮',
    'Q2': '四分之一决赛第二轮',
    'Q': '四分之一决赛',
    'R1': '复赛第一题',
    'R2': '复赛第二题',
    'R3': '复赛第三题',
    'R': '复赛',
    'S1': '半决赛第一轮',
    'S2': '半决赛第二轮',
    'S': '半决赛',
    'F': '决赛'
  }
  
  // 特殊处理P1轮次
  if (roundCode === 'P1') {
    return roundData?.is_warmup ? '热身赛' : '预选赛'
  }
  
  return roundNames[roundCode] || roundCode
}
