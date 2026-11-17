// 登入相關 API（依 Terry 的 Swagger 文件 /api/auth/*）。
// 流程：/login 回傳一個 token，依 token 的用途（audience）決定下一步：
//   - 2FA 登入 → /login-2fa 輸入驗證碼（TOTP 或 Email）
//   - 使用者驗證 → /request-user-verification 寄驗證信，驗證後再登入
//   - 其他 → 視為已登入

import { apiRequest, decodeJwt } from './http';

export interface LoginResponse {
  token?: string;
  emailVerified?: boolean;
  isFirstLogin?: boolean;
  totpVerified?: boolean;
}

export type LoginStep =
  | { kind: 'twoFactor'; token: string; totpAvailable: boolean }
  | { kind: 'verifyUser'; token: string }
  | { kind: 'done'; auth: ApiAuth };

/** 登入完成後保存的資訊 */
export interface ApiAuth {
  /** 存取用 token；API 若改用 cookie，這裡可能是空的 */
  accessToken?: string;
  name: string;
  email: string;
  isFirstLogin?: boolean;
}

const audienceOf = (token: string) => {
  const aud = decodeJwt(token)?.aud;
  return (Array.isArray(aud) ? aud.join(' ') : String(aud ?? '')).toLowerCase();
};

/** 從登入成功的回應找出存取 token，欄位名稱還沒跟 Terry 確認，所以幾種常見寫法都接受 */
function pickAccessToken(data: unknown, headers: Headers): string | undefined {
  if (typeof data === 'string' && data.split('.').length === 3) return data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    for (const k of ['accessToken', 'access_token', 'token', 'jwt']) if (typeof d[k] === 'string' && d[k]) return d[k] as string;
  }
  const h = headers.get('Authorization');
  return h?.replace(/^Bearer\s+/i, '') || undefined;
}

function authFrom(accessToken: string | undefined, username: string, extra?: LoginResponse): ApiAuth {
  const claims = accessToken ? decodeJwt(accessToken) : undefined;
  const pick = (...keys: string[]) => keys.map((k) => claims?.[k]).find((v): v is string => typeof v === 'string' && v.length > 0);
  const first = pick('firstName', 'given_name');
  const last = pick('lastName', 'family_name');
  const name = pick('name', 'displayName') ?? ([last, first].filter(Boolean).join('') || username);
  return { accessToken, name, email: pick('email') ?? username, isFirstLogin: extra?.isFirstLogin };
}

export async function apiLogin(username: string, password: string, skip2fa = false): Promise<LoginStep> {
  if (skip2fa) {
    const { data, headers } = await apiRequest('/api/auth/login-without-2fa', { form: { username, password } });
    return { kind: 'done', auth: authFrom(pickAccessToken(data, headers), username) };
  }
  const { data, headers } = await apiRequest<LoginResponse>('/api/auth/login', { form: { username, password } });
  const token = data?.token;
  if (!token) return { kind: 'done', auth: authFrom(pickAccessToken(data, headers), username, data) };
  const aud = audienceOf(token);
  if (aud.includes('2fa')) return { kind: 'twoFactor', token, totpAvailable: Boolean(data.totpVerified) };
  if (aud.includes('verification')) return { kind: 'verifyUser', token };
  return { kind: 'done', auth: authFrom(token, username, data) };
}

export async function apiLogin2fa(token: string, code: string, method: 'totp' | 'email', username: string): Promise<ApiAuth> {
  const { data, headers } = await apiRequest('/api/auth/login-2fa', { form: { token, code, method } });
  return authFrom(pickAccessToken(data, headers), username);
}

export async function apiRequestEmailPasscode(token: string): Promise<void> {
  await apiRequest('/api/auth/request-login-email-passcode', { form: { token } });
}

export async function apiRequestUserVerification(token: string): Promise<void> {
  await apiRequest('/api/auth/request-user-verification', { form: { token } });
}

export async function apiRequestPasswordReset(email: string): Promise<void> {
  await apiRequest('/api/auth/request-reset-password', { form: { email } });
}

export async function apiLogout(accessToken?: string): Promise<void> {
  await apiRequest('/api/auth/logout', { token: accessToken });
}
