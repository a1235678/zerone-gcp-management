// 資料來源切換：假資料（Prototype 內建）或真資料（後端 API）。
// 在登入頁切換，記在這個瀏覽器；目前只有登入串接 API，其他畫面仍是假資料。

export type DataSource = 'mock' | 'api';

const KEY = 'zerone-data-source';

/** API 網址。先用 Terry 測試站，之後可以用環境變數 VITE_API_BASE 換掉 */
export const API_BASE = ((import.meta.env.VITE_API_BASE as string | undefined) ?? 'https://stageapi.wingwill.com.tw').replace(/\/+$/, '');

export function getDataSource(): DataSource {
  try {
    return localStorage.getItem(KEY) === 'api' ? 'api' : 'mock';
  } catch {
    return 'mock';
  }
}

export function setDataSource(source: DataSource) {
  try {
    localStorage.setItem(KEY, source);
  } catch {
    // 瀏覽器不允許存取 localStorage 時，這次切換只在目前畫面有效
  }
}
