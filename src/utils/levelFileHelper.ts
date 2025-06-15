// 关卡文件信息类型定义
import { loadUserData, type UserData } from './userDataProcessor';

export interface MultiLevelFolder {
  folderName: string | null;   // 文件夹名称
  folderPath: string | null;   // 文件夹路径
  playerCode: string | null;   // 选手代码
}

export interface LevelFile {
  name: string;        // 文件名
  path: string;        // 相对路径
  mtime: string;       // 修改时间 (ISO 字符串)
  size: number;        // 文件大小 (字节)
  playerCode: string | null;  // 选手码
  // 新增的关联信息
  year: number | null;         // 年份
  roundType: string | null;    // 轮次类型
  playerName: string | null;   // 选手名
  roundKey: string | null;     // 轮次键
  groupCode: string | null;    // 分组码
  hasPlayerInfo: boolean;      // 是否有完整的选手信息
  isMultiLevel?: boolean;      // 是否是多关卡文件的一部分
  multiLevelFolder?: MultiLevelFolder | null; // 多关卡文件夹信息
}

let levelFilesCache: LevelFile[] | null = null;

/**
 * 从本地 index.json 获取关卡文件列表
 */
export async function fetchLevelFilesFromLocal(): Promise<LevelFile[]> {
  if (levelFilesCache) {
    return levelFilesCache;
  }
  
  try {
    const response = await fetch('/data/levels/index.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch level index: ${response.status}`);
    }
    
    const data: LevelFile[] = await response.json();
    levelFilesCache = data;
    return data;
  } catch (error) {
    console.error('Error fetching level files from local:', error);
    throw error;
  }
}

/**
 * 根据选手码获取关卡文件（不区分大小写）
 * @param playerCode 选手码
 */
export async function getLevelFileByPlayerCode(
  playerCode: string
): Promise<LevelFile | null> {
  const files = await fetchLevelFilesFromLocal();
  const normalizedCode = playerCode.toUpperCase();
  
  // 首先尝试精确匹配选手码
  const exactMatch = files.find(file => 
    file.playerCode === normalizedCode
  );
  
  if (exactMatch) {
    return exactMatch;
  }
  
  // 如果没有精确匹配，尝试在文件名中查找（兼容不规范的命名）
  const fuzzyMatch = files.find(file => 
    file.name.toUpperCase().includes(normalizedCode)
  );
  
  return fuzzyMatch || null;
}

/**
 * 根据选手码获取所有相关的关卡文件
 */
export async function getLevelFilesByPlayerCode(
  playerCode: string
): Promise<LevelFile[]> {
  const files = await fetchLevelFilesFromLocal();
  const normalizedCode = playerCode.toUpperCase();
  
  // 返回所有匹配的文件
  return files.filter(file => 
    file.playerCode === normalizedCode || 
    file.name.toUpperCase().includes(normalizedCode)
  );
}

/**
 * 获取所有关卡文件
 */
export async function getAllLevelFiles(): Promise<LevelFile[]> {
  return await fetchLevelFilesFromLocal();
}

/**
 * 检查选手名是否匹配搜索关键词（包括别名匹配）
 * @param playerName 选手名
 * @param keyword 搜索关键词
 * @param users 用户数据
 * @param isExact 是否精确匹配
 */
export function matchPlayerName(
  playerName: string | null, 
  keyword: string, 
  users: UserData[], 
  isExact: boolean = false
): boolean {
  if (!playerName || !keyword) return false;
  
  const lowerKeyword = keyword.toLowerCase();
  const lowerPlayerName = playerName.toLowerCase();
  
  // 直接匹配选手名
  if (isExact) {
    if (lowerPlayerName === lowerKeyword) return true;
  } else {
    if (lowerPlayerName.includes(lowerKeyword)) return true;
  }
  
  // 查找该选手在用户数据中的记录
  const playerRecord = users.find(user => {
    // 检查基本用户名
    if (user.百度用户名 === playerName || 
        user.社区用户名 === playerName || 
        user.社区曾用名 === playerName) {
      return true;
    }
    // 检查别名（支持多个别名，用逗号分隔）
    if (user.别名) {
      const aliases = user.别名.split(',').map(alias => alias.trim()).filter(alias => alias);
      if (aliases.includes(playerName)) return true;
    }
    return false;
  });
  
  if (!playerRecord) return false;
  
  // 检查该用户记录的所有相关用户名是否匹配关键词
  const namesToCheck = [
    playerRecord.百度用户名,
    playerRecord.社区用户名,
    playerRecord.社区曾用名
  ].filter(name => name && name.trim());
  
  // 添加所有别名
  if (playerRecord.别名) {
    const aliases = playerRecord.别名.split(',').map(alias => alias.trim()).filter(alias => alias);
    namesToCheck.push(...aliases);
  }
  
  for (const name of namesToCheck) {
    const lowerName = name.toLowerCase();
    if (isExact) {
      if (lowerName === lowerKeyword) return true;
    } else {
      if (lowerName.includes(lowerKeyword)) return true;
    }
  }
  
  // 查找关键词是否匹配其他用户记录，如果匹配，检查是否有相同社区UID
  const keywordMatchedUsers = users.filter(user => {
    const names = [user.百度用户名, user.社区用户名, user.社区曾用名].filter(name => name && name.trim());
    
    // 添加所有别名
    if (user.别名) {
      const aliases = user.别名.split(',').map(alias => alias.trim()).filter(alias => alias);
      names.push(...aliases);
    }
    
    for (const name of names) {
      const lowerName = name.toLowerCase();
      if (isExact) {
        if (lowerName === lowerKeyword) return true;
      } else {
        if (lowerName.includes(lowerKeyword)) return true;
      }
    }
    return false;
  });
  
  // 检查是否有匹配的用户与当前选手有相同的社区UID
  for (const keywordUser of keywordMatchedUsers) {
    if (playerRecord.社区UID && keywordUser.社区UID && 
        playerRecord.社区UID.trim() && keywordUser.社区UID.trim() &&
        playerRecord.社区UID === keywordUser.社区UID) {
      return true;
    }
  }
  
  return false;
}

/**
 * 根据关键词搜索关卡文件（支持选手别名搜索）
 * @param keyword 搜索关键词
 * @param isExact 是否精确匹配
 */
export async function searchLevelFilesByKeyword(
  keyword: string,
  isExact: boolean = false
): Promise<LevelFile[]> {
  if (!keyword.trim()) return [];
  
  const [files, users] = await Promise.all([
    fetchLevelFilesFromLocal(),
    loadUserData()
  ]);
  
  const processedKeyword = isExact ? keyword.slice(1, -1) : keyword;
  const lowerKeyword = processedKeyword.toLowerCase();
  
  return files.filter(file => {
    // 匹配文件名
    if (file.name && file.name.toLowerCase().includes(lowerKeyword)) {
      return true;
    }
    
    // 匹配选手码
    if (file.playerCode && (isExact ? 
        file.playerCode.toLowerCase() === lowerKeyword : 
        file.playerCode.toLowerCase().includes(lowerKeyword))) {
      return true;
    }
    
    // 匹配选手名（包括别名）
    if (matchPlayerName(file.playerName, processedKeyword, users, isExact)) {
      return true;
    }
    
    return false;
  });
}

/**
 * 清除缓存
 */
export function clearLevelFilesCache(): void {
  levelFilesCache = null;
}


