/**
 * 轮次名称映射工具
 */

/**
 * 获取轮次中文显示名称
 */
export function getRoundChineseName(roundCode: string, roundData?: any): string {
  const roundNames: { [key: string]: string } = {
    'P2': '资格赛',
    'I1': '初赛第一轮',
    'I2': '初赛第二轮', 
    'I3': '初赛第三轮',
    'I4': '初赛第四轮',
    'G1': '小组赛第一轮',
    'G2': '小组赛第二轮',
    'G3': '小组赛第三轮',
    'G4': '小组赛第四轮',
    'Q1': '四分之一决赛第一轮',
    'Q2': '四分之一决赛第二轮',
    'Q': '四分之一决赛',
    'R1': '复赛第一轮',
    'R2': '复赛第二轮',
    'R3': '复赛第三轮',
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
