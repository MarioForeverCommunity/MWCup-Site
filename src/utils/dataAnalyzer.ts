/**
 * 比赛数据分析工具 - 分析选手战绩、评委数据和上传率
 */

import { loadUserData, findUserIdByName, getStageLevel, getStageName, isValidJudge, type PlayerRecord, type JudgeRecord, type AttendanceData } from './userDataProcessor';
import { fetchMarioWorkerYaml } from './yamlLoader';
import { getRoundChineseName } from './roundNames';
import { buildPlayerJudgeMap, loadRoundScoreData } from './scoreCalculator';
import { loadTotalPointsData } from './totalPointsCalculator';
import { Decimal } from 'decimal.js';

// 设置Decimal的精度和舍入模式
Decimal.set({ precision: 10, rounding: Decimal.ROUND_HALF_UP });

interface RoundData {
  选手码?: string;
  选手用户名?: string;
  评委: string;
  [key: string]: string | Decimal | undefined;
}

interface PlayerStageResult {
  userId: number;
  year: number;
  stage: string;
  stageLevel: number;
  totalScore: Decimal;
  rank: number;
}

interface MaxScoreData {
  maxScore: {
    [year: string]: {
      [round: string]: {
        base_score: number;
        bonus_score: number;
      };
    };
  };
}

let maxScoreCache: MaxScoreData | null = null;

/**
 * 加载满分数据
 */
async function loadMaxScoreData(): Promise<MaxScoreData | null> {
  if (maxScoreCache) {
    return maxScoreCache;
  }

  try {
    const response = await fetch('/data/maxScore.json');
    if (!response.ok) return null;
    
    const data = await response.json();
    maxScoreCache = data;
    return data;
  } catch (error) {
    console.error('加载满分数据失败:', error);
    return null;
  }
}

/**
 * 获取指定年份轮次的满分
 */
async function getMaxScore(year: number, round: string): Promise<number> {
  const maxScoreData = await loadMaxScoreData();
  if (!maxScoreData) return 100; // 默认满分100
  
  const yearData = maxScoreData.maxScore[year.toString()];
  if (!yearData) return 100;
  
  const roundData = yearData[round];
  if (!roundData) return 100;
  
  return roundData.base_score + roundData.bonus_score;
}

/**
 * 加载指定轮次的CSV数据
 */
async function loadRoundData(year: number, round: string): Promise<RoundData[]> {
  try {
    const response = await fetch(`/data/scores/${year}${round}.csv`);
    if (!response.ok) return [];
    
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('//'));
    
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const dataLines = lines.slice(1);
      return dataLines.map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: RoundData = { 评委: '' };
      
      headers.forEach((header, index) => {
        const value = values[index] || '';
        if (header === '选手码') {
          row.选手码 = value;
        } else if (header === '选手用户名') {
          row.选手用户名 = value;
        } else if (header === '评委') {
          row.评委 = value;
        } else {
          // 仅当 value 是有效数字时才用 Decimal，否则保留原值
          if (!isNaN(Number(value)) && value !== '') {
            row[header] = new Decimal(value);
          } else {
            row[header] = value;
          }
        }
      });
      
      return row;
    });
  } catch (error) {
    console.error(`加载轮次数据失败 ${year}${round}:`, error);
    return [];
  }
}

/**
 * 获取轮次优先级，用于正确排序
 */
function getRoundPriority(round: string): number {
  // 按比赛流程顺序排列：P-G-I-Q-R-S-F
  if (round.startsWith('P')) return 1; // P1=预选赛/热身赛, P2=资格赛
  if (round.startsWith('G')) return 2; // 小组赛
  if (round.startsWith('I')) return 3; // 初赛
  if (round.startsWith('Q')) return 4; // 四分之一决赛
  if (round.startsWith('R')) return 5; // 复赛
  if (round.startsWith('S')) return 6; // 半决赛
  if (round.startsWith('F')) return 7; // 决赛
  return 8; // 其他轮次
}

/**
 * 获取所有可用的比赛轮次
 */
async function getAllRounds(): Promise<{ year: number; round: string }[]> {
  const rounds: { year: number; round: string; order: number }[] = [];
  
  try {
    // 从YAML数据中获取轮次信息
    const yamlData = await fetchMarioWorkerYaml();
    const seasonData = yamlData?.season;
    
    if (seasonData) {
      for (const [yearStr, yearData] of Object.entries(seasonData)) {
        const year = parseInt(yearStr);
        if (!yearData || typeof yearData !== 'object' || !('rounds' in yearData)) continue;
        
        const roundsData = (yearData as any).rounds;
        if (!roundsData || typeof roundsData !== 'object') continue;
        
        let order = 0; // 用于维护YAML中定义的顺序
        
        for (const roundKey of Object.keys(roundsData)) {
          order++;
          
          // 检查是否是数组表示的轮次（如 "[G1, G2, G3, G4]"）
          if (roundKey.startsWith('[') && roundKey.endsWith(']')) {
            try {
              const parsedKey = JSON.parse(roundKey);
              if (Array.isArray(parsedKey)) {
                for (const singleRound of parsedKey) {
                  rounds.push({ year, round: singleRound, order });
                }
                continue;
              }
            } catch {
              // JSON解析失败，按普通轮次处理
            }
          }
          
          // 检查是否是逗号分隔的多轮次（如 "G1,G2,G3,G4"）
          if (roundKey.includes(',')) {
            const singleRounds = roundKey.split(',').map(r => r.trim());
            for (const singleRound of singleRounds) {
              rounds.push({ year, round: singleRound, order });
            }
            continue;
          }
          
          // 普通单轮次
          rounds.push({ year, round: roundKey, order });
        }
      }
    }
  } catch (error) {
    console.error('从YAML获取轮次信息失败:', error);
      // 降级到硬编码的文件列表（按正确的比赛流程顺序）
    const knownFiles = [
      // 2013年
      '2013P1', '2013P2', '2013G1', '2013G2', '2013G3', '2013G4', '2013Q1', '2013Q2', '2013S1', '2013S2', '2013F',
      // 2014年
      '2014P1', '2014P2', '2014G1', '2014G2', '2014G3', '2014Q1', '2014Q2', '2014S', '2014F',
      // 2015年
      '2015P1', '2015P2', '2015G1', '2015G2', '2015G3', '2015G4', '2015Q1', '2015Q2', '2015S', '2015F',
      // 2016年
      '2016P1', '2016P2', '2016G1', '2016G2', '2016G3', '2016Q1', '2016Q2', '2016S1', '2016S2', '2016F',
      // 2017年
      '2017P1', '2017G1', '2017G2', '2017G3', '2017P2', '2017Q1', '2017Q2', '2017S', '2017F',
      // 2018年
      '2018P1', '2018G1', '2018G2', '2018G3', '2018P2', '2018Q1', '2018Q2', '2018S', '2018F',
      // 2019年
      '2019P1', '2019P2', '2019G1', '2019G2', '2019G3', '2019G4', '2019Q', '2019S', '2019F',
      // 2020年
      '2020P1', '2020P2', '2020I1', '2020I2', '2020I3', '2020R', '2020F',
      // 2021年
      '2021P1', '2021P2', '2021I1', '2021I2', '2021I3', '2021I4', '2021R1', '2021R2', '2021R3', '2021F',
      // 2022年
      '2022P1', '2022I1', '2022I2', '2022I3', '2022P2', '2022R', '2022F',
      // 2023年
      '2023P1', '2023P2', '2023I1', '2023I2', '2023I3', '2023F',
      // 2024年
      '2024P1', '2024P2', '2024I1', '2024I2', '2024I3', '2024R', '2024F',
      // 2025年
      '2025P1', '2025P2', '2025I1', '2025I2', '2025I3', '2025F',
    ];
    
    for (let i = 0; i < knownFiles.length; i++) {
      const fileName = knownFiles[i];
      const match = fileName.match(/^(\d{4})(.+)$/);
      if (match) {
        const year = parseInt(match[1]);
        const round = match[2];
        rounds.push({ year, round, order: i });
      }
    }
  }
  // 按年份和轮次优先级排序
  rounds.sort((a, b) => {
    // 首先按年份排序
    if (a.year !== b.year) return a.year - b.year;
    
    // 同年份内，按轮次类型排序（P->G->I->Q->R->S->F）
    const priorityA = getRoundPriority(a.round);
    const priorityB = getRoundPriority(b.round);
    if (priorityA !== priorityB) return priorityA - priorityB;
    
    // 同类型轮次按轮次编号排序 (如 G1, G2, G3, G4)
    const roundA = a.round;
    const roundB = b.round;
    
    // 提取轮次编号进行数字排序
    const numA = parseInt(roundA.replace(/[^0-9]/g, '')) || 0;
    const numB = parseInt(roundB.replace(/[^0-9]/g, '')) || 0;
    if (numA !== numB) return numA - numB;
    
    // 如果没有编号或编号相同，按YAML定义顺序排序
    return a.order - b.order;
  });
  
  return rounds.map(({ year, round }) => ({ year, round }));
}

/**
 * 从YAML数据中获取指定年份和轮次的选手数量
 */
async function getPlayerCountFromYaml(year: number, round: string): Promise<number> {
  try {
    const yamlData = await fetchMarioWorkerYaml();
    const seasonData = yamlData?.season;
    if (!seasonData) return 0;
    
    const yearData = seasonData[year.toString()];
    if (!yearData?.rounds) return 0;
    
    // 首先尝试直接查找轮次
    let roundData = yearData.rounds[round];
    
    // 如果直接查找失败，尝试在数组格式键中查找
    if (!roundData) {
      for (const [roundKey, data] of Object.entries(yearData.rounds)) {
        // 检查是否是数组表示的轮次（如 "[G1, G2, G3, G4]"）
        if (roundKey.startsWith('[') && roundKey.endsWith(']')) {
          try {
            const parsedKey = JSON.parse(roundKey);
            if (Array.isArray(parsedKey) && parsedKey.includes(round)) {
              roundData = data;
              break;
            }
          } catch {
            // JSON解析失败，继续下一个
          }
        }
        
        // 检查是否是逗号分隔的多轮次（如 "G1,G2,G3,G4"）
        if (roundKey.includes(',')) {
          const singleRounds = roundKey.split(',').map(r => r.trim());
          if (singleRounds.includes(round)) {
            roundData = data;
            break;
          }
        }
      }
    }
    
    if (!roundData?.players) return 0;
    
    let playerCount = 0;
      // 处理不同的选手数据结构
    if (Array.isArray(roundData.players)) {
      // P2 轮次格式：数组
      playerCount = roundData.players.length;
    } else if (typeof roundData.players === 'object') {
      // 检查是否为扁平结构或分组结构
      const firstValue = Object.values(roundData.players)[0];
      if (typeof firstValue === 'string') {
        // 扁平结构：players: { '1': 用户名, '2': 用户名, ... }
        // 忽略带波浪号前缀的选手码（表示被取消资格）
        const validPlayerKeys = Object.keys(roundData.players).filter(key => !key.startsWith('~'));
        playerCount = validPlayerKeys.length;
      } else {
        // 分组结构：players: { A: { A1: 用户名, ... }, ... }
        for (const groupData of Object.values(roundData.players)) {
          if (typeof groupData === 'object' && groupData) {
            // 忽略带波浪号前缀的选手码（表示被取消资格）
            const validPlayerKeys = Object.keys(groupData).filter(key => !key.startsWith('~'));
            playerCount += validPlayerKeys.length;
          }
        }
      }
    }
    
    return playerCount;
  } catch (error) {
    console.error(`获取YAML选手数量失败 ${year}${round}:`, error);
    return 0;
  }
}

/**
 * 从YAML数据中获取评委的用户名
 */
function getJudgeNameFromYaml(judgeCode: string, playerMap: any, playerCode?: string): string | null {
  // 优先按分组查找（如果选手有分组信息）
  if (playerCode && playerMap.playerGroups) {
    const group = playerMap.playerGroups[playerCode];
    if (group) {
      const groupJudgeKey = `${group}-${judgeCode}`;
      if (playerMap.judges[groupJudgeKey]) {
        return playerMap.judges[groupJudgeKey];
      }
    }
  }
  
  // 直接查找评委代号
  if (playerMap.judges[judgeCode]) {
    return playerMap.judges[judgeCode];
  }
  
  // 兼容逻辑：处理带前缀的评委代号（如 JR1 -> J1）
  if (judgeCode.length > 1) {
    const parts = judgeCode.match(/^[A-Za-z]+(\d+.*)$/);
    if (parts && parts[1]) {
      const simpleCode = 'J' + parts[1];
      if (playerMap.judges[simpleCode]) {
        return playerMap.judges[simpleCode];
      }
    }
  }
  
  return null;
}

/**
 * 获取统一的用户标识符（用于数据合并）
 * 如果用户在users.csv中存在，将基于社区UID返回统一标识符；否则返回原始用户名
 */
async function getUnifiedUserId(yamlUserName: string): Promise<string> {
  if (!yamlUserName) return yamlUserName;
  
  try {
    const users = await loadUserData();
    
    // 在用户数据中查找匹配的用户
    const matchedUser = users.find(user => {
      // 检查是否匹配贴吧用户名
      if (user.百度用户名 === yamlUserName) return true;
      // 检查是否匹配社区用户名
      if (user.社区用户名 === yamlUserName) return true;
      // 检查是否匹配社区曾用名
      if (user.社区曾用名 === yamlUserName) return true;
      return false;
    });
    
    if (matchedUser) {
      // 检查是否有有效的社区UID
      if (matchedUser.社区UID && matchedUser.社区UID !== '') {
        // 根据社区UID生成统一标识符
        return `community_${matchedUser.社区UID}`;
      } else {
        // 如果没有社区UID，则使用用户序号
        return `user_${matchedUser.序号}`;
      }
    }
    
    // 如果没有找到匹配的用户，返回原始名称
    return yamlUserName;
  } catch (error) {
    console.error('获取统一用户标识符失败:', error);
    return yamlUserName;
  }
}

/**
 * 根据用户数据优先显示社区用户名，如无则显示贴吧用户名
 */
async function getPreferredDisplayName(yamlUserName: string): Promise<string> {
  if (!yamlUserName) return yamlUserName;
  
  try {
    const users = await loadUserData();
    
    // 在用户数据中查找匹配的用户
    const matchedUser = users.find(user => {
      // 检查是否匹配贴吧用户名
      if (user.百度用户名 === yamlUserName) return true;
      // 检查是否匹配社区用户名
      if (user.社区用户名 === yamlUserName) return true;
      // 检查是否匹配社区曾用名
      if (user.社区曾用名 === yamlUserName) return true;
      return false;
    });
    
    if (matchedUser) {
      // 优先返回社区用户名，如无则返回贴吧用户名
      return matchedUser.社区用户名 || matchedUser.百度用户名 || yamlUserName;
    }
    
    // 如果没有找到匹配的用户，返回原始名称
    return yamlUserName;
  } catch (error) {
    console.error('获取用户首选显示名称失败:', error);
    return yamlUserName;
  }
}

/**
 * 分析选手战绩 - 使用正确的计分系统
 */
export async function analyzePlayerRecords(): Promise<PlayerRecord[]> {
  const users = await loadUserData();
  const rounds = await getAllRounds();
  
  const playerRecords: { [unifiedUserId: string]: PlayerRecord } = {};
  const playerStageResults: PlayerStageResult[] = [];
  // 记录每个选手的最高得分及其对应的满分
  const playerMaxScoreInfo: { [unifiedUserId: string]: { maxScore: Decimal; maxPossibleScore: number } } = {};
  
  // 获取YAML数据用于查找选手用户名
  const yamlData = await fetchMarioWorkerYaml();
  
  // 分析每个轮次的数据
  for (const { year, round } of rounds) {
    try {
      // 特殊处理：2012年I2轮次，评分没有进行，使用关卡上传数据
      if (year === 2012 && round === 'I2') {
        try {
          // 从关卡索引获取上传数据
          const response = await fetch('/data/levels/index.json');
          const levelData = await response.json();
          
          // 筛选2012年I2轮次的关卡
          const i2Levels = levelData.filter((level: any) => 
            level.year === 2012 && level.roundKey === 'I2'
          );
          
          // 处理每个选手的上传数据，只计入关卡数量不计算分数
          const processedPlayers = new Set<string>();
          
          for (const level of i2Levels) {
            const playerName = level.playerName;
            if (!playerName || processedPlayers.has(playerName)) continue;
            
            // 获取统一的用户标识符
            const unifiedUserId = await getUnifiedUserId(playerName);
            const userId = findUserIdByName(users, playerName);
            if (!userId) continue;
            
            processedPlayers.add(playerName);
            
            // 初始化或更新选手记录
            if (!playerRecords[unifiedUserId]) {
              playerRecords[unifiedUserId] = {
                userId,
                participatedYears: [],
                totalLevels: 0,
                maxScore: 0,
                maxScoreRate: 0,
                bestStage: '',
                bestRank: Infinity,
                bestStageLevel: 0,
                bestStageYear: undefined,
                bestStageRound: undefined,
                bestStageRank: undefined,
                championCount: 0,
                runnerUpCount: 0,
                thirdPlaceCount: 0
              };
              playerMaxScoreInfo[unifiedUserId] = { maxScore: new Decimal(0), maxPossibleScore: 100 };
            }
            
            const record = playerRecords[unifiedUserId];
            if (!record.participatedYears.includes(year)) {
              record.participatedYears.push(year);
            }
            
            record.totalLevels++;
          }
          
          continue; // 处理完2012年I2后跳到下一个轮次
        } catch (error) {
          console.error('处理2012年I2轮次关卡数据失败:', error);
        }
      }
      
      const scoreData = await loadRoundScoreData(year.toString(), round, yamlData);
      if (!scoreData || scoreData.playerScores.length === 0) continue;
      
      // 获取该轮次的满分
      const maxPossibleScore = await getMaxScore(year, round);
      const stageLevel = getStageLevel(round);
      
      // 处理每个选手的得分
      const playerScores: { 
        playerCode: string; 
        score: Decimal; 
        unifiedUserId: string; 
        displayName: string; 
        userId: number 
      }[] = [];
      
      for (const playerScore of scoreData.playerScores) {
        const { playerCode, playerName, averageScore } = playerScore;
        
        // 获取统一的用户标识符和首选名称
        const unifiedUserId = await getUnifiedUserId(playerName);
        const displayName = await getPreferredDisplayName(playerName);
        
        // 验证用户是否在users.csv中存在
        const userId = findUserIdByName(users, playerName);
        if (!userId) continue;
        
        // 初始化选手记录（无论是否有效都要先初始化）
        if (!playerRecords[unifiedUserId]) {
          playerRecords[unifiedUserId] = {
            userId,
            participatedYears: [],
            totalLevels: 0,
            maxScore: 0,
            maxScoreRate: 0,
            bestStage: '',
            bestRank: Infinity,
            bestStageLevel: 0,
            bestStageYear: undefined,
            bestStageRound: undefined,
            bestStageRank: undefined,
            championCount: 0,
            runnerUpCount: 0,
            thirdPlaceCount: 0
          };
          playerMaxScoreInfo[unifiedUserId] = { maxScore: new Decimal(0), maxPossibleScore: 100 };
        }
        
        // 记录参与年份和总关卡数，无论成绩是否有效、关卡是否无法运行都算
        // 只要选手上传了关卡（包括CANCELED和UNWORKING）
        const record = playerRecords[unifiedUserId];
        if (!record.participatedYears.includes(year)) {
          record.participatedYears.push(year);
        }
        
        record.totalLevels++;
        
        // 只有有效成绩才计入排名和最高分数据（排除被取消成绩的选手）
        if (playerScore.records.some(r => r.isCanceled)) {
          continue;
        }
        
        // 添加到有效排名数据中
        playerScores.push({ 
          playerCode, 
          score: averageScore, 
          unifiedUserId, 
          displayName, 
          userId 
        });
        
        // 更新最高得分信息（无法运行的关卡得分为0，不会影响最高分）
        const currentScore = playerScore.averageScore;
        if (currentScore.greaterThan(record.maxScore)) {
          record.maxScore = currentScore.toNumber();
          playerMaxScoreInfo[unifiedUserId].maxScore = currentScore;
          playerMaxScoreInfo[unifiedUserId].maxPossibleScore = maxPossibleScore;
        }
      }
      
      // 计算排名（只对正式赛阶段）
      if (stageLevel > 1) {
        playerScores.sort((a, b) => b.score.comparedTo(a.score));
        
        playerScores.forEach((player, index) => {
          const rank = index + 1;
          const record = playerRecords[player.unifiedUserId];
          
          // 更新最佳阶段
          if (stageLevel > record.bestStageLevel) {
            record.bestStage = getStageName(stageLevel);
            record.bestStageLevel = stageLevel;
            record.bestStageYear = year;
            record.bestStageRound = round;
            record.bestStageRank = rank;
          }
          
          playerStageResults.push({
            userId: player.userId,
            year,
            stage: getStageName(stageLevel),
            stageLevel,
            totalScore: player.score,
            rank
          });
          
          // 更新最佳排名
          if (rank < record.bestRank) {
            record.bestRank = rank;
          }
          
          // 统计冠亚季军
          if (stageLevel === 6) {
            if (rank === 1) record.championCount++;
            else if (rank === 2) record.runnerUpCount++;
            // 季军仅统计2020年及之后
            else if (rank === 3) record.thirdPlaceCount++;
          }
        });
      }
    } catch (error) {
      console.warn(`跳过轮次 ${year}${round}, 加载失败:`, error);
      continue;
    }
  }
  
  // 计算正确的得分率
  for (const [unifiedUserId, record] of Object.entries(playerRecords)) {
    const scoreInfo = playerMaxScoreInfo[unifiedUserId];
    if (scoreInfo && scoreInfo.maxPossibleScore > 0) {
      record.maxScoreRate = scoreInfo.maxScore.div(scoreInfo.maxPossibleScore).times(100).toNumber();
    } else {
      record.maxScoreRate = 0;
    }
    
    if (record.bestRank === Infinity) record.bestRank = 0;
  }
  
  // 更新总分排行榜中的最佳排名和战绩
  try {
    const bestTotalPointsRankings = await calculateBestTotalPointsRanking();
    const bestTotalPointsRankingsByRank = await calculateBestTotalPointsRankingByRank();
    
    for (const [unifiedUserId, record] of Object.entries(playerRecords)) {
      // 用于"最佳战绩"列：使用决赛名次优先逻辑
      const bestTotalPointsInfo = bestTotalPointsRankings[unifiedUserId];
      if (bestTotalPointsInfo && bestTotalPointsInfo.rank > 0) {
        // 使用决赛名次优先的最佳战绩
        record.bestStage = bestTotalPointsInfo.bestResult;
        record.bestStageYear = bestTotalPointsInfo.year;
        // 保留冠亚季军统计，只重置阶段相关字段
        record.bestStageLevel = 0;
        record.bestStageRound = undefined;
        record.bestStageRank = undefined;
      }
      
      // 用于"最高总积分排名"列：纯粹按总积分排名
      const bestRankInfo = bestTotalPointsRankingsByRank[unifiedUserId];
      if (bestRankInfo && bestRankInfo.rank > 0) {
        record.bestRank = bestRankInfo.rank;
      }
    }
  } catch (error) {
    console.warn('计算总分排行榜历届最佳排名失败:', error);
  }

  // --- 修正最佳战绩为YAML中晋级的最高轮次 ---
  if (yamlData && yamlData.season) {
    const userBestStageLevel: { [unifiedUserId: string]: { stageLevel: number; stage: string; year: number; round: string } } = {};
    for (const [yearStr, yearData] of Object.entries(yamlData.season)) {
      if (!yearData || typeof yearData !== 'object' || !('rounds' in yearData)) continue;
      const year = parseInt(yearStr);
      const roundsData = (yearData as any).rounds;
      for (const [roundKey, roundDataRaw] of Object.entries(roundsData)) {
        const roundData = roundDataRaw as any;
        let roundList: string[] = [];
        if (roundKey.startsWith('[') && roundKey.endsWith(']')) {
          try {
            const parsedKey = JSON.parse(roundKey);
            if (Array.isArray(parsedKey)) roundList = parsedKey;
          } catch { roundList = [roundKey]; }
        } else if (roundKey.includes(',')) {
          roundList = roundKey.split(',').map(r => r.trim());
        } else {
          roundList = [roundKey];
        }
        for (const round of roundList) {
          const stageLevel = getStageLevel(round);
          if (!roundData.players) continue;
          let playerNames: string[] = [];
          if (Array.isArray(roundData.players)) {
            playerNames = roundData.players.filter(Boolean);
          } else if (typeof roundData.players === 'object') {
            const firstValue = Object.values(roundData.players)[0];
            if (typeof firstValue === 'string') {
              playerNames = Object.values(roundData.players).filter(v => typeof v === 'string');
            } else {
              for (const groupData of Object.values(roundData.players)) {
                if (typeof groupData === 'object' && groupData) {
                  playerNames.push(...Object.values(groupData).filter(v => typeof v === 'string'));
                }
              }
            }
          }
          for (const playerName of playerNames) {
            const unifiedUserId = await getUnifiedUserId(playerName as string);
            if (!userBestStageLevel[unifiedUserId] || stageLevel > userBestStageLevel[unifiedUserId].stageLevel) {
              userBestStageLevel[unifiedUserId] = { stageLevel, stage: getStageName(stageLevel), year, round };
            }
          }
        }
      }
    }
    // 用YAML晋级最高轮次覆盖playerRecords的bestStageLevel
    for (const [unifiedUserId, best] of Object.entries(userBestStageLevel)) {
      if (playerRecords[unifiedUserId]) {
        playerRecords[unifiedUserId].bestStageLevel = best.stageLevel;
        // 只在bestStage为空、无、未知、仅报名时才覆盖，保留冠亚季军等精确信息
        if (!playerRecords[unifiedUserId].bestStage ||
            playerRecords[unifiedUserId].bestStage === '无' ||
            playerRecords[unifiedUserId].bestStage === '未知' ||
            playerRecords[unifiedUserId].bestStage === '仅报名') {
          playerRecords[unifiedUserId].bestStage = best.stage;
          playerRecords[unifiedUserId].bestStageYear = best.year;
          playerRecords[unifiedUserId].bestStageRound = best.round;
        }
        // YAML数据中没有排名信息，保持undefined
        playerRecords[unifiedUserId].bestStageRank = undefined;
      }
    }
  }
  // --- END 修正 ---

  return Object.values(playerRecords).filter(record => record.totalLevels > 0);
}

/**
 * 分析评委数据
 */
export async function analyzeJudgeRecords(): Promise<JudgeRecord[]> {
  const rounds = await getAllRounds();
  const judgeRecords: { [judgeName: string]: JudgeRecord } = {};
  const judgeRoundParticipation: { [judgeName: string]: Set<string> } = {};
  
  // 获取YAML数据用于查找评委用户名
  const yamlData = await fetchMarioWorkerYaml();
  
  for (const { year, round } of rounds) {
    const data = await loadRoundData(year, round);
    if (data.length === 0) continue;
    // 获取该轮次的评委映射
    const playerMap = buildPlayerJudgeMap(yamlData, year.toString(), round);
    const judgesInThisRound = new Set<string>();
    
    for (const row of data) {
      const judgeCode = row.评委;
      if (!isValidJudge(judgeCode)) continue;
        // 处理有波浪号前缀的评委代号
      const cleanJudgeCode = judgeCode.replace(/^~/, '');
        // 从YAML中获取评委的用户名
      const yamlJudgeName = getJudgeNameFromYaml(cleanJudgeCode, playerMap, row.选手码) || cleanJudgeCode;
        // 获取统一的用户标识符（用于合并相同用户的不同评委名称）
      const unifiedUserId = await getUnifiedUserId(yamlJudgeName);
      // 获取用于显示的首选名称
      const displayName = await getPreferredDisplayName(yamlJudgeName);      
      if (!judgeRecords[unifiedUserId]) {
        judgeRecords[unifiedUserId] = {
          judgeName: displayName,
          participatedYears: [],
          totalRounds: 0,
          totalLevels: 0,
          yearlyData: {}
        };
        judgeRoundParticipation[unifiedUserId] = new Set();
      }
      
      const record = judgeRecords[unifiedUserId];
      
      if (!record.participatedYears.includes(year)) {
        record.participatedYears.push(year);
      }
      
      if (!record.yearlyData[year]) {
        record.yearlyData[year] = { rounds: 0, levels: 0 };
      }
      
      record.totalLevels++;
      record.yearlyData[year].levels++;
      
      // 记录该评委参与了这一轮
      judgesInThisRound.add(unifiedUserId);
    }
    // 为参与这一轮的所有评委增加轮数计数
    for (const unifiedUserId of judgesInThisRound) {
      const roundKey = `${year}-${round}`;
      if (!judgeRoundParticipation[unifiedUserId].has(roundKey)) {
        judgeRoundParticipation[unifiedUserId].add(roundKey);
        if (judgeRecords[unifiedUserId].yearlyData[year]) {
          judgeRecords[unifiedUserId].yearlyData[year].rounds++;
        }
      }
    }
  }
  
  // 设置总轮数
  for (const [unifiedUserId, record] of Object.entries(judgeRecords)) {
    record.totalRounds = judgeRoundParticipation[unifiedUserId]?.size || 0;
  }
  
  return Object.values(judgeRecords);
}

/**
 * 分析上传率数据
 */
export async function analyzeAttendanceData(): Promise<AttendanceData[]> {
  const rounds = await getAllRounds();
  const attendanceData: AttendanceData[] = [];
  
  // 获取YAML数据用于轮次名称转换
  const yamlData = await fetchMarioWorkerYaml();
  const seasonData = yamlData?.season;
  for (const { year, round } of rounds) {
    // 特殊处理：2012年I2轮次，评分没有进行，使用关卡上传数据
    if (year === 2012 && round === 'I2') {
      try {
        // 从关卡索引获取上传数据
        const response = await fetch('/data/levels/index.json');
        const levelData = await response.json();
        
        // 筛选2012年I2轮次的关卡
        const i2Levels = levelData.filter((level: any) => 
          level.year === 2012 && level.roundKey === 'I2'
        );
        
        // 统计上传的选手（去重）
        const uploadedPlayers = [...new Set(i2Levels.map((level: any) => level.playerCode))];
        const validSubmissions = uploadedPlayers.length;
        
        // 从YAML获取该轮的总选手数
        const totalPlayers = await getPlayerCountFromYaml(year, round);
        if (totalPlayers > 0) {
          const attendanceRate = new Decimal(validSubmissions).div(totalPlayers).times(100).toNumber();
          
          // 获取轮次名称
          const yearData = seasonData?.[year.toString()];
          let roundData = yearData?.rounds?.[round];
          const roundChineseName = getRoundChineseName(round, { ...roundData, year: year.toString() });
          
          attendanceData.push({
            year,
            round,
            roundChineseName,
            totalPlayers,
            validSubmissions,
            attendanceRate
          });
        }
      } catch (error) {
        console.error('处理2012年I2轮次数据失败:', error);
      }
      continue;
    }
    
    // 特殊处理：2015年S轮使用YAML中的scores数据
    if (year === 2015 && round === 'S') {
      const yearData = seasonData?.[year.toString()];
      const roundData = yearData?.rounds?.[round];
      
      if (roundData?.scores && typeof roundData.scores === 'object') {
        const scores = roundData.scores as { [key: string]: number };
        const totalPlayers = Object.keys(scores).length;
        
        // 有得分算上传，0分算未上传
        const validSubmissions = Object.values(scores).filter(score => score > 0).length;
        
        const attendanceRate = totalPlayers > 0 ? new Decimal(validSubmissions).div(totalPlayers).times(100).toNumber() : 0;
        const roundChineseName = getRoundChineseName(round, { ...roundData, year: year.toString() });
        
        attendanceData.push({
          year,
          round,
          roundChineseName,
          totalPlayers,
          validSubmissions,
          attendanceRate
        });
      }
      continue;
    }
    
    const data = await loadRoundData(year, round);
    if (data.length === 0) continue;
    
    // 从YAML获取该轮的选手数量
    const totalPlayers = await getPlayerCountFromYaml(year, round);
    if (totalPlayers === 0) continue;
    
    // 处理特殊情况：2022、2023年P2使用选手用户名而不是选手码
    const isSpecialRound = (year === 2022 || year === 2023) && round === 'P2';
    const playerIdentifierKey = isSpecialRound ? '选手用户名' : '选手码';
    
    const playerIdentifiers = [...new Set(data.map(row => row[playerIdentifierKey]))];
    let validSubmissions = 0;
    
    for (const playerIdentifier of playerIdentifiers) {
      if (!playerIdentifier) continue; // 跳过空值
      const playerData = data.filter(row => row[playerIdentifierKey] === playerIdentifier);
      if (playerData.length > 0) {
        validSubmissions++;
      }
    }
    
    const attendanceRate = totalPlayers > 0 ? new Decimal(validSubmissions).div(totalPlayers).times(100).toNumber() : 0;
    
    // 获取轮次的中文名称
    let roundChineseName = round;
    if (seasonData && seasonData[year.toString()]?.rounds) {
      const yearData = seasonData[year.toString()];
      let roundData = yearData.rounds[round];
      
      if (!roundData) {
        // 如果直接查找失败，尝试在数组格式键中查找
        for (const [roundKey, data] of Object.entries(yearData.rounds)) {
          if (roundKey.startsWith('[') && roundKey.endsWith(']')) {
            try {
              const parsedKey = JSON.parse(roundKey);
              if (Array.isArray(parsedKey) && parsedKey.includes(round)) {
                roundData = data;
                break;
              }
            } catch {
              // JSON解析失败，继续下一个
            }
          }
          
          if (roundKey.includes(',')) {
            const singleRounds = roundKey.split(',').map(r => r.trim());
            if (singleRounds.includes(round)) {
              roundData = data;
              break;
            }
          }
        }
      }
      
      roundChineseName = getRoundChineseName(round, { ...roundData, year: year.toString() });
    }
    
    attendanceData.push({
      year,
      round,
      roundChineseName,
      totalPlayers,
      validSubmissions,
      attendanceRate
    });
  }
  
  return attendanceData.filter(item => item.totalPlayers > 0);
}

/**
 * 判断哪个战绩更好（返回true表示result1更好）
 * 决赛成绩优先级：冠军 > 亚军 > 季军 > 4强 > 其他决赛成绩
 * 对于决赛外的其他阶段，仍按总积分排名优先
 */
function isBetterResult(result1: string, rank1: number, year1: number, result2: string, rank2: number, year2: number): boolean {
  const isResult1Final = result1.includes('决赛');
  const isResult2Final = result2.includes('决赛');
  
  // 如果两个都是决赛成绩，按决赛内部排名比较
  if (isResult1Final && isResult2Final) {
    const getFinalRank = (result: string): number => {
      if (result.includes('冠军')) return 1;
      if (result.includes('亚军')) return 2;
      if (result.includes('季军')) return 3;
      if (result.includes('4强')) return 4;
      return 999; // 其他决赛成绩排在最后
    };
    
    const finalRank1 = getFinalRank(result1);
    const finalRank2 = getFinalRank(result2);
    
    if (finalRank1 !== finalRank2) {
      return finalRank1 < finalRank2; // 决赛排名越小越好
    }
    
    // 决赛排名相同时，比较总积分排名
    if (rank1 !== rank2) {
      return rank1 < rank2;
    }
    
    // 都相同时选择更近的年份
    return year1 > year2;
  }
  
  // 如果只有一个是决赛成绩，决赛成绩更好
  if (isResult1Final && !isResult2Final) return true;
  if (!isResult1Final && isResult2Final) return false;
  
  // 如果都不是决赛成绩，按原有逻辑：总积分排名优先
  if (rank1 !== rank2) {
    return rank1 < rank2;
  }
  
  // 排名相同时选择更近的年份
  return year1 > year2;
}

/**
 * 计算选手在总分排行榜中的历届最佳排名（纯按总积分排名，不考虑决赛名次优先）
 */
async function calculateBestTotalPointsRankingByRank(): Promise<{ [unifiedUserId: string]: { rank: number; year: number; bestResult: string } }> {
  const bestRankings: { [unifiedUserId: string]: { rank: number; year: number; bestResult: string } } = {};
  const yamlData = await fetchMarioWorkerYaml();
  
  // 遍历所有年份（从2013年开始）
  const currentYear = new Date().getFullYear();
  for (let year = 2013; year <= currentYear; year++) {
    try {
      const totalPointsData = await loadTotalPointsData(year.toString(), yamlData);
      
      if (totalPointsData.hasData && totalPointsData.players.length > 0) {
        // 为每个选手计算其在该年度的排名
        for (let index = 0; index < totalPointsData.players.length; index++) {
          const player = totalPointsData.players[index];
          const ranking = index + 1; // 排名从1开始
          
          // 获取统一的用户标识符
          const unifiedUserId = await getUnifiedUserId(player.playerName);
          
          // 纯粹按总积分排名优先：排名越小越好，排名相同时选择更近的年份
          const shouldUpdate = !bestRankings[unifiedUserId] || 
            ranking < bestRankings[unifiedUserId].rank ||
            (ranking === bestRankings[unifiedUserId].rank && year > bestRankings[unifiedUserId].year);
          
          if (shouldUpdate) {
            bestRankings[unifiedUserId] = {
              rank: ranking,
              year: year,
              bestResult: player.bestResult
            };
          }
        }
      }
    } catch (error) {
      console.warn(`跳过年份 ${year}, 总分排行榜加载失败:`, error);
    }
  }
  
  return bestRankings;
}

/**
 * 计算选手在总分排行榜中的历届最佳排名及其对应的战绩信息
 */
async function calculateBestTotalPointsRanking(): Promise<{ [unifiedUserId: string]: { rank: number; year: number; bestResult: string } }> {
  const bestRankings: { [unifiedUserId: string]: { rank: number; year: number; bestResult: string } } = {};
  const yamlData = await fetchMarioWorkerYaml();
  
  // 遍历所有年份（从2013年开始）
  const currentYear = new Date().getFullYear();
  for (let year = 2013; year <= currentYear; year++) {
    try {
      const totalPointsData = await loadTotalPointsData(year.toString(), yamlData);
      
      if (totalPointsData.hasData && totalPointsData.players.length > 0) {
        // 为每个选手计算其在该年度的排名
        for (let index = 0; index < totalPointsData.players.length; index++) {
          const player = totalPointsData.players[index];
          const ranking = index + 1; // 排名从1开始
          
          // 获取统一的用户标识符
          const unifiedUserId = await getUnifiedUserId(player.playerName);
          
          // 判断是否应该更新最佳战绩
          const shouldUpdate = !bestRankings[unifiedUserId] || 
            isBetterResult(
              player.bestResult, ranking, year,
              bestRankings[unifiedUserId].bestResult, bestRankings[unifiedUserId].rank, bestRankings[unifiedUserId].year
            );
          
          if (shouldUpdate) {
            bestRankings[unifiedUserId] = {
              rank: ranking,
              year: year,
              bestResult: player.bestResult
            };
          }
        }
      }
    } catch (error) {
      console.warn(`跳过年份 ${year}, 总分排行榜加载失败:`, error);
    }
  }
  
  return bestRankings;
}
