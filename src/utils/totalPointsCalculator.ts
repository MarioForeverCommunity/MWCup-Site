/**
 * 总分积分排行计算工具类
 * 计算每个选手在各轮次的累积总分，合并相同用户名
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { loadRoundScoreData, type PlayerScore } from './scoreCalculator';
import { Decimal } from 'decimal.js';
import { shouldShowScoreData } from './scheduleHelper';
import type { MWCupYamlDoc, SeasonYearData, RoundConfig, GroupedPlayerMap, FlatPlayerMap } from '../types/mwcup';
import { findRoundConfig, isGroupedPlayerMap, isFlatPlayerMap } from '../types/mwcup';

// 设置Decimal的精度和舍入模式
Decimal.set({ precision: 10, rounding: Decimal.ROUND_HALF_UP });

// 关卡文件索引缓存（同会话内静态数据不会变化）
let levelIndexDataCache: LevelFile[] | null = null;
let levelIndexDataPromise: Promise<LevelFile[]> | null = null;

// 总分积分数据缓存：按 year 键索引
const totalPointsDataCache = new Map<string, TotalPointsData>();
const totalPointsDataPromise = new Map<string, Promise<TotalPointsData>>();

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

// 选手轮次数据（内部使用）
export interface PlayerRoundData {
  totalPoints: number;
  participatedRounds: string[];
  playerCodes: string[];
  roundScores: Record<string, PlayerScore>;
}

// 加载关卡索引数据
export async function loadLevelIndexData(): Promise<LevelFile[]> {
  // 命中缓存直接返回
  if (levelIndexDataCache) {
    return levelIndexDataCache;
  }
  // 复用进行中的 Promise，避免并发重复请求
  if (!levelIndexDataPromise) {
    levelIndexDataPromise = (async () => {
      try {
        const response = await fetch('/data/levels/index.json');
        if (response.ok) {
          const data = await response.json();
          levelIndexDataCache = data;
          return data;
        }
      } catch (error) {
        console.warn('加载levels/index.json失败:', error);
      }
      return [];
    })();
  }
  return levelIndexDataPromise;
}

/**
 * 清除关卡索引数据缓存
 */
export function clearLevelIndexDataCache(): void {
  levelIndexDataCache = null;
  levelIndexDataPromise = null;
}

// 获取指定年份和轮次的截止时间
export function getDeadlines(yamlData: MWCupYamlDoc, year: string, roundKey: string): string[] {
  const seasonData = yamlData?.season?.[year];
  if (!seasonData) {
    return [];
  }

  // 查找轮次数据
  const roundData = findRoundConfig(seasonData, roundKey);

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
export async function loadTotalPointsData(year: string, yamlData: MWCupYamlDoc): Promise<TotalPointsData> {
  const seasonData = yamlData.season[year];
  if (!seasonData || !seasonData.rounds) {
    return {
      year,
      players: [],
      availableRounds: [],
      hasData: false
    };
  }

  // 命中缓存直接返回（同会话内静态数据不会变化）
  const cached = totalPointsDataCache.get(year);
  if (cached) {
    return cached;
  }
  // 复用进行中的 Promise，避免并发重复计算
  const inFlight = totalPointsDataPromise.get(year);
  if (inFlight) {
    return inFlight;
  }
  const promise = loadTotalPointsDataInternal(year, yamlData).then(data => {
    totalPointsDataCache.set(year, data);
    return data;
  }).finally(() => {
    totalPointsDataPromise.delete(year);
  });
  totalPointsDataPromise.set(year, promise);
  return promise;
}

/**
 * 清除总分积分数据缓存
 */
export function clearTotalPointsDataCache(): void {
  totalPointsDataCache.clear();
  totalPointsDataPromise.clear();
}

/**
 * loadTotalPointsData 的内部实现（无缓存逻辑）
 */
async function loadTotalPointsDataInternal(year: string, yamlData: MWCupYamlDoc): Promise<TotalPointsData> {
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
      // 过滤评分未截止的轮次（仅对2026年及之后的赛事生效）
      if (!shouldShowScoreData(yamlData, year, round)) {
        continue;
      }

      // 首先检查是否为特殊的总分制评分（如2015年半决赛）
      const roundData = findRoundConfig(seasonData, round);

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
    roundScores: Record<string, PlayerScore>;
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
function extractRounds(roundsConfig: Record<string, RoundConfig>): string[] {
  const rounds: string[] = [];

  for (const [key] of Object.entries(roundsConfig)) {
    if (key.includes(',')) {
      // 处理逗号分隔的多轮次键
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
    'F': 11, 'F1': 11, 'F2': 12, 'F3': 13 // 决赛/正赛
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
function getRealBestStageFromYaml(yamlData: MWCupYamlDoc, year: string, playerName: string): string | null {
  const seasonData = yamlData.season?.[year];
  if (!seasonData?.rounds) return null;

  // 定义轮次优先级（从高到低）
  const stageInfo = [
    { rounds: ['F'], stageName: '决赛' },
    { rounds: ['F1', 'F2', 'F3'], stageName: '正赛' },
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
function isPlayerInYamlRound(seasonData: SeasonYearData, roundKey: string, playerName: string): boolean {
  // 首先尝试直接查找轮次
  let roundData = seasonData.rounds[roundKey];

  // 如果没有找到，检查多轮次键
  if (!roundData) {
    for (const [key, data] of Object.entries(seasonData.rounds)) {
      // 处理逗号分隔的多轮次键
      if (key.includes(',')) {
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
function calculateBestResult(participatedRounds: string[], roundScores?: Record<string, PlayerScore>, yamlData?: MWCupYamlDoc, year?: string, playerName?: string): string {
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
      // 如果是正赛（F1/F2/F3），尝试获取具体排名
      if (realBestStage === '正赛' && roundScores) {
        for (const fr of ['F1', 'F2', 'F3']) {
          if (roundScores[fr]) {
            const frData = roundScores[fr];
            const rank = frData.rank ?? frData.ranking;
            if (rank !== undefined) {
              if (rank === 1) return '正赛/冠军';
              if (rank === 2) return '正赛/亚军';
              if (rank === 3) return '正赛/季军';
              return `正赛/${rank}强`;
            }
          }
        }
        return '正赛';
      }
      return realBestStage;
    }
  }

  // 如果没有参与任何轮次，返回特殊标识
  if (participatedRounds.length === 0) {
    return '仅报名'; // 将在formatResultDisplay中替换为小组赛/XX强或初赛/XX强
  }

  // 按轮次重要性判断最好成绩
  const hasStandaloneF = participatedRounds.includes('F');
  const hasF123 = participatedRounds.some(r => r.startsWith('F') && r !== 'F');
  if (hasStandaloneF || hasF123) {
    // 如果参加了决赛/正赛，需要根据排名判断具体成绩
    const stageLabel = hasStandaloneF ? '决赛' : '正赛';
    const fRound = hasStandaloneF ? 'F' : ['F1', 'F2', 'F3'].find(r => participatedRounds.includes(r));
    if (fRound && roundScores && roundScores[fRound]) {
      // 尝试从roundScores中获取排名信息
      const finalRoundData = roundScores[fRound];

      // 如果有具体的排名数据
      if (finalRoundData.rank !== undefined) {
        const rank = finalRoundData.rank;
        if (rank === 1) return `${stageLabel}/冠军`;
        if (rank === 2) return `${stageLabel}/亚军`;
        if (rank === 3) return `${stageLabel}/季军`;
        if (rank === 4) return `${stageLabel}/4强`;
        return `${stageLabel}/${rank}强`;
      }

      // 如果有ranking字段
      if (finalRoundData.ranking !== undefined) {
        const rank = finalRoundData.ranking;
        if (rank === 1) return `${stageLabel}/冠军`;
        if (rank === 2) return `${stageLabel}/亚军`;
        if (rank === 3) return `${stageLabel}/季军`;
        if (rank === 4) return `${stageLabel}/4强`;
        return `${stageLabel}/${rank}强`;
      }
    }
    return stageLabel;
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
async function calculatePlayerTotalScore(year: string, playerData: PlayerRoundData, yamlData: MWCupYamlDoc): Promise<Decimal> {
  let totalScore: Decimal;

  // 特殊年份需要特殊处理
  if (year === '2019') {
    // 2019年小组赛：4关取最高3关计算总分
    totalScore = await calculate2019TotalScore(playerData, yamlData);
  } else if (['2020', '2021'].includes(year)) {
    // 2020-2021年初赛：有效关卡制，有扣分
    totalScore = await calculateValidLevelTotalScore(year, playerData, yamlData, true);
  } else if (['2022', '2023', '2024', '2025'].includes(year) || isYearOnlyFRounds(yamlData, year)) {
    // 2022年之后初赛：有效关卡制，无扣分
    // 仅包含F正赛轮次的年份也采用此规则
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
export async function calculate2019TotalScore(playerData: PlayerRoundData, yamlData: MWCupYamlDoc): Promise<Decimal> {
  let totalScore: Decimal;
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
    if (playerData.roundScores[round] && playerData.roundScores[round].averageScore.greaterThan(0)) {
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
export async function calculateValidLevelTotalScore(year: string, playerData: PlayerRoundData, yamlData: MWCupYamlDoc, penaltyForMissing: boolean = true): Promise<Decimal> {
  let preliminaryScore: Decimal;
  const prelimRoundIds = getValidLevelRoundIds(yamlData, year);
  const playerCode = playerData.playerCodes[0];
  const yearNum = parseInt(year);

  // 加载关卡数据
  const levelFiles = await loadLevelIndexData();
  const playerLevels = getPlayerLevels(levelFiles, playerCode, yearNum);

  // 获取截止时间（F正赛年份从F1获取，其他年份从I1获取）
  const deadlineRoundKey = isYearOnlyFRounds(yamlData, year) ? 'F1' : 'I1';
  const deadlines = getDeadlines(yamlData, year, deadlineRoundKey);

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
  } else {
    // 2022年之后及F正赛年份：3道题选2道，2个截止时间，简单选择规则（无超时扣分）
    preliminaryScore = await calculate2022OnwardsPreliminaryScore(playerData, playerLevels, deadlines, prelimRoundIds);
  }

  // 计算其他非初赛/正赛轮次的得分
  let otherRoundsScore = new Decimal(0);
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
async function calculate2020PreliminaryScore(playerData: PlayerRoundData, playerLevels: LevelFile[], deadlines: string[], _penaltyForMissing: boolean): Promise<Decimal> {
  const prelimRounds = ['I1', 'I2', 'I3'];

  // 获取所有初赛关卡得分
  const levelScores: { roundKey: string; score: Decimal; level: LevelFile }[] = [];
  for (const round of prelimRounds) {
    if (playerData.roundScores[round] && playerData.roundScores[round].averageScore.greaterThan(0)) {
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
  const selectedLevels: { roundKey: string; score: Decimal }[] = [];
  const penalty = 0;

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
async function calculate2021PreliminaryScore(playerData: PlayerRoundData, playerLevels: LevelFile[], deadlines: string[], _penaltyForMissing: boolean): Promise<Decimal> {
  const prelimRounds = ['I1', 'I2', 'I3', 'I4'];

  // 获取所有初赛关卡得分
  const levelScores: { roundKey: string; score: Decimal; level: LevelFile }[] = [];
  for (const round of prelimRounds) {
    if (playerData.roundScores[round] && playerData.roundScores[round].averageScore.greaterThan(0)) {
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
  const selectedLevels: { roundKey: string; score: Decimal }[] = [];
  const penalty = 0;

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
async function calculate2022OnwardsPreliminaryScore(playerData: PlayerRoundData, playerLevels: LevelFile[], deadlines: string[], prelimRoundIds: string[] = ['I1', 'I2', 'I3']): Promise<Decimal> {
  const prelimRounds = prelimRoundIds;

  // 获取所有初赛关卡得分
  const levelScores: { roundKey: string; score: Decimal; level: LevelFile }[] = [];
  for (const round of prelimRounds) {
    if (playerData.roundScores[round] && playerData.roundScores[round].averageScore.greaterThan(0)) {
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
function calculateNormalTotalScore(playerData: PlayerRoundData): Decimal {
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
async function addSpecialYearZeroScorePlayers(year: string, levelIndexData: LevelFile[], yamlData: MWCupYamlDoc, playerDataByName: Record<string, PlayerRoundData>) {
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
      const groupPlayers = seasonData.rounds[groupRoundKey].players!;

      // 遍历所有组
      if (isGroupedPlayerMap(groupPlayers)) {
        Object.entries(groupPlayers).forEach(([_, players]) => {
          // 遍历该组的所有选手
          Object.entries(players).forEach(([playerCode, playerName]) => {
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
      } else if (isFlatPlayerMap(groupPlayers)) {
        Object.entries(groupPlayers).forEach(([playerCode, playerName]) => {
          if (!playerDataByName[playerName]) {
            playerDataByName[playerName] = {
              totalPoints: 0,
              participatedRounds: [],
              playerCodes: [playerCode],
              roundScores: {}
            };
          }
        });
      }
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
      const prelimPlayers = seasonData.rounds[prelimRoundKey].players!;

      // 遍历所有组
      if (isGroupedPlayerMap(prelimPlayers)) {
        Object.entries(prelimPlayers).forEach(([_, players]) => {
          // 遍历该组的所有选手
          Object.entries(players).forEach(([playerCode, playerName]) => {
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
      } else if (isFlatPlayerMap(prelimPlayers)) {
        Object.entries(prelimPlayers).forEach(([playerCode, playerName]) => {
          if (!playerDataByName[playerName]) {
            const yearNum = parseInt(year);
            const playerLevels = levelIndexData.filter(level =>
              level.playerCode === playerCode &&
              level.year === yearNum &&
              ['I1', 'I2', 'I3', 'I4'].includes(level.roundKey)
            );
            if (playerLevels.length === 0) {
              playerDataByName[playerName] = {
                totalPoints: 0,
                participatedRounds: [],
                playerCodes: [playerCode],
                roundScores: {}
              };
            }
          }
        });
      }
    }
  }
}

/**
 * 计算决赛排名：为参加决赛的选手确定具体排名
 * 参考ChampionStatistics.vue中的排名逻辑
 */
async function calculateFinalRankings(year: string, yamlData: MWCupYamlDoc, playerDataByName: Record<string, PlayerRoundData>, validRounds: string[]) {
  // 收集所有决赛/正赛轮次
  const finalRounds: string[] = [];
  if (validRounds.includes('F')) finalRounds.push('F');
  for (const fr of ['F1', 'F2', 'F3']) {
    if (validRounds.includes(fr)) finalRounds.push(fr);
  }
  if (finalRounds.length === 0) return;

  // 为每个决赛/正赛轮次计算排名
  for (const roundKey of finalRounds) {
    try {
      const scoreData = await loadRoundScoreData(year, roundKey, yamlData);
      if (scoreData?.playerScores?.length > 0) {
        const sortedPlayers = [...scoreData.playerScores].sort(
          (a, b) => Number(b.averageScore ?? 0) - Number(a.averageScore ?? 0)
        );

        sortedPlayers.forEach((playerScore, index) => {
          const playerName = playerScore.playerName;
          if (playerDataByName[playerName] && playerDataByName[playerName].roundScores[roundKey]) {
            playerDataByName[playerName].roundScores[roundKey].rank = index + 1;
          }
        });

        // 处理YAML中存在但评分数据中缺失的选手
        const seasonData = yamlData.season[year];
        // 通过findRoundConfig查找轮次配置（支持多轮次键）
        let finalRoundConfig: RoundConfig | undefined;
        for (const [key, data] of Object.entries(seasonData?.rounds || {})) {
          if (key.includes(',')) {
            const rounds = key.split(',').map(r => r.trim());
            if (rounds.includes(roundKey)) {
              finalRoundConfig = data;
              break;
            }
          } else if (key === roundKey) {
            finalRoundConfig = data;
            break;
          }
        }

        if (finalRoundConfig?.players) {
          const allPlayers: string[] = [];

          if (isGroupedPlayerMap(finalRoundConfig.players)) {
            const groupedPlayers = finalRoundConfig.players as GroupedPlayerMap;
            for (const group of Object.values(groupedPlayers)) {
              if (typeof group === 'object' && group !== null) {
                allPlayers.push(...Object.values(group));
              }
            }
          } else if (isFlatPlayerMap(finalRoundConfig.players)) {
            const flatPlayers = finalRoundConfig.players as FlatPlayerMap;
            allPlayers.push(...Object.values(flatPlayers).filter((v): v is string => typeof v === 'string'));
          }

          const scoredPlayers = sortedPlayers.map(p => p.playerName);
          const missingPlayers = allPlayers.filter(name => !scoredPlayers.includes(name));

          missingPlayers.forEach((playerName, index) => {
            if (playerDataByName[playerName]) {
              if (!playerDataByName[playerName].roundScores[roundKey]) {
                playerDataByName[playerName].roundScores[roundKey] = {
                  playerName,
                  playerCode: playerDataByName[playerName].playerCodes[0],
                  totalSum: new Decimal(0),
                  averageScore: new Decimal(0),
                  validRecordsCount: 0,
                  records: []
                };
                if (!playerDataByName[playerName].participatedRounds.includes(roundKey)) {
                  playerDataByName[playerName].participatedRounds.push(roundKey);
                }
              }
              playerDataByName[playerName].roundScores[roundKey].rank = sortedPlayers.length + index + 1;
            }
          });
        }
      }
    } catch {
      // 忽略排名计算错误
    }
  }
}

/**
 * 检查某年是否仅包含F1/F2/F3轮次（正赛轮次）
 * 这类年份采用2022年之后的有效关卡制计算总积分
 */
export function isYearOnlyFRounds(yamlData: MWCupYamlDoc, year: string): boolean {
  const seasonData = yamlData.season?.[year];
  if (!seasonData?.rounds) return false;

  const roundKeys = Object.keys(seasonData.rounds);
  const allRounds: string[] = [];

  for (const key of roundKeys) {
    if (key.includes(',')) {
      allRounds.push(...key.split(',').map(r => r.trim()));
    } else {
      allRounds.push(key);
    }
  }

  // 排除P1/P2（预选赛/资格赛/热身赛）
  const competitiveRounds = allRounds.filter(r => r !== 'P1' && r !== 'P2');

  if (competitiveRounds.length === 0) return false;

  return competitiveRounds.every(r => r.startsWith('F'));
}

/**
 * 获取该年份的有效关卡轮次ID列表
 * F正赛年份返回F1/F2/F3，其他年份返回I1/I2/I3（或I4）
 */
export function getValidLevelRoundIds(yamlData: MWCupYamlDoc, year: string): string[] {
  if (isYearOnlyFRounds(yamlData, year)) {
    return ['F1', 'F2', 'F3'];
  }
  const yearNum = parseInt(year);
  return yearNum === 2021 ? ['I1', 'I2', 'I3', 'I4'] : ['I1', 'I2', 'I3'];
}

// ===================== Helper functions for UI =====================

/**
 * 计算并返回2019小组赛选中关卡和超时罚分
 */
export async function get2019ValidLevelInfo(playerData: PlayerRoundData, yamlData: MWCupYamlDoc): Promise<{
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
    if (playerData.roundScores?.[round]?.averageScore?.greaterThan(0)) {
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
export async function getPreliminaryValidInfo(year: string, playerData: PlayerRoundData, yamlData: MWCupYamlDoc): Promise<{
  validRounds: string[];
  timeoutPenalty: number;
  roundSelections: { roundIndex: number; selectedTopic: string; isTimeout: boolean }[];
  deadlineCount: number;
}> {
  const yearNum = parseInt(year);
  const prelimRounds = getValidLevelRoundIds(yamlData, year);
  const deadlineRoundKey = isYearOnlyFRounds(yamlData, year) ? 'F1' : 'I1';
  const deadlines = getDeadlines(yamlData, year, deadlineRoundKey);
  const levelFiles = await loadLevelIndexData();
  const playerCode = playerData.playerCodes?.[0] || '';
  const playerLevels = getPlayerLevels(levelFiles, playerCode, yearNum);
  const levelScores: { roundKey: string; score: Decimal; level: LevelFile }[] = [];
  for (const round of prelimRounds) {
    if (playerData.roundScores?.[round]?.averageScore?.greaterThan(0)) {
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

/**
 * 计算并列排名
 * @param players 选手数组
 * @param scoreField 排序字段（如 'totalPoints'）
 * @param secondaryField 次级排序字段（如 'validRoundsCount'）
 * @returns 包含 displayRank 属性的选手数组
 */
export function calculateRankingWithTies(
  players: PlayerTotalPoints[],
  scoreField: string = 'totalPoints',
  secondaryField: string = 'validRoundsCount'
): (PlayerTotalPoints & { displayRank: number })[] {
  let lastScore: string | null = null;
  let lastSecondary: number | null = null;
  let lastRank = 0;
  let skip = 0;

  const result: (PlayerTotalPoints & { displayRank: number })[] = [];

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const currScore = player[scoreField as keyof PlayerTotalPoints];
    const currSecondary = player[secondaryField as keyof PlayerTotalPoints];

    const currScoreStr = typeof currScore === 'number' ? currScore.toFixed(3) :
      currScore instanceof Decimal ? currScore.toFixed(3) :
        String(currScore);
    const currSecondaryNum = typeof currSecondary === 'number' ? currSecondary : 0;

    if (
      lastScore !== null && currScoreStr === lastScore &&
      lastSecondary !== null && currSecondaryNum === lastSecondary
    ) {
      result.push({
        ...player,
        displayRank: lastRank
      });
      skip++;
    } else {
      const rank = lastRank + 1 + skip;
      result.push({
        ...player,
        displayRank: rank
      });
      lastRank = rank;
      skip = 0;
    }

    lastScore = currScoreStr;
    lastSecondary = currSecondaryNum;
  }

  return result;
}
