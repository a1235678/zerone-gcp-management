import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { getNotifyDirectory, type NotifySuggestion } from '@data/api';
import { useAsync } from '@shared/hooks/useAsync';
import { Icon } from '@shared/components/Icon';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 購買的通知信要寄給誰（2026/11/26 改成搜尋加人）：
 * - 一開始帶入系統建議的收件人（客戶聯絡人、負責業務、後勤），可以移除。
 * - 輸入姓名、Email 或身分搜尋內部人員與經銷商聯絡人，點選加入。
 * - 名單外的人直接輸入 Email 按 Enter（或逗號）加入，可以一次貼上多個。
 * value 是最後的收件人 Email 清單（不重複）。
 */
export function NotifyRecipients({
  customerId,
  dealerId,
  extra = [],
  value,
  onChange,
  error,
}: {
  customerId?: string;
  dealerId?: string;
  /** 畫面上已經填的其他信箱，例如新客戶的聯絡人 */
  extra?: NotifySuggestion[];
  value: string[];
  onChange: (emails: string[]) => void;
  error?: string;
}) {
  const dir = useAsync(() => getNotifyDirectory(customerId, dealerId), [customerId, dealerId]);
  const people = useMemo(() => {
    const seen = new Set<string>();
    return [...extra.filter((x) => EMAIL.test(x.email)), ...(dir.data ?? [])].filter((x) => (seen.has(x.email) ? false : (seen.add(x.email), true)));
  }, [dir.data, extra]);
  const byEmail = new Map(people.map((p) => [p.email.toLowerCase(), p]));

  // 第一次載入時，帶入系統建議的收件人
  const [inited, setInited] = useState(false);
  useEffect(() => {
    if (inited || !dir.data) return;
    setInited(true);
    if (value.length === 0) onChange(people.filter((o) => o.defaultOn).map((o) => o.email));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir.data]);

  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [bad, setBad] = useState('');

  const has = (email: string) => value.some((v) => v.toLowerCase() === email.toLowerCase());
  const kw = text.trim().toLowerCase();
  const matches = people.filter((p) => !has(p.email) && (!kw || [p.name, p.email, p.role].some((f) => f.toLowerCase().includes(kw)))).slice(0, 30);
  // 打的是完整 Email、又不在名單裡：多一個「加入這個 Email」的選項
  const typedEmail = EMAIL.test(text.trim()) && !byEmail.has(kw) && !has(text.trim()) ? text.trim() : '';
  const items: { email: string; person?: NotifySuggestion }[] = [...(typedEmail ? [{ email: typedEmail }] : []), ...matches.map((p) => ({ email: p.email, person: p }))];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const add = (emails: string[]) => {
    const next = [...value];
    for (const e of emails) if (!next.some((v) => v.toLowerCase() === e.toLowerCase())) next.push(byEmail.get(e.toLowerCase())?.email ?? e);
    onChange(next);
    setText('');
    setActive(0);
    setBad('');
  };
  // 直接輸入的 Email（Enter、逗號或貼上多個）
  const addTyped = (raw: string) => {
    const parts = raw.split(/[\s,;，；]+/).filter(Boolean);
    if (parts.length === 0) return;
    const wrong = parts.filter((x) => !EMAIL.test(x));
    if (wrong.length) {
      setBad(wrong.join('、'));
      return;
    }
    add(parts);
  };
  const remove = (email: string) => onChange(value.filter((v) => v !== email));

  return (
    <fieldset className="plain-fieldset notify-recipients">
      <legend className="form-field__label">通知信要寄給誰</legend>
      <p className="muted" style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-sm)' }}>
        建立後與處理完成時寄通知信。已先帶入建議的收件人，可以移除；要加人請搜尋姓名或 Email，名單外的人直接輸入 Email 按 Enter。
      </p>

      <ul className="notify-recipients__chips" aria-label="收件人">
        {value.map((email) => {
          const p = byEmail.get(email.toLowerCase());
          return (
            <li key={email} className="notify-recipients__chip">
              <span className="notify-recipients__chip-text">
                {p ? (
                  <>
                    {p.name} <span className="muted">（{p.role}）</span>
                    <span className="mono muted notify-recipients__email">{email}</span>
                  </>
                ) : (
                  <span className="mono">{email}</span>
                )}
              </span>
              <button type="button" aria-label={`移除 ${p?.name ?? email}`} onClick={() => remove(email)}>
                <Icon name="close" size={14} />
              </button>
            </li>
          );
        })}
        {value.length === 0 && <li className="muted">{dir.loading ? '載入中…' : '還沒有收件人。'}</li>}
      </ul>

      <div className="combobox notify-recipients__search" ref={wrap}>
        <span className="input-icon">
          <Icon name="search" size={16} />
          <input
            className="input"
            role="combobox"
            aria-label="搜尋收件人或輸入 Email"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && items[active] ? `${listId}-${active}` : undefined}
            aria-invalid={!!bad || undefined}
            autoComplete="off"
            placeholder="搜尋姓名、Email，或直接輸入 Email"
            value={text}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onChange={(e) => {
              const v = e.target.value;
              if (/[,;，；]$/.test(v)) return addTyped(v);
              setText(v);
              setOpen(true);
              setActive(0);
              setBad('');
            }}
            onPaste={(e) => {
              const t = e.clipboardData.getData('text');
              if (/[\s,;，；]/.test(t.trim())) {
                e.preventDefault();
                addTyped(t);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setOpen(true);
                setActive((i) => Math.min(i + 1, items.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (open && kw && items[active]) add([items[active].email]);
                else if (kw) addTyped(text);
              } else if (e.key === 'Escape') setOpen(false);
              else if (e.key === 'Backspace' && !text && value.length) remove(value[value.length - 1]);
            }}
          />
        </span>
        {open && (
          <ul className="combobox__list" id={listId} role="listbox" aria-label="符合的收件人">
            {items.length === 0 && <li className="combobox__empty">{kw ? '找不到符合的人。要寄給名單外的人，請輸入完整 Email。' : '名單裡的人都已加入。'}</li>}
            {items.map((it, i) => (
              <li
                key={it.email}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`combobox__option ${i === active ? 'is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  add([it.email]);
                }}
              >
                {it.person ? (
                  <>
                    <span>
                      {it.person.name} <span className="muted">（{it.person.role}）</span>
                    </span>
                    <span className="combobox__hint mono">{it.email}</span>
                  </>
                ) : (
                  <span>
                    加入 <span className="mono">{it.email}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {bad && <div className="form-field__msg form-field__msg--error">Email 格式不正確：{bad}</div>}
      {error && <div className="form-field__msg form-field__msg--error">{error}</div>}
    </fieldset>
  );
}
