import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getTestAccounts, requestPasswordReset } from '@data/api';
import { userStatusLabel } from '@data/labels';
import { Callout, FormField } from '@shared/components/Form';
import { useAsync } from '@shared/hooks/useAsync';
import { useAuth } from '../auth';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthLayout({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="auth__brand">
        <span className="sidebar__logo">01</span>
        <div>
          <div className="sidebar__title">零壹 SaaS 平台</div>
          <div className="sidebar__subtitle">管理端</div>
        </div>
      </div>
      <div className="auth__card">{children}</div>
      {aside}
      <p className="auth__foot">Prototype · 資料皆為假資料</p>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const accounts = useAsync(getTestAccounts);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!EMAIL.test(email.trim())) return setError('請輸入正確的 Email');
    if (!password) return setError('請輸入密碼');
    setBusy(true);
    try {
      await login(email, password);
      const next = params.get('next');
      navigate(next && next.startsWith('/') && !next.startsWith('/login') ? next : '/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      aside={
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
      }
    >
      <h1 className="auth__title">登入</h1>
      <p className="muted">請使用零壹內部帳號登入。</p>
      <form className="auth__form" onSubmit={submit} noValidate>
        {error && <Callout tone="danger">{error}</Callout>}
        <FormField label="Email">
          {(p) => <input {...p} className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </FormField>
        <FormField label="密碼">
          {(p) => <input {...p} className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </FormField>
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
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) return setError('請輸入正確的 Email');
    setError('');
    setBusy(true);
    await requestPasswordReset(email);
    setBusy(false);
    setSent(true);
  };

  return (
    <AuthLayout>
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
