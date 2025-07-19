/**
 * 增强版初赛有效题目信息计算
 * 返回详细的轮次选择信息，支持正确的有效题目列显示
 */

import { Decimal } from 'decimal.js';

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

// 从主文件导入需要的函数
import { 
  loadLevelIndexData, 
  getPlayerLevels, 
  getDeadlines, 
  isLevelUploadedBeforeDeadline 
} from './totalPointsCalculator';

/**
 * 计算并返回初赛选中关卡和超时罚分
 * 返回详细的轮次选择信息，支持正确的有效题目列显示
 */
export async function getPreliminaryValidInfoEnhanced(year: string, playerData: any, yamlData: any): Promise<{ 
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
  if (levelScores.length === 0) return { 
    validRounds: [], 
    timeoutPenalty: 0, 
    roundSelections: [], 
    deadlineCount: deadlines.length 
  };

  const selectCount = yearNum === 2021 ? 3 : 2;
  const selected: { roundKey: string; score: Decimal; level: LevelFile }[] = [];
  let penalty = 0;

  if (deadlines.length >= 2) {
    // 第一截止线
    const before1 = levelScores.filter(ls => isLevelUploadedBeforeDeadline(ls.level, deadlines[0]));
    if (before1.length) {
      before1.sort((a, b) => b.score.comparedTo(a.score));
      selected.push(before1[0]);
    } else {
      penalty += 5;
    }

    if (selectCount > 1) {
      const remaining1 = levelScores.filter(ls => !selected.some(s => s.roundKey === ls.roundKey) && isLevelUploadedBeforeDeadline(ls.level, deadlines[1]));
      if (remaining1.length) {
        remaining1.sort((a, b) => b.score.comparedTo(a.score));
        selected.push(remaining1[0]);
      } else {
        penalty += 5;
      }
    }

    if (selectCount > 2 && deadlines.length >= 3) {
      const remaining2 = levelScores.filter(ls => !selected.some(s => s.roundKey === ls.roundKey) && isLevelUploadedBeforeDeadline(ls.level, deadlines[2]));
      if (remaining2.length) {
        remaining2.sort((a, b) => b.score.comparedTo(a.score));
        selected.push(remaining2[0]);
      } else {
        penalty += 5;
      }
    }
  }

  if (selected.length < selectCount) {
    const rest = levelScores.filter(ls => !selected.some(s => s.roundKey === ls.roundKey));
    rest.sort((a, b) => b.score.comparedTo(a.score));
    for (const r of rest) {
      if (selected.length >= selectCount) break;
      selected.push(r);
    }
  }

  // 构造轮次选择信息
  const roundSelections: { roundIndex: number; selectedTopic: string; isTimeout: boolean }[] = [];
  
  // 根据选择顺序构造轮次信息
  selected.forEach((sel, index) => {
    // 检查是否超时
    let isTimeout = false;
    if (yearNum === 2021) {
      // 2021年复杂规则：根据截止时间判断
      const deadlineIndex = index < deadlines.length ? index : deadlines.length - 1;
      const deadline = deadlines[deadlineIndex];
      if (deadline && !isLevelUploadedBeforeDeadline(sel.level, deadline)) {
        isTimeout = true;
      }
    } else {
      // 2020年和2022年之后简单规则
      const deadlineIndex = Math.min(index, deadlines.length - 1);
      const deadline = deadlines[deadlineIndex];
      if (deadline && !isLevelUploadedBeforeDeadline(sel.level, deadline)) {
        isTimeout = true;
      }
    }
    
    roundSelections.push({
      roundIndex: index + 1, // 第1轮、第2轮、第3轮
      selectedTopic: sel.roundKey, // 选中的题目（如I2、I4、I1）
      isTimeout
    });
  });
  
  return { 
    validRounds: selected.map(s => s.roundKey), 
    timeoutPenalty: penalty,
    roundSelections,
    deadlineCount: deadlines.length
  };
}
