/**
 * 比赛评分计算工具类
 */

import { Decimal } from 'decimal.js';

// 设置Decimal的精度和舍入模式
Decimal.set({ precision: 10, rounding: Decimal.ROUND_HALF_UP });

export interface ScoreRecord {
  playerCode: string;
  judgeCode: string;
  originalJudgeCode: string;
  playerName: string;
  judgeName: string;
  scores: { [key: string]: Decimal };  // 修改为Decimal类型
  bonusPoints?: Decimal;  // 修改为Decimal类型
  penaltyPoints?: Decimal;  // 修改为Decimal类型
  totalScore: Decimal;  // 修改为Decimal类型
  isRevoked?: boolean;
  isBackup?: boolean;
  isCollaborative?: boolean;
  collaborativeJudges?: string[];
  scoringScheme?: string;
  isNoSubmission?: boolean;
  isCanceled?: boolean;
}

export interface PlayerScore {
  playerCode: string;
  playerName: string;
  records: ScoreRecord[];
  totalSum: Decimal;  // 修改为Decimal类型
  averageScore: Decimal;  // 修改为Decimal类型
  validRecordsCount: number;
}

export interface RoundScoreData {
  year: string;
  round: string;
  scoringScheme: string;
  columns: string[];
  playerScores: PlayerScore[];
  allRecords: ScoreRecord[];
}

/**
 * 评分方案配置
 */
export const SCORING_SCHEMES = {
  A: ['欣赏性', '娱乐性', '挑战性', '创新性', '加分项', '扣分项'],
  B: ['欣赏性', '设计水平', '创新性', '挑战性', '娱乐性', '加分项', '扣分项'],
  C: ['得体度', '美观度', '独特度', '思辨度', '完成度', '合理度', '有效度', '参与度', '耐玩度', '成就度', '加分项', '扣分项'],
  D: ['欣赏性', '创新性', '设计性', '游戏性', '加分项', '扣分项'],
  E: ['得体度', '美观度', '独特度', '思辨度', '完成度', '合理度', '有效度', '参与度', '耐玩度', '成就度', '加分项', '扣分项', '换算后大众评分'],
  S: ['总分'] // 特殊的总分制
};

/**
 * 解析CSV数据为评分记录
 */
export function parseCsvToScoreRecords(
  csvText: string,
  yamlData: any,
  year: string,
  round: string
): RoundScoreData {
  try {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) {
      throw new Error('CSV文件为空');
    }
    // 解析表头
    const headers = lines[0].split(',').map(h => h.trim());
    let playerCodeIndex = headers.findIndex(h => h === '选手码');
    let isUsernameFormat = false;
    
    // 如果找不到"选手码"，尝试查找"选手用户名"（用于2022P2和2023P2等特殊格式）
    if (playerCodeIndex === -1) {
      playerCodeIndex = headers.findIndex(h => h === '选手用户名');
      isUsernameFormat = true;
    }
    
    const judgeCodeIndex = headers.findIndex(h => h === '评委');
    
    if (playerCodeIndex === -1) {
      throw new Error('CSV格式错误：找不到"选手码"或"选手用户名"列');
    }
    if (judgeCodeIndex === -1) {
      throw new Error('CSV格式错误：找不到"评委"列');
    }

    // 获取当前轮次的评分方案
    const seasonData = yamlData.season[year];
    let scoringScheme = seasonData?.scoring_scheme || 'A';
    
    // 检查轮次特定的评分方案
    const roundData = seasonData?.rounds?.[round];
    if (roundData?.scoring_scheme) {
      scoringScheme = roundData.scoring_scheme;
    }

    // 验证评分方案
    const expectedColumns = SCORING_SCHEMES[scoringScheme as keyof typeof SCORING_SCHEMES];
    if (!expectedColumns) {
      throw new Error(`未知的评分方案: ${scoringScheme}`);
    }
    // 解析数据行
  const records: ScoreRecord[] = [];
  const playerMap = buildPlayerJudgeMap(yamlData, year, round);
  // 用于跟踪成绩无效的选手
  const canceledPlayers = new Set<string>();
  
  // 先解析所有记录，但不处理评委名称
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 2) continue;

    const originalPlayerValue = values[playerCodeIndex]?.trim();
    const judgeCode = values[judgeCodeIndex]?.trim();
    
    // 标记成绩无效的选手
    if (originalPlayerValue && judgeCode === 'CANCELED') {
      canceledPlayers.add(originalPlayerValue);
      continue;
    }
    
    if (!originalPlayerValue || !judgeCode) continue;

    // 解析评委信息
    const judgeInfo = parseJudgeCode(judgeCode);
    
    // 处理选手信息：根据CSV格式决定playerCode和playerName
    let playerCode: string;
    let playerName: string;
    
    if (isUsernameFormat) {
      // "选手用户名"格式：原值是用户名，需要生成或查找对应的代码
      playerName = originalPlayerValue;
      // 在这种情况下，我们使用用户名作为代码（因为没有单独的代码列）
      playerCode = originalPlayerValue;
    } else {
      // "选手码"格式：原值是代码，需要查找对应的用户名
      playerCode = originalPlayerValue;
      playerName = getPlayerName(playerCode, playerMap);
    }

    // 解析分数
    const scores: { [key: string]: Decimal } = {};
    let totalScore = new Decimal(0);
    let bonusPoints = new Decimal(0);
    let penaltyPoints = new Decimal(0);

    for (let j = 2; j < headers.length && j < values.length; j++) {
      const header = headers[j].trim();
      const value = values[j]?.trim();
      
      if (value && value !== '') {
        const numValue = new Decimal(value);
        if (!numValue.isNaN()) {
          scores[header] = numValue;
          
          if (header === '加分项') {
            bonusPoints = numValue;
          } else if (header === '扣分项') {
            penaltyPoints = numValue;
          } else if (header !== '换算后大众评分') {
            totalScore = totalScore.plus(numValue);
          }
        }
      }
    }

    // 计算最终总分（四舍五入到一位小数）
    const finalScore = totalScore.plus(bonusPoints).plus(penaltyPoints).toDecimalPlaces(1);
    // 如果是协商评分，直接从YAML中查找评委名称而不是使用CSV中的judgeCode
    const judgeName = judgeInfo.isCollaborative 
      ? judgeInfo.collaborativeJudges?.map(j => getJudgeName(j, playerMap, playerCode)).join(', ') || ''
      : '';
      
    records.push({
      playerCode,
      judgeCode: judgeInfo.originalCode,
      originalJudgeCode: judgeCode, // 保存原始的judge code
      playerName,
      judgeName: judgeName, // 协商评分的名称会在这里填充，其他评委稍后填充
      scores,
      bonusPoints: bonusPoints.isZero() ? undefined : bonusPoints,
      penaltyPoints: penaltyPoints.isZero() ? undefined : penaltyPoints,
      totalScore: finalScore,
      isRevoked: judgeInfo.isRevoked,
      isBackup: judgeInfo.isBackup,
      isCollaborative: judgeInfo.isCollaborative,
      collaborativeJudges: judgeInfo.collaborativeJudges
    });
  }
  // 检测协商评分（相同选手两个评委的所有评分子项均相同时视为协商评分）
  const playerJudgeScores: { [key: string]: { [key: string]: ScoreRecord } } = {};
  
  // 先按选手和评分项组织数据
  for (const record of records) {
    if (record.isRevoked) continue; // 跳过被作废的评分
    
    if (!playerJudgeScores[record.playerCode]) {
      playerJudgeScores[record.playerCode] = {};
    }
    
    // 生成评分指纹（所有分数项组合）
    const scoreFingerprint = Object.entries(record.scores)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => `${key}:${value}`)
      .join('|');
      
    // 记录该指纹对应的评委
    if (!playerJudgeScores[record.playerCode][scoreFingerprint]) {
      playerJudgeScores[record.playerCode][scoreFingerprint] = record;
    } else {
      // 如果找到相同指纹的评分，则这两个评委进行了协商评分
      const existingRecord = playerJudgeScores[record.playerCode][scoreFingerprint];
      // 标记两条记录都为协商评分
      existingRecord.isCollaborative = true;
      record.isCollaborative = true;
      // 收集协商评委
      existingRecord.collaborativeJudges = [existingRecord.judgeCode, record.judgeCode];
      record.collaborativeJudges = [existingRecord.judgeCode, record.judgeCode];
      // 修复：协商评分时，isBackup 只要有一个为 true，两个都设为 true
      if (existingRecord.isBackup || record.isBackup) {
        existingRecord.isBackup = true;
        record.isBackup = true;
      }
    }
  }
  
  // 现在填充评委名称（可以访问所有记录来判断重评）
  for (const record of records) {
    // 协商评分特殊处理
    if (record.isCollaborative && record.collaborativeJudges && record.collaborativeJudges.length > 0) {
      record.judgeName = record.collaborativeJudges.map(j => 
        getJudgeName(j, playerMap, record.playerCode)).join(', ');
    } else {
      record.judgeName = getJudgeName(record.judgeCode, playerMap, record.playerCode);
    }
  }
  // 为所有记录添加评分方案信息
  records.forEach(record => {
    record.scoringScheme = scoringScheme;
  });

  // 计算选手总分
  const playerScores = calculatePlayerScores(records);
  // 确定要显示的列（排除全为空的列）
  const displayColumns = determineDisplayColumns(headers, records);
  
  // 为成绩无效的选手创建特殊记录
  if (canceledPlayers.size > 0) {
    for (const playerCode of canceledPlayers) {
      // 根据CSV格式决定playerCode和playerName
      let actualPlayerCode: string;
      let playerName: string;
      
      if (isUsernameFormat) {
        playerName = playerCode;
        actualPlayerCode = playerCode;
      } else {
        actualPlayerCode = playerCode;
        playerName = getPlayerName(actualPlayerCode, playerMap);
      }
      
      // 创建一个成绩无效记录
      const canceledRecord: ScoreRecord = {
        playerCode: actualPlayerCode,
        judgeCode: "canceled",
        originalJudgeCode: "CANCELED",
        playerName,
        judgeName: "成绩无效",
        scores: {},
        totalScore: new Decimal(0),
        isCanceled: true
      };
      
      records.push(canceledRecord);
      
      // 添加到playerScores中，但不计入排名
      playerScores.push({
        playerCode: actualPlayerCode,
        playerName,
        records: [canceledRecord],
        totalSum: new Decimal(0),
        averageScore: new Decimal(0),
        validRecordsCount: 0
      });
    }
  }
  
  return {
    year,
    round,
    scoringScheme,
    columns: displayColumns,
    playerScores,
    allRecords: records
  };
  } catch (error) {
    console.error(`解析${year}${round}评分数据失败:`, error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`解析评分数据时发生未知错误: ${error}`);
    }
  }
}

/**
 * 解析CSV行，处理引号包围的内容
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

/**
 * 解析评委代码
 */
export function parseJudgeCode(judgeCode: string) {
  let isRevoked = false;
  let isBackup = false;
  let isCollaborative = false;
  let collaborativeJudges: string[] = [];
  let originalCode = judgeCode;

  // 检查是否被作废（以~开头）
  if (judgeCode.startsWith('~')) {
    isRevoked = true;
    originalCode = judgeCode.substring(1);
  }

  // 检查是否为预备评委
  if (originalCode.includes('JR')) {
    isBackup = true;
  }

  return {
    originalCode,
    isRevoked,
    isBackup,
    isCollaborative,
    collaborativeJudges
  };
}

/**
 * 构建选手和评委名称映射
 */
export function buildPlayerJudgeMap(yamlData: any, year: string, round: string) {
  const seasonData = yamlData.season[year];
  let roundData = seasonData?.rounds?.[round];
  
  // 如果直接找不到，检查是否在多轮次键中
  if (!roundData && seasonData?.rounds) {
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
  
  if (!roundData) {
    return { players: {}, judges: {} };
  }

  const players: { [key: string]: string } = {};
  const playerGroups: { [key: string]: string } = {}; // 新增：记录选手分组
  const judges: { [key: string]: string } = {};

  // 收集选手映射
  if (roundData.players) {
    if (Array.isArray(roundData.players)) {
      // 数组结构：players: [用户名1, 用户名2, ...]
      roundData.players.forEach((name: string, index: number) => {
        if (typeof name === 'string') {
          players[(index + 1).toString()] = name;
        }
      });
    } else if (typeof roundData.players === 'object') {
      // 检查是否为扁平结构或分组结构
      const firstValue = Object.values(roundData.players)[0];
      if (typeof firstValue === 'string') {
        // 扁平结构：players: { '1': 用户名, '2': 用户名, ... }
        for (const [code, name] of Object.entries(roundData.players)) {
          if (typeof name === 'string') {
            players[code] = name;
          }
        }
      } else {
        // 分组结构：players: { A: { A1: 用户名, ... }, ... }
        for (const [groupKey, group] of Object.entries(roundData.players) as [string, any][]) {
          if (typeof group === 'object' && group !== null) {
            for (const [code, name] of Object.entries(group)) {
              if (typeof name === 'string') {
                players[code] = name;
                playerGroups[code] = groupKey; // 记录选手分组
              }
            }
          }
        }
      }
    }
  }

  // 收集评委映射
  if (roundData.judges) {
    if (typeof roundData.judges === 'object' && !Array.isArray(roundData.judges)) {
      // 检查是否为扁平结构或分组结构
      const firstValue = Object.values(roundData.judges)[0];
      if (typeof firstValue === 'string') {
        // 扁平结构：judges: { J1: 用户名, J2: 用户名, ... }
        for (const [code, name] of Object.entries(roundData.judges)) {
          if (typeof name === 'string') {
            judges[code] = name;
          }
        }
      } else {
        // 分组结构：judges: { A: { J1: 用户名, J2: 用户名 }, ... }
        for (const [groupKey, group] of Object.entries(roundData.judges) as [string, any][]) {
          if (typeof group === 'object' && group !== null) {
            for (const [code, name] of Object.entries(group)) {
              if (typeof name === 'string') {
                judges[`${groupKey}-${code}`] = name; // 记录分组-评委码
              }
            }
          }
        }
      }
    }
  }

  return { players, judges, playerGroups };
}

/**
 * 获取选手名
 */
function getPlayerName(playerCode: string, playerMap: any): string {
  return playerMap.players[playerCode] || playerCode;
}

/**
 * 获取评委名
 */
function getJudgeName(judgeCode: string, playerMap: any, playerCode?: string): string {
  // 优先分组查找
  if (playerCode && playerMap.playerGroups) {
    const group = playerMap.playerGroups[playerCode];
    if (group) {
      const groupJudgeKey = `${group}-${judgeCode}`;
      if (playerMap.judges[groupJudgeKey]) {
        return playerMap.judges[groupJudgeKey];
      }
    }
  }
  // 兼容旧逻辑
  const baseName = playerMap.judges[judgeCode];
  if (!baseName && judgeCode.length > 1) {
    const parts = judgeCode.match(/^[A-Za-z]+(\d+.*)$/);
    if (parts && parts[1]) {
      const simpleCode = 'J' + parts[1];
      const simpleName = playerMap.judges[simpleCode];
      if (simpleName) {
        return simpleName;
      }
    }
  }
  return baseName || judgeCode;
}

/**
 * 计算选手总分
 */
function calculatePlayerScores(records: ScoreRecord[]): PlayerScore[] {
  const playerGroups: { [key: string]: ScoreRecord[] } = {};
  const scoringScheme = records.length > 0 ? records[0].scoringScheme : '';

  // 按选手分组
  for (const record of records) {
    if (!playerGroups[record.playerCode]) {
      playerGroups[record.playerCode] = [];
    }
    playerGroups[record.playerCode].push(record);
  }
  const playerScores: PlayerScore[] = [];
  for (const [playerCode, playerRecords] of Object.entries(playerGroups)) {
    // 过滤掉被作废的评分
    const validRecords = playerRecords.filter(r => !r.isRevoked);
    if (validRecords.length === 0) continue;

    let totalSum = new Decimal(0);
    let averageScore = new Decimal(0);
    if (scoringScheme === 'D') {
      // 方案D特殊处理
      // 1. 评委评分员（J1/J2）每人一票按两票计入，大众评分员（JZx）一票计一票
      // 2. 每个评分员的总分为其各项分数之和（含加分项、扣分项）
      // 3. 所有分数（共7票）去掉一个最高分和一个最低分，剩下5票取平均
      // 4. 评委的两票只去除一票
      //
      // 识别评委和大众评分员
      const judgeRecords: ScoreRecord[] = [];
      validRecords.forEach(r => {
        // 只统计有效评分
        judgeRecords.push(r);
      });
      // 票权展开
      const weightedScores: {score: Decimal, judgeType: 'judge'|'public', record: ScoreRecord}[] = [];
      for (const rec of judgeRecords) {
        // 评委评分员：J1/J2（或以J开头且不是JZ）
        if (/^J\d+$/i.test(rec.judgeCode)) {
          weightedScores.push({score: rec.totalScore, judgeType: 'judge', record: rec});
          weightedScores.push({score: rec.totalScore, judgeType: 'judge', record: rec});
        } else if (/^JZ\d+$/i.test(rec.judgeCode)) {
          weightedScores.push({score: rec.totalScore, judgeType: 'public', record: rec});
        } else {
          // 其他类型（如协商、预备等）按大众票处理
          weightedScores.push({score: rec.totalScore, judgeType: 'public', record: rec});
        }
      }
      // 去除一个最高分和一个最低分（评委的两票只去除一票）
      if (weightedScores.length >= 5) {
        // 先排序
        const sorted = [...weightedScores].sort((a, b) => a.score.comparedTo(b.score));
        // 找到最高分和最低分的下标
        let minIdx = 0;
        let maxIdx = sorted.length - 1;
        // 记录被去除的评委票数
        let removedJudge = 0;
        let removedPublic = 0;
        // 去除最低分
        if (sorted[minIdx].judgeType === 'judge') {
          removedJudge++;
        } else {
          removedPublic++;
        }
        // 去除最高分
        if (sorted[maxIdx].judgeType === 'judge' && removedJudge < 2) {
          removedJudge++;
        } else {
          removedPublic++;
        }
        // 构建剩余分数
        const remain: Decimal[] = [];
        for (let i = 0; i < sorted.length; i++) {
          if (i === minIdx || i === maxIdx) continue;
          remain.push(sorted[i].score);
        }
        // 取平均
        averageScore = remain.length > 0 ? remain.reduce((a, b) => a.plus(b), new Decimal(0)).div(remain.length).toDecimalPlaces(1) : new Decimal(0);
        totalSum = remain.reduce((a, b) => a.plus(b), new Decimal(0));
      } else {
        // 票数不足，直接平均
        averageScore = weightedScores.reduce((a, b) => a.plus(b.score), new Decimal(0)).div(weightedScores.length).toDecimalPlaces(1);
        totalSum = weightedScores.reduce((a, b) => a.plus(b.score), new Decimal(0));
      }
    } else if (scoringScheme === 'E') {
      // 方案E：每个选手只有一条记录，直接用该行的totalScore和换算后大众评分加权
      const record = validRecords[0];
      const judgeScore = record.totalScore;
      const publicScore = record.scores['换算后大众评分'] || new Decimal(0);
      let avg = judgeScore.times(0.75).plus(publicScore.times(0.25));
      averageScore = avg.toDecimalPlaces(1);
      totalSum = judgeScore;
    } else {
      // 其他评分方案的正常计算
      totalSum = validRecords.reduce((sum, record) => sum.plus(record.totalScore), new Decimal(0));
      averageScore = totalSum.div(validRecords.length).toDecimalPlaces(1);
    }

    // 对最终总分和平均分进行非负处理，但保留原始评分项中的负分
    totalSum = ensureNonNegativeScore(totalSum);
    averageScore = ensureNonNegativeScore(averageScore);

    playerScores.push({
      playerCode,
      playerName: validRecords[0].playerName,
      records: validRecords,
      totalSum: totalSum.toDecimalPlaces(1),
      averageScore,
      validRecordsCount: validRecords.length
    });
  }

  return playerScores;
}

/**
 * 确保分数不为负数
 */
function ensureNonNegativeScore(score: Decimal): Decimal {
  return score.isNegative() ? new Decimal(0) : score;
}

/**
 * 确定要显示的列（排除全为空的列）
 */
function determineDisplayColumns(headers: string[], records: ScoreRecord[]): string[] {
  const displayColumns: string[] = [];
    for (const header of headers) {
    if (header === '选手码' || header === '选手用户名' || header === '评委') {
      continue; // 这些列不在scores中，单独处理
    }
    
    // 检查这一列是否有非空值
    const hasValue = records.some(record => 
      record.scores[header] !== undefined && 
      record.scores[header] !== null &&
      !(record.scores[header] instanceof Decimal && record.scores[header].isZero())
    );
    
    if (hasValue) {
      displayColumns.push(header);
    }
  }
  
  return displayColumns;
}

/**
 * 加载并解析轮次评分数据
 */
export async function loadRoundScoreData(year: string, round: string, yamlData: any): Promise<RoundScoreData> {
  // 验证输入参数
  if (!year || !round) {
    throw new Error('年份和轮次参数不能为空');
  }
  
  if (!yamlData || !yamlData.season) {
    throw new Error('YAML配置数据无效');
  }
  // 检查年份和轮次是否存在
  const seasonData = yamlData.season[year];
  if (!seasonData) {
    throw new Error(`找不到${year}年的比赛数据`);
  }
  // 查找轮次数据，支持多轮次键
  let roundData = seasonData.rounds?.[round];
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
  
  if (!roundData) {
    throw new Error(`找不到${year}年${round}轮的比赛数据`);
  }
    // 加载用户映射
  // const userMapping = await loadUserMapping();
    // 首先检查是否为特殊的总分制评分
  const directScores = handleDirectScores(yamlData, year, round);
  if (directScores) {
    return directScores;
  }
  
  const csvUrl = `/data/rounds/${year}${round}.csv`;
  
  try {
    const response = await fetch(csvUrl);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`找不到评分文件: ${year}${round}.csv`);
      } else if (response.status >= 500) {
        throw new Error(`服务器错误 (${response.status}): 无法获取评分数据`);
      } else {
        throw new Error(`网络错误 (${response.status}): 无法加载评分数据`);
      }
    }
    
    const csvText = await response.text();
    if (!csvText.trim()) {
      throw new Error(`评分文件 ${year}${round}.csv 为空`);
    }
    
    return parseCsvToScoreRecords(csvText, yamlData, year, round);
  } catch (error) {
    console.error(`加载 ${year}${round} 评分数据失败:`, error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('网络连接失败，请检查网络连接或稍后重试');
    }
    throw error;
  }
}

/**
 * 处理特殊的总分制评分（如2015年半决赛）
 */
function handleDirectScores(yamlData: any, year: string, round: string): RoundScoreData | null {
  const seasonData = yamlData.season[year];
  const roundData = seasonData?.rounds?.[round];
    if (roundData?.scoring_scheme === 'S' && roundData?.scores) {
    const playerMap = buildPlayerJudgeMap(yamlData, year, round);
    const records: ScoreRecord[] = [];
    const playerScores: PlayerScore[] = [];
    
    for (const [playerCode, score] of Object.entries(roundData.scores)) {
      if (typeof score === 'number') {
        const playerName = getPlayerName(playerCode, playerMap);
        const decimalScore = new Decimal(score);
        
        const record: ScoreRecord = {
          playerCode,
          judgeCode: 'TOTAL',
          originalJudgeCode: 'TOTAL',
          playerName,
          judgeName: 'MW杯组委会',
          scores: { '总分': decimalScore },
          totalScore: decimalScore,
          isRevoked: false,
          isBackup: false,
          isCollaborative: false,
          collaborativeJudges: []
        };
        
        records.push(record);
          playerScores.push({
          playerCode,
          playerName,
          records: [record],
          totalSum: decimalScore,
          averageScore: decimalScore,
          validRecordsCount: 1
        });
      }
    }
    
    return {
      year,
      round,
      scoringScheme: 'S',
      columns: ['总分'],
      playerScores,
      allRecords: records
    };
  }
  
  return null;
}
