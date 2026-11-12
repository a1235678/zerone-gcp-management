import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  checkDomain,
  createCustomer,
  createTransferInCustomer,
  getDealers,
  getSalesPeople,
  getWorkOrder,
  linkCustomerToWorkOrder,
} from '@data/api';
import type { DomainCheck } from '@data/types';
import { Callout, FormField, FormSection } from '@shared/components/Form';
import { Icon } from '@shared/components/Icon';
import { PageHeader } from '@shared/components/PageHeader';
import { PendingTag } from '@shared/components/PendingTag';
import { useToast } from '@shared/components/Toast';
import { useAsync } from '@shared/hooks/useAsync';
import { usePermission } from '../auth';

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
  transferMemo: '',
  salesNew: '',
  salesRenewal: '',
};
type Key = keyof typeof empty;

/**
 * 新增客戶，或「轉入客戶」：從其他經銷商轉進來的客戶。
 * 轉入時同一張表單多了轉移資訊（客戶已在 Google 申請完移轉，不需要轉移碼），送出後建立客戶主檔，並建立一筆「新訂（移轉）」由後勤人工執行。
 * 網址帶 ?fromWo=單號 時，從執行單帶入新客戶資料，建立後接回執行單。
 */
export function NewCustomerPage({ mode = 'new' }: { mode?: 'new' | 'transfer' }) {
  const isTransfer = mode === 'transfer';
  const { can } = usePermission();
  const navigate = useNavigate();
  const toast = useToast();
  const dealers = useAsync(getDealers);
  const salesPeople = useAsync(getSalesPeople);
  const [params] = useSearchParams();
  const fromWo = params.get('fromWo');
  const wo = useAsync(() => (fromWo ? getWorkOrder(fromWo) : Promise.resolve(undefined)), [fromWo]);
  const [form, setForm] = useState(empty);
  const [prefilled, setPrefilled] = useState(false);

  // 從執行單帶入新客戶資料
  useEffect(() => {
    const n = wo.data?.newCustomer;
    if (!n || prefilled) return;
    setForm((f) => ({
      ...f,
      name: n.name,
      taxId: n.taxId,
      primaryDomain: n.primaryDomain,
      dealerId: wo.data!.dealerId,
      contactName: n.contactName,
      contactEmail: n.contactEmail,
      contactPhone: n.contactPhone,
      note: n.note,
      transferMemo: wo.data!.payload.memo ?? '',
    }));
    setPrefilled(true);
  }, [wo.data, prefilled]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [sameAsContact, setSameAsContact] = useState(true);
  const [domain, setDomain] = useState<{ checking: boolean; result?: DomainCheck }>({ checking: false });
  const [saving, setSaving] = useState(false);

  const set = (key: Key) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
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

  const errors: Partial<Record<Key, string>> = {};
  if (!form.name.trim()) errors.name = '請輸入客戶名稱';
  if (!/^\d{8}$/.test(form.taxId)) errors.taxId = '統一編號為 8 位數字';
  if (!form.dealerId) errors.dealerId = '請選擇經銷商';
  if (!form.contactName.trim()) errors.contactName = '請輸入聯絡人';
  if (!EMAIL.test(form.contactEmail)) errors.contactEmail = 'Email 格式不正確';
  if (!admin.adminName.trim()) errors.adminName = '請輸入姓名';
  if (!EMAIL.test(admin.adminEmail)) errors.adminEmail = 'Email 格式不正確';
  const domainOk = !domain.checking && domain.result?.ok === true;
  const canSubmit = domainOk && Object.keys(errors).length === 0 && !saving;

  const err = (key: Key) => (touched[key] ? errors[key] : undefined);
  const errState = (key: Key) => (err(key) ? ('error' as const) : undefined);

  const submit = async () => {
    setTouched(Object.fromEntries(Object.keys(empty).map((k) => [k, true])));
    if (!canSubmit) return;
    setSaving(true);
    try {
      if (isTransfer) {
        const { customer, operation } = await createTransferInCustomer({ ...form, ...admin, memo: form.transferMemo, workOrderId: fromWo ?? undefined });
        toast(`已建立「${customer.name}」，客戶轉入（${operation.id}）待後勤人工執行`);
        navigate(fromWo ? `/work-orders/${fromWo}` : `/customers/${customer.id}`);
      } else {
        const c = await createCustomer({ ...form, ...admin });
        if (fromWo) {
          await linkCustomerToWorkOrder(fromWo, c.id);
          toast(`已建立客戶「${c.name}」，回到執行單 ${fromWo} 繼續處理`);
          navigate(`/work-orders/${fromWo}`);
        } else {
          toast(`已建立客戶「${c.name}」，並寄出組織管理員邀請`);
          navigate(`/customers/${c.id}`);
        }
      }
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
        <span>
          <Icon name="alert" size={14} /> {r.message}。
          {r.existingCustomer &&
            (isTransfer ? (
              <>
                客戶已在系統裡，請到<Link to={`/customers/${r.existingCustomer}`}>該客戶詳情</Link>建立客戶轉入。
              </>
            ) : (
              <Link to={`/customers/${r.existingCustomer}`}>查看該客戶</Link>
            ))}
        </span>
      ),
    };
  })();

  const missing = [
    !domainOk && '有效的主網域',
    Object.keys(errors).length > 0 && `${Object.keys(errors).length} 個必填欄位`,
  ].filter(Boolean);

  if (!(can('customers', 'write') && (!isTransfer || can('subscriptions', 'write'))))
    return (
      <Callout tone="warning" title="你的角色沒有權限">
        你的角色不能建立客戶。如果需要，請聯絡系統管理員調整角色權限。
      </Callout>
    );

  return (
    <>
      <Link to="/customers" className="back-link">
        <Icon name="chevronLeft" size={14} />
        客戶管理
      </Link>
      <PageHeader
        title={isTransfer ? '轉入客戶' : '新增客戶'}
        titleAddon={
          <>
            <PendingTag id={1} hint="客戶由誰建立" />
            {isTransfer && <PendingTag id={4} hint="是否使用 Cloud Channel API" />}
          </>
        }
        description={
          isTransfer
            ? '客戶從其他經銷商轉到我們底下。建立客戶主檔與第一個組織管理員帳號，並建立一筆客戶轉入，由後勤在 Google 後台人工執行。'
            : '建立客戶主檔，同時建立該客戶的第一個「組織管理員」帳號。'
        }
      />

      {fromWo && (
        <div className="form-card" style={{ marginBottom: 'var(--space-4)' }}>
          <Callout tone="info" title={`依執行單 ${fromWo} ${isTransfer ? '轉入客戶' : '建立客戶'}`}>
            {isTransfer ? '客戶資料與轉移備註已從執行單帶入，請確認後建立。建立後會產生一筆客戶轉入（待人工執行），並回到執行單。' : '客戶資料已從執行單帶入，請確認後建立。建立後會回到執行單繼續下一步。'}
          </Callout>
        </div>
      )}
      <form
        className="card form-card"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
      >
        <div className="card__body">
          {isTransfer && (
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <Callout tone="neutral">客戶從其他經銷商轉進來。如果客戶已經在系統裡，請改到該客戶詳情建立客戶轉入。</Callout>
            </div>
          )}

          <FormSection title="客戶資料">
            <FormField label="客戶名稱" required message={err('name')} state={errState('name')}>
              {(p) => <input {...p} className="input" value={form.name} onChange={set('name')} onBlur={touch('name')} />}
            </FormField>
            <FormField label="統一編號" required message={err('taxId')} state={errState('taxId')}>
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
            <FormField label={isTransfer ? '轉入後的經銷商' : '經銷商'} required message={err('dealerId')} state={errState('dealerId')}>
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
            <FormField label="聯絡人" required message={err('contactName')} state={errState('contactName')}>
              {(p) => <input {...p} className="input" value={form.contactName} onChange={set('contactName')} onBlur={touch('contactName')} />}
            </FormField>
            <FormField label="聯絡人 Email" required message={err('contactEmail')} state={errState('contactEmail')}>
              {(p) => <input {...p} className="input" type="email" value={form.contactEmail} onChange={set('contactEmail')} onBlur={touch('contactEmail')} />}
            </FormField>
            <FormField label="電話">{(p) => <input {...p} className="input" type="tel" value={form.contactPhone} onChange={set('contactPhone')} />}</FormField>
            <FormField label="備註" className="is-full">
              {(p) => <textarea {...p} className="textarea" value={form.note} onChange={set('note')} />}
            </FormField>
          </FormSection>

          <FormSection title="負責業務" description="依產品、新約或續約指定，同一個客戶可以是不同業務。建立後可以在客戶詳情修改，也可以指定 GCP 的業務。">
            {(['salesNew', 'salesRenewal'] as const).map((k) => (
              <FormField key={k} label={k === 'salesNew' ? 'GWS 新約業務' : 'GWS 續約業務'} help={k === 'salesRenewal' ? 'GWS 到期通知會寄給續約業務。' : undefined}>
                {(p) => (
                  <select {...p} className="select" value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}>
                    <option value="">未指定</option>
                    {(salesPeople.data ?? []).map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                )}
              </FormField>
            ))}
          </FormSection>

          {isTransfer && (
            <FormSection title="轉移資訊" description="客戶已經在 Google 申請完轉移。建立客戶後狀態為「待人工執行」，後勤在 Google 後台接受轉入後回來標記。">
              <FormField label="轉移備註" className="is-full">
                {(p) => <textarea {...p} className="textarea" value={form.transferMemo} onChange={set('transferMemo')} />}
              </FormField>
              <Callout tone="neutral">客戶的訂閱會全部轉入，不能只轉一部分。原訂閱會取消並在我方底下重建，承諾期方案的承諾期會重新計算。</Callout>
            </FormSection>
          )}

          <FormSection title="第一個組織管理員帳號" description="零壹只建立這一個帳號；其他帳號與角色由客戶自己建立，零壹也可以在「使用者」頁代為新增。">
            <label className="inline is-full">
              <input type="checkbox" checked={sameAsContact} onChange={(e) => setSameAsContact(e.target.checked)} />
              與聯絡人相同
            </label>
            <FormField label="姓名" required message={err('adminName')} state={errState('adminName')}>
              {(p) => <input {...p} className="input" value={admin.adminName} readOnly={sameAsContact} onChange={set('adminName')} onBlur={touch('adminName')} />}
            </FormField>
            <FormField label="Email（登入帳號）" required message={err('adminEmail')} state={errState('adminEmail')}>
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
            {saving ? '處理中…' : isTransfer ? '建立客戶並建立客戶轉入' : fromWo ? '建立客戶並回到執行單' : '建立客戶'}
          </button>
        </div>
      </form>
    </>
  );
}
