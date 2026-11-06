import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getCustomers, getDealers, getPlans, getSubscriptions, getWorkOrder, saveWorkOrder, validateWorkOrder } from '@data/api';
import { workOrderTypeLabel } from '@data/labels';
import type { NewCustomerDraft, WorkOrderInput, WorkOrderType } from '@data/types';
import { Callout, FormField, FormSection } from '@shared/components/Form';
import { Icon } from '@shared/components/Icon';
import { PageHeader } from '@shared/components/PageHeader';
import { PendingTag } from '@shared/components/PendingTag';
import { useToast } from '@shared/components/Toast';
import { useAsync } from '@shared/hooks/useAsync';
import { usePermission } from '../auth';

const emptyCustomer: NewCustomerDraft = { name: '', taxId: '', primaryDomain: '', contactName: '', contactEmail: '', contactPhone: '', note: '' };
const types: WorkOrderType[] = ['new', 'renewal', 'seats', 'cancel', 'transfer'];
const needsSubscription = (t: WorkOrderType) => t === 'renewal' || t === 'seats' || t === 'cancel';

/** 業務開立或修改執行單（草稿、已退回才能修改） */
export function WorkOrderFormPage() {
  const { can } = usePermission();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = useAsync(() => (id ? getWorkOrder(id) : Promise.resolve(undefined)), [id]);
  const customers = useAsync(() => getCustomers({ status: 'active' }));
  const dealers = useAsync(getDealers);
  const plans = useAsync(getPlans);

  const [input, setInput] = useState<WorkOrderInput>({ type: 'new', customerMode: 'existing', payload: { renewMonths: 12 } });
  const [nc, setNc] = useState<NewCustomerDraft>(emptyCustomer);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!id);

  // 修改時帶入原內容
  useEffect(() => {
    const w = existing.data;
    if (!id || !w || loaded) return;
    setInput({ type: w.type, customerMode: w.customerMode, customerId: w.customerId, dealerId: w.dealerId, subscriptionId: w.subscriptionId, payload: w.payload });
    setNc(w.newCustomer ?? emptyCustomer);
    setLoaded(true);
  }, [id, existing.data, loaded]);

  const subs = useAsync(
    () => (input.customerId ? getSubscriptions({ customerId: input.customerId }) : Promise.resolve([])),
    [input.customerId],
  );
  const liveSubs = (subs.data ?? []).filter((s) => s.status !== 'cancelled');
  const sub = liveSubs.find((s) => s.id === input.subscriptionId);

  const full: WorkOrderInput = { ...input, newCustomer: input.customerMode === 'new' ? nc : undefined };
  const errors = useMemo(() => validateWorkOrder(full, id), [JSON.stringify(full), id]); // eslint-disable-line react-hooks/exhaustive-deps
  // 主網域輸入時就檢查，其他欄位在按下送出後才顯示錯誤
  const show = (k: string) => (tried || (k === 'primaryDomain' && nc.primaryDomain) ? errors[k] : undefined);
  const st = (k: string) => (show(k) ? ('error' as const) : undefined);

  const setType = (t: WorkOrderType) =>
    setInput((x) => ({ ...x, type: t, customerMode: needsSubscription(t) ? 'existing' : x.customerMode, subscriptionId: needsSubscription(t) ? x.subscriptionId : undefined }));
  const setPayload = (k: keyof WorkOrderInput['payload'], v: string | number | undefined) => setInput((x) => ({ ...x, payload: { ...x.payload, [k]: v } }));
  const setNcField = (k: keyof NewCustomerDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setNc((x) => ({ ...x, [k]: e.target.value }));

  const save = async (submit: boolean) => {
    setTried(true);
    if (Object.keys(errors).length) {
      toast(`還有 ${Object.keys(errors).length} 個欄位要處理`, 'danger');
      return;
    }
    setSaving(true);
    try {
      const wo = await saveWorkOrder(full, submit, id);
      toast(submit ? `${wo.id} 已送出簽核，等待業務主管審核` : `${wo.id} 已存成草稿`);
      navigate(`/work-orders/${wo.id}`);
    } catch (e) {
      toast((e as Error).message, 'danger');
      setSaving(false);
    }
  };

  if (id && existing.data && !['draft', 'returned'].includes(existing.data.status))
    return (
      <Callout tone="warning">
        只有草稿或已退回的執行單可以修改。<Link to={`/work-orders/${id}`}>回到執行單</Link>
      </Callout>
    );

  if (!(can('workOrders', 'write')))
    return (
      <Callout tone="warning" title="你的角色沒有權限">
        你的角色不能開立或修改執行單。如果需要，請聯絡系統管理員調整角色權限。
      </Callout>
    );

  return (
    <>
      <Link to={id ? `/work-orders/${id}` : '/work-orders'} className="back-link">
        <Icon name="chevronLeft" size={14} />
        {id ?? '執行單'}
      </Link>
      <PageHeader
        title={id ? `修改執行單 ${id}` : '開立執行單'}
        titleAddon={<PendingTag id={6} hint="是否列入第一階段上線" />}
        description="業務接到客戶需求後開立。送出後依序由業務主管、技術主管簽核，核准後由後勤處理。"
      />
      {existing.data?.status === 'returned' && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Callout tone="danger" title="退回原因">
            {existing.data.returnReason}
          </Callout>
        </div>
      )}

      <form className="card form-card" onSubmit={(e) => e.preventDefault()} noValidate>
        <div className="card__body">
          <FormSection title="需求類型">
            <FormField label="類型" required className="is-full">
              {(p) => (
                <div className="segmented segmented--wrap" role="group" aria-labelledby={p.id}>
                  {types.map((t) => (
                    <button key={t} type="button" aria-pressed={input.type === t} onClick={() => setType(t)}>
                      {workOrderTypeLabel[t]}
                    </button>
                  ))}
                </div>
              )}
            </FormField>
          </FormSection>

          <FormSection title="客戶">
            <FormField label="客戶" required className="is-full" message={show('customerMode')} state={st('customerMode')}>
              {(p) => (
                <div className="segmented" role="group" aria-labelledby={p.id}>
                  <button type="button" aria-pressed={input.customerMode === 'existing'} onClick={() => setInput((x) => ({ ...x, customerMode: 'existing' }))}>
                    現有客戶
                  </button>
                  <button
                    type="button"
                    aria-pressed={input.customerMode === 'new'}
                    disabled={needsSubscription(input.type)}
                    title={needsSubscription(input.type) ? '續約、調整席次、取消訂閱只適用現有客戶' : undefined}
                    onClick={() => setInput((x) => ({ ...x, customerMode: 'new', customerId: undefined, subscriptionId: undefined }))}
                  >
                    新客戶
                  </button>
                </div>
              )}
            </FormField>

            {input.customerMode === 'existing' ? (
              <>
                <FormField label="選擇客戶" required message={show('customerId')} state={st('customerId')}>
                  {(p) => (
                    <select
                      {...p}
                      className="select"
                      value={input.customerId ?? ''}
                      onChange={(e) => setInput((x) => ({ ...x, customerId: e.target.value || undefined, subscriptionId: undefined }))}
                    >
                      <option value="">請選擇</option>
                      {(customers.data ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}（{c.primaryDomain}）
                        </option>
                      ))}
                    </select>
                  )}
                </FormField>
                {needsSubscription(input.type) ? (
                  <FormField label="訂閱" required message={show('subscriptionId')} state={st('subscriptionId')}>
                    {(p) => (
                      <select
                        {...p}
                        className="select"
                        value={input.subscriptionId ?? ''}
                        disabled={!input.customerId}
                        onChange={(e) => setInput((x) => ({ ...x, subscriptionId: e.target.value || undefined }))}
                      >
                        <option value="">{input.customerId ? (liveSubs.length ? '請選擇' : '這個客戶沒有有效訂閱') : '請先選擇客戶'}</option>
                        {liveSubs.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.plan} · {s.seats} 席 · 到期 {s.expiresAt}
                          </option>
                        ))}
                      </select>
                    )}
                  </FormField>
                ) : (
                  <div />
                )}
              </>
            ) : (
              <>
                <Callout tone="neutral">客戶資料會在核准後由後勤建檔，這裡填的內容會自動帶到建檔畫面。主網域現在就會檢查格式與是否重複。</Callout>
                <FormField label="客戶名稱" required message={show('name')} state={st('name')}>
                  {(p) => <input {...p} className="input" value={nc.name} onChange={setNcField('name')} />}
                </FormField>
                <FormField label="統一編號" required message={show('taxId')} state={st('taxId')}>
                  {(p) => <input {...p} className="input mono" inputMode="numeric" maxLength={8} value={nc.taxId} onChange={setNcField('taxId')} />}
                </FormField>
                <FormField label="主網域" required message={show('primaryDomain')} state={st('primaryDomain')} help="例如 company.example">
                  {(p) => <input {...p} className="input mono" spellCheck={false} autoCapitalize="off" value={nc.primaryDomain} onChange={setNcField('primaryDomain')} />}
                </FormField>
                <FormField label="經銷商" required message={show('dealerId')} state={st('dealerId')}>
                  {(p) => (
                    <select {...p} className="select" value={input.dealerId ?? ''} onChange={(e) => setInput((x) => ({ ...x, dealerId: e.target.value || undefined }))}>
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
                <FormField label="聯絡人" required message={show('contactName')} state={st('contactName')}>
                  {(p) => <input {...p} className="input" value={nc.contactName} onChange={setNcField('contactName')} />}
                </FormField>
                <FormField label="聯絡人 Email" required message={show('contactEmail')} state={st('contactEmail')}>
                  {(p) => <input {...p} className="input" type="email" value={nc.contactEmail} onChange={setNcField('contactEmail')} />}
                </FormField>
                <FormField label="電話">{(p) => <input {...p} className="input" type="tel" value={nc.contactPhone} onChange={setNcField('contactPhone')} />}</FormField>
                <div />
              </>
            )}
          </FormSection>

          <FormSection title="需求內容">
            {input.type === 'new' && (
              <>
                <FormField label="方案" required addon={<PendingTag id={3} hint="方案清單來源" />} message={show('plan')} state={st('plan')}>
                  {(p) => (
                    <select {...p} className="select" value={input.payload.plan ?? ''} onChange={(e) => setPayload('plan', e.target.value || undefined)}>
                      <option value="">請選擇</option>
                      {(plans.data ?? []).map((pl) => (
                        <option key={pl}>{pl}</option>
                      ))}
                    </select>
                  )}
                </FormField>
                <FormField label="席次" required message={show('seats')} state={st('seats')}>
                  {(p) => (
                    <input {...p} className="input tnum" type="number" min={1} value={input.payload.seats ?? ''} onChange={(e) => setPayload('seats', e.target.value ? Number(e.target.value) : undefined)} />
                  )}
                </FormField>
              </>
            )}
            {input.type === 'renewal' && (
              <FormField label="續約期間" required message={show('renewMonths')} state={st('renewMonths')}>
                {(p) => (
                  <select {...p} className="select" value={input.payload.renewMonths ?? ''} onChange={(e) => setPayload('renewMonths', Number(e.target.value))}>
                    <option value="12">12 個月</option>
                    <option value="24">24 個月</option>
                    <option value="36">36 個月</option>
                  </select>
                )}
              </FormField>
            )}
            {input.type === 'seats' && (
              <FormField label="調整後席次" required message={show('toSeats')} state={st('toSeats')} help={sub ? `目前 ${sub.seats} 席` : '請先選擇訂閱'}>
                {(p) => (
                  <input {...p} className="input tnum" type="number" min={1} value={input.payload.toSeats ?? ''} onChange={(e) => setPayload('toSeats', e.target.value ? Number(e.target.value) : undefined)} />
                )}
              </FormField>
            )}
            {input.type === 'transfer' && (
              <Callout tone="info">轉移碼由客戶的 Google 管理員產生，14 天內有效。為避免簽核期間過期，轉移碼由後勤處理時再填，開單時不用填。</Callout>
            )}
            {input.type === 'cancel' && <Callout tone="warning">核准後由後勤送 Google 取消，完成後這筆訂閱的所有授權會停止。</Callout>}
            <FormField label={input.type === 'cancel' ? '取消原因' : '備註'} required={input.type === 'cancel'} className="is-full" message={show('memo')} state={st('memo')}>
              {(p) => <textarea {...p} className="textarea" value={input.payload.memo ?? ''} onChange={(e) => setPayload('memo', e.target.value)} />}
            </FormField>
          </FormSection>
        </div>
        <div className="form-actions">
          <span className="form-actions__hint">{Object.keys(errors).length ? `尚有 ${Object.keys(errors).length} 個欄位未完成` : '資料完整，可以送出'}</span>
          <Link to={id ? `/work-orders/${id}` : '/work-orders'} className="btn">
            取消
          </Link>
          <button type="button" className="btn" disabled={saving} onClick={() => save(false)}>
            存成草稿
          </button>
          <button type="button" className="btn btn--primary" disabled={saving} onClick={() => save(true)}>
            送出簽核
          </button>
        </div>
      </form>
    </>
  );
}
