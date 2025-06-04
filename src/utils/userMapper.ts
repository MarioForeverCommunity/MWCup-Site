/**
 * 用户映射工具 - 从 mwcup.yaml 中获取选手和评委的映射关系
 */

import { fetchMarioWorkerYaml } from './yamlLoader';

export interface UserMapping {
  [key: string]: string;
}

let userMappingCache: UserMapping | null = null;

/**
 * 从 mwcup.yaml 加载用户映射数据
 */
export async function loadUserMapping(): Promise<UserMapping> {
  if (userMappingCache) {
    return userMappingCache;
  }

  try {
    const yamlData = await fetchMarioWorkerYaml();
    const mapping: UserMapping = {};
    
    // 遍历所有年份和轮次，收集选手和评委的映射关系
    if (yamlData && yamlData.season) {
      for (const [, seasonData] of Object.entries(yamlData.season)) {
        if (seasonData && (seasonData as any).rounds) {
          for (const [, roundData] of Object.entries((seasonData as any).rounds)) {
            if (roundData && typeof roundData === 'object') {
              // 收集选手映射
              if ((roundData as any).players) {
                for (const group of Object.values((roundData as any).players)) {
                  if (group && typeof group === 'object') {
                    for (const [code, name] of Object.entries(group)) {
                      if (typeof name === 'string') {
                        mapping[code] = name;
                      }
                    }
                  }
                }
              }
              
              // 收集评委映射
              if ((roundData as any).judges) {
                for (const group of Object.values((roundData as any).judges)) {
                  if (group && typeof group === 'object') {
                    for (const [code, name] of Object.entries(group)) {
                      if (typeof name === 'string') {
                        mapping[code] = name;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    userMappingCache = mapping;
    return mapping;
  } catch (error) {
    console.error('从 YAML 加载用户映射失败:', error);
    return {};
  }
}

/**
 * 获取用户显示名称
 */
export function getUserDisplayName(username: string, userMapping: UserMapping): string {
  return userMapping[username] || username;
}

/**
 * 清除用户映射缓存
 */
export function clearUserMappingCache(): void {
  userMappingCache = null;
}
