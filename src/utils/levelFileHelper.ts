// 关卡文件信息类型定义
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
}

// nginx autoindex 解析结果类型
export interface NginxFile {
  name: string;
  href: string;
  mtime: string;
  size: number;
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
 * 从 nginx autoindex 页面解析关卡文件列表
 */
export async function fetchLevelFilesFromNginx(url: string): Promise<LevelFile[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch nginx autoindex: ${response.status}`);
    }
    
    const html = await response.text();
    return parseNginxAutoindex(html);
  } catch (error) {
    console.error('Error fetching level files from nginx:', error);
    throw error;
  }
}

/**
 * 解析 nginx autoindex HTML 页面
 */
function parseNginxAutoindex(html: string): LevelFile[] {
  const files: LevelFile[] = [];
  
  // 创建一个临时的 DOM 解析器
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // 查找所有链接
  const links = doc.querySelectorAll('a[href]');
  
  links.forEach(link => {
    const href = link.getAttribute('href');
    const text = link.textContent?.trim();
    
    if (href && text && (href.endsWith('.mfl') || href.endsWith('.smwl'))) {
      // 尝试从表格行中提取文件信息
      const row = link.closest('tr');
      const rowText = row?.textContent || '';
      
      // 提取文件大小和修改时间（这是一个简化的实现）
      const sizeMatch = rowText.match(/(\d+(?:\.\d+)?[KMG]?)/);
      const size = sizeMatch ? parseFileSize(sizeMatch[1]) : 0;
      
      // 从文件名提取选手码
      const playerCode = extractPlayerCode(text);
      
      files.push({
        name: text,
        path: href,
        mtime: new Date().toISOString(), // nginx autoindex 时间解析比较复杂，这里简化
        size: size,
        playerCode: playerCode,
        year: null,
        roundType: null,
        playerName: null,
        roundKey: null,
        groupCode: null,
        hasPlayerInfo: false
      });
    }
  });
  
  return files;
}

/**
 * 解析文件大小字符串
 */
function parseFileSize(sizeStr: string): number {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)([KMG]?)$/i);
  if (!match) return 0;
  
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  
  switch (unit) {
    case 'K': return num * 1024;
    case 'M': return num * 1024 * 1024;
    case 'G': return num * 1024 * 1024 * 1024;
    default: return num;
  }
}

/**
 * 从文件名中提取选手码
 */
function extractPlayerCode(filename: string): string | null {
  // 简单的选手码提取（标准格式）
  const match = filename.match(/^([A-Z]\d*)-/i);
  if (match) {
    return match[1].toUpperCase();
  }
  
  // 决赛单字母格式
  const singleMatch = filename.match(/^([MWSP])-?/i);
  if (singleMatch) {
    return singleMatch[1].toUpperCase();
  }
  
  return null;
}

/**
 * 根据选手码获取关卡文件（不区分大小写）
 * @param playerCode 选手码
 * @param useNginx 是否使用 nginx autoindex（默认 false，使用本地文件）
 * @param nginxUrl nginx autoindex URL（当 useNginx 为 true 时必需）
 */
export async function getLevelFileByPlayerCode(
  playerCode: string,
  useNginx: boolean = false,
  nginxUrl?: string
): Promise<LevelFile | null> {
  let files: LevelFile[];
  
  if (useNginx) {
    if (!nginxUrl) {
      throw new Error('nginxUrl is required when useNginx is true');
    }
    files = await fetchLevelFilesFromNginx(nginxUrl);
  } else {
    files = await fetchLevelFilesFromLocal();
  }
  
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
  playerCode: string,
  useNginx: boolean = false,
  nginxUrl?: string
): Promise<LevelFile[]> {
  let files: LevelFile[];
  
  if (useNginx) {
    if (!nginxUrl) {
      throw new Error('nginxUrl is required when useNginx is true');
    }
    files = await fetchLevelFilesFromNginx(nginxUrl);
  } else {
    files = await fetchLevelFilesFromLocal();
  }
  
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
export async function getAllLevelFiles(
  useNginx: boolean = false,
  nginxUrl?: string
): Promise<LevelFile[]> {
  if (useNginx) {
    if (!nginxUrl) {
      throw new Error('nginxUrl is required when useNginx is true');
    }
    return await fetchLevelFilesFromNginx(nginxUrl);
  } else {
    return await fetchLevelFilesFromLocal();
  }
}

/**
 * 清除缓存
 */
export function clearLevelFilesCache(): void {
  levelFilesCache = null;
}

// 常量配置
export const NGINX_LEVELS_URL = 'https://levels.smwp.marioforever.net/MW%E6%9D%AF%E5%85%B3%E5%8D%A1/';
