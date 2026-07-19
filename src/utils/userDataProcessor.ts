/**
 * 用户数据处理工具 - 处理users.csv和比赛数据
 */

export interface UserData {
  序号: number;
  百度用户名: string;
  社区用户名: string;
  社区UID: string;
  社区曾用名: string[];
  别名: string[];
}

export interface PlayerRecord {
  userId: number;
  participatedYears: number[];
  mainEventYears: number[];
  totalLevels: number;
  maxScore: number;
  maxScoreRate: number;
  bestStage: string;
  bestRank: number;
  bestStageLevel: number;
  bestStageYear?: number;
  bestStageRound?: string;
  bestStageRank?: number;
  championCount: number;
  runnerUpCount: number;
  thirdPlaceCount: number;
}

export interface JudgeRecord {
  judgeName: string;
  communityUid: string;
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
// 姓名 -> 用户记录的查找映射，避免重复的线性搜索
let userNameIndex: Map<string, UserData> | null = null;

/**
 * 构建姓名 -> 用户的索引映射
 * 将百度用户名、社区用户名、社区曾用名都映射到同一个用户记录
 */
function buildUserNameIndex(users: UserData[]): Map<string, UserData> {
  const index = new Map<string, UserData>();
  for (const user of users) {
    if (user.百度用户名) index.set(user.百度用户名, user);
    if (user.社区用户名) index.set(user.社区用户名, user);
    for (const name of user.社区曾用名) {
      if (name) index.set(name, user);
    }
  }
  return index;
}

/**
 * 根据用户名查找用户记录（使用索引，O(1) 复杂度）
 */
export function findUserByName(users: UserData[], playerName: string): UserData | null {
  // 优先使用索引（当 users 引用与缓存一致时）
  if (userNameIndex && users === userDataCache) {
    return userNameIndex.get(playerName) || null;
  }
  // 降级到线性搜索（兼容外部传入的 users 数组）
  return users.find(user => {
    if (user.百度用户名 === playerName) return true;
    if (user.社区用户名 === playerName) return true;
    if (user.社区曾用名.includes(playerName)) return true;
    return false;
  }) || null;
}

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
        社区曾用名: 社区曾用名 ? 社区曾用名.split(',').map(name => name.trim()).filter(name => name) : [],
        别名: 别名 ? 别名.split(',').map(name => name.trim()).filter(name => name) : []
      };
    }).filter(user => user.序号 > 0);

    userDataCache = users;
    // 构建姓名索引，加速后续查找
    userNameIndex = buildUserNameIndex(users);
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
  const user = findUserByName(users, playerName);
  return user ? user.序号 : null;
}

/**
 * 获取比赛阶段优先级（数字越大优先级越高）
 */
export function getStageLevel(roundCode: string): number {
  const round = roundCode.toUpperCase();

  // 决赛/正赛 (Final) — F 为决赛，F1/F2/F3 为正赛，同级别
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
 * 根据轮次代号获取阶段名称
 * 区分决赛(F)和正赛(F1/F2/F3)
 */
export function getStageNameFromRound(roundCode: string): string {
  const round = roundCode.toUpperCase();
  if (/^F\d+$/.test(round)) return '正赛';
  if (round === 'F') return '决赛';
  return getStageName(getStageLevel(roundCode));
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
  userNameIndex = null;
}
