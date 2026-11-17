import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getTestAccounts, requestPasswordReset } from '@data/api';
import { API_BASE, getDataSource, setDataSource, type DataSource } from '@data/dataSource';
import { userStatusLabel } from '@data/labels';
import {
  apiLogin,
  apiLogin2fa,
  apiRequestEmailPasscode,
  apiRequestPasswordReset,
  apiRequestUserVerification,
  type ApiAuth,
} from '@data/remote/auth';
import { Callout, FormField } from '@shared/components/Form';
import { useAsync } from '@shared/hooks/useAsync';
import { useToast } from '@shared/components/Toast';
import { useAuth } from '../auth';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const apiHost = API_BASE.replace(/^https?:\/\//, '');

function AuthLayout({ children, aside, source }: { children: React.ReactNode; aside?: React.ReactNode; source: DataSource }) {
  return (
    <div className="auth">
      <div className="auth__brand">
        <span className="sidebar__logo">01</span>
        <div>
          <div className="sidebar__title">零壹雲管家</div>
          <div className="sidebar__subtitle">Zerone Cloud · 管理端</div>
        </div>
      </div>
      <div className="auth__card">{children}</div>
      {aside}
      <p className="auth__foot">{source === 'api' ? 'Prototype · 登入使用 API，其他畫面仍是假資料' : 'Prototype · 資料皆為假資料'}</p>
    </div>
  );
}

/** 切換假資料、真資料（API） */
function DataSourceSwitch({ value, onChange }: { value: DataSource; onChange: (v: DataSource) => void }) {
  const on = value === 'api';
  return (
    <div className="source-switch">
      <button type="button" role="switch" aria-checked={on} className="switch" onClick={() => onChange(on ? 'mock' : 'api')}>
        <span className="switch__track" aria-hidden="true">
          <span className="switch__thumb" />
        </span>
        <span className="switch__label">使用真資料（API）</span>
      </button>
      <div className="source-switch__hint">
        {on ? (
          <>
            連線到 <span className="mono">{apiHost}</span>。目前只有登入串接 API，登入後其他畫面仍是假資料。
          </>
        ) : (
          '目前使用 Prototype 假資料，可以用下方的測試帳號登入。'
        )}
      </div>
    </div>
  );
}

type Step = { kind: 'credentials' } | { kind: 'twoFactor'; token: string; totpAvailable: boolean } | { kind: 'verifyUser'; token: string; sent: boolean };

export function LoginPage() {
  const { login, loginWithApi } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const accounts = useAsync(getTestAccounts);
  const [source, setSource] = useState<DataSource>(getDataSource);
  const [step, setStep] = useState<Step>({ kind: 'credentials' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [skip2fa, setSkip2fa] = useState(false);
  const [method, setMethod] = useState<'totp' | 'email'>('totp');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const isApi = source === 'api';

  const goNext = () => {
    const next = params.get('next');
    navigate(next && next.startsWith('/') && !next.startsWith('/login') ? next : '/', { replace: true });
  };

  const finishApi = (auth: ApiAuth) => {
    loginWithApi(auth);
    toast(auth.accessToken ? '已透過 API 登入' : '已透過 API 登入（回應沒有 token，可能改用 cookie）');
    goNext();
  };

  const run = async (fn: () => Promise<void>) => {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

  const changeSource = (v: DataSource) => {
    setDataSource(v);
    setSource(v);
    setStep({ kind: 'credentials' });
    setError('');
    setInfo('');
  };

  const submitCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isApi ? !email.trim() : !EMAIL.test(email.trim())) return setError(isApi ? '請輸入帳號' : '請輸入正確的 Email');
    if (!password) return setError('請輸入密碼');
    if (!isApi) {
      return run(async () => {
        await login(email, password);
        goNext();
      });
    }
    return run(async () => {
      const r = await apiLogin(email.trim(), password, skip2fa);
      if (r.kind === 'done') return finishApi(r.auth);
      if (r.kind === 'twoFactor') {
        setMethod(r.totpAvailable ? 'totp' : 'email');
        setCode('');
        setCodeSent(false);
        setStep(r);
        return;
      }
      setStep({ kind: 'verifyUser', token: r.token, sent: false });
    });
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (step.kind !== 'twoFactor') return;
    if (!/^\d{4,8}$/.test(code.trim())) return setError('請輸入驗證碼');
    run(async () => finishApi(await apiLogin2fa(step.token, code.trim(), method, email.trim())));
  };

  const sendEmailCode = () => {
    if (step.kind !== 'twoFactor') return;
    run(async () => {
      await apiRequestEmailPasscode(step.token);
      setCodeSent(true);
      setInfo('驗證碼已寄到你的信箱。');
    });
  };

  const backToCredentials = () => {
    setStep({ kind: 'credentials' });
    setError('');
    setInfo('');
  };

  if (step.kind === 'twoFactor') {
    return (
      <AuthLayout source={source}>
        <h1 className="auth__title">兩步驟驗證</h1>
        <p className="muted">請輸入驗證碼完成登入。</p>
        <form className="auth__form" onSubmit={submitCode} noValidate>
          {error && <Callout tone="danger">{error}</Callout>}
          {info && <Callout tone="info">{info}</Callout>}
          <div className="segmented" role="group" aria-label="驗證方式">
            <button type="button" aria-pressed={method === 'totp'} onClick={() => setMethod('totp')}>
              驗證器 App
            </button>
            <button type="button" aria-pressed={method === 'email'} onClick={() => setMethod('email')}>
              Email 驗證碼
            </button>
          </div>
          {method === 'totp' ? (
            !step.totpAvailable && <p className="muted" style={{ margin: 0 }}>這個帳號可能還沒設定驗證器 App，請改用 Email 驗證碼。</p>
          ) : (
            <button type="button" className="btn" onClick={sendEmailCode} disabled={busy}>
              {codeSent ? '重新寄送驗證碼' : '寄送驗證碼到信箱'}
            </button>
          )}
          <FormField label="驗證碼">
            {(p) => (
              <input
                {...p}
                className="input mono"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            )}
          </FormField>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? '驗證中…' : '驗證並登入'}
          </button>
          <div className="auth__row" style={{ justifyContent: 'center' }}>
            <button type="button" className="link-button" onClick={backToCredentials}>
              回到登入
            </button>
          </div>
        </form>
      </AuthLayout>
    );
  }

  if (step.kind === 'verifyUser') {
    return (
      <AuthLayout source={source}>
        <h1 className="auth__title">驗證帳號</h1>
        <div className="auth__form">
          {error && <Callout tone="danger">{error}</Callout>}
          {step.sent ? (
            <Callout tone="info" title="請到信箱收信">
              驗證信已寄出，請點信中的連結完成驗證，再回來登入。
            </Callout>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              這個帳號需要先完成驗證才能登入。按下方按鈕，系統會寄一封驗證信到你的信箱。
            </p>
          )}
          {!step.sent && (
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await apiRequestUserVerification(step.token);
                  setStep({ ...step, sent: true });
                })
              }
            >
              {busy ? '寄送中…' : '寄送驗證信'}
            </button>
          )}
          <button type="button" className="btn" onClick={backToCredentials}>
            回到登入
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      source={source}
      aside={
        !isApi && (
          <section className="auth__test" aria-label="Prototype 測試帳號">
            <div className="auth__test-head">
              <strong>Prototype 測試帳號</strong>
              <div className="muted">點一下會填入帳號，密碼隨便填即可登入。正式版不會有這一區。</div>
            </div>
            <ul className="auth__test-list">
              {(accounts.data ?? []).map((a) => (
                <li key={a.email}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(a.email);
                      setPassword('prototype');
                      setError('');
                    }}
                  >
                    <span>
                      <strong>{a.role}</strong>
                      <span className="muted"> · {a.name}</span>
                    </span>
                    {a.status !== 'active' ? <span className="muted">{userStatusLabel[a.status]}</span> : <span className="muted mono">{a.email.split('@')[0]}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      }
    >
      <h1 className="auth__title">登入</h1>
      <p className="muted">請使用零壹內部帳號登入。</p>
      <DataSourceSwitch value={source} onChange={changeSource} />
      <form className="auth__form" onSubmit={submitCredentials} noValidate>
        {error && <Callout tone="danger">{error}</Callout>}
        <FormField label={isApi ? '帳號' : 'Email'}>
          {(p) => <input {...p} className="input" type={isApi ? 'text' : 'email'} autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </FormField>
        <FormField label="密碼">
          {(p) => <input {...p} className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </FormField>
        {isApi && (
          <label className="inline checkbox-row auth__check">
            <input type="checkbox" checked={skip2fa} onChange={(e) => setSkip2fa(e.target.checked)} />
            <span>略過兩步驟驗證（API 的測試用登入，之後會移除）</span>
          </label>
        )}
        <div className="auth__row">
          <Link to={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`}>忘記密碼？</Link>
        </div>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? '登入中…' : '登入'}
        </button>
      </form>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const [params] = useSearchParams();
  const source = getDataSource();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) return setError('請輸入正確的 Email');
    setError('');
    setBusy(true);
    try {
      await (source === 'api' ? apiRequestPasswordReset(email.trim()) : requestPasswordReset(email));
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

  return (
    <AuthLayout source={source}>
      <h1 className="auth__title">忘記密碼</h1>
      {sent ? (
        <div className="auth__form">
          <Callout tone="info" title="請到信箱收信">
            如果 <span className="mono">{email.trim()}</span> 是有效的帳號，我們已寄出重設密碼的連結。沒收到的話，請檢查垃圾郵件，或聯絡系統管理員。
          </Callout>
          <Link to="/login" className="btn">
            回到登入
          </Link>
        </div>
      ) : (
        <>
          <p className="muted">輸入登入用的 Email，我們會寄送重設密碼的連結。</p>
          <form className="auth__form" onSubmit={submit} noValidate>
            {error && <Callout tone="danger">{error}</Callout>}
            <FormField label="Email">
              {(p) => <input {...p} className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />}
            </FormField>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? '寄送中…' : '寄送重設密碼連結'}
            </button>
            <div className="auth__row" style={{ justifyContent: 'center' }}>
              <Link to="/login">回到登入</Link>
            </div>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
