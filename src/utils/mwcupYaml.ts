import yaml from 'js-yaml';

export interface ScheduleItem {
  stage: string; // 比赛阶段（如“预选赛”）
  content: string; // 内容（如“报名”、“抽签”等）
  start?: string;
  end?: string;
  link?: string; // 新增：链接
}
export interface YearSchedule {
  year: string;
  items: ScheduleItem[];
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

export async function fetchMWCupYaml(): Promise<any> {
  const res = await fetch('/data/mwcup.yaml');
  const text = await res.text();
  const doc = yaml.load(text) as any;
  // 对每个赛季做批量轮次展开
  if (doc && doc.season) {
    for (const year in doc.season) {
      doc.season[year] = expandRounds(doc.season[year]);
    }
  }
  return doc;
}

// 阶段/内容映射表
const stageMap: Record<string, string> = {
  I: '初赛',
  P1: '预选赛',
  P2: '资格赛',
  Q: '四分之一决赛',
  S: '半决赛',
  F: '决赛',
  registration: '报名',
  draw: '抽签',
  match: '比赛',
  judging: '评分',
  pre_match_checkin: '报名选手签到',
  post_match_checkin: '晋级选手签到',
  promotion: '晋级名单公布',
};
// 轮次映射表
const roundMap: Record<string, string> = {
  G: '小组赛',
  I: '初赛',
  Q: '四分之一决赛',
  S: '半决赛',
};
function getTidLink(tid: string, type: 'tieba' | 'archive' | 'mf' = 'tieba') {
  if (!tid) return '';
  if (type === 'mf') return `https://www.marioforever.net/thread-${tid}-1-1.html`;
  if (type === 'archive') return `https://archive.marioforever.net/post/${tid}`;
  return `https://tieba.baidu.com/p/${tid}`;
}
function getStageZh(mainStage: string) {
  // G1 => 小组赛，I2 => 初赛，Q1 => 四分之一决赛，S2 => 半决赛
  const m = mainStage.match(/^([GIQS])(\d+)$/);
  if (m) return roundMap[m[1]] || mainStage;
  return stageMap[mainStage] || mainStage;
}
function getContentZh(mainStage: string, contentKey: string) {
  // G1-match => 第一轮比赛，I2-judging => 第二轮评分
  const m = mainStage.match(/^([GIQS])(\d+)$/);
  let roundStr = '';
  if (m) {
    const num = Number(m[2]);
    const cnNum = ['零','一','二','三','四','五','六','七','八','九','十'][num] || num;
    roundStr = `第${cnNum}轮`;
    if (m[1] === 'Q' || m[1] === 'S') roundStr = `第${cnNum}场`;
  }
  const contentZh = stageMap[contentKey] || contentKey;
  if (roundStr && contentZh) return `${roundStr}${contentZh}`;
  if (roundStr) return roundStr;
  return contentZh;
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
    if (season && typeof season.schedule === 'object' && season.schedule !== null) {
      Object.assign(schedule, season.schedule);
    }
    if (season && typeof season.rounds === 'object' && season.rounds !== null) {
      for (const [roundKey, roundVal] of Object.entries(season.rounds)) {
        if (roundVal && typeof (roundVal as any).schedule === 'object' && (roundVal as any).schedule !== null) {
          for (const [subStage, subValue] of Object.entries((roundVal as any).schedule)) {
            schedule[`${roundKey}-${subStage}`] = subValue;
          }
        }
      }
    }
    if (!schedule || typeof schedule !== 'object') continue;
    const items: ScheduleItem[] = [];
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
      const stageZh = getStageZh(mainStage);
      const contentZh = getContentZh(mainStage, contentKey);
      if (typeof value === 'object' && value !== null && ('start' in value || 'end' in value)) {
        const v = value as Record<string, any>;
        let link = '';
        if (v.tieba_tid) link = getTidLink(v.tieba_tid, tidType);
        if (v.mf_tid) link = getTidLink(v.mf_tid, 'mf');
        items.push({
          stage: stageZh,
          content: contentZh || v.content || v.desc || v.title || '',
          start: v.start,
          end: v.end,
          link: link || undefined,
        });
      } else if (typeof value === 'object' && value !== null) {
        for (const [subStage, subValue] of Object.entries(value)) {
          if (!subValue) continue;
          const contentZh2 = getContentZh(mainStage, subStage);
          if (typeof subValue === 'object' && ('start' in subValue || 'end' in subValue)) {
            const sv = subValue as Record<string, any>;
            let link = '';
            if (sv.tieba_tid) link = getTidLink(sv.tieba_tid, tidType);
            if (sv.mf_tid) link = getTidLink(sv.mf_tid, 'mf');
            items.push({
              stage: stageZh,
              content: contentZh2,
              start: sv.start,
              end: sv.end,
              link: link || undefined,
            });
          } else if (typeof subValue === 'string') {
            items.push({
              stage: stageZh,
              content: contentZh2,
            });
          }
        }
      } else if (typeof value === 'string') {
        items.push({
          stage: stageZh,
          content: value,
        });
      }
    }
    if (items.length > 0) {
      result.push({ year, items });
    }
  }
  return result;
}
