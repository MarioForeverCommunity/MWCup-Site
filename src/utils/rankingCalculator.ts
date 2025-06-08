/**
 * 排名计算工具类
 */

import { loadRoundScoreData, type PlayerScore } from './scoreCalculator';
import * as YAML from 'js-yaml';
import { Decimal } from 'decimal.js';
import type { 
  LevelRankingItem, 
  MultiLevelRankingItem, 
  OriginalScoreRankingItem,
  RankingFilters 
} from '../types/ranking';

// 缓存加载的数据
let levelsData: any[] | null = null;
let maxScoreData: any | null = null;
let yamlData: any | null = null;

/**
 * 加载基础数据
 */
async function loadBaseData() {
  if (!levelsData || !maxScoreData || !yamlData) {
    console.log('开始加载基础数据...')
    
    const [levelsResponse, maxScoreResponse, yamlResponse] = await Promise.all([
      fetch('/data/levels/index.json'),
      fetch('/data/maxScore.json'),
      fetch('/data/mwcup.yaml')
    ]);

    if (!levelsResponse.ok || !maxScoreResponse.ok || !yamlResponse.ok) {
      throw new Error('Failed to load base data');
    }

    levelsData = await levelsResponse.json();
    maxScoreData = await maxScoreResponse.json();
    
    const yamlText = await yamlResponse.text();
    yamlData = YAML.load(yamlText);
    
    console.log('基础数据加载完成:', {
      levels: levelsData?.length || 0,
      maxScoreData: !!maxScoreData,
      yamlData: !!yamlData
    })
  }

  return { levelsData: levelsData!, maxScoreData: maxScoreData!, yamlData: yamlData! };
}

/**
 * 获取届次信息
 */
function getEditionString(year: number): string {
  const editionMap: { [key: number]: string } = {
    2012: '2012年第一届',
    2013: '2013年第二届',
    2014: '2014年第三届',
    2015: '2015年第四届',
    2016: '2016年第五届',
    2017: '2017年第六届',
    2018: '2018年第七届',
    2019: '2019年第八届',
    2020: '2020年第九届',
    2021: '2021年第十届',
    2022: '2022年第十一届',
    2023: '2023年第十二届',
    2024: '2024年第十三届',
    2025: '2025年第十四届'
  };
  return editionMap[year] || `${year}年`;
}

/**
 * 获取轮次名称
 */
function getRoundName(roundKey: string, roundType: string): string {
  const roundNameMap: { [key: string]: string } = {
    'P1': '预选赛',
    'P2': '资格赛',
    'I1': '初赛第一题',
    'I2': '初赛第二题',
    'I3': '初赛第三题',
    'I4': '初赛第四题',
    'G1': '小组赛第一轮',
    'G2': '小组赛第二轮',
    'G3': '小组赛第三轮',
    'G4': '小组赛第四轮',
    'Q1': '四分之一决赛第一轮',
    'Q2': '四分之一决赛第二轮',
    'Q': '四分之一决赛',
    'S1': '半决赛第一轮',
    'S2': '半决赛第二轮',
    'S': '半决赛',
    'R1': '复赛第一题',
    'R2': '复赛第二题',
    'R3': '复赛第三题',
    'R': '复赛',
    'F': '决赛'
  };
  return roundNameMap[roundKey] || roundType;
}

/**
 * 获取满分信息
 */
function getMaxScore(year: number, roundKey: string): { baseScore: number; bonusScore: number; totalScore: number } {
  const yearData = maxScoreData?.maxScore?.[year.toString()];
  if (!yearData || !yearData[roundKey]) {
    return { baseScore: 100, bonusScore: 0, totalScore: 100 };
  }
  
  const { base_score = 100, bonus_score = 0 } = yearData[roundKey];
  return {
    baseScore: base_score,
    bonusScore: bonus_score,
    totalScore: base_score + bonus_score
  };
}

/**
 * 获取评分方案
 */
function getScoringScheme(year: number, roundKey: string): string {
  const yearStr = year.toString();
  const seasonData = yamlData?.season?.[yearStr];
  
  if (!seasonData) {
    return 'A'; // 默认方案
  }
  
  // 优先使用轮次特定的评分方案
  const roundData = seasonData.rounds?.[roundKey];
  if (roundData?.scoring_scheme) {
    return roundData.scoring_scheme;
  }
  
  // 如果轮次没有指定评分方案，则使用年度评分方案
  return seasonData.scoring_scheme || 'A';
}

/**
 * 计算单关排名
 */
export async function calculateSingleLevelRanking(filters?: RankingFilters): Promise<LevelRankingItem[]> {
  const { levelsData, yamlData } = await loadBaseData();
  
  // 过滤非MultiLevel的关卡
  const singleLevels = levelsData.filter((level: any) => !level.isMultiLevel);
  
  const rankingItems: LevelRankingItem[] = [];
  
  // 按年份和轮次分组加载评分数据
  const roundGroups = new Map<string, any[]>();
  for (const level of singleLevels) {
    const key = `${level.year}-${level.roundKey}`;
    if (!roundGroups.has(key)) {
      roundGroups.set(key, []);
    }
    roundGroups.get(key)!.push(level);
  }
  
  // 加载每个轮次的评分数据
  for (const [roundKey, levels] of roundGroups) {
    const [year, round] = roundKey.split('-');
    
    try {
      const scoreData = await loadRoundScoreData(year, round, yamlData);
      const maxScore = getMaxScore(parseInt(year), round);
      
      // 为每个关卡计算得分率
      for (const level of levels) {
        const playerScore = scoreData.playerScores.find(
          (ps: PlayerScore) => ps.playerCode === level.playerCode
        );
        
        if (playerScore && playerScore.validRecordsCount > 0) {
          const finalScore = Number(playerScore.averageScore);
          const scoreRate = (finalScore / maxScore.totalScore) * 100;
          // 获取评分方案
          const scoringScheme = getScoringScheme(level.year, level.roundKey);
          
          rankingItems.push({
            rank: 0, // 将在后面设置
            levelName: level.name,
            author: level.playerName,
            finalScore,
            year: level.year,
            edition: getEditionString(level.year),
            round: getRoundName(level.roundKey, level.roundType),
            maxScore: maxScore.totalScore,
            scoreRate,
            playerCode: level.playerCode,
            roundKey: level.roundKey,
            scoringScheme // 添加评分方案
          });
        }
      }
    } catch (error) {
      console.warn(`Failed to load score data for ${year}${round}:`, error);
    }
  }
  
  // 按得分率排序并设置排名
  rankingItems.sort((a, b) => b.scoreRate - a.scoreRate);
  rankingItems.forEach((item, index) => {
    item.rank = index + 1;
  });
  
  // 应用过滤器
  return applyFilters(rankingItems, filters);
}

/**
 * 计算多关排名
 */
export async function calculateMultiLevelRanking(filters?: RankingFilters): Promise<MultiLevelRankingItem[]> {
  const { levelsData, yamlData } = await loadBaseData();
  
  // 获取所有MultiLevel关卡的文件夹信息或直接的多关题文件
  const multiLevelItems = new Map<string, any>();
  for (const level of levelsData) {
    if (level.isMultiLevel) {
      // 带有文件夹的多关卡题
      if (level.multiLevelFolder) {
        const key = `${level.year}-${level.roundKey}-${level.multiLevelFolder.folderName}`;
        if (!multiLevelItems.has(key)) {
          multiLevelItems.set(key, {
            levelName: level.multiLevelFolder.folderName, // 改为 levelName
            playerCode: level.multiLevelFolder.playerCode,
            year: level.year,
            roundKey: level.roundKey,
            roundType: level.roundType,
            playerName: level.playerName,
            isDirectFile: false
          });
        }
      } 
      // 直接的多关卡文件 (.mfs 或 .smws)
      else {
        const key = `${level.year}-${level.roundKey}-${level.name}`;
        if (!multiLevelItems.has(key)) {
          multiLevelItems.set(key, {
            levelName: level.name, // 使用文件名作为 levelName
            playerCode: level.playerCode,
            year: level.year,
            roundKey: level.roundKey,
            roundType: level.roundType,
            playerName: level.playerName,
            isDirectFile: true
          });
        }
      }
    }
  }
  
  const rankingItems: MultiLevelRankingItem[] = [];
  
  // 按年份和轮次分组
  const roundGroups = new Map<string, any[]>();
  for (const item of multiLevelItems.values()) {
    const key = `${item.year}-${item.roundKey}`;
    if (!roundGroups.has(key)) {
      roundGroups.set(key, []);
    }
    roundGroups.get(key)!.push(item);
  }
  
  // 加载每个轮次的评分数据
  for (const [roundKey, items] of roundGroups) {
    const [year, round] = roundKey.split('-');
    
    try {
      const scoreData = await loadRoundScoreData(year, round, yamlData);
      const maxScore = getMaxScore(parseInt(year), round);
      
      // 为每个多关卡项目计算得分率
      for (const item of items) {
        const playerScore = scoreData.playerScores.find(
          (ps: PlayerScore) => ps.playerCode === item.playerCode
        );
        
        if (playerScore && playerScore.validRecordsCount > 0) {
          const finalScore = Number(playerScore.averageScore);
          const scoreRate = (finalScore / maxScore.totalScore) * 100;
          // 获取评分方案
          const scoringScheme = getScoringScheme(item.year, item.roundKey);
          
          rankingItems.push({
            rank: 0, // 将在后面设置
            levelName: item.levelName, // 已改为 levelName
            author: item.playerName,
            finalScore,
            year: item.year,
            edition: getEditionString(item.year),
            round: getRoundName(item.roundKey, item.roundType),
            maxScore: maxScore.totalScore,
            scoreRate,
            playerCode: item.playerCode,
            roundKey: item.roundKey,
            scoringScheme
          });
        }
      }
    } catch (error) {
      console.warn(`Failed to load score data for ${year}${round}:`, error);
    }
  }
  
  // 按得分率排序并设置排名
  rankingItems.sort((a, b) => b.scoreRate - a.scoreRate);
  rankingItems.forEach((item, index) => {
    item.rank = index + 1;
  });
  
  // 应用过滤器
  return applyMultiLevelFilters(rankingItems, filters);
}

/**
 * 计算原始得分率排名
 */
export async function calculateOriginalScoreRanking(filters?: RankingFilters): Promise<OriginalScoreRankingItem[]> {
  const { levelsData, yamlData } = await loadBaseData();
  
  // 过滤非MultiLevel的关卡
  const singleLevels = levelsData.filter((level: any) => !level.isMultiLevel);
  
  const originalItems: OriginalScoreRankingItem[] = [];
  const finalItems: LevelRankingItem[] = [];
  
  // 按年份和轮次分组加载评分数据
  const roundGroups = new Map<string, any[]>();
  for (const level of singleLevels) {
    const key = `${level.year}-${level.roundKey}`;
    if (!roundGroups.has(key)) {
      roundGroups.set(key, []);
    }
    roundGroups.get(key)!.push(level);
  }
  
  // 加载每个轮次的评分数据
  for (const [roundKey, levels] of roundGroups) {
    const [year, round] = roundKey.split('-');
    
    try {
      const scoreData = await loadRoundScoreData(year, round, yamlData);
      const maxScore = getMaxScore(parseInt(year), round);
      
      // 为每个关卡计算原始分和最终分
      for (const level of levels) {
        const playerScore = scoreData.playerScores.find(
          (ps: PlayerScore) => ps.playerCode === level.playerCode
        );
        
        if (playerScore && playerScore.validRecordsCount > 0) {
          // 计算原始分（基础分的平均值，不包括加分项和扣分项）
          let originalScoreSum = 0;
          let validCount = 0;
          // 2016Q2特殊：用于换算后的原始分
          let calculatedOriginalScoreSum = new Decimal(0);
          let calculatedValidCount = 0;
          for (const record of playerScore.records) {
            if (!record.isRevoked) {
              // 计算基础分总和（排除加分项和扣分项）
              let baseScore = 0;
              let calculatedBaseScore = new Decimal(0);
              for (const [key, value] of Object.entries(record.scores)) {
                if (key !== '加分项' && key !== '扣分项' && key !== '换算后大众评分') {
                  let score = typeof value === 'number' ? value : Number(value);
                  let calculatedScore = new Decimal(score);
                  // 2016年Q2轮次的欣赏性得分需要乘以10/15
                  if (year === '2016' && round === 'Q2' && key === '欣赏性') {
                    calculatedScore = new Decimal(score).times(10).div(15);
                  }
                  baseScore += score;
                  calculatedBaseScore = calculatedBaseScore.plus(calculatedScore);
                }
              }
              originalScoreSum += baseScore;
              validCount++;
              calculatedOriginalScoreSum = calculatedOriginalScoreSum.plus(calculatedBaseScore);
              calculatedValidCount++;
            }
          }
          // 计算未换算和换算后的原始分，使用decimal.js保证精度
          const originalScore = validCount > 0 ? new Decimal(originalScoreSum).div(validCount).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber() : 0;
          const calculatedOriginalScore = calculatedValidCount > 0 ? new Decimal(calculatedOriginalScoreSum).div(calculatedValidCount).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber() : 0;
          const finalScore = Number(playerScore.averageScore);
          const originalScoreRate = (originalScore / maxScore.baseScore) * 100;
          const finalScoreRate = (finalScore / maxScore.totalScore) * 100;
          let scoreChange: number;
          if (year === '2016' && round === 'Q2') {
            scoreChange = finalScoreRate - calculatedOriginalScore;
          } else {
            scoreChange = finalScoreRate - originalScoreRate;
          }
          // 获取评分方案
          const scoringScheme = getScoringScheme(level.year, level.roundKey);
          
          const baseItem: LevelRankingItem = {
            rank: 0,
            levelName: level.name,
            author: level.playerName,
            finalScore,
            year: level.year,
            edition: getEditionString(level.year),
            round: getRoundName(level.roundKey, level.roundType),
            maxScore: maxScore.totalScore,
            scoreRate: finalScoreRate,
            playerCode: level.playerCode,
            roundKey: level.roundKey,
            scoringScheme
          };
          
          originalItems.push({
            ...baseItem,
            originalRank: 0, // 将在后面设置
            scoreRateRank: 0, // 将在后面设置
            rankChange: 0, // 将在后面设置
            originalScore: year === '2016' && round === 'Q2' ? calculatedOriginalScore : originalScore, // 2016Q2显示换算后的分数
            originalScoreRate, // 排名用未换算分
            scoreChange: Math.abs(scoreChange),
            changeType: scoreChange > 0 ? 'down' : scoreChange < 0 ? 'up' : 'same'
          } as any);
          
          finalItems.push(baseItem);
        }
      }
    } catch (error) {
      console.warn(`Failed to load score data for ${year}${round}:`, error);
    }
  }
  // 计算最终得分排名
  finalItems.sort((a, b) => Number(b.scoreRate) - Number(a.scoreRate));
  const scoreRateRankMap = new Map<string, number>();
  finalItems.forEach((item, index) => {
    scoreRateRankMap.set(`${item.year}-${item.roundKey}-${item.playerCode}`, index + 1);
  });
    // 按原始得分率排序并设置排名
  originalItems.sort((a, b) => Number(b.originalScoreRate) - Number(a.originalScoreRate));
  originalItems.forEach((item, index) => {
    item.originalRank = index + 1;
    item.scoreRateRank = scoreRateRankMap.get(`${item.year}-${item.roundKey}-${item.playerCode}`) || 0;
    item.rankChange = item.originalRank - item.scoreRateRank;
  });
  
  // 应用过滤器
  return applyOriginalScoreFilters(originalItems, filters);
}

/**
 * 应用过滤器到单关排名
 */
function applyFilters(items: LevelRankingItem[], filters?: RankingFilters): LevelRankingItem[] {
  if (!filters) return items;
  
  let filtered = items;
  
  if (filters.searchPlayer) {
    const searchTerm = filters.searchPlayer.toLowerCase();
    filtered = filtered.filter(item => 
      item.author.toLowerCase().includes(searchTerm)
    );
  }
  
  if (filters.searchLevel) {
    const searchTerm = filters.searchLevel.toLowerCase();
    filtered = filtered.filter(item => 
      item.levelName.toLowerCase().includes(searchTerm)
    );
  }
  
  if (filters.selectedYear) {
    filtered = filtered.filter(item => 
      item.year.toString() === filters.selectedYear
    );
  }
  
  // 过滤评分方案
  if (filters.scoringSchemes) {
    const enabledSchemes = Object.entries(filters.scoringSchemes)
      .filter(([_, enabled]) => enabled)
      .map(([scheme]) => scheme);
    
    // 只有当有选中的方案时才进行过滤
    if (enabledSchemes.length > 0) {
      filtered = filtered.filter(item => enabledSchemes.includes(item.scoringScheme));
    }
  }
  
  return filtered;
}

/**
 * 应用过滤器到多关排名
 */
function applyMultiLevelFilters(items: MultiLevelRankingItem[], filters?: RankingFilters): MultiLevelRankingItem[] {
  if (!filters) return items;
  
  let filtered = items;
  
  if (filters.searchPlayer) {
    const searchTerm = filters.searchPlayer.toLowerCase();
    filtered = filtered.filter(item => 
      item.author.toLowerCase().includes(searchTerm)
    );
  }
  
  if (filters.searchLevel) {
    const searchTerm = filters.searchLevel.toLowerCase();
    filtered = filtered.filter(item => 
      item.levelName.toLowerCase().includes(searchTerm)
    );
  }
  
  if (filters.selectedYear) {
    filtered = filtered.filter(item => 
      item.year.toString() === filters.selectedYear
    );
  }
  
  // 过滤评分方案
  if (filters.scoringSchemes) {
    const enabledSchemes = Object.entries(filters.scoringSchemes)
      .filter(([_, enabled]) => enabled)
      .map(([scheme]) => scheme);
    
    // 只有当有选中的方案时才进行过滤
    if (enabledSchemes.length > 0) {
      filtered = filtered.filter(item => enabledSchemes.includes(item.scoringScheme));
    }
  }
  
  return filtered;
}

/**
 * 应用过滤器到原始得分率排名
 */
function applyOriginalScoreFilters(items: OriginalScoreRankingItem[], filters?: RankingFilters): OriginalScoreRankingItem[] {
  if (!filters) return items;
  
  let filtered = items;
  
  if (filters.searchPlayer) {
    const searchTerm = filters.searchPlayer.toLowerCase();
    filtered = filtered.filter(item => 
      item.author.toLowerCase().includes(searchTerm)
    );
  }
  
  if (filters.searchLevel) {
    const searchTerm = filters.searchLevel.toLowerCase();
    filtered = filtered.filter(item => 
      item.levelName.toLowerCase().includes(searchTerm)
    );
  }
  
  if (filters.selectedYear) {
    filtered = filtered.filter(item => 
      item.year.toString() === filters.selectedYear
    );
  }
  
  // 过滤评分方案
  if (filters.scoringSchemes) {
    const enabledSchemes = Object.entries(filters.scoringSchemes)
      .filter(([_, enabled]) => enabled)
      .map(([scheme]) => scheme);
    
    // 只有当有选中的方案时才进行过滤
    if (enabledSchemes.length > 0) {
      filtered = filtered.filter(item => enabledSchemes.includes(item.scoringScheme));
    }
  }
  
  return filtered;
}

/**
 * 获取所有可用的年份
 */
export async function getAvailableYears(): Promise<number[]> {
  const { levelsData } = await loadBaseData();
  const years = new Set<number>();
  
  for (const level of levelsData) {
    years.add(level.year);
  }
  
  return Array.from(years).sort((a, b) => b - a);
}
