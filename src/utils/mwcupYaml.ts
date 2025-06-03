import yaml from 'js-yaml';

export async function fetchMWCupYaml(): Promise<any> {
  const res = await fetch('/data/mwcup.yaml');
  const text = await res.text();
  const doc = yaml.load(text) as any;
  return doc;
}

export interface ScheduleItem {
  stage: string; // 比赛阶段（如"预选赛"）
  content: string; // 内容（如"报名"、"抽签"等）
  start?: string;
  end?: string;
  link?: string; // 新增：链接
  multipleLinks?: string[]; // 新增：支持多个链接
}
export interface YearSchedule {
  year: string;
  items: ScheduleItem[];
}

// 阶段/内容映射表
const stageMap: Record<string, string> = {
  I: '初赛',
  P1: '预选赛',
  P2: '资格赛',
  Q: '四分之一决赛',
  S: '半决赛',
  R: '复赛',
  F: '决赛',
  registration: '报名',
  draw: '抽签',
  match: '比赛',
  judging: '评分',
  consult: '协商',
  pre_match_checkin: '报名选手签到',
  post_match_checkin: '晋级选手签到',
  promotion: '晋级名单公布',
  voting: '大众评分',
};

// 轮次映射表
const roundMap: Record<string, string> = {
  G: '小组赛',
  I: '初赛',
  Q: '四分之一决赛',
  S: '半决赛',
  R: '复赛',
  F: '决赛',
};

// 内容的排序权重
const contentOrder: Record<string, number> = {
  'registration': 1,        // 报名
  'pre_match_checkin': 2,  // 报名选手签到
  'draw': 3,                // 抽签
  'consult': 3,              // 协商
  'match': 4,              // 比赛
  'deadlines': 5,           // 截止
  'judging': 5,           // 评分
  'post_match_checkin': 6, // 晋级选手签到
  'promotion': 7,          // 晋级名单公布
};

function getStageZh(mainStage: string, season?: any) {
  // 处理带有批量轮次的抽签情况（如 Q1,Q2-draw）
  const drawMatch = mainStage.match(/^([GIQSR])(?:\d+(?:,[GIQSR]\d+)*)-draw$/);
  if (drawMatch) {
    const stageType = drawMatch[1];
    return stageType === 'I' ? '初赛' :
           stageType === 'G' ? '小组赛' :
           stageType === 'Q' ? '四分之一决赛' :
           stageType === 'S' ? '半决赛' :
           stageType === 'R' ? '复赛' : mainStage;
  }

  // 处理带有批量轮次的情况（如 I1,I2,I3,I4-I1）
  const batchMatch = mainStage.match(/^([GIQSR])(?:\d+(?:,[GIQSR]\d+)*)-/);
  if (batchMatch) {
    const stageType = batchMatch[1];
    return stageType === 'I' ? '初赛' :
           stageType === 'G' ? '小组赛' :
           stageType === 'Q' ? '四分之一决赛' :
           stageType === 'S' ? '半决赛' :
           stageType === 'R' ? '复赛' : mainStage;
  }

  // 处理热身赛标记
  if (mainStage === 'P1') {
    // 获取当前轮次的完整数据
    const roundData = Object.entries(season.rounds).find(([key]) => key === 'P1')?.[1];
    if (roundData && (roundData as any).is_warmup) {
      return '热身赛';
    }
  }

  // 处理单个轮次的情况
  const m = mainStage.match(/^([GIQSR])(\d+)?$/);
  if (m) return roundMap[m[1]] || mainStage;
  
  // 处理单轮比赛阶段的情况
  const m2 = mainStage.match(/^([GIQSR])-\w+$/);
  if (m2) return roundMap[m2[1]] || mainStage;
  
  return stageMap[mainStage] || mainStage;
}

function getContentZh(mainStage: string, contentKey: string) {
  // 处理deadline的情况
  const deadlineMatch = mainStage.match(/^([GIQSR])(?:\d+(?:,[GIQSR]\d+)*)-deadline(\d+)$/);
  if (deadlineMatch) {
    const num = Number(deadlineMatch[2]);
    const cnNum = ['零','一','二','三','四','五','六','七','八','九','十'][num] || num;
    return `第${cnNum}关上传截止`;
  }
  // 处理评分截止
  const judgingDeadlineMatch = mainStage.match(/^([GIQSR])(?:\d+(?:,[GIQSR]\d+)*)-judging-deadline(\d+)$/);
  if (judgingDeadlineMatch) {
    const num = Number(judgingDeadlineMatch[2]);
    const cnNum = ['零','一','二','三','四','五','六','七','八','九','十'][num] || num;
    return `第${cnNum}关评分截止`;
  }

  // 处理抽签的情况
  if (mainStage.endsWith('-draw')) {
    return '抽签';
  }

  // 处理批量轮次的promotion
  const promotionMatch = mainStage.match(/^([GIQSR])(?:\d+(?:,[GIQSR]\d+)*)-promotion$/);
  if (promotionMatch || contentKey === 'promotion') {
    return stageMap['promotion'];
  }

  // 处理带有批量轮次的情况（如 I1,I2,I3,I4-I1）
  const batchMatch = mainStage.match(/^([GIQSR])(?:\d+(?:,[GIQSR]\d+)*)-([A-Za-z]+)(\d+)?$/);
  if (batchMatch) {
    const [, stageType, action, num] = batchMatch;
    if (action.match(/^[GIQSR]$/)) {
      // 处理题目公布（如 I1,I2,I3,I4-I1）
      const topicNum = Number(num);
      const cnNum = ['零','一','二','三','四','五','六','七','八','九','十'][topicNum] || topicNum;
      return `第${cnNum}题公布`;
    } else if (action === 'deadline') {
      // 处理截止时间
      const deadlineNum = Number(num);
      const cnNum = ['零','一','二','三','四','五','六','七','八','九','十'][deadlineNum] || deadlineNum;
      return `第${cnNum}轮截止`;
    } else if (action === 'match') {
      return '比赛开始';
    } else if (action === 'judging') {
      return '评分';
    } else if (action === 'draw') {
      return '抽签';
    }
  }

  // 处理常规轮次
  const m = mainStage.match(/^([GIQSR])(\d+)$/);
  let roundStr = '';
  if (m) {
    const num = Number(m[2]);
    const cnNum = ['零','一','二','三','四','五','六','七','八','九','十'][num] || num;
    roundStr = `第${cnNum}轮`;
  }
  const contentZh = stageMap[contentKey] || contentKey;
  if (roundStr && contentZh) return `${roundStr}${contentZh}`;
  if (roundStr) return roundStr;
  
  // 处理单轮比赛阶段的情况
  const m2 = mainStage.match(/^([GIQSR])-(\w+)$/);
  if (m2 && contentKey === '') {
    return stageMap[m2[2]] || m2[2];
  }
  
  return contentZh || '';
}

function getTidLink(tid: string, type: 'tieba' | 'archive' | 'mf' = 'tieba') {
  if (!tid) return '';
  if (type === 'mf') return `https://www.marioforever.net/thread-${tid}-1-1.html`;
  if (type === 'archive') return `https://archive.marioforever.net/post/${tid}`;
  return `https://tieba.baidu.com/p/${tid}`;
}

// 自动展开批量轮次（如 [G1, G2, G3, G4]）为独立轮次
type Season = any;
function expandRounds(season: Season): Season {
  if (!season.rounds) return season;
  const expanded: Record<string, any> = {};
  for (const key in season.rounds) {
    if (/^\[.*\]$/.test(key)) {
      const rounds = key.replace(/\[|\]/g, '').split(',').map(r => r.trim());
      for (const r of rounds) {
        expanded[r] = season.rounds[key];
      }
    } else {
      expanded[key] = season.rounds[key];
    }
  }
  return { ...season, rounds: expanded };
}

// 获取内容的排序权重
function getContentWeight(content: string) {
  // 处理带有数字的内容（如"第一轮截止"）
  if (content.includes('关上传截止')) return 4.5;
  if (content.includes('关评分截止')) return 4.7;
  if (content === '评分') return 4.6;
  if (content === '晋级名单公布') return 4.8;
  if (content.includes('题公布')) return 4.2;
  if (content === '比赛开始') return 4;
  
  // 对于基础内容类型使用预定义的权重
  for (const [key, weight] of Object.entries(contentOrder)) {
    if (content === stageMap[key]) return weight;
  }
  return 999; // 未知内容类型放到最后
}

// 获取 schedule 表结构
export function getYearSchedules(doc: any, tidType: 'tieba' | 'archive' | 'mf' = 'tieba'): YearSchedule[] {
  const result: YearSchedule[] = [];
  const seasonObj = doc?.season ? doc.season : doc;
  if (!seasonObj || typeof seasonObj !== 'object') return result;
  for (const year of Object.keys(seasonObj)) {
    const season = seasonObj[year];
    // 合并主 schedule 和所有 rounds 下的 schedule
    let schedule: Record<string, any> = {};
    if (season && typeof season.rounds === 'object' && season.rounds !== null) {
      for (const [roundKey, roundVal] of Object.entries(season.rounds)) {
        if (roundVal && typeof (roundVal as any).schedule === 'object' && (roundVal as any).schedule !== null) {
          const scheduleObj = (roundVal as any).schedule;
          
          // 处理带有topics和deadlines的轮次（初赛、小组赛、复赛等）
          if (scheduleObj.topics || scheduleObj.deadlines || scheduleObj.draw || scheduleObj.match?.deadlines) {

            // 处理题目发布时间
            if (scheduleObj.topics) {
              for (const [topicKey, topicValue] of Object.entries(scheduleObj.topics)) {
                if (typeof topicValue === 'object' && topicValue !== null) {
                  schedule[`${roundKey}-${topicKey}`] = {
                    time: (topicValue as any).time,
                    tieba_tid: (topicValue as any).tieba_tid,
                    mf_tid: (topicValue as any).mf_tid
                  };
                }
              }
            }

            // 处理独立的deadlines
            if (scheduleObj.deadlines) {
              scheduleObj.deadlines.forEach((deadline: string, index: number) => {
                schedule[`${roundKey}-deadline${index + 1}`] = {
                  time: deadline
                };
              });
            }

            // 处理比赛开始时间和deadlines
            if (scheduleObj.match) {
              if (scheduleObj.match.deadlines) {
                // 添加比赛开始时间
                schedule[`${roundKey}-match`] = {
                  time: scheduleObj.match.start,
                  tieba_tid: scheduleObj.match.tieba_tid,
                  mf_tid: scheduleObj.match.mf_tid
                };
                
                // 添加每轮截止时间
                scheduleObj.match.deadlines.forEach((deadline: string, index: number) => {
                  schedule[`${roundKey}-deadline${index + 1}`] = {
                    time: deadline
                  };
                });
              } else {
                schedule[`${roundKey}-match`] = scheduleObj.match;
              }
            }
            
            // 处理评分帖
            if (scheduleObj.judging) {
              const judgingData = scheduleObj.judging;
              // 添加评分截止时间的处理
              if (judgingData.deadlines) {
                judgingData.deadlines.forEach((deadline: string, index: number) => {
                  schedule[`${roundKey}-judging-deadline${index + 1}`] = {
                    time: deadline
                  };
                });
              }
              // 处理评分帖
              if ((judgingData.mf_tid && typeof judgingData.mf_tid === 'object') || 
                  (judgingData.tieba_tid && typeof judgingData.tieba_tid === 'object')) {
                // 如果有mf_tid就用mf_tid，否则用tieba_tid
                const usesMfTid = judgingData.mf_tid && typeof judgingData.mf_tid === 'object';
                const judgingTids = usesMfTid ? judgingData.mf_tid : (judgingData.tieba_tid || {});
                const linkType = usesMfTid ? 'mf' : 'tieba';
                
                const links: string[] = [];
                for (const [topic, tid] of Object.entries(judgingTids)) {
                  if (tid) {
                    const num = topic.match(/[GIQSR](\d+)/)?.[1] || topic.match(/(\d+)$/)?.[1];
                    const cnNum = num ? `第${['零','一','二','三','四','五','六','七','八','九','十'][Number(num)] || num}题` : '链接';
                    links.push(`<a href="${getTidLink(tid as string, linkType)}" target="_blank">${cnNum}</a>`);
                  }
                }
                if (links.length > 0) {
                  schedule[`${roundKey}-judging`] = {
                    start: judgingData.start,
                    end: judgingData.end,
                    links
                  };
                }
              }
            }
          }
          
          // 分类全局性内容和轮次性内容
          const globalKeys = ['draw', 'registration', 'pre_match_checkin', 'post_match_checkin', 'promotion'];
          
          // 处理全局性内容
          for (const [subStage, subValue] of Object.entries(scheduleObj)) {
            if (globalKeys.includes(subStage)) {
              const key = `${roundKey}-${subStage}`;
              if (!schedule[key] || (
                (typeof subValue === 'object' && subValue !== null) && 
                ((subValue as any).start || (subValue as any).time)
              )) {
                schedule[key] = subValue;
              }
              continue;
            }
          }

          // 处理轮次性内容
          for (const [subStage, subValue] of Object.entries(scheduleObj)) {
            if (globalKeys.includes(subStage)) continue;

            // 处理嵌套的轮次内容（如 G1, G2 等）
            if (typeof subValue === 'object' && subValue !== null && !('start' in subValue) && !('end' in subValue)) {
              const roundNum = subStage.match(/[GIQSR](\d+)/)?.[1];
              if (roundNum) {
                for (const [action, actionValue] of Object.entries(subValue)) {
                  schedule[`${subStage}-${action}`] = actionValue;
                }
              }
              continue;
            }

            // 处理普通内容
            const timeKey = typeof subValue === 'object' && subValue !== null ? 
              `${(subValue as any).start}-${(subValue as any).end}` : '';
            for (const rk of roundKey.split(',')) {
              const newKey = `${rk}-${subStage}`;
              if (timeKey && Object.entries(schedule).some(([k, v]) => 
                typeof v === 'object' && v !== null &&
                `${(v as any).start}-${(v as any).end}` === timeKey &&
                k.endsWith(`-${subStage}`)
              )) {
                continue;
              }
              schedule[newKey] = subValue;
            }
          }
        }
      }
    }
    if (!schedule || typeof schedule !== 'object') continue;
    const items: ScheduleItem[] = [];
    const processedTimes = new Set<string>();

    for (const [stage, value] of Object.entries(schedule)) {
      if (!value) continue;
      // 拆分主阶段和内容
      let mainStage = stage;
      let contentKey = '';
      const m = stage.match(/^(G\d+|I\d+|Q\d+|S\d+|P1|P2|F)-(\w+)$/);
      if (m) {
        mainStage = m[1];
        contentKey = m[2];
      }
      const stageZh = getStageZh(mainStage, season);
      const contentZh = contentKey === 'draw' ? '抽签' : getContentZh(mainStage, contentKey);

      if (typeof value === 'object' && value !== null) {
        const v = value as Record<string, any>;
        if (v.links) {
          items.push({
            stage: stageZh,
            content: contentZh,
            start: v.start,
            end: v.end,
            multipleLinks: v.links
          });
        } else {
          // 处理带有time字段的情况（主要用于抽签）
          if (v.time) {
            const timeKey = `${v.time}-${contentZh}`;
            if (!processedTimes.has(timeKey)) {
              processedTimes.add(timeKey);
              let link = '';
              if (v.tieba_tid) link = getTidLink(v.tieba_tid, 'tieba');
              if (v.mf_tid) link = getTidLink(v.mf_tid, 'mf');
              items.push({
                stage: stageZh,
                content: contentZh,
                start: v.time,
                end: v.time,
                link: link || undefined,
              });
            }
            continue;
          }

          // 处理带有start/end的情况
          if ('start' in v && 'end' in v) {
            const timeKey = `${v.start}-${v.end}-${contentZh}`;
            if (!processedTimes.has(timeKey)) {
              processedTimes.add(timeKey);
              let link = '';
              if (v.tieba_tid) link = getTidLink(v.tieba_tid, 'tieba');
              if (v.mf_tid) link = getTidLink(v.mf_tid, 'mf');
              items.push({
                stage: stageZh,
                content: contentZh,
                start: v.start,
                end: v.end,
                link: link || undefined,
              });
            }
          }
        }
      } else if (typeof value === 'string') {
        items.push({
          stage: stageZh,
          content: contentZh,
        });
      }
    }
    if (items.length > 0) {
      // 按轮次分组
      const roundGroups = new Map<string, ScheduleItem[]>();
      for (const item of items) {
        if (!roundGroups.has(item.stage)) {
          roundGroups.set(item.stage, []);
        }
        roundGroups.get(item.stage)!.push(item);
      }
      
      // 对每个轮次内的内容进行排序
      const sortedItems: ScheduleItem[] = [];
      for (const [, roundItems] of roundGroups) {
        // 去除重复的比赛开始项
        const uniqueItems = roundItems.filter((item, index, self) => 
          !(item.content === '比赛开始' && 
            self.findIndex(i => i.content === '比赛开始' && 
                               i.start === item.start && 
                               i.end === item.end) !== index)
        );
        
        uniqueItems.sort((a, b) => {
          const weightA = getContentWeight(a.content);
          const weightB = getContentWeight(b.content);
          
          if (weightA !== weightB) return weightA - weightB;
          
          // 如果权重相同，按照时间排序
          if (a.start && b.start) return new Date(a.start).getTime() - new Date(b.start).getTime();
          if (a.start) return -1;
          if (b.start) return 1;
          return 0;
        });
        sortedItems.push(...uniqueItems);
      }
      
      result.push({ year, items: sortedItems });
    }
  }
  return result;
}
