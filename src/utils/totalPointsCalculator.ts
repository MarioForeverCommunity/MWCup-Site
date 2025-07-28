/**
 * 总分积分排行计算工具类
 * 计算每个选手在各轮次的累积总分，合并相同用户名
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { loadRoundScoreData } from './scoreCalculator';
import { Decimal } from 'decimal.js';

// 设置Decimal的精度和舍入模式
Decimal.set({ precision: 10, rounding: Decimal.ROUND_HALF_UP });

// 关卡文件接口
interface LevelFile {
  name: string;
  path: string;
  mtime: string;
  size: number;
  playerCode: string;
  year: number;
  roundType: string;
  playerName: string;
  roundKey: string;
  groupCode: string;
  hasPlayerInfo: boolean;
  isMultiLevel: boolean;
  multiLevelFolder: string | null;
}

// 加载关卡索引数据
export async function loadLevelIndexData(): Promise<LevelFile[]> {
  try {
    const response = await fetch('/data/levels/index.json');
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn('加载levels/index.json失败:', error);
  }
  return [];
}

// 获取指定年份和轮次的截止时间
export function getDeadlines(yamlData: any, year: string, roundKey: string): string[] {
  const seasonData = yamlData?.season?.[year];
  if (!seasonData) {
    return [];
  }
  
  // 查找轮次数据
  let roundData = seasonData.rounds?.[roundKey];
  
  // 如果直接找不到，检查是否在多轮次键中
  if (!roundData && seasonData.rounds) {
    for (const [key, data] of Object.entries(seasonData.rounds)) {
      // 检查方括号格式：[I1, I2, I3, I4]
      if (key.startsWith('[') && key.endsWith(']')) {
        const rounds = key.slice(1, -1).split(',').map(r => r.trim());
        if (rounds.includes(roundKey)) {
          roundData = data;
          break;
        }
      }
      // 检查逗号分隔格式：I1,I2,I3,I4
      else if (key.includes(',')) {
        const rounds = key.split(',').map(r => r.trim());
        if (rounds.includes(roundKey)) {
          roundData = data;
          break;
        }
      }
    }
  }
  
  if (!roundData) {
    return [];
  }
  
  // 获取截止时间
  
  if (roundData?.schedule?.match?.deadlines) {
    return roundData.schedule.match.deadlines;
  } else if (roundData?.schedule?.deadlines) {
    return roundData.schedule.deadlines;
  } else if (roundData?.deadlines) {
    return roundData.deadlines;
  }
  
  return [];
}

// 获取选手在指定年份的所有关卡上传记录
export function getPlayerLevels(levelFiles: LevelFile[], playerCode: string, year: number): LevelFile[] {
  return levelFiles.filter(file => 
    file.playerCode === playerCode && 
    file.year === year
  );
}

// 将GMT时间字符串转换为Date对象
function parseGMTTime(timeStr: string): Date {
  return new Date(timeStr);
}

// 检查关卡是否在截止时间前上传（包含1分钟冗余时间）
export function isLevelUploadedBeforeDeadline(level: LevelFile, deadline: string): boolean {
  const uploadTime = parseGMTTime(level.mtime);
  const deadlineTime = parseGMTTime(deadline);
  
  // 增加1分钟冗余时间（即允许在deadline后1分钟内上传）
  const deadlineWithTolerance = new Date(deadlineTime.getTime() + 60 * 1000);
  
  return uploadTime <= deadlineWithTolerance;
}

// 计算基于累计上传数量的超时扣分（用于2019-2021年）
function calculateCumulativeTimeoutPenalty(playerLevels: LevelFile[], deadlines: string[]): number {
  let totalPenalty = 0;
  
  // 对每个deadline检查累计上传数量
  for (let i = 0; i < deadlines.length; i++) {
    const deadline = deadlines[i];
    const expectedCount = i + 1; // 第N个deadline应该上传N关
    
    // 统计在该deadline前上传的关卡数量
    const uploadedCount = playerLevels.filter(level => 
      isLevelUploadedBeforeDeadline(level, deadline)
    ).length;
    
    // 计算扣分：每少上传一关，扣5分
    if (uploadedCount < expectedCount) {
      const shortage = expectedCount - uploadedCount;
      const penalty = shortage * 5;
      totalPenalty += penalty;
    }
  }
  
  return totalPenalty;
}

export interface PlayerTotalPoints {
  playerName: string;
  totalPoints: Decimal; // 改为Decimal类型
  participatedRounds: string[];
  validRoundsCount: number;
  bestResult: string;
  playerCodes: string[];
}

export interface TotalPointsData {
  year: string;
  players: PlayerTotalPoints[];
  availableRounds: string[];
  hasData: boolean;
}

/**
 * 加载某年度的总分积分排行数据
 */
export async function loadTotalPointsData(year: string, yamlData: any): Promise<TotalPointsData> {
  const seasonData = yamlData.season[year];
  if (!seasonData || !seasonData.rounds) {
    return {
      year,
      players: [],
      availableRounds: [],
      hasData: false
    };
  }

  // 获取所有轮次，排除P1、P2预选赛轮次
  const allRounds = extractRounds(seasonData.rounds);
  const availableRounds = allRounds.filter(round => !round.startsWith('P'));
  // 验证CSV文件存在性或特殊总分制评分
  const validRounds: string[] = [];
  for (const round of availableRounds) {
    try {
      // 首先检查是否为特殊的总分制评分（如2015年半决赛）
      let roundData = seasonData.rounds[round];
      
      // 如果直接找不到，检查是否在多轮次键中
      if (!roundData && seasonData.rounds) {
        for (const [key, data] of Object.entries(seasonData.rounds)) {
          // 检查方括号格式的多轮次键，如 [G1, G2, G3]
          if (key.startsWith('[') && key.endsWith(']')) {
            const rounds = key.slice(1, -1).split(',').map(r => r.trim());
            if (rounds.includes(round)) {
              roundData = data;
              break;
            }
          } else if (key.includes(',') && key.split(',').map(r => r.trim()).includes(round)) {
            // 处理逗号分隔的轮次键（如果存在）
            roundData = data;
            break;
          }
        }
      }
      
      if (roundData?.scoring_scheme === 'S' && roundData?.scores) {
        validRounds.push(round);
        continue;
      }
      
      // 检查CSV文件是否存在
      const response = await fetch(`/data/scores/${year}${round}.csv`);
      if (response.ok) {
        validRounds.push(round);
      }
    } catch (error) {
      // 继续处理其他轮次
    }
  }

  // 加载关卡索引数据用于特殊年份处理（暂时保留变量以备后续使用）
  const levelIndexData = await loadLevelIndexData();
  // 收集所有选手的各轮次数据，按选手名合并
  const playerDataByName: { [playerName: string]: {
    totalPoints: number;
    participatedRounds: string[];
    playerCodes: string[];
    roundScores: { [round: string]: any }; // 存储各轮次原始数据用于特殊计算
  } } = {};
  
  // 先收集所有轮次的原始数据
  for (const round of validRounds) {
    try {
      const roundData = await loadRoundScoreData(year, round, yamlData);
      
      // 收集该轮次的选手数据
      for (const playerScore of roundData.playerScores) {
        const playerName = playerScore.playerName;
        
        if (!playerDataByName[playerName]) {
          playerDataByName[playerName] = {
            totalPoints: 0,
            participatedRounds: [],
            playerCodes: [],
            roundScores: {}
          };
        }

        const player = playerDataByName[playerName];
        
        // 存储轮次数据
        player.roundScores[round] = playerScore;
        
        if (!player.participatedRounds.includes(round)) {
          player.participatedRounds.push(round);
        }
        if (!player.playerCodes.includes(playerScore.playerCode)) {
          player.playerCodes.push(playerScore.playerCode);
        }
      }} catch (error) {
      // 继续处理其他轮次
    }
  }
  
  // 处理特殊年份的0分选手（如2019年D4，2020年B4等）
  await addSpecialYearZeroScorePlayers(year, levelIndexData, yamlData, playerDataByName);
    // 计算每个选手的总积分（应用特殊年份规则）
  for (const [, playerData] of Object.entries(playerDataByName)) {
    const totalScore = await calculatePlayerTotalScore(year, playerData, yamlData);
    playerData.totalPoints = totalScore.toNumber();
  }

  // 处理决赛排名：为参加决赛的选手确定具体排名
  await calculateFinalRankings(year, yamlData, playerDataByName, validRounds);
  // 转换为数组并排序
  const players = Object.entries(playerDataByName)
    .filter(([_, data]) => {
      // 统一处理逻辑：只要有选手码，就表示该选手存在于某处配置中，应该显示在榜单中
      // 无论是2014-2019年的未上传小组赛作品选手，还是2020年之后的未上传初赛作品选手
      return data.playerCodes.length > 0;
    })
    .map(([playerName, data]) => ({
      playerName,
      totalPoints: new Decimal(Math.round(data.totalPoints * 10) / 10),
      participatedRounds: sortRounds(data.participatedRounds),
      validRoundsCount: data.participatedRounds.length,
      bestResult: calculateBestResult(data.participatedRounds, data.roundScores, yamlData, year, playerName),
      playerCodes: data.playerCodes
    }))
    .sort((a, b) => {
      // 按总分降序排序，总分相同时按参与轮次数降序
      const diff = b.totalPoints.comparedTo(a.totalPoints);
      if (diff === 0) {
        return b.validRoundsCount - a.validRoundsCount;
      }
      return diff;
    });

  return {
    year,
    players,
    availableRounds: validRounds,
    hasData: players.length > 0
  };
}

/**
 * 从轮次配置中提取所有轮次
 */
function extractRounds(roundsConfig: any): string[] {
  const rounds: string[] = [];
  
  for (const [key] of Object.entries(roundsConfig)) {
    if (key.startsWith('[') && key.endsWith(']')) {
      // 处理方括号格式的多轮次键，如 [G1, G2, G3]
      try {
        const roundList = JSON.parse(key);
        if (Array.isArray(roundList)) {
          rounds.push(...roundList);
        }
      } catch {
        // 如果JSON解析失败，尝试手动解析
        const roundList = key.slice(1, -1).split(',').map(r => r.trim());
        rounds.push(...roundList);
      }
    } else if (key.includes(',')) {
      // 处理逗号分隔的轮次键
      const roundList = key.split(',').map(r => r.trim());
      rounds.push(...roundList);
    } else {
      // 单个轮次
      rounds.push(key);
    }
  }
  
  // 去重并按轮次顺序排序
  const uniqueRounds = [...new Set(rounds)];
  return sortRounds(uniqueRounds);
}

/**
 * 按轮次的逻辑顺序排序
 */
function sortRounds(rounds: string[]): string[] {
  // 定义轮次优先级
  const roundPriority = {
    'P1': 1, 'P2': 2, // 预选赛、资格赛
    'G1': 3, 'G2': 4, 'G3': 5, 'G4': 6, // 小组赛
    'I1': 3, 'I2': 4, 'I3': 5, 'I4': 6, // 初赛
    'Q': 7, 'Q1': 7, 'Q2': 8, // 四分之一决赛
    'R': 7, 'R1': 7, 'R2': 8, 'R3': 9, // 复赛
    'S': 9, 'S1': 9, 'S2': 10, // 半决赛
    'F': 11 // 决赛
  };

  return rounds.sort((a, b) => {
    const priorityA = roundPriority[a as keyof typeof roundPriority] || 999;
    const priorityB = roundPriority[b as keyof typeof roundPriority] || 999;
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // 如果优先级相同，按字符串排序
    return a.localeCompare(b);
  });
}

/**
 * 从YAML数据中获取选手真正晋级的最高阶段
 * 这会考虑选手在YAML中出现但没有评分数据的轮次
 */
function getRealBestStageFromYaml(yamlData: any, year: string, playerName: string): string | null {
  const seasonData = yamlData.season?.[year];
  if (!seasonData?.rounds) return null;
  
  // 定义轮次优先级（从高到低）
  const stageInfo = [
    { rounds: ['F'], stageName: '决赛' },
    { rounds: ['S', 'S1', 'S2'], stageName: '半决赛' },
    { rounds: ['R', 'R1', 'R2', 'R3'], stageName: '复赛' },
    { rounds: ['Q', 'Q1', 'Q2'], stageName: '四分之一决赛' },
    { rounds: ['G1', 'G2', 'G3', 'G4'], stageName: '小组赛' },
    { rounds: ['I1', 'I2', 'I3', 'I4'], stageName: '初赛' }
  ];
  
  // 从最高阶段开始检查
  for (const stage of stageInfo) {
    for (const roundKey of stage.rounds) {
      if (isPlayerInYamlRound(seasonData, roundKey, playerName)) {
        return stage.stageName;
      }
    }
  }
  
  return null;
}

/**
 * 检查选手是否在YAML的指定轮次中出现
 */
function isPlayerInYamlRound(seasonData: any, roundKey: string, playerName: string): boolean {
  // 首先尝试直接查找轮次
  let roundData = seasonData.rounds[roundKey];
  
  // 如果没有找到，检查多轮次键
  if (!roundData) {
    for (const [key, data] of Object.entries(seasonData.rounds)) {
      // 检查方括号格式的多轮次键，如 [G1, G2, G3, G4]
      if (key.startsWith('[') && key.endsWith(']')) {
        try {
          const parsedKey = JSON.parse(key);
          if (Array.isArray(parsedKey) && parsedKey.includes(roundKey)) {
            roundData = data;
            break;
          }
        } catch {
          // JSON解析失败，尝试手动解析
          const rounds = key.slice(1, -1).split(',').map(r => r.trim());
          if (rounds.includes(roundKey)) {
            roundData = data;
            break;
          }
        }
      } else if (key.includes(',')) {
        // 处理逗号分隔的轮次键
        const rounds = key.split(',').map(r => r.trim());
        if (rounds.includes(roundKey)) {
          roundData = data;
          break;
        }
      }
    }
  }
  
  if (!roundData?.players) return false;
  
  // 检查选手是否在该轮次的players中
  if (Array.isArray(roundData.players)) {
    return roundData.players.includes(playerName);
  } else if (typeof roundData.players === 'object') {
    // 检查是否为分组结构或扁平结构
    const firstValue = Object.values(roundData.players)[0];
    if (typeof firstValue === 'string') {
      // 扁平结构：players: { '1': 用户名, '2': 用户名, ... }
      return Object.values(roundData.players).includes(playerName);
    } else {
      // 分组结构：players: { A: { A1: 用户名, ... }, ... }
      for (const groupData of Object.values(roundData.players)) {
        if (typeof groupData === 'object' && groupData) {
          if (Object.values(groupData).includes(playerName)) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

/**
 * 根据参与轮次计算最好成绩
 * 优先使用YAML中的晋级信息，如果没有则使用实际参与轮次
 */
function calculateBestResult(participatedRounds: string[], roundScores?: { [round: string]: any }, yamlData?: any, year?: string, playerName?: string): string {
  // 如果提供了YAML数据，尝试从中获取选手的真实晋级情况
  if (yamlData && year && playerName) {
    const realBestStage = getRealBestStageFromYaml(yamlData, year, playerName);
    if (realBestStage) {
      // 如果是决赛，尝试获取具体排名
      if (realBestStage === '决赛' && roundScores && roundScores['F']) {
        const finalRoundData = roundScores['F'];
        if (finalRoundData.rank !== undefined) {
          const rank = finalRoundData.rank;
          if (rank === 1) return '决赛/冠军';
          if (rank === 2) return '决赛/亚军';
          if (rank === 3) return '决赛/季军';
          if (rank === 4) return '决赛/4强';
        }
        if (finalRoundData.ranking !== undefined) {
          const rank = finalRoundData.ranking;
          if (rank === 1) return '决赛/冠军';
          if (rank === 2) return '决赛/亚军';
          if (rank === 3) return '决赛/季军';
          if (rank === 4) return '决赛/4强';
        }
      }
      return realBestStage;
    }
  }
  
  // 如果没有参与任何轮次，返回特殊标识
  if (participatedRounds.length === 0) {
    return '仅报名'; // 将在formatResultDisplay中替换为小组赛/XX强或初赛/XX强
  }
  
  // 按轮次重要性判断最好成绩
  if (participatedRounds.includes('F')) {
    // 如果参加了决赛，需要根据排名判断具体成绩
    if (roundScores && roundScores['F']) {
      // 尝试从roundScores中获取排名信息
      const finalRoundData = roundScores['F'];
      
      // 如果有具体的排名数据
      if (finalRoundData.rank !== undefined) {
        const rank = finalRoundData.rank;
        if (rank === 1) return '决赛/冠军';
        if (rank === 2) return '决赛/亚军';
        if (rank === 3) return '决赛/季军';
        if (rank === 4) return '决赛/4强';
        return `决赛/第${rank}名`;
      }
      
      // 如果有ranking字段
      if (finalRoundData.ranking !== undefined) {
        const rank = finalRoundData.ranking;
        if (rank === 1) return '决赛/冠军';
        if (rank === 2) return '决赛/亚军';
        if (rank === 3) return '决赛/季军';
        if (rank === 4) return '决赛/4强';
        return `决赛/第${rank}名`;
      }
      
      // 如果没有具体排名，但有分数，可以尝试通过分数推断
      // 这里暂时返回决赛，后续可以通过其他方式改进
    }
    return '决赛';
  } else if (participatedRounds.some(r => r.startsWith('S'))) {
    return '半决赛';
  } else if (participatedRounds.includes('R') || participatedRounds.some(r => r.startsWith('R'))) {
    return '复赛';
  } else if (participatedRounds.some(r => r.startsWith('Q'))) {
    return '四分之一决赛';
  } else if (participatedRounds.some(r => r.startsWith('G'))) {
    return '小组赛';
  } else if (participatedRounds.some(r => r.startsWith('I'))) {
    return '初赛';
  }
  
  return '参赛';
}
/**
 * 计算选手的总积分（应用特殊年份规则）
 */
async function calculatePlayerTotalScore(year: string, playerData: any, yamlData: any): Promise<Decimal> {
  let totalScore: Decimal;
  
  // 特殊年份需要特殊处理
  if (year === '2019') {
    // 2019年小组赛：4关取最高3关计算总分
    totalScore = await calculate2019TotalScore(playerData, yamlData);
  } else if (['2020', '2021'].includes(year)) {
    // 2020-2021年初赛：有效关卡制，有扣分
    totalScore = await calculateValidLevelTotalScore(year, playerData, yamlData, true);
  } else if (['2022', '2023', '2024', '2025'].includes(year)) {
    // 2022年之后初赛：有效关卡制，无扣分
    totalScore = await calculateValidLevelTotalScore(year, playerData, yamlData, false);
  } else {
    // 普通年份：累加所有轮次分数
    totalScore = calculateNormalTotalScore(playerData);
  }
  
  return totalScore;
}

/**
 * 2019年总分计算：小组赛4关取最高3关，应用截止时间扣分规则
 */
export async function calculate2019TotalScore(playerData: any, yamlData: any): Promise<Decimal> {
  let totalScore = new Decimal(0);
  const playerCode = playerData.playerCodes[0];
  const groupRounds = ['G1', 'G2', 'G3', 'G4'];
  
  // 加载关卡数据
  const levelFiles = await loadLevelIndexData();
  const playerLevels = getPlayerLevels(levelFiles, playerCode, 2019);
  
  // 获取小组赛截止时间
  const deadlines = getDeadlines(yamlData, '2019', 'G1'); // 2019年小组赛统一截止时间
  
  // 收集所有小组赛轮次的分数
  const allGroupScores: Decimal[] = [];
  for (const round of groupRounds) {
    if (playerData.roundScores[round] && playerData.roundScores[round].averageScore > 0) {
      allGroupScores.push(new Decimal(playerData.roundScores[round].averageScore));
    }
  }
  
  // 计算截止时间扣分
  let timeoutPenalty = 0;
  if (deadlines.length >= 3) {
    // 检查每个截止时间前的上传情况
    for (let i = 0; i < 3; i++) {
      const deadline = deadlines[i];
      const requiredLevels = i + 1; // 第i+1个截止时间前需要i+1个关卡
      
      const levelsBeforeDeadline = playerLevels.filter(level => 
        groupRounds.includes(level.roundKey) && 
        isLevelUploadedBeforeDeadline(level, deadline)
      ).length;
      
      if (levelsBeforeDeadline < requiredLevels) {
        timeoutPenalty += (requiredLevels - levelsBeforeDeadline) * 5;
      }
    }
  }
  
  if (allGroupScores.length >= 3) {
    allGroupScores.sort((a, b) => b.comparedTo(a)); // 降序排序
    const bestThreeSum = allGroupScores[0].plus(allGroupScores[1]).plus(allGroupScores[2]);
    const afterPenalty = bestThreeSum.minus(timeoutPenalty);
    totalScore = afterPenalty.isNegative() ? new Decimal(0) : afterPenalty;
  } else if (allGroupScores.length > 0) {
    const allScoresSum = allGroupScores.reduce((a, b) => a.plus(b), new Decimal(0));
    const afterPenalty = allScoresSum.minus(timeoutPenalty);
    totalScore = afterPenalty.isNegative() ? new Decimal(0) : afterPenalty;
  } else {
    totalScore = new Decimal(0);
  }
  
  // 其他轮次正常累加
  for (const round of playerData.participatedRounds) {
    if (!groupRounds.includes(round) && playerData.roundScores[round]) {
      const roundScore = new Decimal(playerData.roundScores[round].averageScore || 0);
      totalScore = totalScore.plus(roundScore);
    }
  }
  
  return totalScore;
}


/**
 * 有效关卡制总分计算（2020年之后的初赛）- 重构版本，不依赖validLevel.json
 */
export async function calculateValidLevelTotalScore(year: string, playerData: any, yamlData: any, penaltyForMissing: boolean = true): Promise<Decimal> {
  let preliminaryScore = new Decimal(0);
  let otherRoundsScore = new Decimal(0);
  const prelimRoundIds = ['I1', 'I2', 'I3', 'I4'];
  const playerCode = playerData.playerCodes[0];
  const yearNum = parseInt(year);

  // 加载关卡数据
  const levelFiles = await loadLevelIndexData();
  const playerLevels = getPlayerLevels(levelFiles, playerCode, yearNum);
  
  // 获取初赛截止时间
  const deadlines = getDeadlines(yamlData, year, 'I1');
  
  if (yearNum === 2020) {
    // 2020年：3道题选2道，2个截止时间
    preliminaryScore = await calculate2020PreliminaryScore(playerData, playerLevels, deadlines, penaltyForMissing);
    // 应用累计上传数量超时扣分
    const timeoutPenalty = calculateCumulativeTimeoutPenalty(playerLevels, deadlines);
    preliminaryScore = preliminaryScore.minus(timeoutPenalty);
    // 确保总分不为负数
    if (preliminaryScore.isNegative()) {
      preliminaryScore = new Decimal(0);
    }
  } else if (yearNum === 2021) {
    // 2021年：4道题选3道，3个截止时间，复杂选择规则
    preliminaryScore = await calculate2021PreliminaryScore(playerData, playerLevels, deadlines, penaltyForMissing);
    // 应用累计上传数量超时扣分
    const timeoutPenalty = calculateCumulativeTimeoutPenalty(playerLevels, deadlines);
    preliminaryScore = preliminaryScore.minus(timeoutPenalty);
    // 确保总分不为负数
    if (preliminaryScore.isNegative()) {
      preliminaryScore = new Decimal(0);
    }
  } else if (yearNum >= 2022) {
    // 2022年之后：3道题选2道，2个截止时间，简单选择规则（无超时扣分）
    preliminaryScore = await calculate2022OnwardsPreliminaryScore(playerData, playerLevels, deadlines);
  } else {
    // 其他年份按普通方式计算
    return calculateNormalTotalScore(playerData);
  }

  // 计算其他非初赛轮次的得分
  for (const round of playerData.participatedRounds) {
    if (!prelimRoundIds.includes(round) && playerData.roundScores[round]) {
      const score = new Decimal(playerData.roundScores[round].averageScore || 0);
      otherRoundsScore = otherRoundsScore.plus(score);
    }
  }

  return preliminaryScore.plus(otherRoundsScore);
}

/**
 * 2020年初赛计算：3道题选2道，2个截止时间
 */
async function calculate2020PreliminaryScore(playerData: any, playerLevels: LevelFile[], deadlines: string[], _penaltyForMissing: boolean): Promise<Decimal> {
  const prelimRounds = ['I1', 'I2', 'I3'];
  
  // 获取所有初赛关卡得分
  const levelScores: { roundKey: string; score: Decimal; level: LevelFile }[] = [];
  for (const round of prelimRounds) {
    if (playerData.roundScores[round] && playerData.roundScores[round].averageScore > 0) {
      const level = playerLevels.find(l => l.roundKey === round);
      if (level) {
        levelScores.push({
          roundKey: round,
          score: new Decimal(playerData.roundScores[round].averageScore),
          level
        });
      }
    }
  }
  
  if (levelScores.length === 0) {
    return new Decimal(0);
  }
  
  // 2020年规则：第一条截止线前至少上传一关，第二条截止线前至少上传两关
  let selectedLevels: { roundKey: string; score: Decimal }[] = [];
  let penalty = 0;
  
  if (deadlines.length >= 2) {
    // 第一关：截止线1前得分最高的关卡
    const levelsBeforeDeadline1 = levelScores.filter(ls => 
      isLevelUploadedBeforeDeadline(ls.level, deadlines[0])
    );
    
    if (levelsBeforeDeadline1.length > 0) {
      levelsBeforeDeadline1.sort((a, b) => b.score.comparedTo(a.score));
      selectedLevels.push({ roundKey: levelsBeforeDeadline1[0].roundKey, score: levelsBeforeDeadline1[0].score });
    }
    // 注意：不再在这里扣分，扣分统一由累计上传数量机制处理
    
    // 第二关：除第一关外，截止线2前得分最高的关卡
    const remainingLevels = levelScores.filter(ls => 
      !selectedLevels.some(sl => sl.roundKey === ls.roundKey) &&
      isLevelUploadedBeforeDeadline(ls.level, deadlines[1])
    );
    
    if (remainingLevels.length > 0) {
      remainingLevels.sort((a, b) => b.score.comparedTo(a.score));
      selectedLevels.push({ roundKey: remainingLevels[0].roundKey, score: remainingLevels[0].score });
    }
    // 注意：不再在这里扣分，扣分统一由累计上传数量机制处理
  }
  
  // 如果选择的关卡不足2个，从剩余关卡中补充
  if (selectedLevels.length < 2) {
    const remainingLevels = levelScores.filter(ls => 
      !selectedLevels.some(sl => sl.roundKey === ls.roundKey)
    );
    remainingLevels.sort((a, b) => b.score.comparedTo(a.score));
    
    for (const level of remainingLevels) {
      if (selectedLevels.length >= 2) break;
      selectedLevels.push({ roundKey: level.roundKey, score: level.score });
    }
  }
  
  const totalScore = selectedLevels.reduce((sum, level) => sum.plus(level.score), new Decimal(0));
  const afterPenalty = totalScore.minus(penalty);
  return afterPenalty.isNegative() ? new Decimal(0) : afterPenalty;
}

/**
 * 2021年初赛计算：4道题选3道，3个截止时间，复杂选择规则
 */
async function calculate2021PreliminaryScore(playerData: any, playerLevels: LevelFile[], deadlines: string[], _penaltyForMissing: boolean): Promise<Decimal> {
  const prelimRounds = ['I1', 'I2', 'I3', 'I4'];
  
  // 获取所有初赛关卡得分
  const levelScores: { roundKey: string; score: Decimal; level: LevelFile }[] = [];
  for (const round of prelimRounds) {
    if (playerData.roundScores[round] && playerData.roundScores[round].averageScore > 0) {
      const level = playerLevels.find(l => l.roundKey === round);
      if (level) {
        levelScores.push({
          roundKey: round,
          score: new Decimal(playerData.roundScores[round].averageScore),
          level
        });
      }
    }
  }
  
  if (levelScores.length === 0) {
    return new Decimal(0);
  }
  
  // 2021年复杂选择规则
  let selectedLevels: { roundKey: string; score: Decimal }[] = [];
  let penalty = 0;
  
  if (deadlines.length >= 3) {
    // 按截止时间逐个选择关卡
    for (let i = 0; i < 3; i++) {
      const deadline = deadlines[i];
      
      // 选取该轮截止前未被选取的得分最高的关卡
      let availableLevels = levelScores.filter(ls => 
        !selectedLevels.some(sl => sl.roundKey === ls.roundKey) &&
        isLevelUploadedBeforeDeadline(ls.level, deadline)
      );
      
      if (availableLevels.length > 0) {
        availableLevels.sort((a, b) => b.score.comparedTo(a.score));
        selectedLevels.push({ roundKey: availableLevels[0].roundKey, score: availableLevels[0].score });
      } else {
        // 不存在符合要求的关卡，选取下一轮截止线前未被选取的得分最高的关卡，并扣5分
        if (i < 2) { // 还有下一轮
          const nextDeadline = deadlines[i + 1];
          availableLevels = levelScores.filter(ls => 
            !selectedLevels.some(sl => sl.roundKey === ls.roundKey) &&
            isLevelUploadedBeforeDeadline(ls.level, nextDeadline)
          );
          
          if (availableLevels.length > 0) {
            availableLevels.sort((a, b) => b.score.comparedTo(a.score));
            selectedLevels.push({ roundKey: availableLevels[0].roundKey, score: availableLevels[0].score });
          }
          // 注意：不再在这里扣分，扣分统一由累计上传数量机制处理
        }
      }
    }
  }
  
  // 如果选择的关卡不足3个，从剩余关卡中补充
  if (selectedLevels.length < 3) {
    const remainingLevels = levelScores.filter(ls => 
      !selectedLevels.some(sl => sl.roundKey === ls.roundKey)
    );
    remainingLevels.sort((a, b) => b.score.comparedTo(a.score));
    
    for (const level of remainingLevels) {
      if (selectedLevels.length >= 3) break;
      selectedLevels.push({ roundKey: level.roundKey, score: level.score });
    }
  }
  
  const totalScore = selectedLevels.reduce((sum, level) => sum.plus(level.score), new Decimal(0));
  const afterPenalty = totalScore.minus(penalty);
  return afterPenalty.isNegative() ? new Decimal(0) : afterPenalty;
}

/**
 * 2022年之后初赛计算：3道题选2道，2个截止时间，简单选择规则
 */
async function calculate2022OnwardsPreliminaryScore(playerData: any, playerLevels: LevelFile[], deadlines: string[]): Promise<Decimal> {
  const prelimRounds = ['I1', 'I2', 'I3'];
  
  // 获取所有初赛关卡得分
  const levelScores: { roundKey: string; score: Decimal; level: LevelFile }[] = [];
  for (const round of prelimRounds) {
    if (playerData.roundScores[round] && playerData.roundScores[round].averageScore > 0) {
      const level = playerLevels.find(l => l.roundKey === round);
      if (level) {
        levelScores.push({
          roundKey: round,
          score: new Decimal(playerData.roundScores[round].averageScore),
          level
        });
      }
    }
  }
  
  if (levelScores.length === 0) {
    return new Decimal(0);
  }
  
  // 2022年之后简单规则
  let selectedLevels: { roundKey: string; score: Decimal }[] = [];
  
  if (deadlines.length >= 2) {
    // 第一关：第一轮截止前得分最高的关卡
    const levelsBeforeDeadline1 = levelScores.filter(ls => 
      isLevelUploadedBeforeDeadline(ls.level, deadlines[0])
    );
    
    if (levelsBeforeDeadline1.length > 0) {
      levelsBeforeDeadline1.sort((a, b) => b.score.comparedTo(a.score));
      selectedLevels.push({ roundKey: levelsBeforeDeadline1[0].roundKey, score: levelsBeforeDeadline1[0].score });
    }
    
    // 第二关：未被第一轮选取的关卡中得分最高的关卡
    const remainingLevels = levelScores.filter(ls => 
      !selectedLevels.some(sl => sl.roundKey === ls.roundKey)
    );
    
    if (remainingLevels.length > 0) {
      remainingLevels.sort((a, b) => b.score.comparedTo(a.score));
      selectedLevels.push({ roundKey: remainingLevels[0].roundKey, score: remainingLevels[0].score });
    }
  } else {
    // 没有截止时间信息，选择得分最高的2个关卡
    levelScores.sort((a, b) => b.score.comparedTo(a.score));
    selectedLevels = levelScores.slice(0, 2).map(ls => ({ roundKey: ls.roundKey, score: ls.score }));
  }
  
  return selectedLevels.reduce((sum, level) => sum.plus(level.score), new Decimal(0));
}

/**
 * 普通年份总分计算：累加所有轮次
 */
function calculateNormalTotalScore(playerData: any): Decimal {
  let totalScore = new Decimal(0);
  
  for (const round of playerData.participatedRounds) {
    if (playerData.roundScores[round]) {
      const roundScore = new Decimal(playerData.roundScores[round].averageScore || 0);
      totalScore = totalScore.plus(roundScore);
    }
  }
  
  return totalScore;
}

/**
 * 处理特殊年份的0分选手（如2019年D4，2020年B4等）
 */
async function addSpecialYearZeroScorePlayers(year: string, levelIndexData: LevelFile[], yamlData: any, playerDataByName: { [playerName: string]: any }) {
  const seasonData = yamlData.season[year];
  if (!seasonData?.rounds) return;
  // 2014、2018、2019年：处理小组赛未上传任何关卡的选手
  if (['2014', '2018', '2019'].includes(year)) {
    let groupRoundKey: string | undefined;
    
    // 查找小组赛配置键（不同年份可能格式不同）
    if (seasonData.rounds['[G1, G2, G3, G4]']) {
      groupRoundKey = '[G1, G2, G3, G4]';
    } else if (seasonData.rounds['[G1, G2, G3]']) {
      groupRoundKey = '[G1, G2, G3]';
    } else {
      // 查找其他可能的格式
      const possibleKeys = Object.keys(seasonData.rounds).filter(key => 
        key.includes('G1') && key.includes('G2')
      );
      if (possibleKeys.length > 0) {
        groupRoundKey = possibleKeys[0];
      }
    }
    
    if (groupRoundKey && seasonData.rounds[groupRoundKey]?.players) {
      const groupPlayers = seasonData.rounds[groupRoundKey].players;
      
      // 遍历所有组
      Object.entries(groupPlayers).forEach(([_, players]) => {
        // 遍历该组的所有选手
        Object.entries(players as { [key: string]: string }).forEach(([playerCode, playerName]) => {
          // 检查该选手是否已经在数据中
          if (!playerDataByName[playerName]) {
            // 创建特殊标记的选手数据
            playerDataByName[playerName] = {
              totalPoints: 0,
              participatedRounds: [], // 修改：不再添加轮次，显示为0轮参赛
              playerCodes: [playerCode],
              roundScores: {}
            };
          }
        });
      });
    }
  }
  // 2020年之后：处理初赛未上传任何关卡的选手
  if (parseInt(year) >= 2020) {
    let prelimRoundKey: string | undefined;
    
    // 查找初赛配置键（不同年份可能格式不同）
    const prelimKeys = ['[I1, I2, I3, I4]', '[I1, I2, I3]', 'I1,I2,I3,I4', 'I1,I2,I3'];
    for (const key of prelimKeys) {
      if (seasonData.rounds[key]) {
        prelimRoundKey = key;
        break;
      }
    }
    
    // 如果没有找到，查找其他可能的格式
    if (!prelimRoundKey) {
      const possibleKeys = Object.keys(seasonData.rounds).filter(key => 
        key.includes('I1') && key.includes('I2')
      );
      if (possibleKeys.length > 0) {
        prelimRoundKey = possibleKeys[0];
      }
    }
    
    if (prelimRoundKey && seasonData.rounds[prelimRoundKey]?.players) {
      const prelimPlayers = seasonData.rounds[prelimRoundKey].players;
      
      // 遍历所有组
      Object.entries(prelimPlayers).forEach(([_, players]) => {
        // 遍历该组的所有选手
        Object.entries(players as { [key: string]: string }).forEach(([playerCode, playerName]) => {
          // 检查该选手是否已经在数据中
          if (!playerDataByName[playerName]) {
            // 检查该选手是否在levelIndexData中有任何初赛关卡上传记录
            const yearNum = parseInt(year);
            const playerLevels = levelIndexData.filter(level => 
              level.playerCode === playerCode && 
              level.year === yearNum &&
              ['I1', 'I2', 'I3', 'I4'].includes(level.roundKey)
            );
            
            // 如果没有任何初赛关卡上传记录，则添加为0分选手
            if (playerLevels.length === 0) {
              playerDataByName[playerName] = {
                totalPoints: 0,
                participatedRounds: [], // 不添加轮次，显示为0轮参赛
                playerCodes: [playerCode],
                roundScores: {}
              };
            }
          }
        });
      });
    }
  }
}

/**
 * 计算决赛排名：为参加决赛的选手确定具体排名
 * 参考ChampionStatistics.vue中的排名逻辑
 */
async function calculateFinalRankings(year: string, yamlData: any, playerDataByName: { [playerName: string]: any }, validRounds: string[]) {
  // 只有决赛轮次存在时才处理
  if (!validRounds.includes('F')) {
    return;
  }

  try {
    // 加载决赛评分数据
    const scoreData = await loadRoundScoreData(year, 'F', yamlData);
    if (scoreData?.playerScores?.length > 0) {
      // 按平均分排序，兼容Decimal类型
      const sortedPlayers = [...scoreData.playerScores].sort(
        (a, b) => Number(b.averageScore ?? 0) - Number(a.averageScore ?? 0)
      );
      
      // 为每个决赛选手分配排名
      sortedPlayers.forEach((playerScore, index) => {
        const playerName = playerScore.playerName;
        if (playerDataByName[playerName] && playerDataByName[playerName].roundScores['F']) {
          // 在roundScores中添加排名信息
          playerDataByName[playerName].roundScores['F'].rank = index + 1;
        }
      });

      // 处理YAML中存在但评分数据中缺失的决赛选手（未上传作品的选手）
      const seasonData = yamlData.season[year];
      const finalRound = seasonData?.rounds?.F;
      if (finalRound?.players) {
        const allFinalists: string[] = [];
        
        // 收集所有从YAML获取的决赛选手
        if (finalRound.players.M) allFinalists.push(finalRound.players.M);
        if (finalRound.players.W) allFinalists.push(finalRound.players.W);
        if (finalRound.players.S) allFinalists.push(finalRound.players.S);
        if (finalRound.players.P) allFinalists.push(finalRound.players.P);
        
        // 找出在YAML中存在但在评分数据中不存在的选手（未上传作品的选手）
        const scoredFinalists = sortedPlayers.map(p => p.playerName);
        const missingFinalists = allFinalists.filter(name => !scoredFinalists.includes(name));
        
        // 为缺失的决赛选手分配排名（排在有成绩选手之后）
        missingFinalists.forEach((playerName, index) => {
          if (playerDataByName[playerName]) {
            // 如果该选手没有决赛轮次记录，创建一个
            if (!playerDataByName[playerName].roundScores['F']) {
              playerDataByName[playerName].roundScores['F'] = {
                playerName,
                playerCode: playerDataByName[playerName].playerCodes[0],
                averageScore: 0,
                records: []
              };
              // 确保该选手的参与轮次包含决赛
              if (!playerDataByName[playerName].participatedRounds.includes('F')) {
                playerDataByName[playerName].participatedRounds.push('F');
              }
            }
            // 分配排名（在有成绩选手之后）
            playerDataByName[playerName].roundScores['F'].rank = sortedPlayers.length + index + 1;
          }
        });
      }
    }
  } catch (error) {
    // 忽略决赛排名计算错误
  }
}

// ===================== Helper functions for UI =====================

/**
 * 计算并返回2019小组赛选中关卡和超时罚分
 */
export async function get2019ValidLevelInfo(playerData: any, yamlData: any): Promise<{ 
  validRounds: string[]; 
  timeoutPenalty: number;
  roundSelections: { roundIndex: number; selectedTopic: string; isTimeout: boolean }[];
  deadlineCount: number;
}> {
  const groupRounds = ['G1', 'G2', 'G3', 'G4'];
  const deadlines = getDeadlines(yamlData, '2019', 'G1');
  const levelFiles = await loadLevelIndexData();
  const playerCode = playerData.playerCodes?.[0] || '';
  const playerLevels = getPlayerLevels(levelFiles, playerCode, 2019);

  const roundScoreEntries: { roundKey: string; score: Decimal; level: LevelFile }[] = [];
  for (const round of groupRounds) {
    if (playerData.roundScores?.[round]?.averageScore > 0) {
      const lv = playerLevels.find(l => l.roundKey === round);
      if (lv) {
        roundScoreEntries.push({ roundKey: round, score: new Decimal(playerData.roundScores[round].averageScore), level: lv });
      }
    }
  }
  // 即使没有上传关卡，也要计算超时扣分
  let penalty = 0;
  if (deadlines.length > 0) {
    penalty = calculateCumulativeTimeoutPenalty(playerLevels, deadlines);
  }
  
  if (roundScoreEntries.length === 0) {
    // 为没有上传关卡的选手生成空的轮次选择信息
    const roundSelections = Array.from({ length: deadlines.length }, (_, i) => ({
      roundIndex: i,
      selectedTopic: '未上传',
      isTimeout: true
    }));
    
    return { 
      validRounds: [], 
      timeoutPenalty: penalty,
      roundSelections,
      deadlineCount: deadlines.length
    };
  }

  roundScoreEntries.sort((a, b) => b.score.comparedTo(a.score));
  const selected = roundScoreEntries.slice(0, 3);

  // penalty 变量已在上面声明和计算
  
  // 生成轮次选择信息（简化处理）
  const roundSelections = Array.from({ length: deadlines.length }, (_, i) => {
    const selectedInThisRound = selected[i];
    if (selectedInThisRound) {
      const topicNumber = selectedInThisRound.roundKey.replace(/[^0-9]/g, '');
      const chineseNumbers = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
      const chineseTopic = chineseNumbers[parseInt(topicNumber)] || topicNumber;
      return {
        roundIndex: i,
        selectedTopic: `第${chineseTopic}题`,
        isTimeout: false // 简化处理
      };
    } else {
      return {
        roundIndex: i,
        selectedTopic: '未上传',
        isTimeout: true
      };
    }
  });
  
  return { 
    validRounds: selected.map(s => s.roundKey), 
    timeoutPenalty: penalty,
    roundSelections,
    deadlineCount: deadlines.length
  };
}

/**
 * 计算并返回初赛选中关卡和超时罚分
 * 返回详细的轮次选择信息，支持正确的有效题目列显示
 */
export async function getPreliminaryValidInfo(year: string, playerData: any, yamlData: any): Promise<{ 
  validRounds: string[]; 
  timeoutPenalty: number;
  roundSelections: { roundIndex: number; selectedTopic: string; isTimeout: boolean }[];
  deadlineCount: number;
}> {
  const yearNum = parseInt(year);
  const prelimRounds = yearNum === 2021 ? ['I1', 'I2', 'I3', 'I4'] : ['I1', 'I2', 'I3'];
  const deadlines = getDeadlines(yamlData, year, 'I1');
  const levelFiles = await loadLevelIndexData();
  const playerCode = playerData.playerCodes?.[0] || '';
  const playerLevels = getPlayerLevels(levelFiles, playerCode, yearNum);
  const levelScores: { roundKey: string; score: Decimal; level: LevelFile }[] = [];
  for (const round of prelimRounds) {
    if (playerData.roundScores?.[round]?.averageScore > 0) {
      const lv = playerLevels.find(l => l.roundKey === round);
      if (lv) levelScores.push({ roundKey: round, score: new Decimal(playerData.roundScores[round].averageScore), level: lv });
    }
  }
  // 即使没有上传关卡，也要计算超时扣分
  let penalty = 0;
  if (yearNum === 2020 || yearNum === 2021) {
    penalty = calculateCumulativeTimeoutPenalty(playerLevels, deadlines);
  }
  
  if (levelScores.length === 0) {
    // 为没有上传关卡的选手生成空的轮次选择信息
    const roundSelections = Array.from({ length: deadlines.length }, (_, i) => ({
      roundIndex: i,
      selectedTopic: '未上传',
      isTimeout: true
    }));
    
    return { 
      validRounds: [], 
      timeoutPenalty: penalty, 
      roundSelections, 
      deadlineCount: deadlines.length 
    };
  }

  const selectCount = yearNum === 2021 ? 3 : 2;
  const selected: { roundKey: string; score: Decimal; level: LevelFile }[] = [];

  // penalty 变量已在上面声明和计算

  if (deadlines.length >= 2) {
    
    // 第一截止线
    const before1 = levelScores.filter(ls => {
      const isBeforeDeadline = isLevelUploadedBeforeDeadline(ls.level, deadlines[0]);
      return isBeforeDeadline;
    });
    
    if (before1.length) {
      before1.sort((a, b) => b.score.comparedTo(a.score));
      selected.push(before1[0]);
    }

    if (selectCount > 1) {
      if (yearNum === 2021) {
        // 2021年规则：第二轮选择第二个deadline前剩余关卡中得分最高的
        const before2 = levelScores.filter(ls => {
          const isBeforeDeadline = isLevelUploadedBeforeDeadline(ls.level, deadlines[1]);
          const notSelected = !selected.some(s => s.roundKey === ls.roundKey);
          return isBeforeDeadline && notSelected;
        });
        
        if (before2.length) {
          before2.sort((a, b) => b.score.comparedTo(a.score));
          selected.push(before2[0]);
        }
      } else {
        // 非2021年规则：第二轮选择剩余关卡中得分最高的，不限制上传时间
        const remaining1 = levelScores.filter(ls => !selected.some(s => s.roundKey === ls.roundKey));
        
        if (remaining1.length) {
          remaining1.sort((a, b) => b.score.comparedTo(a.score));
          // 确保第二轮选择的关卡被放在第二个位置（索引1）
          if (selected.length === 0) {
            // 如果第一轮没有选择，先添加一个null占位
            selected[0] = {
              roundKey: '',
              score: new Decimal(0),
              level: {} as LevelFile
            };
          }
          selected[1] = remaining1[0];
        } else {
        }
      }
    }

    if (selectCount > 2 && deadlines.length >= 3) {
      const remaining2 = levelScores.filter(ls => !selected.some(s => s.roundKey === ls.roundKey) && isLevelUploadedBeforeDeadline(ls.level, deadlines[2]));
      if (remaining2.length) {
        remaining2.sort((a, b) => b.score.comparedTo(a.score));
        selected.push(remaining2[0]);
      }
      // 注意：不再在这里扣分，因为我们现在使用的是基于累计上传数量的超时扣分机制
    }
  }

  if (selected.filter(s => s).length < selectCount) {
    const rest = levelScores.filter(ls => !selected.some(s => s && s.roundKey === ls.roundKey));
    rest.sort((a, b) => b.score.comparedTo(a.score));
    
    // 找出未填充的轮次索引
    const emptyIndices = [];
    for (let i = 0; i < selectCount; i++) {
      if (!selected[i] || !selected[i].roundKey) {
        emptyIndices.push(i);
      }
    }
    
    // 填充未填充的轮次
    for (let i = 0; i < Math.min(emptyIndices.length, rest.length); i++) {
      const roundIndex = emptyIndices[i];
      selected[roundIndex] = rest[i];
    }
  }

  // 生成轮次选择信息，缺失的轮次标记为未上传且视为超时
  const roundSelections = Array.from({ length: deadlines.length }, (_, i) => {
    const sel = selected[i];
    return {
      roundIndex: i,
      selectedTopic: sel && sel.roundKey ? sel.roundKey : '未上传',
      isTimeout: !sel || !sel.roundKey
    };
  });

  return {
    validRounds: selected.map(s => s ? s.roundKey : ""),
    timeoutPenalty: penalty,
    roundSelections,
    deadlineCount: deadlines.length
  };
}