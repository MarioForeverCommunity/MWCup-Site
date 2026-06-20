import yaml from 'js-yaml';
import type { MWCupYamlDoc, SeasonYearData } from '../types/mwcup';

/**
 * 归一化 YAML 中的 tieba_tid / mf_tid 字段
 * YAML 解析时帖子 ID 是数字，统一转为字符串以便下游使用
 */
function normalizeTids(obj: unknown): void {
  if (!obj || typeof obj !== 'object') return
  const record = obj as Record<string, unknown>
  for (const key of ['tieba_tid', 'mf_tid']) {
    if (key in record) {
      const val = record[key]
      if (typeof val === 'number') {
        record[key] = String(val)
      } else if (val && typeof val === 'object') {
        const map = val as Record<string, unknown>
        for (const [k, v] of Object.entries(map)) {
          if (typeof v === 'number') map[k] = String(v)
        }
      }
    }
  }
  // 递归处理嵌套对象
  for (const val of Object.values(record)) {
    if (val && typeof val === 'object') normalizeTids(val)
  }
}

/**
 * 从指定URL加载并解析YAML文件
 * @param url YAML文件的URL路径
 * @returns 解析后的YAML数据
 */
export async function loadYamlFromUrl(url: string): Promise<MWCupYamlDoc> {
  const res = await fetch(url);
  const text = await res.text();
  const doc = yaml.load(text) as MWCupYamlDoc;
  normalizeTids(doc);
  return doc;
}

/**
 * 获取Mario Worker 杯YAML数据
 * @returns Mario Worker 杯YAML数据
 */
export async function fetchMarioWorkerYaml(): Promise<MWCupYamlDoc> {
  return await loadYamlFromUrl('/data/mwcup.yaml');
}

// 保持向后兼容性的别名
export const fetchMWCupYaml = fetchMarioWorkerYaml;

/**
 * 从YAML文档中提取季节数据
 * @param doc YAML文档对象
 * @returns 季节对象，如果没有season字段则返回doc本身
 */
export function extractSeasonData(doc: MWCupYamlDoc): Record<string, SeasonYearData> {
  return doc?.season ? doc.season : (doc as unknown as Record<string, SeasonYearData>);
}
