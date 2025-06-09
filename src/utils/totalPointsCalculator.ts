/**
 * 总分积分排行计算工具类
 * 计算每个选手在各轮次的累积总分，合并相同用户名
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { loadRoundScoreData } from './scoreCalculator';
import { Decimal } from 'decimal.js';

// 设置Decimal的精度和舍入模式
Decimal.set({ precision: 10, rounding: Decimal.ROUND_HALF_UP });

// 加载有效关卡配置
async function loadValidLevelData(): Promise<any> {
  try {
    const response = await fetch('/data/validLevel.json');
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn('加载validLevel.json失败:', error);
  }
  return null;
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
  // 验证CSV文件存在性
  const validRounds: string[] = [];
  for (const round of availableRounds) {
    try {
      const response = await fetch(`/data/scores/${year}${round}.csv`);
      if (response.ok) {
        validRounds.push(round);
      }
    } catch (error) {
      // 继续处理其他轮次
    }
  }

  // 加载特殊年份的配置数据
  const validLevelData = await loadValidLevelData();
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
  await addSpecialYearZeroScorePlayers(year, validLevelData, yamlData, playerDataByName);
    // 计算每个选手的总积分（应用特殊年份规则）
  for (const [, playerData] of Object.entries(playerDataByName)) {
    playerData.totalPoints = calculatePlayerTotalScore(year, playerData, validLevelData).toNumber();
  }

  // 处理决赛排名：为参加决赛的选手确定具体排名
  await calculateFinalRankings(year, yamlData, playerDataByName, validRounds);
  // 转换为数组并排序
  const players = Object.entries(playerDataByName)
    .filter(([_, data]) => {
      // 统一处理逻辑：只要有选手码，就表示该选手存在于某处配置中，应该显示在榜单中
      // 无论是2014-2019年的未上传小组赛作品选手，还是2020-2024年的未上传初赛作品选手
      return data.playerCodes.length > 0;
    })
    .map(([playerName, data]) => ({
      playerName,
      totalPoints: new Decimal(Math.round(data.totalPoints * 10) / 10),
      participatedRounds: sortRounds(data.participatedRounds),
      validRoundsCount: data.participatedRounds.length,
      bestResult: calculateBestResult(data.participatedRounds, data.roundScores),
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
 * 根据参与轮次计算最好成绩
 */
function calculateBestResult(participatedRounds: string[], roundScores?: { [round: string]: any }): string {
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

// 以下是备用的单轮次计算函数，当前使用总分计算方式
// 如需单轮次计算可以启用这些函数

/*
function calculateSpecialRoundScore(year: string, round: string, playerScore: any, validLevelData: any): number {
  // 2019年小组赛特殊规则
  if (year === '2019' && round.startsWith('G')) {
    return calculate2019GroupScore(playerScore);
  }
  
  // 2020-2021年初赛有效题目制
  if ((year === '2020' || year === '2021') && round.startsWith('I')) {
    return calculateValidLevelScore(year, round, playerScore, validLevelData, true); // 有扣分
  }
  
  // 2022-2024年初赛有效题目制
  if (['2022', '2023', '2024'].includes(year) && round.startsWith('I')) {
    return calculateValidLevelScore(year, round, playerScore, validLevelData, false); // 无扣分
  }
  
  // 默认使用平均分
  console.log(`${year}年${round}轮次选手${playerScore.playerCode}: 使用标准计算，平均分=${playerScore.averageScore}`);
  return playerScore.averageScore;
}

function shouldIncludeZeroScore(year: string, round: string, playerScore: any, validLevelData: any): boolean {
  // 2019年小组赛的D4选手（三关均未传，计0分）
  if (year === '2019' && round.startsWith('G') && playerScore.playerCode === 'D4') {
    return true;
  }
  
  // 2020-2021年初赛的全未上传选手（计0分）
  if ((year === '2020' || year === '2021') && round.startsWith('I')) {
    const playerData = validLevelData?.validLevel?.[year]?.[playerScore.playerCode];
    if (playerData) {
      const allRounds = Object.values(playerData);
      return allRounds.every(r => r === '未上传');
    }
  }
  
  return false;
}
*/

/*
 * 2019年小组赛特殊计算（备用函数）
 * 四道题目取最高三关，A4选手少传2关扣15分，D4选手三关均未传计0分
 */
/*
function calculate2019GroupScore(playerScore: any): number {
  const playerCode = playerScore.playerCode;
  
  // D4选手三关均未传，小组赛计0分
  if (playerCode === 'D4') {
    console.log(`2019年选手D4: 三关均未传，小组赛计0分`);
    return 0;
  }
  
  // A4选手只有一关，少传2关，扣15分
  if (playerCode === 'A4') {
    const penaltyScore = Math.max(0, playerScore.averageScore - 15);
    console.log(`2019年选手A4: 原始分数=${playerScore.averageScore}, 少传2关扣15分，最终得分=${penaltyScore}`);
    return penaltyScore;
  }
    // 其他选手实现四选三最高分计算
  if (playerScore.records && playerScore.records.length > 0) {
    // 获取所有关卡分数
    const scores = playerScore.records
      .map((record: any) => record.totalScore || 0)
      .filter((score: number) => score > 0); // 只考虑有效分数
    
    if (scores.length >= 3) {
      // 如果有3个或以上分数，取最高三个
      scores.sort((a: number, b: number) => b - a); // 降序排列
      const top3Average = (scores[0] + scores[1] + scores[2]) / 3;
      console.log(`2019年选手${playerCode}: 四选三最高分，所有分数=[${scores.join(',')}], 最高三关平均分=${top3Average}`);
      return top3Average;
    } else {
      // 分数不足3个，使用现有分数的平均值
      const average = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;
      console.log(`2019年选手${playerCode}: 有效分数不足3个，分数=[${scores.join(',')}], 平均分=${average}`);
      return average;
    }
  } else {
    // 没有详细记录，使用平均分
    console.log(`2019年选手${playerCode}: 无详细记录，使用平均分=${playerScore.averageScore}`);    return playerScore.averageScore;
  }
}
*/

/**
 * 计算选手的总积分（应用特殊年份规则）
 */
function calculatePlayerTotalScore(year: string, playerData: any, validLevelData: any): Decimal {
  let totalScore: Decimal;
  
  // 特殊年份需要特殊处理
  if (year === '2019') {
    // 2019年小组赛：4关取最高3关计算总分
    totalScore = calculate2019TotalScore(playerData, validLevelData);
  } else if (['2020', '2021'].includes(year)) {
    // 2020-2021年初赛：有效关卡制，有扣分
    totalScore = calculateValidLevelTotalScore(year, playerData, validLevelData, true);
  } else if (['2022', '2023', '2024'].includes(year)) {
    // 2022-2024年初赛：有效关卡制，无扣分
    totalScore = calculateValidLevelTotalScore(year, playerData, validLevelData, false);
  } else {
    // 普通年份：累加所有轮次分数
    totalScore = calculateNormalTotalScore(playerData);
  }
  
  return totalScore;
}

/**
 * 2019年总分计算：小组赛4关取最高3关
 */
function calculate2019TotalScore(playerData: any, _validLevelData: any): Decimal {
  let totalScore = new Decimal(0);
  
  // 收集所有小组赛轮次的分数（每轮是一关）
  const allGroupScores: Decimal[] = [];
  const groupRounds = ['G1', 'G2', 'G3', 'G4'];
  
  // 采用轮次的averageScore作为每关分数（2019年每轮是一关）  
  for (const round of groupRounds) {
    if (playerData.roundScores[round] && playerData.roundScores[round].averageScore > 0) {
      allGroupScores.push(new Decimal(playerData.roundScores[round].averageScore));
    }
  }
    
  // 应用2019年特殊规则
  const playerCode = playerData.playerCodes[0];
  
  if (playerCode === 'D4') {
    // D4选手三关均未传，小组赛总分为0
    totalScore = new Decimal(0);
  } else if (playerCode === 'A4') {
    // A4选手只有一关，扣15分
    if (allGroupScores.length > 0) {
      // 存在一关成绩，扣15分
      const totalScoreSum = allGroupScores.reduce((a, b) => a.plus(b), new Decimal(0));
      const afterPenalty = totalScoreSum.minus(15);
      totalScore = afterPenalty.isNegative() ? new Decimal(0) : afterPenalty;
    } else {
      totalScore = new Decimal(0);
    }
  } else {
    // 其他选手：4关取最高3关的总分
    if (allGroupScores.length >= 3) {
      allGroupScores.sort((a, b) => b.comparedTo(a)); // 降序排序
      totalScore = allGroupScores[0].plus(allGroupScores[1]).plus(allGroupScores[2]);
    } else if (allGroupScores.length > 0) {
      totalScore = allGroupScores.reduce((a, b) => a.plus(b), new Decimal(0));
    } else {
      totalScore = new Decimal(0);
    }
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
 * 有效关卡制总分计算（2020-2024年初赛）
 */
function calculateValidLevelTotalScore(year: string, playerData: any, validLevelData: any, penaltyForMissing: boolean): Decimal {
  let preliminaryScore = new Decimal(0);
  let otherRoundsScore = new Decimal(0);
  const prelimRoundIds = ['I1', 'I2', 'I3', 'I4'];
  const playerCode = playerData.playerCodes[0];

  const playerValidLevelConfig = validLevelData?.validLevel?.[year]?.[playerCode];

  if (!playerValidLevelConfig) {
    // 没有特定初赛配置，按普通年份计算所有轮次总分
    return calculateNormalTotalScore(playerData);
  }

  const jsonRoundKeys = ['round1', 'round2', 'round3', 'round4'];
  
  // 统计在validLevel.json中为该选手定义的初赛轮次及其状态
  let numberOfDefinedPrelimsInJson = 0;
  let numberOfUnuploadedInJson = 0;
  for (const jsonKey of jsonRoundKeys) {
    if (playerValidLevelConfig[jsonKey] !== undefined) {
      numberOfDefinedPrelimsInJson++;
      const roundValue = playerValidLevelConfig[jsonKey];
      if (roundValue === '!' || (typeof roundValue === 'string' && roundValue.includes('!'))) {
        numberOfUnuploadedInJson++;
      }
    }
  }

  // 特殊情况：如果validLevel.json中为该选手定义的所有初赛轮次均为"!"
  if (numberOfDefinedPrelimsInJson > 0 && numberOfUnuploadedInJson === numberOfDefinedPrelimsInJson) {
    preliminaryScore = new Decimal(0);
  } else {
    // 计算有效且参与的初赛轮次得分
    for (const jsonKey of jsonRoundKeys) {
      if (playerValidLevelConfig[jsonKey] !== undefined) {
        const roundValue = playerValidLevelConfig[jsonKey];
        
        if (roundValue === '!') {
          continue;
        }
        
        let actualRoundId = roundValue;
        if (typeof roundValue === 'string' && roundValue.startsWith('!')) {
          actualRoundId = roundValue.substring(1);
        }
        
        if (playerData.roundScores[actualRoundId]) {
          const score = new Decimal(playerData.roundScores[actualRoundId].averageScore || 0);
          preliminaryScore = preliminaryScore.plus(score);
        }
      }
    }
  }
  
  // 应用罚分规则（仅2020-2021年）
  if (penaltyForMissing && numberOfUnuploadedInJson > 0) {
    const penaltyAmount = new Decimal(numberOfUnuploadedInJson * 5);
    const afterPenalty = preliminaryScore.minus(penaltyAmount);
    preliminaryScore = afterPenalty.isNegative() ? new Decimal(0) : afterPenalty;
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
async function addSpecialYearZeroScorePlayers(year: string, validLevelData: any, yamlData: any, playerDataByName: { [playerName: string]: any }) {
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
  // 2020-2024年：处理仅在validLevel.json中定义且所有已定义初赛轮次均为"未上传"的选手
  if (['2020', '2021', '2022', '2023', '2024'].includes(year) && validLevelData?.validLevel?.[year]) {
    const yearValidLevelConfig = validLevelData.validLevel[year];
    const seasonData = yamlData.season[year];
    const jsonRoundKeys = ['round1', 'round2', 'round3', 'round4'];
    for (const [playerCode, playerLevelConfig] of Object.entries(yearValidLevelConfig)) {
      const playerName = getPlayerNameFromYaml(seasonData, playerCode);
      if (playerName && !playerDataByName[playerName]) {
        let definedPrelimsCount = 0;
        let unuploadedDefinedPrelimsCount = 0;
        for (const jsonKey of jsonRoundKeys) {
          if ((playerLevelConfig as any)[jsonKey] !== undefined) {
            definedPrelimsCount++;
            const roundValue = (playerLevelConfig as any)[jsonKey];
            // 检查是否为感叹号（未上传/超时上传）
            if (roundValue === '!' || (typeof roundValue === 'string' && roundValue.includes('!'))) {
              unuploadedDefinedPrelimsCount++;
            }
          }
        }
        // 条件：选手在validLevel.json中有初赛轮次定义，且所有这些定义的轮次都是感叹号
        if (definedPrelimsCount > 0 && definedPrelimsCount === unuploadedDefinedPrelimsCount) {
          // 在轮次信息中添加初赛轮次
          const prelimRounds = ["I1", "I2", "I3", "I4"].filter(r => {
            // 只添加在validLevel.json中定义的轮次
            for (const jsonKey of jsonRoundKeys) {
              const configValue = (playerLevelConfig as any)[jsonKey];
              if (configValue) {
                const roundId = configValue.startsWith('!') ? configValue.substring(1) : configValue;
                if (roundId === r) return true;
              }
            }
            return false;
          });
          
          playerDataByName[playerName] = {
            totalPoints: 0,
            participatedRounds: prelimRounds, // 添加初赛轮次，使其在榜单显示
            playerCodes: [playerCode],
            roundScores: {} // 没有实际轮次得分
          };
        }
      }
    }
  }
}

/**
 * 从YAML配置中获取选手用户名
 */
function getPlayerNameFromYaml(seasonData: any, playerCode: string): string | null {
  if (!seasonData?.rounds) return null;
    for (const [, roundData] of Object.entries(seasonData.rounds)) {
    if (typeof roundData === 'object' && roundData && 'players' in roundData) {
      const players = (roundData as any).players;
      for (const [, groupPlayers] of Object.entries(players)) {
        if (typeof groupPlayers === 'object' && groupPlayers && playerCode in groupPlayers) {
          return (groupPlayers as any)[playerCode];
        }
      }
    }
  }
  
  return null;
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
    if (scoreData?.playerScores?.length > 0) {      // 按平均分排序，兼容Decimal类型
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
