import yaml from 'js-yaml';

/**
 * 从指定URL加载并解析YAML文件
 * @param url YAML文件的URL路径
 * @returns 解析后的YAML数据
 */
export async function loadYamlFromUrl(url: string): Promise<any> {
  const res = await fetch(url);
  const text = await res.text();
  const doc = yaml.load(text) as any;
  return doc;
}

/**
 * 获取Mario Worker 杯YAML数据
 * @returns Mario Worker 杯YAML数据
 */
export async function fetchMarioWorkerYaml(): Promise<any> {
  return await loadYamlFromUrl('/data/mwcup.yaml');
}

// 保持向后兼容性的别名
export const fetchMWCupYaml = fetchMarioWorkerYaml;

/**
 * 从YAML文档中提取季节数据
 * @param doc YAML文档对象
 * @returns 季节对象，如果没有season字段则返回doc本身
 */
export function extractSeasonData(doc: any): any {
  return doc?.season ? doc.season : doc;
}
