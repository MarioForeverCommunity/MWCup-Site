import {
  getPreliminaryValidInfo,
  getDeadlines,
  getPlayerLevels,
  isLevelUploadedBeforeDeadline,
  loadLevelIndexData,
  isYearOnlyFRounds,
  type PlayerRoundData
} from './totalPointsCalculator';
import type { MWCupYamlDoc } from '../types/mwcup';

/**
 * 增强版的初赛有效题目信息获取函数
 * 返回完整的轮次选择信息，包括超时状态
 */
export async function getPreliminaryValidInfoEnhanced(year: string, playerData: PlayerRoundData, yamlData: MWCupYamlDoc): Promise<{
  validRounds: string[];
  timeoutPenalty: number;
  roundSelections: { roundIndex: number; selectedTopic: string; isTimeout: boolean }[];
  deadlineCount: number;
}> {
  // 获取基础信息
  const basicInfo = await getPreliminaryValidInfo(year, playerData, yamlData);

  // 获取详细的超时信息
  const yearNum = parseInt(year);
  const deadlineRoundKey = isYearOnlyFRounds(yamlData, year) ? 'F1' : 'I1';
  const deadlines = getDeadlines(yamlData, year, deadlineRoundKey);
  const levelFiles = await loadLevelIndexData();
  const playerCode = playerData.playerCodes?.[0] || '';
  const playerLevels = getPlayerLevels(levelFiles, playerCode, yearNum);

  // 构造详细的轮次选择信息
  const roundSelections = basicInfo.validRounds.map((roundKey, index) => {
    const deadlineIndex = index;
    let isTimeout = false;

    if (deadlineIndex < deadlines.length) {
      const playerLevel = playerLevels.find(l => l.roundKey === roundKey);
      if (playerLevel) {
        isTimeout = !isLevelUploadedBeforeDeadline(playerLevel, deadlines[deadlineIndex]);
      }
    }

    return {
      roundIndex: index + 1,
      selectedTopic: roundKey,
      isTimeout
    };
  });

  return {
    validRounds: basicInfo.validRounds,
    timeoutPenalty: basicInfo.timeoutPenalty,
    roundSelections,
    deadlineCount: deadlines.length
  };
}
