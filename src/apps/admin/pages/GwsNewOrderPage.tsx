import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { checkDomain, getCustomers } from '@data/api';
import type { NewCustomerInput } from '@data/types';
import { Combobox } from '@shared/components/Combobox';
import { Callout, FormField, FormSection } from '@shared/components/Form';
import { Icon } from '@shared/components/Icon';
import { PageHeader } from '@shared/components/PageHeader';
import { useAsync } from '@shared/hooks/useAsync';
import { usePermission } from '../auth';
import { OperationModal, type OperationTarget } from '../components/OperationModal';
import { QuickCustomerForm, emptyQuickCustomer, quickCustomerErrors, toNewCustomerInput, type QuickCustomer } from '../components/QuickCustomerForm';

/**
 * GWS 新訂（整頁）：第一步選原有客戶或填新客戶資料，第二步填訂閱內容。
 * 新客戶在送出新訂時才一起建立客戶主檔（2026/11/18：第一階段沒有獨立的客戶建檔畫面）。
 */
export function GwsNewOrderPage() {
  const { can } = usePermission();
  const navigate = useNavigate();
  const customers = useAsync(() => getCustomers({ status: 'active' }));
  const canCreateCustomer = can('customers', 'create');
  const [step, setStep] = useState<1 | 2>(1);
  const [who, setWho] = useState<'existing' | 'new'>('existing');
  const [pickId, setPickId] = useState('');
  const [pickTried, setPickTried] = useState(false);
  const [newCust, setNewCust] = useState<QuickCustomer>(emptyQuickCustomer);
  const [newCustTried, setNewCustTried] = useState(false);
  const [target, setTarget] = useState<OperationTarget | null>(null);
  const [newCustomerInput, setNewCustomerInput] = useState<NewCustomerInput | undefined>();
  // 新客戶的 GWS 網域在第一步填（2026/11/24）
  const [newDomain, setNewDomain] = useState('');
  const domainCheck = newDomain.trim() ? checkDomain(newDomain) : undefined;
  const domainError = !newDomain.trim() ? '請輸入網域' : domainCheck && !domainCheck.ok ? domainCheck.message : undefined;

  const errorCount = Object.keys(quickCustomerErrors(newCust)).length + (domainError ? 1 : 0);
  const goList = () => navigate('/products/gws');

  const next = () => {
    if (who === 'existing') {
      setPickTried(true);
      const c = customers.data?.find((x) => x.id === pickId);
      if (!c) return;
      setNewCustomerInput(undefined);
      setTarget({ customerId: c.id, customerName: c.name, primaryDomain: c.primaryDomain, dealerId: c.dealerId });
    } else {
      setNewCustTried(true);
      if (errorCount) {
        // 捲回上方，讓「還有幾個欄位要填」的提示看得到
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const input = toNewCustomerInput(newCust);
      setNewCustomerInput(input);
      setTarget({ customerId: '', customerName: input.name, primaryDomain: '', dealerId: input.dealerId });
    }
    setStep(2);
    window.scrollTo({ top: 0 });
  };

  if (!can('subscriptions', 'create'))
    return (
      <Callout tone="warning" title="你的角色沒有權限">
        你的角色不能新訂 GWS。如果需要，請聯絡系統管理員調整角色權限。
      </Callout>
    );

  return (
    <>
      <Link to="/products/gws" className="back-link">
        <Icon name="chevronLeft" size={14} />
        GWS 訂閱
      </Link>
      <PageHeader title="GWS 新訂" description="選擇原有客戶，或直接填寫新客戶的資料；下一步填訂閱內容。新客戶在送出新訂時才會一起建立。" />

      <ol className="step-indicator step-indicator--page" aria-label="新訂步驟">
        <li aria-current={step === 1 ? 'step' : undefined}>1. 客戶資料</li>
        <li aria-current={step === 2 ? 'step' : undefined}>2. 訂閱內容</li>
      </ol>

      {step === 1 ? (
        <div className="card form-card">
          <div className="card__body stack" style={{ gap: 'var(--space-5)' }}>
            <div>
              <div className="segmented" role="group" aria-label="客戶">
                <button type="button" aria-pressed={who === 'existing'} onClick={() => setWho('existing')}>
                  原有客戶
                </button>
                <button type="button" aria-pressed={who === 'new'} disabled={!canCreateCustomer} onClick={() => setWho('new')}>
                  新客戶
                </button>
              </div>
              <p className="muted" style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-sm)' }}>
                {!canCreateCustomer
                  ? '你的角色不能建立客戶，只能選原有客戶。'
                  : who === 'existing'
                    ? '客戶已經在系統裡（包含其他產品的客戶）。'
                    : '客戶還不在系統裡：在這裡填客戶資料，下一步填訂閱內容，送出時一起建立。'}
              </p>
            </div>

            {who === 'existing' ? (
              <FormField
                label="客戶"
                required
                message={pickTried && !pickId ? '請選擇客戶' : undefined}
                state={pickTried && !pickId ? 'error' : undefined}
                help="從其他經銷商轉入的客戶，請回 GWS 訂閱用「客戶轉入」。"
              >
                {(p) => (
                  <Combobox
                    {...p}
                    value={pickId}
                    onChange={setPickId}
                    placeholder="輸入客戶名稱、網域或統編搜尋"
                    emptyText="找不到符合的客戶，可以改選「新客戶」"
                    options={(customers.data ?? []).map((c) => ({
                      value: c.id,
                      label: c.name,
                      hint: [c.primaryDomain, c.taxId ? `統編 ${c.taxId}` : '個人', c.dealerName].filter(Boolean).join(' · '),
                      keywords: [...c.shortNames, c.taxId, ...c.otherDomains],
                    }))}
                  />
                )}
              </FormField>
            ) : (
              <>
                {newCustTried && errorCount > 0 && <Callout tone="danger">還有 {errorCount} 個欄位要填寫或修正。</Callout>}
                <QuickCustomerForm value={newCust} onChange={setNewCust} showErrors={newCustTried} domainNote="">
                  <FormSection title="GWS 網域">
                    <FormField
                      className="is-full"
                      label="網域名稱"
                      required
                      message={newCustTried && domainError ? domainError : domainCheck?.ok ? '可以使用' : undefined}
                      state={newCustTried && domainError ? 'error' : domainCheck?.ok ? 'success' : undefined}
                      help="客戶要用在 GWS 的網域；訂閱成功後會寫回客戶主檔，成為主網域。"
                    >
                      {(p) => (
                        <input
                          {...p}
                          className="input mono"
                          spellCheck={false}
                          autoCapitalize="off"
                          placeholder="company.example"
                          value={newDomain}
                          onChange={(e) => setNewDomain(e.target.value)}
                        />
                      )}
                    </FormField>
                  </FormSection>
                </QuickCustomerForm>
              </>
            )}
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={goList}>
              取消
            </button>
            <button type="button" className="btn btn--primary" onClick={next}>
              下一步：訂閱內容
            </button>
          </div>
        </div>
      ) : (
        target && (
          <OperationModal
            open
            layout="page"
            type="new"
            target={target}
            newCustomer={newCustomerInput}
            fixedDomain={newCustomerInput ? newDomain.trim().toLowerCase() : undefined}
            onBack={() => {
              setStep(1);
              window.scrollTo({ top: 0 });
            }}
            onClose={goList}
            onSubmitted={(op) => navigate(`/products/gws?op=${op.id}`)}
          />
        )
      )}
    </>
  );
}
