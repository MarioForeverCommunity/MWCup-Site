/**
 * 排名相关的类型定义
 */

export interface LevelRankingItem {
  rank: number;
  levelName: string;
  author: string;
  finalScore: number;
  year: number;
  edition: string; // 如"2013年第二届"
  round: string; // 如"小组赛第一轮"
  maxScore: number;
  scoreRate: number; // 得分率（百分比）
  playerCode: string;
  roundKey: string;
  scoringScheme: string; // 评分方案 A/B/C/D/E
}

export interface MultiLevelRankingItem {
  rank: number;
  levelName: string;
  author: string;
  finalScore: number;
  year: number;
  edition: string;
  round: string;
  maxScore: number;
  scoreRate: number;
  playerCode: string;
  roundKey: string;
  scoringScheme: string; // 评分方案 A/B/C/D/E
}

export interface OriginalScoreRankingItem extends LevelRankingItem {
  originalRank: number; // 原始分排名
  scoreRateRank: number; // 得分率排名（对应单关排名中的名次）
  rankChange: number; // 排名升降（原始分排名比单关排名升/降了几位）
  originalScore: number; // 原始分（基础分）
  originalScoreRate: number; // 原始得分率
  scoreChange: number; // 上升/下降的得分率差异
  changeType: 'up' | 'down' | 'same'; // 变化类型
}

export interface RankingFilters {
  searchPlayer: string;
  searchLevel: string;
  selectedYear: string;
  scoringSchemes: {
    A: boolean;
    B: boolean;
    C: boolean;
    D: boolean;
    E: boolean;
  };
  onlyHighScore?: boolean; // 仅展示得分率高于87.000%的关卡
}
