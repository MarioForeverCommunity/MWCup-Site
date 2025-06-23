// 成绩显示格式化工具函数
// 用于统一TotalPointsRanking.vue和PlayerRecords.vue中的成绩显示格式

export interface ResultFormatterOptions {
  year: string;
  yamlData: any;
}

/**
 * 格式化成绩显示
 * 此函数与TotalPointsRanking.vue中的formatResultDisplay函数保持完全一致
 */
export function formatResultDisplay(bestResult: string, options: ResultFormatterOptions): string {
  const { year, yamlData } = options;
  
  // 获取特定轮次的选手数量
  const getPlayerCountForRound = (roundCode: string): number => {
    if (!yamlData?.season?.[year]?.rounds) return 0;
    
    const rounds = yamlData.season[year].rounds;
    let playerCount = 0;
    
    // 查找对应轮次的配置
    const roundData = rounds[roundCode] || 
                     rounds[`[${roundCode}]`] || 
                     rounds[`${roundCode}`] ||
                     Object.entries(rounds).find(([key]) => key.includes(roundCode))?.[1];
    
    if (!roundData?.players) return 0;
    
    // 计算选手数量（每个组的选手总和）
    Object.values(roundData.players).forEach((group: any) => {
      if (typeof group === 'object') {
        playerCount += Object.keys(group).length;
      }
    });
    
    return playerCount;
  };

  // 如果是"仅报名"，需要根据年份显示对应的轮次/强度
  if (bestResult === '仅报名') {
    // 根据年份判断是"小组赛"还是"初赛"
    const yearNum = Number(year);
    
    if (yearNum >= 2020) {
      // 2020年及之后使用"初赛"
      // 获取初赛选手数
      let playerCount = 0;
      const roundsData = yamlData?.season?.[year]?.rounds;
      if (roundsData) {
        // 寻找初赛配置
        const prelimRoundKey = Object.keys(roundsData).find(key => 
          key.includes('I1') || key === 'I'
        );
        
        if (prelimRoundKey && roundsData[prelimRoundKey]?.players) {
          // 计算选手数量
          Object.values(roundsData[prelimRoundKey].players).forEach((group: any) => {
            if (typeof group === 'object') {
              playerCount += Object.keys(group).length;
            } else if (Array.isArray(group)) {
              playerCount += group.length;
            }
          });
        }
      }
      
      return playerCount > 0 ? `初赛/${playerCount}强` : '初赛/16强';
    } else {
      // 2019年及之前使用"小组赛"
      // 获取小组赛选手数
      let playerCount = 0;
      const roundsData = yamlData?.season?.[year]?.rounds;
      if (roundsData) {
        // 寻找小组赛配置
        const groupRoundKey = Object.keys(roundsData).find(key => 
          key.includes('G1') && (key.includes('G2') || key.includes('G3') || key.includes('G4'))
        );
        
        if (groupRoundKey && roundsData[groupRoundKey]?.players) {
          // 计算选手数量
          Object.values(roundsData[groupRoundKey].players).forEach((group: any) => {
            if (typeof group === 'object') {
              playerCount += Object.keys(group).length;
            }
          });
        }
      }
      
      return playerCount > 0 ? `小组赛/${playerCount}强` : '小组赛/16强';
    }
  }
  
  // 决赛的具体排名（冠军、亚军等）
  if (bestResult.includes('冠军') || bestResult.includes('亚军') || bestResult.includes('季军') || bestResult.includes('第四名') || bestResult.includes('决赛第')) {
    return bestResult;
  }
  
  // 为轮次补充X强信息
  if (bestResult === '决赛') {
    return '决赛/4强'; // 进入决赛一般为4强
  } else if (bestResult === '半决赛') {
    return '半决赛/4强';
  } else if (bestResult === '复赛' || bestResult.startsWith('复赛')) {
    // 获取复赛选手数
    const playerCount = getPlayerCountForRound('R') || getPlayerCountForRound('R1');
    return playerCount > 0 ? `复赛/${playerCount}强` : '复赛/8强';
  } else if (bestResult === '四分之一决赛') {
    return '四分之一决赛/8强';
  } else if (bestResult === '小组赛') {
    // 获取小组赛选手数
    let playerCount = 0;
    const roundsData = yamlData?.season?.[year]?.rounds;
    if (roundsData) {
      // 寻找小组赛配置
      const groupRoundKey = Object.keys(roundsData).find(key => 
        key.includes('G1') && (key.includes('G2') || key.includes('G3') || key.includes('G4'))
      );
      
      if (groupRoundKey && roundsData[groupRoundKey]?.players) {
        // 计算选手数量
        Object.values(roundsData[groupRoundKey].players).forEach((group: any) => {
          if (typeof group === 'object') {
            playerCount += Object.keys(group).length;
          }
        });
      }
    }
    
    return playerCount > 0 ? `小组赛/${playerCount}强` : '小组赛/16强';
  } else if (bestResult === '初赛' || bestResult.startsWith('初赛')) {
    // 获取初赛选手数
    let playerCount = 0;
    const roundsData = yamlData?.season?.[year]?.rounds;
    if (roundsData) {
      // 寻找初赛配置
      const prelimRoundKey = Object.keys(roundsData).find(key => 
        key.includes('I1') || key === 'I'
      );
      
      if (prelimRoundKey && roundsData[prelimRoundKey]?.players) {
        // 计算选手数量
        Object.values(roundsData[prelimRoundKey].players).forEach((group: any) => {
          if (typeof group === 'object') {
            playerCount += Object.keys(group).length;
          } else if (Array.isArray(group)) {
            playerCount += group.length;
          }
        });
      }
    }
    
    return playerCount > 0 ? `初赛/${playerCount}强` : '初赛/16强';
  }
  
  return bestResult;
}
