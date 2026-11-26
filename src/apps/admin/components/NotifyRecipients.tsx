import { useEffect, useState } from 'react';
import { getNotifySuggestions, type NotifySuggestion } from '@data/api';
import { useAsync } from '@shared/hooks/useAsync';
import { TagInput } from './CustomerFields';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 購買的通知信要寄給誰（2026/11/26）：系統列出常用的收件人可以複選，也可以自由輸入 Email。
 * value 是最後的收件人清單（勾選的加上自己輸入的，不重複）。
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
  /** 畫面上已經填的其他信箱，例如新客戶的聯絡人、第一個使用者 */
  extra?: NotifySuggestion[];
  value: string[];
  onChange: (emails: string[]) => void;
  error?: string;
}) {
  const sug = useAsync(() => getNotifySuggestions(customerId, dealerId), [customerId, dealerId]);
  const options = dedupe([...(sug.data ?? []), ...extra.filter((x) => EMAIL.test(x.email))]);
  const [typed, setTyped] = useState<string[]>([]);
  const [inited, setInited] = useState(false);

  // 第一次載入時，預設勾選系統建議的收件人
  useEffect(() => {
    if (inited || !sug.data) return;
    setInited(true);
    if (value.length === 0) onChange(options.filter((o) => o.defaultOn).map((o) => o.email));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sug.data]);

  const toggle = (email: string, on: boolean) => onChange(on ? [...new Set([...value, email])] : value.filter((x) => x !== email));
  const optionEmails = new Set(options.map((o) => o.email));
  const typedShown = [...new Set([...typed, ...value.filter((v) => !optionEmails.has(v))])];
  const badTyped = typedShown.filter((t) => !EMAIL.test(t));

  return (
    <fieldset className="plain-fieldset notify-recipients">
      <legend className="form-field__label">通知信要寄給誰</legend>
      <p className="muted" style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-sm)' }}>
        建立後與處理完成時寄通知信。可以複選，也可以另外輸入 Email。
      </p>
      <div className="notify-recipients__list">
        {options.map((o) => (
          <label key={o.email} className="checkbox-row notify-recipients__item">
            <input type="checkbox" checked={value.includes(o.email)} onChange={(e) => toggle(o.email, e.target.checked)} />
            <span>
              {o.name} <span className="muted">（{o.role}）</span>
              <span className="mono muted notify-recipients__email">{o.email}</span>
            </span>
          </label>
        ))}
        {options.length === 0 && <span className="muted">{sug.loading ? '載入中…' : '沒有建議的收件人，請自行輸入。'}</span>}
      </div>
      <div style={{ marginTop: 'var(--space-3)' }}>
        <label className="form-field__label" htmlFor="notify-more">
          其他 Email
        </label>
        <TagInput
          id="notify-more"
          values={typedShown}
          placeholder="輸入 Email 後按 Enter，可以輸入多個"
          onChange={(v) => {
            setTyped(v);
            onChange([...value.filter((x) => optionEmails.has(x)), ...v]);
          }}
        />
        {badTyped.length > 0 && <div className="form-field__msg form-field__msg--error">Email 格式不正確：{badTyped.join('、')}</div>}
        {error && <div className="form-field__msg form-field__msg--error">{error}</div>}
      </div>
    </fieldset>
  );
}

function dedupe(list: NotifySuggestion[]) {
  const seen = new Set<string>();
  return list.filter((x) => (seen.has(x.email) ? false : (seen.add(x.email), true)));
}
