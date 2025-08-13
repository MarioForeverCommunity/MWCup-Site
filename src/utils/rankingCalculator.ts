/**
 * 排名计算工具类
 */

import { loadRoundScoreData, type PlayerScore } from './scoreCalculator';
import { calculateFinalPublicScore } from './scoreCalculator';
import * as YAML from 'js-yaml';
import { Decimal } from 'decimal.js';
import { getRoundChineseName } from './roundNames';
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
 * 直接使用 roundNames.ts 中的 getRoundChineseName 函数
 */
function getRoundName(roundKey: string, _roundType: string, year?: number): string {
  // _roundType 参数不使用但保留以维持函数签名兼容性
  
  // 构造必要的 roundData 对象
  const roundData: any = {
    year: year?.toString() || ''
  };
  
  // 从 YAML 数据中获取轮次信息
  if (yamlData && year) {
    const yearStr = year.toString();
    const roundInfo = yamlData?.season?.[yearStr]?.rounds?.[roundKey];
    
    if (roundInfo) {
      // 对于 P1 轮次，获取 is_warmup 属性
      if (roundKey === 'P1') {
        roundData.is_warmup = !!roundInfo.is_warmup;
      }
    }
  }
  
  return getRoundChineseName(roundKey, roundData);
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
            round: getRoundName(level.roundKey, level.roundType, level.year),
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
            round: getRoundName(item.roundKey, item.roundType, item.year),
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
          // 获取评分方案
          const scoringScheme = getScoringScheme(level.year, level.roundKey);
          
          let originalScore = 0;
          let originalScoreRate = 0;
          let calculatedOriginalScore = 0;
          
          if (scoringScheme === 'E') {
            // 评分方案E：评委评分去除附加分*75% + 大众评分去除附加分*25%
            
            // 计算评委原始分（去除加分项和扣分项）
            let judgeOriginalScoreSum = 0;
            let judgeValidCount = 0;
            for (const record of playerScore.records) {
              if (!record.isRevoked) {
                let judgeBaseScore = 0;
                for (const [key, value] of Object.entries(record.scores)) {
                  if (key !== '加分项' && key !== '扣分项') {
                    let score = typeof value === 'number' ? value : Number(value);
                    judgeBaseScore += score;
                  }
                }
                judgeOriginalScoreSum += judgeBaseScore;
                judgeValidCount++;
              }
            }
            const judgeOriginalScore = judgeValidCount > 0 ? new Decimal(judgeOriginalScoreSum).div(judgeValidCount).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber() : 0;
            
            // 计算大众原始分（去除附加分和扣分）
            let publicOriginalScore = 0;
            if (scoreData.publicScores) {
              const playerPublicScore = scoreData.publicScores.find(ps => ps.playerCode === level.playerCode);
              if (playerPublicScore && playerPublicScore.validVotesCount > 0) {
                // 收集所有投票的基础分数（不包括附加分和扣分）
                const baseScores: number[] = [];
                for (const vote of playerPublicScore.votes) {
                  // 大众评分原始分：欣赏性×1.5 + 创新性×1.5 + 设计性×3 + 游戏性×4（不包括附加分和扣分）
                  const baseScore = vote.appreciation * 1.5 + vote.innovation * 1.5 + vote.design * 3 + vote.gameplay * 4;
                  baseScores.push(baseScore);
                }
                
                // 应用基于人数的算法计算原始分
                if (baseScores.length > 0) {
                  publicOriginalScore = calculateFinalPublicScore(baseScores);
                }
              }
            }
            
            // 计算评分方案E的原始分：评委原始分*75% + 大众原始分*25%
            originalScore = new Decimal(judgeOriginalScore).times(0.75).plus(new Decimal(publicOriginalScore).times(0.25)).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber();
            calculatedOriginalScore = originalScore;
          } else {
            // 其他评分方案的原始分计算（保持原有逻辑）
            let originalScoreSum = 0;
            let validCount = 0;
            // 2013S1/2016Q2特殊：用于换算后的原始分
            let calculatedOriginalScoreSum = new Decimal(0);
            let calculatedValidCount = 0;
            for (const record of playerScore.records) {
              if (!record.isRevoked) {
                // 计算基础分总和（排除加分项和扣分项）
                let baseScore = 0;
                let calculatedBaseScore = new Decimal(0);
                for (const [key, value] of Object.entries(record.scores)) {
                  if (key !== '加分项' && key !== '扣分项') {
                    let score = typeof value === 'number' ? value : Number(value);
                    let calculatedScore = new Decimal(score);
                    // 2016年Q2轮次的欣赏性得分需要乘以10/15
                    if (year === '2016' && round === 'Q2' && key === '欣赏性') {
                      calculatedScore = new Decimal(score).times(10).div(15);
                    }
                    if (year === '2013' && round === 'S1' && key === '娱乐性') {
                      calculatedScore = new Decimal(score).times(80).div(60);
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
            originalScore = validCount > 0 ? new Decimal(originalScoreSum).div(validCount).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber() : 0;
            calculatedOriginalScore = calculatedValidCount > 0 ? new Decimal(calculatedOriginalScoreSum).div(calculatedValidCount).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber() : 0;
          }
          
          const finalScore = Number(playerScore.averageScore);
          originalScoreRate = (originalScore / maxScore.baseScore) * 100;
          const finalScoreRate = (finalScore / maxScore.totalScore) * 100;
          let scoreChange: number;
          if ((year === '2016' && round === 'Q2') || (year === '2013' && round === 'S1')) {
            scoreChange = finalScoreRate - calculatedOriginalScore;
          } else {
            scoreChange = finalScoreRate - originalScoreRate;
          }
          
          const baseItem: LevelRankingItem = {
            rank: 0,
            levelName: level.name,
            author: level.playerName,
            finalScore,
            year: level.year,
            edition: getEditionString(level.year),
            round: getRoundName(level.roundKey, level.roundType, level.year),
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
            originalScore: (year === '2016' && round === 'Q2') || (year === '2013' && round === 'S1') ? calculatedOriginalScore : originalScore, // 2016Q2/2013S1显示换算后的分数
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
  
  // 仅展示得分率高于87.000%的关卡
  if (filters.onlyHighScore) {
    filtered = filtered.filter(item => item.scoreRate > 87.0);
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
  
  // 仅展示得分率高于87.000%的关卡
  if (filters.onlyHighScore) {
    filtered = filtered.filter(item => item.scoreRate > 87.0);
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
  
  // 仅展示得分率高于87.000%的关卡
  if (filters.onlyHighScore) {
    filtered = filtered.filter(item => item.scoreRate > 87.0);
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
