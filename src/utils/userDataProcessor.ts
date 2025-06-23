/**
 * 用户数据处理工具 - 处理users.csv和比赛数据
 */

export interface UserData {
  序号: number;
  百度用户名: string;
  社区用户名: string;
  社区UID: string;
  社区曾用名: string;
  别名: string;
}

export interface PlayerRecord {
  userId: number;
  participatedYears: number[];
  totalLevels: number;
  maxScore: number;
  maxScoreRate: number;
  bestStage: string;
  bestRank: number;
  bestStageLevel: number;  // 添加数值型的最佳阶段等级
  bestStageYear?: number;  // 最佳战绩所在年份
  bestStageRound?: string; // 最佳战绩所在轮次
  bestStageRank?: number;  // 最佳战绩轮次内的排名（用于决赛具体排名）
  championCount: number;
  runnerUpCount: number;
  thirdPlaceCount: number;
}

export interface JudgeRecord {
  judgeName: string;
  participatedYears: number[];
  totalRounds: number;
  totalLevels: number;
  yearlyData: { [year: number]: { rounds: number; levels: number } };
}

export interface AttendanceData {
  year: number;
  round: string;
  roundChineseName: string;
  totalPlayers: number;
  validSubmissions: number;
  attendanceRate: number;
}

let userDataCache: UserData[] | null = null;

/**
 * 加载users.csv数据
 */
export async function loadUserData(): Promise<UserData[]> {
  if (userDataCache) {
    return userDataCache;
  }

  try {
    const response = await fetch('/data/users.csv');
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('//'));
    
    if (lines.length === 0) return [];
    
    // 跳过标题行
    const dataLines = lines.slice(1);
    const users: UserData[] = dataLines.map(line => {
      // 使用正则表达式来正确解析CSV，处理引号包围的字段
      const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
      const parts = line.split(csvRegex).map(cell => {
        let trimmed = cell.trim();
        // 如果字段被双引号包围，移除引号
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          trimmed = trimmed.slice(1, -1);
        }
        return trimmed;
      });
      
      const [序号, 百度用户名, 社区用户名, 社区UID, 社区曾用名, 别名] = parts;
      return {
        序号: parseInt(序号) || 0,
        百度用户名: 百度用户名 || '',
        社区用户名: 社区用户名 || '',
        社区UID: 社区UID || '',
        社区曾用名: 社区曾用名 || '',
        别名: 别名 || ''
      };
    }).filter(user => user.序号 > 0);

    userDataCache = users;
    return users;
  } catch (error) {
    console.error('加载用户数据失败:', error);
    return [];
  }
}

/**
 * 根据用户名查找用户ID
 */
export function findUserIdByName(users: UserData[], playerName: string): number | null {
  const user = users.find(user => {
    // 检查百度用户名
    if (user.百度用户名 === playerName) return true;
    // 检查社区用户名
    if (user.社区用户名 === playerName) return true;
    // 检查社区曾用名
    if (user.社区曾用名 === playerName) return true;
    // 检查别名（支持多个别名，用逗号分隔）
    if (user.别名) {
      const aliases = user.别名.split(',').map(alias => alias.trim()).filter(alias => alias);
      if (aliases.includes(playerName)) return true;
    }
    return false;
  });
  
  return user ? user.序号 : null;
}

/**
 * 获取比赛阶段优先级（数字越大优先级越高）
 */
export function getStageLevel(roundCode: string): number {
  const round = roundCode.toUpperCase();
  
  // 决赛 (Final)
  if (round.includes('F')) return 6;
  // 半决赛 (Semi-final) 
  if (round.includes('S')) return 5;
  // 复赛
  if (round.includes('R')) return 4;
  // 四分之一决赛 (Quarterfinal)
  if (round.includes('Q')) return 3;
  // 小组赛/初赛 (Group/Initial)
  if (round.includes('G') || round.includes('I')) return 2;
  // 预选赛/热身赛/资格赛 (Preliminary)
  if (round.includes('P')) return 1;
  
  return 0;
}

/**
 * 获取比赛阶段名称
 */
export function getStageName(level: number): string {
  switch (level) {
    case 6: return '决赛';
    case 5: return '半决赛';
    case 4: return '复赛';
    case 3: return '四分之一决赛';
    case 2: return '小组赛/初赛';
    case 1: return '预选赛/热身赛/资格赛';
    default: return '未知';
  }
}

/**
 * 判断评委代号是否有效（排除JZ开头的大众评分和CANCELED评委）
 */
export function isValidJudge(judgeCode: string): boolean {
  if (!judgeCode) return false;
  
  // 排除JZ开头的大众评分
  if (judgeCode.startsWith('JZ')) return false;
  
  // 排除CANCELED评委
  if (judgeCode.toUpperCase().includes('CANCELED')) return false;
  if (judgeCode.toUpperCase().includes('UNWORKING')) return false;
  
  // 处理带波浪号前缀的评委代号
  const cleanCode = judgeCode.replace(/^~/, '');
  if (cleanCode.startsWith('JZ')) return false;
  
  return true;
}

/**
 * 清除缓存
 */
export function clearUserDataCache(): void {
  userDataCache = null;
}
