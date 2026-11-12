import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  checkDomain,
  createCustomer,
  createTransferInCustomer,
  createTransferForExisting,
  getCustomers,
  getDealers,
  emptyAddress,
  lookupTaxId,
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
import { Combobox } from '@shared/components/Combobox';
import type { Address, SalesAssignment } from '@data/types';
import { SalesAssignmentEditor } from '../components/SalesAssignments';
import { addressComplete } from '@data/api';
import { AddressFields, TagInput } from '../components/CustomerFields';
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
};
type Key = keyof typeof empty;

/**
 * 新增客戶，或「轉入客戶」：從其他經銷商轉進來的客戶。
 * 轉入時同一張表單多了轉移資訊（客戶已在 Google 申請完移轉，不需要轉移碼），送出後建立客戶主檔，並建立一筆「新訂（移轉）」由後勤人工執行。
 * 網址帶 ?fromWo=單號 時，從執行單帶入新客戶資料，建立後接回執行單。
 */
export function NewCustomerPage({ mode = 'new' }: { mode?: 'new' | 'transfer' }) {
  const isTransfer = mode === 'transfer';
  const [who, setWho] = useState<'new' | 'existing'>('new');
  const { can } = usePermission();
  const navigate = useNavigate();
  const toast = useToast();
  const dealers = useAsync(getDealers);
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
  const [shortNames, setShortNames] = useState<string[]>([]);
  const [sales, setSales] = useState<SalesAssignment[]>([]);
  const [regAddr, setRegAddr] = useState<Address>(emptyAddress());
  const [conAddr, setConAddr] = useState<Address>(emptyAddress());
  const [sameAddr, setSameAddr] = useState(true);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<{ text: string; tone: 'success' | 'error' } | undefined>();
  const lookup = async () => {
    setLookingUp(true);
    setLookupMsg(undefined);
    try {
      const r = await lookupTaxId(form.taxId);
      if (r) {
        setForm((f) => ({ ...f, name: r.name }));
        setRegAddr(r.address);
        setLookupMsg({ text: `已帶入：${r.name}`, tone: 'success' });
      } else setLookupMsg({ text: '查無登記資料，請手動輸入', tone: 'error' });
    } catch (e) {
      setLookupMsg({ text: (e as Error).message, tone: 'error' });
    } finally {
      setLookingUp(false);
    }
  };
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [sameAsContact, setSameAsContact] = useState(true);
  const [domain, setDomain] = useState<{ checking: boolean; result?: DomainCheck }>({ checking: false });
  const [saving, setSaving] = useState(false);

  const set = (key: Key) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const touch = (key: string) => () => setTouched((t) => ({ ...t, [key]: true }));

  // 網域檢查：停止輸入 300ms 後檢查格式與是否重複
  useEffect(() => {
    if (!isTransfer || !form.primaryDomain) {
      setDomain({ checking: false });
      return;
    }
    setDomain({ checking: true });
    const t = setTimeout(() => setDomain({ checking: false, result: checkDomain(form.primaryDomain) }), 300);
    return () => clearTimeout(t);
  }, [form.primaryDomain, isTransfer]);

  const admin = sameAsContact ? { adminName: form.contactName, adminEmail: form.contactEmail } : { adminName: form.adminName, adminEmail: form.adminEmail };

  const errors: Partial<Record<Key, string>> = {};
  if (!form.name.trim()) errors.name = '請輸入公司全名';
  if (!/^\d{8}$/.test(form.taxId)) errors.taxId = '統一編號為 8 位數字';
  if (!form.dealerId) errors.dealerId = '請選擇經銷商';
  if (!form.contactName.trim()) errors.contactName = '請輸入聯絡人';
  if (!EMAIL.test(form.contactEmail)) errors.contactEmail = '聯絡人信箱格式不正確';
  const contactAddrOk = addressComplete(sameAddr ? regAddr : conAddr);
  if (!admin.adminName.trim()) errors.adminName = '請輸入姓名';
  if (!EMAIL.test(admin.adminEmail)) errors.adminEmail = 'Email 格式不正確';
  // 主網域只有客戶轉入要填；一般新增客戶的網域在 GWS 新訂時填（2026/11/12）
  const domainOk = !isTransfer || (!domain.checking && domain.result?.ok === true);
  const canSubmit = domainOk && contactAddrOk && Object.keys(errors).length === 0 && !saving;

  const err = (key: Key) => (touched[key] ? errors[key] : undefined);
  const errState = (key: Key) => (err(key) ? ('error' as const) : undefined);

  const submit = async () => {
    setTouched(Object.fromEntries([...Object.keys(empty), 'contactAddress'].map((k) => [k, true])));
    if (!canSubmit) return;
    setSaving(true);
    try {
      if (isTransfer) {
        const { customer, operation } = await createTransferInCustomer({ ...form, ...admin, shortNames, salesAssignments: sales, registeredAddress: regAddr, contactAddress: sameAddr ? regAddr : conAddr, contactSameAsRegistered: sameAddr, memo: form.transferMemo, workOrderId: fromWo ?? undefined });
        toast(`已建立「${customer.name}」，客戶轉入（${operation.id}）待後勤人工執行`);
        navigate(fromWo ? `/work-orders/${fromWo}` : `/customers/${customer.id}`);
      } else {
        const c = await createCustomer({ ...form, primaryDomain: undefined, ...admin, shortNames, salesAssignments: sales, registeredAddress: regAddr, contactAddress: sameAddr ? regAddr : conAddr, contactSameAsRegistered: sameAddr });
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
                這個網域已經是系統裡的客戶，請確認是否重複建立：<Link to={`/customers/${r.existingCustomer}`}>查看該客戶</Link>。
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
    !contactAddrOk && '完整的聯絡地址',
    Object.keys(errors).length > 0 && `${Object.keys(errors).length} 個必填欄位`,
  ].filter(Boolean);

  if (!(can('customers', 'create') && (!isTransfer || can('subscriptions', 'write'))))
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
            ? '客戶從其他經銷商轉到我們底下，客戶已經在 Google 申請完轉移。建立後產生一筆客戶轉入，由後勤在 Google 後台人工執行。'
            : '建立客戶主檔，同時建立該客戶的第一個「組織管理員」帳號。'
        }
      />

      {isTransfer && !fromWo && (
        <div className="form-card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="segmented" role="group" aria-label="轉入的客戶">
            <button type="button" aria-pressed={who === 'new'} onClick={() => setWho('new')}>
              新客戶
            </button>
            <button type="button" aria-pressed={who === 'existing'} onClick={() => setWho('existing')}>
              現有客戶
            </button>
          </div>
          <p className="muted" style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-sm)' }}>
            {who === 'new' ? '客戶還不在系統裡：建立客戶主檔與第一個組織管理員帳號。' : '客戶已經在系統裡（例如已經是其他產品的客戶）：不用重填主檔，直接建立客戶轉入。'}
          </p>
        </div>
      )}
      {isTransfer && who === 'existing' && !fromWo ? (
        <ExistingTransferForm />
      ) : (
      <>

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
              <Callout tone="neutral">客戶從其他經銷商轉進來，客戶已經在 Google 申請完轉移。</Callout>
            </div>
          )}

          <FormSection title="基本資訊">
            <FormField
              label="統一編號"
              required
              message={err('taxId') ?? lookupMsg?.text}
              state={err('taxId') ? 'error' : lookupMsg?.tone}
              help="輸入 8 碼統一編號後按「查詢」，會帶入公司全名與登記地址。"
              addon={<PendingTag hint="查詢的資料來源待確認" />}
            >
              {(p) => (
                <div className="input-with-button">
                  <input {...p} className="input mono" inputMode="numeric" maxLength={8} value={form.taxId} onChange={set('taxId')} onBlur={touch('taxId')} />
                  <button type="button" className="btn" disabled={lookingUp || !/^\d{8}$/.test(form.taxId)} onClick={lookup}>
                    <Icon name="search" size={16} />
                    {lookingUp ? '查詢中…' : '查詢'}
                  </button>
                </div>
              )}
            </FormField>
            <FormField label="公司全名" required message={err('name')} state={errState('name')}>
              {(p) => <input {...p} className="input" value={form.name} onChange={set('name')} onBlur={touch('name')} />}
            </FormField>
            <FormField label="公司簡稱" help="可輸入多個別名，按 Enter 確認。">
              {(p) => <TagInput id={p.id} values={shortNames} onChange={setShortNames} />}
            </FormField>
            <div />
            <FormField label={isTransfer ? '轉入後的經銷商' : '所屬經銷商'} required message={err('dealerId')} state={errState('dealerId')}>
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
            <FormField label="經銷商 ID" help="選擇經銷商後自動帶出。">
              {(p) => <input {...p} className="input mono" readOnly value={form.dealerId} placeholder="—" />}
            </FormField>
            {isTransfer && (
              <FormField
                className="is-full"
                label="主網域"
                required
                state={domainField.state}
                message={domainField.message}
                help="客戶轉入是既有的 GWS 客戶，要填主網域。只能用小寫英文、數字、連字號，例如 company.example。"
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
            )}
            {!isTransfer && (
              <p className="muted is-full" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
                建立客戶時不用填網域。有 GWS 產品時，在新訂時填寫網域（新買或綁定既有網域），訂閱成功後會自動寫回客戶主檔；之後也可以在客戶詳情新增網域。
              </p>
            )}
          </FormSection>

          <FormSection title="登記地址（公司法定登記地）">
            <div className="is-full">
              <AddressFields label="登記地址" value={regAddr} onChange={setRegAddr} />
            </div>
          </FormSection>

          <FormSection title="聯絡資訊">
            <div className="is-full section-subhead">
              <span className="form-field__label">
                聯絡地址 <span className="form-field__req">必填</span>
              </span>
              <label className="inline checkbox-row">
                <input type="checkbox" checked={sameAddr} onChange={(e) => setSameAddr(e.target.checked)} />
                同登記地址
              </label>
            </div>
            <div className="is-full">
              <AddressFields label="聯絡地址" value={sameAddr ? regAddr : conAddr} onChange={setConAddr} disabled={sameAddr} />
              {touched.contactAddress && !contactAddrOk && <div className="form-field__msg form-field__msg--error">請填寫完整的聯絡地址（縣市、鄉鎮區、街道）</div>}
            </div>
            <div className="is-full section-subhead">
              <span className="form-field__label">聯絡人</span>
            </div>
            <FormField label="聯絡人姓名" required message={err('contactName')} state={errState('contactName')}>
              {(p) => <input {...p} className="input" value={form.contactName} onChange={set('contactName')} onBlur={touch('contactName')} />}
            </FormField>
            <FormField label="聯絡電話">{(p) => <input {...p} className="input" type="tel" value={form.contactPhone} onChange={set('contactPhone')} />}</FormField>
            <FormField label="聯絡人信箱" required message={err('contactEmail')} state={errState('contactEmail')}>
              {(p) => <input {...p} className="input" type="email" value={form.contactEmail} onChange={set('contactEmail')} onBlur={touch('contactEmail')} />}
            </FormField>
            <div />
          </FormSection>

          <FormSection title="其他資訊">
            <FormField label="備註" className="is-full" help={`${form.note.length} / 2000`}>
              {(p) => <textarea {...p} className="textarea" maxLength={2000} value={form.note} onChange={set('note')} />}
            </FormField>
          </FormSection>

          <FormSection title="負責業務" description="一列一位業務，只列有設定的；一個客戶可以有多位業務。建立後也可以在客戶詳情修改。">
            <div className="is-full">
              <SalesAssignmentEditor value={sales} onChange={setSales} />
            </div>
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
      )}
    </>
  );
}

/** 現有客戶的客戶轉入：選客戶、確認網域、填轉移備註 */
function ExistingTransferForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const customers = useAsync(() => getCustomers({ status: 'active' }));
  const [customerId, setCustomerId] = useState('');
  const [domainPick, setDomainPick] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [memo, setMemo] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const c = customers.data?.find((x) => x.id === customerId);
  const owned = c ? [c.primaryDomain, ...c.otherDomains].filter(Boolean) : [];
  const domain = domainPick || newDomain.trim();
  const check = !domainPick && newDomain ? checkDomain(newDomain) : undefined;
  const errors = { customer: !customerId ? '請選擇客戶' : undefined, domain: !domain ? '請選擇或輸入網域' : check && !check.ok ? check.message : undefined };

  const submit = async () => {
    setTried(true);
    if (errors.customer || errors.domain) return;
    setSaving(true);
    try {
      const op = await createTransferForExisting({ customerId, domain, memo });
      toast(`已建立客戶轉入（${op.id}），待後勤人工執行`);
      navigate(`/customers/${customerId}`);
    } catch (e) {
      toast((e as Error).message, 'danger');
      setSaving(false);
    }
  };

  return (
    <form className="card form-card" onSubmit={(e) => e.preventDefault()} noValidate>
      <div className="card__body">
        <FormSection title="客戶">
          <FormField label="選擇客戶" required className="is-full" message={tried ? errors.customer : undefined} state={tried && errors.customer ? 'error' : undefined}>
            {(p) => (
              <Combobox
                {...p}
                value={customerId}
                onChange={(v) => {
                  setCustomerId(v);
                  setDomainPick('');
                }}
                placeholder="輸入客戶名稱、網域或統編搜尋"
                emptyText="找不到符合的客戶"
                options={(customers.data ?? []).map((x) => ({
                  value: x.id,
                  label: x.name,
                  hint: [x.primaryDomain, `統編 ${x.taxId}`, x.dealerName].filter(Boolean).join(' · '),
                  keywords: [...x.shortNames, x.taxId, ...x.otherDomains],
                }))}
              />
            )}
          </FormField>
        </FormSection>
        <FormSection title="轉入資訊" description="客戶已經在 Google 申請完轉移，不需要轉移碼。建立後狀態為「待人工執行」，後勤在 Google 後台接受轉入後回來標記，完成後網域會寫回客戶主檔。">
          <fieldset className="plain-fieldset is-full">
            <legend className="form-field__label">
              GWS 網域 <span className="form-field__req">必填</span>
            </legend>
            {owned.map((d) => (
              <label key={d} className="radio-row">
                <input type="radio" name="tdomain" checked={domainPick === d} onChange={() => setDomainPick(d)} />
                <span>
                  <span className="mono">{d}</span>
                  <span className="muted">：客戶已有的網域</span>
                </span>
              </label>
            ))}
            <label className="radio-row">
              <input type="radio" name="tdomain" checked={domainPick === ''} onChange={() => setDomainPick('')} />
              <span>輸入要轉入的網域</span>
            </label>
            {domainPick === '' && (
              <FormField
                label="網域"
                message={tried && errors.domain ? errors.domain : check?.ok ? '可以使用' : undefined}
                state={tried && errors.domain ? 'error' : check?.ok ? 'success' : undefined}
              >
                {(p) => <input {...p} className="input mono" spellCheck={false} autoCapitalize="off" placeholder="company.example" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />}
              </FormField>
            )}
          </fieldset>
          <FormField label="轉移備註" className="is-full">
            {(p) => <textarea {...p} className="textarea" value={memo} onChange={(e) => setMemo(e.target.value)} />}
          </FormField>
        </FormSection>
      </div>
      <div className="form-actions">
        <Link to="/customers" className="btn">
          取消
        </Link>
        <button type="button" className="btn btn--primary" disabled={saving} onClick={submit}>
          建立客戶轉入
        </button>
      </div>
    </form>
  );
}
