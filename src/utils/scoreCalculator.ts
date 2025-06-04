/**
 * 比赛评分计算工具类
 */

export interface ScoreRecord {
  playerCode: string;
  judgeCode: string;
  originalJudgeCode: string; // 添加原始judge code
  playerName: string;
  judgeName: string;
  scores: { [key: string]: number };
  bonusPoints?: number;
  penaltyPoints?: number;
  totalScore: number;
  isRevoked?: boolean;
  isBackup?: boolean;
  isCollaborative?: boolean;
  collaborativeJudges?: string[];
}

export interface PlayerScore {
  playerCode: string;
  playerName: string;
  records: ScoreRecord[];
  totalSum: number;
  averageScore: number;
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
    const playerCodeIndex = headers.findIndex(h => h === '选手码');
    const judgeCodeIndex = headers.findIndex(h => h === '评委');
    
    if (playerCodeIndex === -1) {
      throw new Error('CSV格式错误：找不到"选手码"列');
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

  // 先解析所有记录，但不处理评委名称
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 2) continue;

    const playerCode = values[playerCodeIndex]?.trim();
    const judgeCode = values[judgeCodeIndex]?.trim();
    
    if (!playerCode || !judgeCode || judgeCode === 'CANCELED') continue;

    // 解析评委信息
    const judgeInfo = parseJudgeCode(judgeCode);
    const playerName = getPlayerName(playerCode, playerMap);

    // 解析分数
    const scores: { [key: string]: number } = {};
    let totalScore = 0;
    let bonusPoints = 0;
    let penaltyPoints = 0;

    for (let j = 2; j < headers.length && j < values.length; j++) {
      const header = headers[j].trim();
      const value = values[j]?.trim();
      
      if (value && value !== '') {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          scores[header] = numValue;
          
          if (header === '加分项') {
            bonusPoints = numValue;
          } else if (header === '扣分项') {
            penaltyPoints = numValue;
          } else if (header !== '换算后大众评分') {
            totalScore += numValue;
          }
        }
      }
    }

    // 计算最终总分（四舍五入到一位小数）
    const finalScore = Math.round((totalScore + bonusPoints - penaltyPoints) * 10) / 10;

    records.push({
      playerCode,
      judgeCode: judgeInfo.originalCode,
      originalJudgeCode: judgeCode, // 保存原始的judge code
      playerName,
      judgeName: '', // 暂时为空，稍后填充
      scores,
      bonusPoints: bonusPoints || undefined,
      penaltyPoints: penaltyPoints || undefined,
      totalScore: finalScore,
      isRevoked: judgeInfo.isRevoked,
      isBackup: judgeInfo.isBackup,
      isCollaborative: judgeInfo.isCollaborative,
      collaborativeJudges: judgeInfo.collaborativeJudges
    });
  }  // 现在填充评委名称（可以访问所有记录来判断重评）
  for (const record of records) {
    const judgeInfo = parseJudgeCode(record.originalJudgeCode);
    record.judgeName = getJudgeName(record.judgeCode, playerMap, judgeInfo, records, record.playerCode);
  }

  // 计算选手总分
  const playerScores = calculatePlayerScores(records);

  // 确定要显示的列（排除全为空的列）
  const displayColumns = determineDisplayColumns(headers, records);
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
function parseJudgeCode(judgeCode: string) {
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

  // 检查是否为协商评分（用引号包围）
  if (originalCode.startsWith('"') && originalCode.endsWith('"')) {
    isCollaborative = true;
    const innerCode = originalCode.slice(1, -1);
    collaborativeJudges = innerCode.split(',').map(j => j.trim());
    originalCode = innerCode;
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
function buildPlayerJudgeMap(yamlData: any, year: string, round: string) {
  const seasonData = yamlData.season[year];
  const roundData = seasonData?.rounds?.[round];
  
  if (!roundData) {
    return { players: {}, judges: {} };
  }

  const players: { [key: string]: string } = {};
  const judges: { [key: string]: string } = {};

  // 收集选手映射
  if (roundData.players) {
    for (const group of Object.values(roundData.players) as any[]) {
      if (typeof group === 'object' && group !== null) {
        for (const [code, name] of Object.entries(group)) {
          if (typeof name === 'string') {
            players[code] = name;
          }
        }
      }
    }
  }

  // 收集评委映射
  if (roundData.judges) {
    for (const group of Object.values(roundData.judges) as any[]) {
      if (typeof group === 'object' && group !== null) {
        for (const [code, name] of Object.entries(group)) {
          if (typeof name === 'string') {
            judges[code] = name;
          }
        }
      }
    }
  }

  return { players, judges };
}

/**
 * 获取选手姓名
 */
function getPlayerName(playerCode: string, playerMap: any): string {
  return playerMap.players[playerCode] || playerCode;
}

/**
 * 获取评委姓名
 */
function getJudgeName(judgeCode: string, playerMap: any, judgeInfo: any, allRecords: ScoreRecord[], playerCode: string): string {
  if (judgeInfo.isCollaborative && judgeInfo.collaborativeJudges) {
    const names = judgeInfo.collaborativeJudges.map((j: string) => {
      const baseName = playerMap.judges[j] || j;
      if (j.includes('JR')) {
        // 检查是否有对应的作废评分来判断是重评还是预备
        const baseJudgeCode = j.replace('JR', 'J');
        const hasRevokedJudge = allRecords.some(r => 
          r.playerCode === playerCode && 
          r.isRevoked && 
          r.judgeCode.replace(/^~/, '') === baseJudgeCode
        );
        return hasRevokedJudge ? `${baseName}（重评）` : `${baseName}（预备）`;
      }
      return baseName;
    });
    return names.join('、');
  }

  const baseName = playerMap.judges[judgeCode] || judgeCode;
  
  if (judgeInfo.isBackup) {
    // 检查是否有对应的作废评分来判断是重评还是预备
    let baseJudgeCode = judgeCode;
    if (judgeCode.match(/^JR\d*$/)) {
      // JR1 -> J1, JR -> J1 (假设默认对应J1)
      baseJudgeCode = judgeCode.replace('JR', 'J');
      if (baseJudgeCode === 'J') {
        baseJudgeCode = 'J1';
      }
    }
    
    const hasRevokedJudge = allRecords.some(r => 
      r.playerCode === playerCode && 
      r.isRevoked && 
      r.judgeCode.replace(/^~/, '') === baseJudgeCode
    );
    return hasRevokedJudge ? `${baseName}（重评）` : `${baseName}（预备）`;
  }
  
  return baseName;
}

/**
 * 计算选手总分
 */
function calculatePlayerScores(records: ScoreRecord[]): PlayerScore[] {
  const playerGroups: { [key: string]: ScoreRecord[] } = {};
  
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

    const totalSum = validRecords.reduce((sum, record) => sum + record.totalScore, 0);
    const averageScore = Math.round((totalSum / validRecords.length) * 10) / 10;

    playerScores.push({
      playerCode,
      playerName: validRecords[0].playerName,
      records: validRecords,
      totalSum: Math.round(totalSum * 10) / 10,
      averageScore,
      validRecordsCount: validRecords.length
    });
  }

  // 按平均分降序排序
  playerScores.sort((a, b) => b.averageScore - a.averageScore);

  return playerScores;
}

/**
 * 确定要显示的列（排除全为空的列）
 */
function determineDisplayColumns(headers: string[], records: ScoreRecord[]): string[] {
  const displayColumns: string[] = [];
  
  for (const header of headers) {
    if (header === '选手码' || header === '评委') {
      continue; // 这些列不在scores中，单独处理
    }
    
    // 检查这一列是否有非空值
    const hasValue = records.some(record => 
      record.scores[header] !== undefined && 
      record.scores[header] !== null &&
      record.scores[header] !== 0
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

  const roundData = seasonData.rounds?.[round];
  if (!roundData) {
    throw new Error(`找不到${year}年${round}轮的比赛数据`);
  }
  
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
        
        const record: ScoreRecord = {
          playerCode,
          judgeCode: 'TOTAL',
          originalJudgeCode: 'TOTAL',
          playerName,
          judgeName: '总评',
          scores: { '总分': score },
          totalScore: score,
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
          totalSum: score,
          averageScore: score,
          validRecordsCount: 1
        });
      }
    }
    
    // 按平均分降序排序
    playerScores.sort((a, b) => b.averageScore - a.averageScore);
    
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
