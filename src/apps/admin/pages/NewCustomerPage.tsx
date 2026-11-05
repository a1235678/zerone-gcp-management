import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { checkDomain, createCustomer, getDealers } from '@data/api';
import type { DomainCheck } from '@data/types';
import { Callout, FormField, FormSection } from '@shared/components/Form';
import { Icon } from '@shared/components/Icon';
import { PageHeader } from '@shared/components/PageHeader';
import { PendingTag } from '@shared/components/PendingTag';
import { useToast } from '@shared/components/Toast';
import { useAsync } from '@shared/hooks/useAsync';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const empty = {
  name: '',
  taxId: '',
  primaryDomain: '',
  dealerId: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  note: '',
  adminName: '',
  adminEmail: '',
};

export function NewCustomerPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const dealers = useAsync(getDealers);
  const [form, setForm] = useState(empty);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [sameAsContact, setSameAsContact] = useState(true);
  const [domain, setDomain] = useState<{ checking: boolean; result?: DomainCheck }>({ checking: false });
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const touch = (key: string) => () => setTouched((t) => ({ ...t, [key]: true }));

  // 網域檢查：停止輸入 300ms 後檢查格式與是否重複
  useEffect(() => {
    if (!form.primaryDomain) {
      setDomain({ checking: false });
      return;
    }
    setDomain({ checking: true });
    const t = setTimeout(() => setDomain({ checking: false, result: checkDomain(form.primaryDomain) }), 300);
    return () => clearTimeout(t);
  }, [form.primaryDomain]);

  const admin = sameAsContact ? { adminName: form.contactName, adminEmail: form.contactEmail } : { adminName: form.adminName, adminEmail: form.adminEmail };

  const errors: Partial<Record<keyof typeof empty, string>> = {};
  if (!form.name.trim()) errors.name = '請輸入客戶名稱';
  if (!/^\d{8}$/.test(form.taxId)) errors.taxId = '統一編號為 8 位數字';
  if (!form.dealerId) errors.dealerId = '請選擇經銷商';
  if (!form.contactName.trim()) errors.contactName = '請輸入聯絡人';
  if (!EMAIL.test(form.contactEmail)) errors.contactEmail = 'Email 格式不正確';
  if (!admin.adminName.trim()) errors.adminName = '請輸入姓名';
  if (!EMAIL.test(admin.adminEmail)) errors.adminEmail = 'Email 格式不正確';
  const domainOk = !domain.checking && domain.result?.ok === true;
  const canSubmit = domainOk && Object.keys(errors).length === 0 && !saving;

  const err = (key: keyof typeof empty) => (touched[key] ? errors[key] : undefined);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(Object.fromEntries(Object.keys(empty).map((k) => [k, true])));
    if (!canSubmit) return;
    setSaving(true);
    try {
      const c = await createCustomer({ ...form, ...admin });
      toast(`已建立客戶「${c.name}」，並寄出組織管理員邀請`);
      navigate(`/customers/${c.id}`);
    } catch (error) {
      toast((error as Error).message, 'danger');
      setSaving(false);
    }
  };

  const domainField = (() => {
    if (!form.primaryDomain) return { state: undefined, message: undefined };
    if (domain.checking) return { state: 'checking' as const, message: '檢查中…' };
    const r = domain.result;
    if (!r) return { state: undefined, message: undefined };
    if (r.ok)
      return {
        state: 'success' as const,
        message: (
          <>
            <Icon name="check" size={14} />
            格式正確，系統內沒有重複
          </>
        ),
      };
    return {
      state: 'error' as const,
      message: (
        <>
          <Icon name="alert" size={14} />
          {r.message}
          {r.existingCustomer && (
            <Link to={`/customers/${r.existingCustomer}`} target="_blank">
              查看該客戶
            </Link>
          )}
        </>
      ),
    };
  })();

  const missing = [
    !domainOk && '有效的主網域',
    Object.keys(errors).length > 0 && `${Object.keys(errors).length} 個必填欄位`,
  ].filter(Boolean);

  return (
    <>
      <Link to="/customers" className="back-link">
        <Icon name="chevronLeft" size={14} />
        客戶管理
      </Link>
      <PageHeader title="新增客戶" titleAddon={<PendingTag id={1} hint="客戶由誰建立" />} description="建立客戶主檔，同時建立該客戶的第一個「組織管理員」帳號。" />

      <form className="card form-card" onSubmit={submit} noValidate>
        <div className="card__body">
          <FormSection title="客戶資料">
            <FormField label="客戶名稱" required message={err('name')} state={err('name') ? 'error' : undefined}>
              {(p) => <input {...p} className="input" value={form.name} onChange={set('name')} onBlur={touch('name')} />}
            </FormField>
            <FormField label="統一編號" required message={err('taxId')} state={err('taxId') ? 'error' : undefined}>
              {(p) => (
                <input {...p} className="input mono" inputMode="numeric" maxLength={8} value={form.taxId} onChange={set('taxId')} onBlur={touch('taxId')} />
              )}
            </FormField>
            <FormField
              className="is-full"
              label="主網域"
              required
              state={domainField.state}
              message={domainField.message}
              help="只能用小寫英文、數字、連字號，例如 company.example。Google 網域驗證會在客戶建立後才檢查。"
            >
              {(p) => (
                <input
                  {...p}
                  className="input mono"
                  placeholder="company.example"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={form.primaryDomain}
                  onChange={set('primaryDomain')}
                />
              )}
            </FormField>
            <FormField label="經銷商" required message={err('dealerId')} state={err('dealerId') ? 'error' : undefined}>
              {(p) => (
                <select {...p} className="select" value={form.dealerId} onChange={set('dealerId')} onBlur={touch('dealerId')}>
                  <option value="">請選擇</option>
                  {(dealers.data ?? [])
                    .filter((d) => d.status === 'active')
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              )}
            </FormField>
            <div />
            <FormField label="聯絡人" required message={err('contactName')} state={err('contactName') ? 'error' : undefined}>
              {(p) => <input {...p} className="input" value={form.contactName} onChange={set('contactName')} onBlur={touch('contactName')} />}
            </FormField>
            <FormField label="聯絡人 Email" required message={err('contactEmail')} state={err('contactEmail') ? 'error' : undefined}>
              {(p) => (
                <input {...p} className="input" type="email" value={form.contactEmail} onChange={set('contactEmail')} onBlur={touch('contactEmail')} />
              )}
            </FormField>
            <FormField label="電話">{(p) => <input {...p} className="input" type="tel" value={form.contactPhone} onChange={set('contactPhone')} />}</FormField>
            <FormField label="備註" className="is-full">
              {(p) => <textarea {...p} className="textarea" value={form.note} onChange={set('note')} />}
            </FormField>
          </FormSection>

          <FormSection title="第一個組織管理員帳號" description="零壹只建立這一個帳號；其他帳號與角色由客戶自己建立，零壹也可以在「使用者」頁代為新增。">
            <label className="inline is-full">
              <input type="checkbox" checked={sameAsContact} onChange={(e) => setSameAsContact(e.target.checked)} />
              與聯絡人相同
            </label>
            <FormField label="姓名" required message={err('adminName')} state={err('adminName') ? 'error' : undefined}>
              {(p) => (
                <input
                  {...p}
                  className="input"
                  value={admin.adminName}
                  readOnly={sameAsContact}
                  onChange={set('adminName')}
                  onBlur={touch('adminName')}
                />
              )}
            </FormField>
            <FormField label="Email（登入帳號）" required message={err('adminEmail')} state={err('adminEmail') ? 'error' : undefined}>
              {(p) => (
                <input
                  {...p}
                  className="input"
                  type="email"
                  value={admin.adminEmail}
                  readOnly={sameAsContact}
                  onChange={set('adminEmail')}
                  onBlur={touch('adminEmail')}
                />
              )}
            </FormField>
            <Callout tone="neutral">建立後系統會寄出邀請信，對方設定密碼後即可登入客戶端。</Callout>
          </FormSection>
        </div>
        <div className="form-actions">
          <span className="form-actions__hint">{canSubmit ? '資料完整，可以建立' : `尚缺：${missing.join('、')}`}</span>
          <Link to="/customers" className="btn">
            取消
          </Link>
          <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
            {saving ? '建立中…' : '建立客戶'}
          </button>
        </div>
      </form>
    </>
  );
}
