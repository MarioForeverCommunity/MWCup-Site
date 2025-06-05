import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const levelsDir = path.join(__dirname, '../public/data/levels');
const yamlPath = path.join(__dirname, '../public/data/mwcup.yaml');
const output = [];

// 加载 YAML 数据
let mwcupData = null;
try {
  const yamlContent = fs.readFileSync(yamlPath, 'utf8');
  mwcupData = yaml.load(yamlContent);
  console.log('Loaded YAML data successfully');
} catch (error) {
  console.error('Failed to load YAML data:', error);
  process.exit(1);
}

/**
 * 从文件路径中提取年份和轮次信息
 */
function extractYearAndRound(filePath) {
  // 匹配路径中的年份，如 "2020年第九届"
  const yearMatch = filePath.match(/(\d{4})年/);
  const year = yearMatch ? yearMatch[1] : null;
  
  // 匹配轮次，如 "初赛"、"复赛"、"决赛" 等
  const roundPatterns = {
    '预赛': ['预赛', '预选赛'],
    '热身赛': ['热身赛'],
    '资格赛': ['资格赛', '小组资格赛'],
    '小组赛': ['小组赛'],
    '初赛': ['初赛'],
    '复赛': ['复赛'],
    '四分之一决赛': ['四分之一决赛'],
    '半决赛': ['半决赛'],
    '决赛': ['决赛'],
  };
  
  let roundType = null;
  for (const [type, patterns] of Object.entries(roundPatterns)) {
    for (const pattern of patterns) {
      if (filePath.includes(pattern)) {
        roundType = type;
        break;
      }
    }
    if (roundType) break;
  }
  
  return { year, roundType };
}

/**
 * 根据年份、轮次、选手码和文件路径查找选手信息
 */
function findPlayerInfo(year, roundType, playerCode, mwcupData, filePath) {
  if (!year || !mwcupData?.season?.[year]) {
    return null;
  }
  const yearData = mwcupData.season[year];
  const rounds = yearData.rounds;
  if (!rounds) return null;
  const specificRound = extractSpecificRound(filePath, roundType);  
  // 优先严格匹配轮次
  for (const [roundKey, roundData] of Object.entries(rounds)) {
    if (!roundData.players) continue;
    let roundTypeMatches = false;
    let actualRoundKey = roundKey;    
    // 检查是否是逗号分隔的多轮次键，如 "G1,G2,G3,G4"
    const isArrayKey = roundKey.includes(',');
    if (isArrayKey) {
      const keyArray = roundKey.split(',').map(k => k.trim());
      roundTypeMatches = keyArray.some(key => {
        if (key.startsWith('P1')) return roundType === '热身赛' || roundType === '预赛';
        if (key.startsWith('P2')) return roundType === '资格赛';
        if (key.startsWith('G')) return roundType === '小组赛';
        if (key.startsWith('I')) return roundType === '初赛';
        if (key.startsWith('R')) return roundType === '复赛';
        if (key.startsWith('Q')) return roundType === '四分之一决赛';
        if (key.startsWith('S')) return roundType === '半决赛';
        if (key.startsWith('F')) return roundType === '决赛';
        return false;
      });
      if (roundTypeMatches && specificRound) {
        let matchingKey = null;
        if (specificRound === '第一轮') matchingKey = keyArray.find(key => key.endsWith('1'));
        else if (specificRound === '第二轮') matchingKey = keyArray.find(key => key.endsWith('2'));
        else if (specificRound === '第三轮') matchingKey = keyArray.find(key => key.endsWith('3'));
        else if (specificRound === '第四轮') matchingKey = keyArray.find(key => key.endsWith('4'));
        actualRoundKey = matchingKey || keyArray[0];
      } else {
        actualRoundKey = keyArray[0];
      }
    } else {
      if (roundKey.startsWith('P1')) roundTypeMatches = roundType === '热身赛' || roundType === '预赛';
      else if (roundKey.startsWith('P2')) roundTypeMatches = roundType === '资格赛';
      else if (roundKey.startsWith('G')) roundTypeMatches = roundType === '小组赛';
      else if (roundKey.startsWith('I')) roundTypeMatches = roundType === '初赛';
      else if (roundKey.startsWith('R')) roundTypeMatches = roundType === '复赛';
      else if (roundKey.startsWith('Q')) roundTypeMatches = roundType === '四分之一决赛';
      else if (roundKey.startsWith('S')) roundTypeMatches = roundType === '半决赛';
      else if (roundKey.startsWith('F')) roundTypeMatches = roundType === '决赛';
    }
      const playerInfo = findPlayerInRound(roundData.players, playerCode);
      if (playerInfo && (roundTypeMatches || !roundType)) {
        return {
          year: parseInt(year),
          roundKey: actualRoundKey,
          roundType,
          playerName: playerInfo.name,
          playerCode: playerInfo.matchedCode || playerCode,
          matchedCode: playerInfo.matchedCode || playerCode,
          groupCode: playerInfo.group
        };
      }
    }
    // 宽松兜底：遍历所有轮次，找到第一个有该选手码的
    for (const [roundKey, roundData] of Object.entries(rounds)) {
      if (!roundData.players) continue;
      const playerInfo = findPlayerInRound(roundData.players, playerCode);
      if (playerInfo) {
        let finalRoundKey = roundKey;      // 如果是逗号分隔的多轮次 roundKey，尝试根据具体轮次匹配
        const isArrayKey = roundKey.includes(',');
        if (isArrayKey && specificRound) {
          const keyArray = roundKey.split(',').map(k => k.trim());
          let matchingKey = null;
          if (specificRound === '第一轮') matchingKey = keyArray.find(key => key.endsWith('1'));
          else if (specificRound === '第二轮') matchingKey = keyArray.find(key => key.endsWith('2'));
          else if (specificRound === '第三轮') matchingKey = keyArray.find(key => key.endsWith('3'));
          else if (specificRound === '第四轮') matchingKey = keyArray.find(key => key.endsWith('4'));        finalRoundKey = matchingKey || keyArray[0];
        } else if (isArrayKey) {
          const keyArray = roundKey.split(',').map(k => k.trim());
          finalRoundKey = keyArray[0];
        }
        
        return {
          year: parseInt(year),
          roundKey: finalRoundKey,
          roundType: roundType,
          playerName: playerInfo.name,
          playerCode: playerInfo.matchedCode || playerCode,
          matchedCode: playerInfo.matchedCode || playerCode,
          groupCode: playerInfo.group
        };
      }
    }
  return null;
}

/**
 * 从文件路径中提取具体的轮次信息
 */
function extractSpecificRound(filePath, roundType) {
  if (!filePath) {
    return null;
  }
  
  // 查找路径中的轮次标识
  const pathLower = filePath.toLowerCase();
  
  // 优先匹配明确的轮次描述
  if (pathLower.includes('第一轮')) {
    return '第一轮';
  } else if (pathLower.includes('第二轮')) {
    return '第二轮';
  } else if (pathLower.includes('第三轮')) {
    return '第三轮';
  } else if (pathLower.includes('第四轮')) {
    return '第四轮';
  } else if (pathLower.includes('第五轮')) {
    return '第五轮';
  }
  
  // 如果没有明确的轮次描述，尝试从路径段落中提取数字
  const pathSegments = filePath.split(/[/\\]/).filter(seg => seg.length > 0);
  for (const segment of pathSegments) {
    const segLower = segment.toLowerCase();
    // 匹配包含轮次信息的段落，如 "小组赛第一轮"、"初赛1"等
    if (segLower.includes(roundType) || (roundType && segLower.includes('赛'))) {
      if (segLower.includes('1') || segLower.includes('一')) {
        return '第一轮';
      } else if (segLower.includes('2') || segLower.includes('二')) {
        return '第二轮';
      } else if (segLower.includes('3') || segLower.includes('三')) {
        return '第三轮';
      } else if (segLower.includes('4') || segLower.includes('四')) {
        return '第四轮';
      } else if (segLower.includes('5') || segLower.includes('五')) {
        return '第五轮';
      }
    }
  }
  
  return null;
}

/**
 * 在轮次数据中查找选手（递归，兼容大小写和空格）
 */
function findPlayerInRound(playersData, playerCode) {
  if (!playerCode) return null;
  const codeNorm = playerCode.trim().toLowerCase();
  if (Array.isArray(playersData)) {
    for (const player of playersData) {
      if (typeof player === 'string' && player.trim().toLowerCase() === codeNorm) {
        return { name: player, group: null, matchedCode: player };
      }
    }
  } else if (typeof playersData === 'object' && playersData !== null) {
    for (const [key, value] of Object.entries(playersData)) {
      // 1. 直接匹配选手码（数字或字母）
      if (key.trim().toLowerCase() === codeNorm) {
        // value 是字符串，直接返回真实选手名
        if (typeof value === 'string') {
          return { name: value, group: null, matchedCode: key };
        }
        // value 是对象，尝试递归（如分组结构）
        if (typeof value === 'object' && value !== null) {
          // 递归查找分组下的选手码
          const found = findPlayerInRound(value, playerCode);
          if (found) {
            return { ...found, group: found.group || key };
          }
        }
        // 兜底：返回 key 作为 name
        return { name: key, group: null, matchedCode: key };
      }
      // 2. 匹配选手名称（用于用户名前缀的情况）
      if (typeof value === 'string' && value.trim().toLowerCase() === codeNorm) {
        return { name: value, group: null, matchedCode: key };
      }
      // 3. 如果值是对象，递归查找
      if (typeof value === 'object' && value !== null) {
        const found = findPlayerInRound(value, playerCode);
        if (found) {
          return { ...found, group: found.group || key };
        }
      }
    }
    // 4. 嵌套分组查找
    for (const [groupKey, groupValue] of Object.entries(playersData)) {
      if (typeof groupValue === 'object' && groupValue !== null) {
        for (const [playerKey, playerName] of Object.entries(groupValue)) {
          if (playerKey.trim().toLowerCase() === codeNorm) {
            return { name: typeof playerName === 'string' ? playerName : playerKey, group: groupKey, matchedCode: playerKey };
          }
        }
      }
    }
  }
  return null;
}

function walk(dir, relativePath = '', parentFolderPlayerCode = null) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    const fileRelativePath = path.join(relativePath, file.name).replace(/\\/g, '/');
    if (file.isDirectory()) {
      // 忽略2012年和2025年的目录（命名不规范）
      if (file.name.includes('2012') || file.name.includes('2025')) {
        console.log(`Skipping directory: ${file.name} (naming rules not standardized)`);
        continue;
      }
      
      // 检查是否是多关卡题的选手文件夹（格式：选手码-名称）
      const folderPlayerCode = extractPlayerCode(file.name);
      const isPlayerFolder = folderPlayerCode && isMultiLevelRound(fileRelativePath);
      
      if (isPlayerFolder) {
        console.log(`Detected multi-level player folder: ${file.name} (player code: ${folderPlayerCode})`);
        walk(fullPath, fileRelativePath, folderPlayerCode);
      } else {
        walk(fullPath, fileRelativePath, parentFolderPlayerCode);
      }
    } else {
      // 只处理关卡文件，跳过说明文件等      
      if (file.name.endsWith('.smwl') || file.name.endsWith('.smws') || file.name.endsWith('.mfl') || file.name.endsWith('.mfs')) {
        // 优先使用父文件夹的选手码（多关卡题情况），否则从文件名提取
        let playerCode = parentFolderPlayerCode || extractPlayerCode(file.name);
        
        // 只有能提取到有效选手码的文件才添加到索引中
        if (playerCode) {
          const stat = fs.statSync(fullPath);
          const { year, roundType } = extractYearAndRound(fileRelativePath);
          const playerInfo = findPlayerInfo(year, roundType, playerCode, mwcupData, fileRelativePath);
          
          const levelFile = {
            name: file.name,
            path: fileRelativePath,
            mtime: stat.mtime.toISOString(),
            size: stat.size,
            playerCode: playerInfo?.matchedCode || playerCode,
            // 新增的关联信息
            year: year ? parseInt(year) : null,
            roundType: roundType,
            playerName: playerInfo?.playerName || null,
            roundKey: playerInfo?.roundKey || null,
            groupCode: playerInfo?.groupCode || null,
            // 是否找到了完整的选手信息
            hasPlayerInfo: !!playerInfo,
            // 标记是否来自多关卡题文件夹
            isMultiLevel: !!parentFolderPlayerCode
          };
          
          output.push(levelFile);
          
          if (playerInfo) {
            const multiLevelFlag = parentFolderPlayerCode ? ' [Multi-Level]' : '';
            console.log(`✓ ${playerCode} -> ${playerInfo.playerName} (${year} ${roundType})${multiLevelFlag}`);
          } else {
            const multiLevelFlag = parentFolderPlayerCode ? ' [Multi-Level]' : '';
            console.log(`? ${playerCode} -> Unknown player (${year} ${roundType})${multiLevelFlag}`);
          }
        } else {
          console.log(`Skipping file with invalid naming: ${file.name}`);
        }
      }
    }
  }
}

function extractPlayerCode(filename) {
  // 查找第一个横杠的位置
  const dashIndex = filename.indexOf('-');
  if (dashIndex === -1) {
    // 没有横杠，尝试匹配决赛单字母格式：M, W, S, P
    const singleMatch = filename.match(/^([MWSP])[\s\.]|^([MWSP])$/i);
    if (singleMatch) {
      return (singleMatch[1] || singleMatch[2]);
    }
    return null;
  }
  
  // 获取第一个横杠前的字符串
  const prefix = filename.substring(0, dashIndex);
  
  // 排除一些明显不是选手码的前缀
  const excludePatterns = [
    /^\d{4}$/, // 年份 (如 2019)
    /^模板关卡/,
    /^模板/i, // 模板关卡
  ];
  
  if (excludePatterns.some(pattern => pattern.test(prefix))) {
    return null;
  }
  
  // 特殊文件名检查：排除明显的模板或示例文件
  const excludeFullNames = [
    /模板/i,
    /复刻/i,
  ];
  
  if (excludeFullNames.some(pattern => pattern.test(filename))) {
    return null;
  }
  
  // 在横杠前的字符串中按优先级寻找选手码模式
  
  // 1. 优先匹配数字前缀格式：1A, 2B, 3A 等（四分之一决赛等常用格式）
  const numPrefixMatch = prefix.match(/(\d+[A-Z])/gi);
  if (numPrefixMatch) {
    return numPrefixMatch[numPrefixMatch.length - 1];
  }
  
  // 2. 匹配标准选手码格式：A1, B2, C3, M, W, S, P 等
  const standardMatch = prefix.match(/([A-Z]\d*)/gi);
  if (standardMatch) {
    // 取第一个完整匹配
    return standardMatch[0];
  }
  
  // 3. 匹配纯数字格式：1, 2, 3 等（作为后备）
  const numOnlyMatch = prefix.match(/(\d+)/g);
  if (numOnlyMatch) {
    return numOnlyMatch[numOnlyMatch.length - 1];
  }
  
  // 4. 检查是否整个前缀就是用户名（用于用户名前缀的情况）
  // 排除一些明显不是用户名的格式
  if (prefix.length > 0 && prefix.length <= 30 && 
      !/^\d+$/.test(prefix) && // 排除纯数字（已经在上面处理了）
      !/^[a-z]\d+$/i.test(prefix)) { // 排除像 c1 这样应该被标准规则捕获的格式
    return prefix;
  }
  return null;
}

/**
 * 判断文件路径是否属于多关卡题的轮次
 * 目前已知的多关卡题轮次：2013小组赛第三轮、2016决赛、2020决赛
 */
function isMultiLevelRound(filePath) {
  // 2013年第二届小组赛第三轮
  if (filePath.includes('2013年第二届') && filePath.includes('小组赛第三轮')) {
    return true;
  }
  
  // 2016年第五届决赛
  if (filePath.includes('2016年第五届') && filePath.includes('决赛')) {
    return true;
  }
  
  // 2020年第九届决赛
  if (filePath.includes('2020年第九届') && filePath.includes('决赛')) {
    return true;
  }
  
  return false;
}

try {
  if (!fs.existsSync(levelsDir)) {
    console.error('Levels directory not found:', levelsDir);
    process.exit(1);
  }
  
  walk(levelsDir);
  
  const indexPath = path.join(levelsDir, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(output, null, 2), 'utf-8');
  
  console.log(`Level index generated with ${output.length} files.`);
  console.log('Index saved to:', indexPath);
} catch (error) {
  console.error('Error generating level index:', error);
  process.exit(1);
}
