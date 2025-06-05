// 关卡文件信息类型定义
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
  playerName: string | null;   // 选手姓名
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
 * 清除缓存
 */
export function clearLevelFilesCache(): void {
  levelFilesCache = null;
}


