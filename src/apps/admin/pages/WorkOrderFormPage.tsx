import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { analyzeOrder, getCustomers, getDealers, getPlanList, getSubscriptions, getWorkOrder, saveWorkOrder, validateWorkOrder } from '@data/api';
import { executionModeLabel, workOrderTypeLabel } from '@data/labels';
import type { NewCustomerDraft, WorkOrderInput, WorkOrderType } from '@data/types';
import { StatusTag } from '@shared/components/StatusTag';
import { Combobox } from '@shared/components/Combobox';
import { ChangeTags } from '../components/OperationModal';
import { Callout, FormField, FormSection } from '@shared/components/Form';
import { Icon } from '@shared/components/Icon';
import { PageHeader } from '@shared/components/PageHeader';
import { PendingTag } from '@shared/components/PendingTag';
import { useToast } from '@shared/components/Toast';
import { useAsync } from '@shared/hooks/useAsync';
import { usePermission } from '../auth';

const emptyCustomer: NewCustomerDraft = { name: '', taxId: '', primaryDomain: '', contactName: '', contactEmail: '', contactPhone: '', note: '' };
const types: WorkOrderType[] = ['new', 'transfer', 'renewal', 'addSeats', 'upgrade'];
const needsSubscription = (t: WorkOrderType) => t === 'renewal' || t === 'addSeats' || t === 'upgrade';

/** 業務開立或修改執行單（草稿、已退回才能修改） */
export function WorkOrderFormPage() {
  const { can } = usePermission();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = useAsync(() => (id ? getWorkOrder(id) : Promise.resolve(undefined)), [id]);
  const customers = useAsync(() => getCustomers({ status: 'active' }));
  const dealers = useAsync(getDealers);
  const plans = useAsync(getPlanList);

  const [input, setInput] = useState<WorkOrderInput>({ type: 'new', customerMode: 'new', payload: { renewMonths: 12 } });
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
  const activePlans = (plans.data ?? []).filter((p) => p.productId === 'P01' && p.status === 'active');
  const subTier = activePlans.find((p) => p.name === sub?.plan)?.tier ?? 0;
  const analysis = analyzeOrder(input.type, sub, input.payload);
  const ownedCustomer = (customers.data ?? []).find((c) => c.id === input.customerId);
  const ownedDomains = input.customerMode === 'existing' && ownedCustomer ? [ownedCustomer.primaryDomain, ...ownedCustomer.otherDomains].filter(Boolean) : [];
  const planLabel = input.type === 'upgrade' ? '升級後的方案' : input.type === 'renewal' ? '續約方案（版本）' : '方案';
  const upgradeOnly = input.type === 'upgrade';

  const full: WorkOrderInput = { ...input, newCustomer: input.customerMode === 'new' ? nc : undefined };
  const errors = useMemo(() => validateWorkOrder(full, id), [JSON.stringify(full), id]); // eslint-disable-line react-hooks/exhaustive-deps
  // 主網域輸入時就檢查，其他欄位在按下送出後才顯示錯誤
  const show = (k: string) => (tried || (k === 'primaryDomain' && nc.primaryDomain) ? errors[k] : undefined);
  const st = (k: string) => (show(k) ? ('error' as const) : undefined);

  // 客戶轉入一定是新客戶；續約、加購、中途升版一定是現有客戶；新訂可以選新客戶或現有客戶（其他產品的客戶）
  const setType = (t: WorkOrderType) =>
    setInput((x) => {
      const mode = needsSubscription(t) ? 'existing' : t === 'transfer' ? 'new' : x.customerMode;
      return {
        ...x,
        type: t,
        customerMode: mode,
        customerId: mode === 'existing' ? x.customerId : undefined,
        subscriptionId: needsSubscription(t) ? x.subscriptionId : undefined,
      };
    });
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

  if (!can('workOrders', id ? 'write' : 'create'))
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
        titleAddon={<StatusTag tone="neutral">第二階段</StatusTag>}
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
            {input.type === 'new' && (
              <FormField label="客戶" required className="is-full" message={show('customerMode')} state={st('customerMode')} help="現有客戶：已經是我們平台其他產品的客戶。">
                {(p) => (
                  <div className="segmented" role="group" aria-labelledby={p.id}>
                    <button type="button" aria-pressed={input.customerMode === 'new'} onClick={() => setInput((x) => ({ ...x, customerMode: 'new', customerId: undefined }))}>
                      新客戶
                    </button>
                    <button type="button" aria-pressed={input.customerMode === 'existing'} onClick={() => setInput((x) => ({ ...x, customerMode: 'existing' }))}>
                      現有客戶
                    </button>
                  </div>
                )}
              </FormField>
            )}
            {input.customerMode === 'existing' ? (
              <>
                <FormField label="選擇客戶" required message={show('customerId')} state={st('customerId')}>
                  {(p) => (
                    <Combobox
                      {...p}
                      value={input.customerId ?? ''}
                      onChange={(v) => setInput((x) => ({ ...x, customerId: v || undefined, subscriptionId: undefined }))}
                      placeholder="輸入客戶名稱、網域或統編搜尋"
                      emptyText="找不到符合的客戶"
                      options={(customers.data ?? []).map((c) => ({
                value: c.id,
                label: c.name,
                hint: [c.primaryDomain, `統編 ${c.taxId}`, c.dealerName].filter(Boolean).join(' · '),
                keywords: [...c.shortNames, c.taxId, ...c.otherDomains],
              }))}
                    />
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
                        onChange={(e) => {
                          const next = liveSubs.find((x) => x.id === e.target.value);
                          // 續約預設帶入目前的方案與人數
                          setInput((x) => ({
                            ...x,
                            subscriptionId: e.target.value || undefined,
                            payload: x.type === 'renewal' && next ? { ...x.payload, plan: next.plan, seats: next.seats ?? undefined } : x.payload,
                          }));
                        }}
                      >
                        <option value="">{input.customerId ? (liveSubs.length ? '請選擇' : '這個客戶沒有有效訂閱') : '請先選擇客戶'}</option>
                        {liveSubs.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.plan} · {s.seats} 席 · 合約 {s.startsAt} – {s.expiresAt}
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
                <div className="is-full">
                  <Callout tone="neutral">
                    {input.type === 'transfer'
                      ? '客戶轉入：客戶從其他經銷商轉進來，一定是新客戶，請填客戶主檔「轉入客戶」的欄位。核准後由後勤在「轉入客戶」建檔並建立轉入，這裡填的內容會自動帶入。'
                      : '新客戶的資料會在核准後由後勤建檔，這裡填的內容會自動帶到建檔畫面。網域在下方「需求內容」填寫。'}
                    {input.type === 'transfer' && '主網域現在就會檢查格式與是否重複。'}
                  </Callout>
                </div>
                <FormField label="客戶名稱" required message={show('name')} state={st('name')}>
                  {(p) => <input {...p} className="input" value={nc.name} onChange={setNcField('name')} />}
                </FormField>
                <FormField label="統一編號" required message={show('taxId')} state={st('taxId')}>
                  {(p) => <input {...p} className="input mono" inputMode="numeric" maxLength={8} value={nc.taxId} onChange={setNcField('taxId')} />}
                </FormField>
                {input.type === 'transfer' ? (
                  <FormField label="主網域" required message={show('primaryDomain')} state={st('primaryDomain')} help="客戶轉入是既有的 GWS 客戶，例如 company.example">
                    {(p) => <input {...p} className="input mono" spellCheck={false} autoCapitalize="off" value={nc.primaryDomain} onChange={setNcField('primaryDomain')} />}
                  </FormField>
                ) : (
                  <div />
                )}
                <FormField label={input.type === 'transfer' ? '轉入後的經銷商' : '經銷商'} required message={show('dealerId')} state={st('dealerId')}>
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
                <FormField label="聯絡人姓名" required message={show('contactName')} state={st('contactName')}>
                  {(p) => <input {...p} className="input" value={nc.contactName} onChange={setNcField('contactName')} />}
                </FormField>
                <FormField label="聯絡電話">{(p) => <input {...p} className="input" type="tel" value={nc.contactPhone} onChange={setNcField('contactPhone')} />}</FormField>
                <FormField label="聯絡人信箱" required message={show('contactEmail')} state={st('contactEmail')}>
                  {(p) => <input {...p} className="input" type="email" value={nc.contactEmail} onChange={setNcField('contactEmail')} />}
                </FormField>
                <div />
              </>
            )}
          </FormSection>

          <FormSection title="需求內容">
            {input.type === 'new' && (
              <>
                <FormField
                  label="網域"
                  required
                  message={show('domain')}
                  state={st('domain')}
                  help={ownedDomains.length ? `客戶已有：${ownedDomains.join('、')}（可以直接填）` : '例如 company.example。訂閱成功後會寫回客戶主檔。'}
                >
                  {(p) => <input {...p} className="input mono" spellCheck={false} autoCapitalize="off" value={input.payload.domain ?? ''} onChange={(e) => setPayload('domain', e.target.value)} />}
                </FormField>
                <FormField label={planLabel} required addon={<PendingTag id={3} hint="方案清單來源" />} message={show('plan')} state={st('plan')}>
                  {(p) => (
                    <select {...p} className="select" value={input.payload.plan ?? ''} onChange={(e) => setPayload('plan', e.target.value || undefined)}>
                      <option value="">請選擇</option>
                      {activePlans
                        .filter((pl) => !upgradeOnly || pl.tier > subTier)
                        .map((pl) => (
                          <option key={pl.id} value={pl.name}>
                            {pl.name}（等級 {pl.tier}）{pl.name === sub?.plan ? '・目前' : ''}
                          </option>
                        ))}
                    </select>
                  )}
                </FormField>
                <FormField label="人數" required message={show('seats')} state={st('seats')}>
                  {(p) => (
                    <input {...p} className="input tnum" type="number" min={1} value={input.payload.seats ?? ''} onChange={(e) => setPayload('seats', e.target.value ? Number(e.target.value) : undefined)} />
                  )}
                </FormField>
              </>
            )}
            {input.type === 'renewal' && (
              <>
                <FormField label={planLabel} required addon={<PendingTag id={3} hint="方案清單來源" />} message={show('plan')} state={st('plan')}>
                  {(p) => (
                    <select {...p} className="select" value={input.payload.plan ?? ''} onChange={(e) => setPayload('plan', e.target.value || undefined)}>
                      <option value="">請選擇</option>
                      {activePlans
                        .filter((pl) => !upgradeOnly || pl.tier > subTier)
                        .map((pl) => (
                          <option key={pl.id} value={pl.name}>
                            {pl.name}（等級 {pl.tier}）{pl.name === sub?.plan ? '・目前' : ''}
                          </option>
                        ))}
                    </select>
                  )}
                </FormField>
                <FormField label="續約人數" required message={show('seats')} state={st('seats')} help={sub ? `目前 ${sub.seats} 席` : '請先選擇訂閱'}>
                  {(p) => (
                    <input {...p} className="input tnum" type="number" min={1} value={input.payload.seats ?? ''} onChange={(e) => setPayload('seats', e.target.value ? Number(e.target.value) : undefined)} />
                  )}
                </FormField>
                <FormField label="續約期間" required message={show('renewMonths')} state={st('renewMonths')}>
                  {(p) => (
                    <select {...p} className="select" value={input.payload.renewMonths ?? ''} onChange={(e) => setPayload('renewMonths', Number(e.target.value))}>
                      <option value="12">12 個月</option>
                      <option value="24">24 個月</option>
                      <option value="36">36 個月</option>
                    </select>
                  )}
                </FormField>
                <FormField label="新合約期間">
                  {(p) => <input {...p} className="input mono" readOnly value={sub ? `${analysis.newStartsAt?.replace(/-/g, '/')} – ${analysis.newExpiresAt?.replace(/-/g, '/')}` : '請先選擇訂閱'} />}
                </FormField>
              </>
            )}
            {input.type === 'addSeats' && (
              <>
                <FormField label="加購人數" required message={show('addSeats')} state={st('addSeats')} help={sub ? `目前 ${sub.seats} 席。加購只能加人，不能減人。` : '請先選擇訂閱'}>
                  {(p) => (
                    <input {...p} className="input tnum" type="number" min={1} value={input.payload.addSeats ?? ''} onChange={(e) => setPayload('addSeats', e.target.value ? Number(e.target.value) : undefined)} />
                  )}
                </FormField>
                <FormField label="加購期間" help="期間一律到舊合約結束日。">
                  {(p) => <input {...p} className="input mono" readOnly value={sub ? `生效日起 – ${sub.expiresAt.replace(/-/g, '/')}` : '請先選擇訂閱'} />}
                </FormField>
              </>
            )}
            {input.type === 'upgrade' && (
              <>
                <FormField label={planLabel} required addon={<PendingTag id={3} hint="方案清單來源" />} message={show('plan')} state={st('plan')}>
                  {(p) => (
                    <select {...p} className="select" value={input.payload.plan ?? ''} onChange={(e) => setPayload('plan', e.target.value || undefined)}>
                      <option value="">請選擇</option>
                      {activePlans
                        .filter((pl) => !upgradeOnly || pl.tier > subTier)
                        .map((pl) => (
                          <option key={pl.id} value={pl.name}>
                            {pl.name}（等級 {pl.tier}）{pl.name === sub?.plan ? '・目前' : ''}
                          </option>
                        ))}
                    </select>
                  )}
                </FormField>
                <FormField label="同時加購人數" message={show('addSeats')} state={st('addSeats')} help={sub ? `選填。目前 ${sub.seats} 席，只能加人。` : '選填'}>
                  {(p) => (
                    <input {...p} className="input tnum" type="number" min={0} placeholder="0" value={input.payload.addSeats ?? ''} onChange={(e) => setPayload('addSeats', e.target.value ? Number(e.target.value) : undefined)} />
                  )}
                </FormField>
              </>
            )}
            {input.type === 'transfer' && (
              <div className="is-full">
                <Callout tone="neutral">客戶已經在 Google 申請完轉移，不需要轉移碼。客戶的訂閱會全部轉入，不能只轉一部分。</Callout>
              </div>
            )}
            {(input.type === 'new' || input.type === 'transfer' || sub) && (
              <div className="is-full exec-box" style={{ gridColumn: '1 / -1' }}>
                <div className="exec-box__head">
                  <span className="muted">核准後的執行方式</span>
                  <StatusTag tone={analysis.execution === 'schedule' ? 'info' : 'warning'}>{executionModeLabel[analysis.execution]}</StatusTag>
                  {analysis.pendingId && <PendingTag id={analysis.pendingId} />}
                  {input.type === 'renewal' && input.payload.plan && <ChangeTags planChange={analysis.planChange} seatChange={analysis.seatChange} />}
                </div>
                <ul className="exec-box__reasons">
                  {analysis.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            <FormField label={input.type === 'transfer' ? '轉移備註' : '備註'} className="is-full">
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
