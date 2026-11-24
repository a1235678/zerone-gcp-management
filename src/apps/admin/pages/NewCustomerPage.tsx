import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { checkDomain, createCustomer, createTransferInCustomer, createTransferForExisting, getCustomers, getWorkOrder, linkCustomerToWorkOrder } from '@data/api';
import type { DomainCheck } from '@data/types';
import { Callout, FormField, FormSection } from '@shared/components/Form';
import { Icon } from '@shared/components/Icon';
import { PageHeader } from '@shared/components/PageHeader';
import { PendingTag } from '@shared/components/PendingTag';
import { useToast } from '@shared/components/Toast';
import { useAsync } from '@shared/hooks/useAsync';
import { Combobox } from '@shared/components/Combobox';
import { QuickCustomerForm, emptyQuickCustomer, quickCustomerErrors, toNewCustomerInput, type CustomerFormValue } from '../components/QuickCustomerForm';
import { usePermission } from '../auth';

/**
 * 新增客戶，或「轉入客戶」：從其他經銷商轉進來的客戶。
 * 客戶欄位用共用的 QuickCustomerForm（跟 GWS 新訂的新客戶同一份）。建立客戶主檔時不建立帳號（2026/11/24）。
 * 轉入時多了主網域與轉移備註（客戶已在 Google 申請完移轉，不需要轉移碼），送出後建立客戶主檔，並建立一筆客戶轉入由後勤人工執行。
 * 網址帶 ?fromWo=單號 時，從執行單帶入新客戶資料，建立後接回執行單。
 */
export function NewCustomerPage({ mode = 'new' }: { mode?: 'new' | 'transfer' }) {
  const isTransfer = mode === 'transfer';
  const { can } = usePermission();
  // 客戶轉入：沒有「客戶可新增」權限的角色只能轉入現有客戶
  const canCreateCustomer = can('customers', 'create');
  const [who, setWho] = useState<'new' | 'existing'>(isTransfer && !canCreateCustomer ? 'existing' : 'new');
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const fromWo = params.get('fromWo');
  const wo = useAsync(() => (fromWo ? getWorkOrder(fromWo) : Promise.resolve(undefined)), [fromWo]);
  const [form, setForm] = useState<CustomerFormValue>(emptyQuickCustomer);
  const [primaryDomain, setPrimaryDomain] = useState('');
  const [transferMemo, setTransferMemo] = useState('');
  const [prefilled, setPrefilled] = useState(false);
  const [tried, setTried] = useState(false);
  const [domain, setDomain] = useState<{ checking: boolean; result?: DomainCheck }>({ checking: false });
  const [saving, setSaving] = useState(false);

  // 從執行單帶入新客戶資料
  useEffect(() => {
    const n = wo.data?.newCustomer;
    if (!n || prefilled) return;
    setForm((f) => ({
      ...f,
      kind: n.taxId ? 'company' : 'individual',
      name: n.name,
      taxId: n.taxId,
      dealerId: wo.data!.dealerId,
      contactName: n.contactName,
      contactEmail: n.contactEmail,
      contactPhone: n.contactPhone,
      note: n.note,
    }));
    setPrimaryDomain(n.primaryDomain);
    setTransferMemo(wo.data!.payload.memo ?? '');
    setPrefilled(true);
  }, [wo.data, prefilled]);

  // 主網域（只有客戶轉入要填）：停止輸入 300ms 後檢查格式與是否重複
  useEffect(() => {
    if (!isTransfer || !primaryDomain) {
      setDomain({ checking: false });
      return;
    }
    setDomain({ checking: true });
    const t = setTimeout(() => setDomain({ checking: false, result: checkDomain(primaryDomain) }), 300);
    return () => clearTimeout(t);
  }, [primaryDomain, isTransfer]);

  const errors = quickCustomerErrors(form);
  const domainOk = !isTransfer || (!domain.checking && domain.result?.ok === true);
  const canSubmit = domainOk && Object.keys(errors).length === 0 && !saving;

  const submit = async () => {
    setTried(true);
    if (!canSubmit) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSaving(true);
    const input = toNewCustomerInput(form);
    try {
      if (isTransfer) {
        const { customer, operation } = await createTransferInCustomer({ ...input, primaryDomain, memo: transferMemo, workOrderId: fromWo ?? undefined });
        toast(`已建立「${customer.name}」與客戶轉入（${operation.id}）`);
        navigate(fromWo ? `/work-orders/${fromWo}` : `/products/gws?op=${operation.id}`);
      } else {
        const c = await createCustomer(input);
        if (fromWo) {
          await linkCustomerToWorkOrder(fromWo, c.id);
          toast(`已建立客戶「${c.name}」，回到執行單 ${fromWo} 繼續處理`);
          navigate(`/work-orders/${fromWo}`);
        } else {
          toast(`已建立客戶「${c.name}」。使用者帳號請在客戶詳情的「使用者帳號」邀請`);
          navigate(`/customers/${c.id}`);
        }
      }
    } catch (error) {
      toast((error as Error).message, 'danger');
      setSaving(false);
    }
  };

  const domainField = (() => {
    if (!primaryDomain) return { state: tried ? ('error' as const) : undefined, message: tried ? '請輸入主網域' : undefined };
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
          {r.existingCustomer && (
            <>
              這個網域已經是系統裡的客戶，請確認是否重複建立：<Link to={`/customers/${r.existingCustomer}`}>查看該客戶</Link>。
            </>
          )}
        </span>
      ),
    };
  })();

  const missing = [!domainOk && '有效的主網域', Object.keys(errors).length > 0 && `${Object.keys(errors).length} 個必填欄位`].filter(Boolean);

  if (isTransfer ? !can('subscriptions', 'write') : !canCreateCustomer)
    return (
      <Callout tone="warning" title="你的角色沒有權限">
        你的角色不能建立客戶。如果需要，請聯絡系統管理員調整角色權限。
      </Callout>
    );

  return (
    <>
      <Link to={isTransfer ? '/products/gws' : '/customers'} className="back-link">
        <Icon name="chevronLeft" size={14} />
        {isTransfer ? 'GWS 訂閱' : '客戶管理'}
      </Link>
      <PageHeader
        title={isTransfer ? '客戶轉入' : '新增客戶'}
        titleAddon={<PendingTag id={1} hint="客戶由誰建立" />}
        description={
          isTransfer
            ? 'GWS 客戶從其他經銷商轉到我們底下，客戶已經在 Google 申請完轉移。送出後產生一筆客戶轉入，回到 GWS 訂閱，流程就結束。'
            : '建立客戶主檔。建立時不會建立帳號；客戶的使用者帳號在客戶詳情的「使用者帳號」用「邀請」建立。'
        }
      />

      {isTransfer && !fromWo && (
        <div className="form-card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="segmented" role="group" aria-label="轉入的客戶">
            <button type="button" aria-pressed={who === 'new'} disabled={!canCreateCustomer} onClick={() => setWho('new')}>
              新客戶
            </button>
            <button type="button" aria-pressed={who === 'existing'} onClick={() => setWho('existing')}>
              現有客戶
            </button>
          </div>
          <p className="muted" style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-sm)' }}>
            {who === 'new' ? '客戶還不在系統裡：建立客戶主檔。' : '客戶已經在系統裡（例如已經是其他產品的客戶）：不用重填主檔，直接建立客戶轉入。'}
          </p>
        </div>
      )}
      {isTransfer && (who === 'existing' || !canCreateCustomer) && !fromWo ? (
        <ExistingTransferForm />
      ) : (
        <>
          {fromWo && (
            <div className="form-card" style={{ marginBottom: 'var(--space-4)' }}>
              <Callout tone="info" title={`依執行單 ${fromWo} ${isTransfer ? '客戶轉入' : '建立客戶'}`}>
                {isTransfer
                  ? '客戶資料與轉移備註已從執行單帶入，請確認後建立。建立後會產生一筆客戶轉入（待人工執行），並回到執行單。'
                  : '客戶資料已從執行單帶入，請確認後建立。建立後會回到執行單繼續下一步。'}
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
              {tried && missing.length > 0 && (
                <div style={{ marginBottom: 'var(--space-5)' }}>
                  <Callout tone="danger">還缺：{missing.join('、')}。</Callout>
                </div>
              )}
              <QuickCustomerForm
                value={form}
                onChange={setForm}
                showErrors={tried}
                dealerLabel={isTransfer ? '轉入後的經銷商' : '所屬經銷商'}
                domainNote={
                  isTransfer ? '' : '建立客戶時不用填網域。有 GWS 產品時，在新訂時填寫網域，訂閱成功後會自動寫回客戶主檔；之後也可以在客戶詳情新增網域。'
                }
              >
                {isTransfer && (
                  <FormSection title="GWS 主網域">
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
                          value={primaryDomain}
                          onChange={(e) => setPrimaryDomain(e.target.value)}
                        />
                      )}
                    </FormField>
                  </FormSection>
                )}
              </QuickCustomerForm>
              {isTransfer && (
                <FormSection title="轉移資訊" description="客戶已經在 Google 申請完轉移。建立客戶後狀態為「待人工執行」，後勤在 Google 後台接受轉入後回來標記。">
                  <FormField label="轉移備註" className="is-full">
                    {(p) => <textarea {...p} className="textarea" value={transferMemo} onChange={(e) => setTransferMemo(e.target.value)} />}
                  </FormField>
                  <Callout tone="neutral">客戶的訂閱會全部轉入，不能只轉一部分。原訂閱會取消並在我方底下重建，承諾期方案的承諾期會重新計算。</Callout>
                </FormSection>
              )}
            </div>
            <div className="form-actions">
              <span className="form-actions__hint">{canSubmit ? '資料完整，可以建立' : `尚缺：${missing.join('、')}`}</span>
              <Link to={isTransfer ? '/products/gws' : '/customers'} className="btn">
                取消
              </Link>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? '處理中…' : isTransfer ? '送出客戶轉入' : fromWo ? '建立客戶並回到執行單' : '建立客戶'}
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
      toast(`已建立客戶轉入（${op.id}）`);
      navigate(`/products/gws?op=${op.id}`);
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
                  hint: [x.primaryDomain, x.taxId ? `統編 ${x.taxId}` : '個人', x.dealerName].filter(Boolean).join(' · '),
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
        <Link to="/products/gws" className="btn">
          取消
        </Link>
        <button type="button" className="btn btn--primary" disabled={saving} onClick={submit}>
          送出客戶轉入
        </button>
      </div>
    </form>
  );
}
