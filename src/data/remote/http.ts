// 呼叫後端 API 的共用函式。
// 依 Terry 的 API 文件：參數用 formData，回應格式是 { data, error }。

import { API_BASE } from '../dataSource';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly detail?: unknown,
  ) {
    super(message);
  }
}

/** 從錯誤回應取出給人看的訊息；error 可能是字串，也可能是 { message } 之類的物件 */
function errorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (Object.keys(e).length === 0) return undefined;
    for (const k of ['message', 'msg', 'description', 'detail', 'code']) {
      if (typeof e[k] === 'string' && e[k]) return e[k] as string;
    }
    return JSON.stringify(error);
  }
  return String(error);
}

export interface ApiResult<T> {
  data: T;
  /** 回應標頭，部分 API 可能把 token 放在這裡 */
  headers: Headers;
}

/**
 * 送出 API 請求。
 * - form：用 application/x-www-form-urlencoded 送出（瀏覽器不需要先做 CORS 預檢）
 * - token：帶在 Authorization: Bearer
 * - 一律帶 cookie（credentials: include），因為 refresh token 可能放在 cookie
 */
export async function apiRequest<T = unknown>(
  path: string,
  { method = 'POST', form, token }: { method?: string; form?: Record<string, string>; token?: string } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: form ? new URLSearchParams(form) : undefined,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(
      `連不到 API（${API_BASE}）。可能是網路不通，或 API 的 CORS 沒有開放這個網址（${location.origin}）；請 Terry 允許這個來源並開啟 Access-Control-Allow-Credentials。`,
    );
  }
  const text = await res.text();
  let body: { data?: unknown; error?: unknown } | undefined;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  const msg = errorMessage(body?.error);
  if (!res.ok || msg) {
    throw new ApiError(msg ?? (res.status === 401 ? '帳號或密碼不正確' : `API 回應錯誤（HTTP ${res.status}）`), res.status, body ?? text);
  }
  return { data: (body?.data ?? body ?? text) as T, headers: res.headers };
}

/** 讀出 JWT 內容（不驗證簽章，只用來判斷 token 用途與顯示名稱） */
export function decodeJwt(token: string): Record<string, unknown> | undefined {
  const part = token.split('.')[1];
  if (!part) return undefined;
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const json = decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}
