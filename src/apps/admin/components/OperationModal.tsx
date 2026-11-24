import { useEffect, useMemo, useState } from 'react';
import {
  AFTERNOON_START,
  AFTERNOON_TYPES,
  OFFER_TYPES,
  offerUnavailableReason,
  TODAY,
  analyzeOrder,
  checkDomain,
  firstUserError,
  getCustomer,
  cancelSchedule,
  createOperation,
  createNewOrderWithCustomer,
  getOperations,
  getPendingSchedules,
  getPlanList,
} from '@data/api';
import { executionModeLabel, languageOptions, operationTypeLabel, scheduleActionLabel, transferSourceLabel } from '@data/labels';
import type { NewCustomerInput, OfferSnapshot, OperationListItem, OperationPayload, OperationType, TransferSource } from '@data/types';
import { Callout, FormField } from '@shared/components/Form';
import { Modal } from '@shared/components/Modal';
import { PendingTag } from '@shared/components/PendingTag';
import { StatusTag } from '@shared/components/StatusTag';
import { useToast } from '@shared/components/Toast';
import { formatContractPeriod, formatDate, formatDateTime } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { OfferPicker } from './OfferPicker';

export interface OperationTarget {
  customerId: string;
  customerName: string;
  primaryDomain: string;
  subscriptionId?: string;
  /** 客戶所屬經銷商，移轉時用來帶出經銷商代碼 */
  dealerId?: string;
  plan?: string;
  seats?: number | null;
  startsAt?: string;
  expiresAt?: string;
  /** 合約時間（時:分，GMT+0） */
  contractTime?: string;
  /** 不續約（合約到期後不續約） */
  renewalCancelled?: boolean;
}

const intOrUndef = (v: string) => (v === '' ? undefined : Number(v));

/** 版本變動、人數變動的標示（文字加符號，不只靠顏色） */
export function ChangeTags({ planChange, seatChange }: { planChange?: 'up' | 'down' | 'same'; seatChange?: number }) {
  return (
    <span className="inline">
      {planChange === 'up' && <StatusTag tone="info">升版</StatusTag>}
      {planChange === 'down' && <StatusTag tone="warning">降版</StatusTag>}
      {planChange === 'same' && <StatusTag tone="neutral">版本不變</StatusTag>}
      {seatChange !== undefined && seatChange > 0 && <StatusTag tone="info">人數增加 {seatChange}</StatusTag>}
      {seatChange !== undefined && seatChange < 0 && <StatusTag tone="warning">人數減少 {-seatChange}</StatusTag>}
      {seatChange === 0 && <StatusTag tone="neutral">人數不變</StatusTag>}
    </span>
  );
}

/**
 * 訂單操作：新訂、新訂（移轉）、續約、加購、中途升版（2026/11/10 會議；不提供取消訂閱）。
 * 依類型與內容判斷「排程執行」或「人工執行」，畫面上直接顯示。
 * 從執行單開啟時，欄位會帶入執行單的內容（仍可修改），並記錄來源單號。
 */
export function OperationModal({
  open,
  type: typeProp,
  combined = false,
  target,
  workOrderId,
  initial,
  newCustomer,
  fixedDomain,
  onBack,
  layout = 'modal',
  onClose,
  onSubmitted,
}: {
  open: boolean;
  type: OperationType;
  /**
   * 加購／升版合併成一個視窗（2026/11/24）：選版本與加購人數，
   * 版本不變就是「加購」，選了比目前高的版本就是「中途升版」（可同時加人）。
   */
  combined?: boolean;
  target: OperationTarget;
  workOrderId?: string;
  initial?: OperationPayload;
  /** 新客戶的新訂：送出時一併建立客戶主檔 */
  newCustomer?: NewCustomerInput;
  /** 新客戶在上一步已經填好網域（2026/11/24：新客的網域搬到前頁），這裡只顯示 */
  fixedDomain?: string;
  /** 有值時顯示「上一步」（回到填客戶資料） */
  onBack?: () => void;
  /** modal：彈窗（預設）；page：整頁表單 */
  layout?: 'modal' | 'page';
  onClose: () => void;
  onSubmitted: (op: OperationListItem) => void;
}) {
  const toast = useToast();
  const plans = useAsync(getPlanList);
  const [version, setVersion] = useState(0);
  const pendingSchedules = useAsync(
    () => (typeProp === 'addSeats' || combined ? getPendingSchedules(target.customerId) : Promise.resolve([])),
    [typeProp, combined, target.customerId, version],
  );
  // 續約時，把還沒生效的加購算進預設人數（會議：加購後要重新按一次續約）
  const subOps = useAsync(
    () => (typeProp === 'renewal' && target.subscriptionId ? getOperations({ customerId: target.customerId, type: 'addSeats' }) : Promise.resolve([])),
    [typeProp, target.subscriptionId],
  );
  const pendingAdd = (subOps.data ?? [])
    .filter((o) => o.subscriptionId === target.subscriptionId && ['scheduled', 'submitted', 'manual'].includes(o.status))
    .reduce((n, o) => n + (o.payload.addSeats ?? 0), 0);
  const [plan, setPlan] = useState('');
  // 合併模式：版本不變是加購，選了更高的版本是中途升版
  const type: OperationType = combined ? (plan && plan !== target.plan ? 'upgrade' : 'addSeats') : typeProp;
  // 新訂的網域：選客戶已有的網域，或輸入網域
  const cust = useAsync(() => (type === 'new' && target.customerId ? getCustomer(target.customerId) : Promise.resolve(undefined)), [type, target.customerId]);
  const ownedDomains = cust.data ? [cust.data.primaryDomain, ...cust.data.otherDomains].filter(Boolean) : [];
  const [domainPick, setDomainPick] = useState('');
  const [newDomain, setNewDomain] = useState('');
  // 新訂：第一個使用者的帳號（公司網域信箱）與驗證信箱（非公司網域）
  // 第一個使用者帳號：只輸入 @ 前面的帳號，後面固定接選好的網域（2026/11/24）
  const [firstUserLocal, setFirstUserLocal] = useState('');
  const [verifyEmail, setVerifyEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [languageCode, setLanguageCode] = useState('zh-TW');
  const [seats, setSeats] = useState('');
  const [addSeats, setAddSeats] = useState('');
  const [renewMonths, setRenewMonths] = useState('12');
  const [scheduledAt, setScheduledAt] = useState('');
  const [scheduledTime, setScheduledTime] = useState(AFTERNOON_START);
  const [renewEndAt, setRenewEndAt] = useState('');
  // Google 方案快照：新訂、續約、中途升版選完版本後，依客戶即時從 Google 查並選擇（2026/11/24）
  const [offer, setOffer] = useState<OfferSnapshot | undefined>();
  const [source, setSource] = useState<TransferSource | ''>('');
  const [memo, setMemo] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlan(initial?.plan ?? (typeProp === 'renewal' || combined ? target.plan ?? '' : ''));
    setDomainPick('');
    setNewDomain(initial?.domain ?? '');
    setFirstUserLocal((initial?.firstUserEmail ?? '').split('@')[0]);
    setVerifyEmail(initial?.verifyEmail ?? '');
    setFirstName(initial?.firstUserFirstName ?? '');
    setLastName(initial?.firstUserLastName ?? '');
    setLanguageCode(initial?.languageCode ?? 'zh-TW');
    setSeats(initial?.seats ? String(initial.seats) : type === 'renewal' && target.seats ? String(target.seats + pendingAdd) : '');
    setAddSeats(initial?.addSeats ? String(initial.addSeats) : '');
    setRenewMonths(initial?.renewEndAt ? 'custom' : String(initial?.renewMonths ?? 12));
    setScheduledAt('');
    setScheduledTime(initial?.scheduledTime ?? AFTERNOON_START);
    setRenewEndAt(initial?.renewEndAt ?? '');
    setOffer(initial?.offer);
    setSource(initial?.transferSource ?? '');
    setMemo(initial?.memo ?? '');
    setTried(false);
    setSaving(false);
    // initial 用內容比較，避免父元件每次重繪都重設欄位
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, JSON.stringify(initial), target.subscriptionId, typeProp, combined, pendingAdd]);

  const activePlans = (plans.data ?? []).filter((p) => p.productId === 'P01');
  const currentTier = activePlans.find((p) => p.name === target.plan)?.tier ?? plans.data?.find((p) => p.name === target.plan)?.tier ?? 0;
  const planOptions = combined
    ? activePlans.filter((p) => p.tier >= currentTier)
    : type === 'upgrade'
      ? activePlans.filter((p) => p.tier > currentTier)
      : activePlans;

  const payload: OperationPayload = {
    plan: plan || undefined,
    seats: intOrUndef(seats),
    addSeats: intOrUndef(addSeats),
    renewMonths: renewMonths === 'custom' ? undefined : Number(renewMonths),
    renewEndAt: renewMonths === 'custom' ? renewEndAt || undefined : undefined,
    transferSource: source || undefined,
  };
  const afternoon = AFTERNOON_TYPES.includes(type);
  const needsOffer = OFFER_TYPES.includes(type);
  const offerSeats = type === 'upgrade' ? (target.seats ?? 0) + (Number(addSeats) || 0) : Number(seats) || undefined;
  // 換了版本，原本選的方案就不適用
  useEffect(() => {
    if (offer && offer.version !== plan) setOffer(undefined);
  }, [plan, offer]);
  const offerError = !needsOffer ? undefined : !offer ? '請選擇方案' : offerUnavailableReason(offer, offerSeats, type);
  const sub = target.subscriptionId ? { plan: target.plan ?? '', seats: target.seats ?? 0, expiresAt: target.expiresAt ?? TODAY } : undefined;
  const analysis = analyzeOrder(type, sub, payload);
  const date = type === 'renewal' ? analysis.defaultDate! : scheduledAt || analysis.defaultDate || TODAY;
  const maxDate = type === 'addSeats' || type === 'upgrade' ? target.expiresAt : undefined;

  const usingOwned = Boolean(fixedDomain) || domainPick !== '';
  const chosenDomain = fixedDomain ?? (usingOwned ? domainPick : newDomain.trim());
  const domainCheckResult = type === 'new' && !usingOwned ? checkDomain(newDomain) : undefined;
  const firstUserEmail = firstUserLocal.trim() && chosenDomain ? `${firstUserLocal.trim()}@${chosenDomain}` : '';
  const localError = !firstUserLocal.trim()
    ? '請輸入帳號'
    : !/^[A-Za-z0-9._%+-]+$/.test(firstUserLocal.trim())
      ? '帳號只能有英文、數字和 . _ % + -，不用輸入 @ 和網域'
      : !chosenDomain
        ? '先選擇或輸入網域'
        : undefined;
  const userErr = type === 'new' ? localError ?? firstUserError(chosenDomain, firstUserEmail, verifyEmail) : undefined;
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (type === 'new' && !usingOwned && domainCheckResult && !domainCheckResult.ok) e.domain = domainCheckResult.message;
    if (type === 'new' && userErr) e[userErr.includes('驗證信箱') ? 'verifyEmail' : 'firstUserEmail'] = userErr;
    if (type === 'new' && !firstName.trim()) e.firstName = '請輸入名';
    if (type === 'new' && !lastName.trim()) e.lastName = '請輸入姓';
    if (type === 'new' || type === 'renewal' || type === 'upgrade') if (!plan) e.plan = type === 'upgrade' ? '請選擇升級後的版本' : '請選擇版本';
    if (type === 'new' || type === 'renewal') {
      const n = Number(seats);
      if (!Number.isInteger(n) || n < 1) e.seats = '人數需為大於 0 的整數';
    }
    if (type === 'upgrade' && addSeats !== '') {
      const n = Number(addSeats);
      if (!Number.isInteger(n) || n < 0) e.addSeats = '加購人數需為 0 以上的整數（升版不能減人）';
    }
    if (type === 'addSeats') {
      const n = Number(addSeats);
      if (!Number.isInteger(n) || n < 1)
        e.addSeats = combined ? '版本不變時，加購人數要大於 0；要升版請選更高的版本' : '加購人數需為大於 0 的整數（加購不能減人）';
    }
    if (needsOffer && plan && offerError) e.offerId = offerError;
    if (type === 'renewal' && renewMonths === 'custom') {
      if (!renewEndAt) e.renewEndAt = '請選擇新合約到期日';
      else if (analysis.newStartsAt && renewEndAt <= analysis.newStartsAt) e.renewEndAt = '到期日要晚於新合約起日';
    }
    if (analysis.execution === 'schedule' && afternoon && (!scheduledTime || scheduledTime < AFTERNOON_START)) e.scheduledTime = '新購、加購要排在下午 4 點（GMT+8）之後';
    if (analysis.execution === 'schedule' && type !== 'renewal') {
      if (date < TODAY) e.scheduledAt = '啟用日不能早於今天';
      else if (maxDate && date > maxDate) e.scheduledAt = `啟用日不能晚於合約結束日 ${formatDate(maxDate)}`;
    }
    if (type === 'transfer') {
      if (!source) e.source = '請選擇轉入來源';
    }
    return e;
  }, [type, combined, plan, seats, addSeats, memo, source, date, maxDate, analysis.execution, usingOwned, domainCheckResult?.ok, newDomain, userErr, renewMonths, renewEndAt, analysis.newStartsAt, scheduledTime, afternoon, needsOffer, offerError, firstName, lastName]);
  const show = (k: string) => (tried ? errors[k] : undefined);
  const st = (k: string) => (show(k) ? ('error' as const) : undefined);

  const renewConflict = (pendingSchedules.data ?? []).some((s) => s.action === 'renew' && s.subscriptionId === target.subscriptionId);

  const submit = async () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    const p: OperationPayload = { memo: memo.trim() || undefined };
    if (type === 'new')
      Object.assign(p, {
        plan,
        seats: Number(seats),
        domain: chosenDomain,
        firstUserFirstName: firstName.trim(),
        firstUserLastName: lastName.trim(),
        firstUserEmail: firstUserEmail.trim(),
        verifyEmail: verifyEmail.trim(),
        languageCode,
      });
    if (type === 'renewal')
      Object.assign(p, { plan, seats: Number(seats) }, renewMonths === 'custom' ? { renewEndAt } : { renewMonths: Number(renewMonths) });
    if (type === 'addSeats') p.addSeats = Number(addSeats);
    if (type === 'upgrade') Object.assign(p, { plan }, Number(addSeats) > 0 ? { addSeats: Number(addSeats) } : {});
    if (type === 'transfer') p.transferSource = source || undefined;
    if (needsOffer) p.offer = offer;
    if (analysis.execution === 'schedule' && type !== 'renewal') p.scheduledAt = date;
    if (analysis.execution === 'schedule' && afternoon) p.scheduledTime = scheduledTime;
    setSaving(true);
    try {
      if (newCustomer) {
        const { customer, operation } = await createNewOrderWithCustomer(newCustomer, { type, payload: p });
        toast(`已建立客戶「${customer.name}」與新訂（${operation.id}）${operation.execution === 'schedule' ? `，${formatDate(operation.payload.scheduledAt ?? TODAY)} 執行` : '，待後勤人工執行'}`);
        onSubmitted(operation);
        return;
      }
      const op = await createOperation({ type, customerId: target.customerId, subscriptionId: target.subscriptionId, workOrderId, payload: p });
      toast(
        op.execution === 'schedule'
          ? `已建立排程（${op.id}），${formatDate(op.payload.scheduledAt ?? TODAY)} 執行`
          : op.execution === 'immediate'
            ? op.status === 'failed'
              ? `Google 回應失敗（${op.id}），請重新送出或改為手動處理`
              : `已完成（${op.id}）`
            : `已建立（${op.id}），待後勤人工執行`,
        op.status === 'failed' ? 'danger' : 'success',
      );
      onSubmitted(op);
    } catch (e) {
      toast((e as Error).message, 'danger');
      setSaving(false);
    }
  };

  const cancelOne = async (id: string) => {
    try {
      await cancelSchedule(id);
      toast(`已取消排程 ${id}`);
      setVersion((v) => v + 1);
    } catch (e) {
      toast((e as Error).message, 'danger');
    }
  };

  const planSelect = (label: string) => (
    <FormField label={label} required addon={<PendingTag id={3} hint="版本清單來源" />} message={show('plan')} state={st('plan')}>
      {(p) => (
        <select {...p} className="select" value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="">{type === 'upgrade' && !planOptions.length ? '已經是最高等級' : '請選擇'}</option>
          {planOptions.map((pl) => (
            <option key={pl.id} value={pl.name}>
              {pl.name}
              {pl.name === target.plan ? '・目前' : ''}
            </option>
          ))}
        </select>
      )}
    </FormField>
  );

  const footerEl = (
    <>
      <button type="button" className="btn" onClick={onClose}>
        取消
      </button>
      {onBack && (
        <button type="button" className="btn" onClick={onBack} disabled={saving}>
          上一步
        </button>
      )}
      <button type="button" className="btn btn--primary" disabled={saving} onClick={submit}>
        {saving ? '送出中…' : analysis.execution === 'schedule' ? '建立排程' : analysis.execution === 'immediate' ? '送出' : '建立人工執行'}
      </button>
    </>
  );
  const bodyEl = (
    <div className="stack" style={{ gap: 'var(--space-4)' }}>
      {onBack && layout === 'modal' && (
        <ol className="step-indicator" aria-label="新訂步驟">
          <li>1. 客戶資料</li>
          <li aria-current="step">2. 訂閱內容</li>
        </ol>
      )}
      <Callout tone="neutral">
        <strong>{target.customerName}</strong>
        {target.primaryDomain && <span className="mono"> · {target.primaryDomain}</span>}
        {newCustomer && (
          <>
            <br />
            新客戶（{newCustomer.kind === 'individual' ? '個人' : '公司'}）：送出後會同時建立客戶主檔
          </>
        )}
        {target.plan && (
          <>
            <br />
            目前：{target.plan} · {target.seats} 席 · 合約{' '}
            <span className="mono">{formatContractPeriod(target.startsAt ?? '', target.expiresAt ?? '', target.contractTime)}</span>
          </>
        )}
        {workOrderId && (
          <>
            <br />
            依執行單 <span className="mono">{workOrderId}</span> 處理，欄位已帶入執行單內容
          </>
        )}
      </Callout>

      {type === 'new' && (
        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          {fixedDomain ? (
            <FormField label="網域" help="在上一步填寫；訂閱成功後會寫回客戶主檔，成為主網域。">
              {(p) => <input {...p} className="input mono" value={fixedDomain} readOnly disabled />}
            </FormField>
          ) : (
          <>
          <fieldset className="plain-fieldset">
            <legend className="form-field__label">
              網域 <span className="form-field__req">必填</span>
            </legend>
            {ownedDomains.map((d) => (
              <label key={d} className="radio-row">
                <input type="radio" name="domainPick" checked={domainPick === d} onChange={() => setDomainPick(d)} />
                <span>
                  <span className="mono">{d}</span>
                  <span className="muted">：客戶已有的網域{cust.data?.gwsDomains.includes(d) ? '（已開通 GWS）' : '（尚未開通 GWS）'}</span>
                </span>
              </label>
            ))}
            <label className="radio-row">
              <input type="radio" name="domainPick" checked={domainPick === ''} onChange={() => setDomainPick('')} />
              <span>
                <strong>輸入網域</strong>
                <span className="muted">：客戶要用在 GWS 的網域</span>
              </span>
            </label>
          </fieldset>
          {domainPick === '' && (
            <FormField
              label="網域名稱"
              required
              message={show('domain') ?? (newDomain && domainCheckResult?.ok ? '可以使用' : undefined)}
              state={show('domain') ? 'error' : newDomain && domainCheckResult?.ok ? 'success' : undefined}
              help="訂閱成功後會寫回客戶主檔；客戶還沒有主網域時會成為主網域。"
            >
              {(p) => <input {...p} className="input mono" spellCheck={false} autoCapitalize="off" placeholder="company.example" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />}
            </FormField>
          )}
          </>
          )}
          <fieldset className="plain-fieldset">
            <legend className="form-field__label">第一個使用者帳號</legend>
            <p className="muted" style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-sm)' }}>
              Google 會用這組姓名與信箱建立客戶的第一個管理員帳號。
            </p>
            <div className="form-grid">
              <FormField label="名" required message={show('firstName')} state={st('firstName')}>
                {(p) => <input {...p} className="input" autoComplete="off" value={firstName} onChange={(e) => setFirstName(e.target.value)} />}
              </FormField>
              <FormField label="姓" required message={show('lastName')} state={st('lastName')}>
                {(p) => <input {...p} className="input" autoComplete="off" value={lastName} onChange={(e) => setLastName(e.target.value)} />}
              </FormField>
              <FormField
                label="帳號（公司網域的信箱）"
                required
                message={show('firstUserEmail')}
                state={st('firstUserEmail')}
                help={chosenDomain ? `只要輸入 @ 前面的帳號，後面固定是 @${chosenDomain}` : '先選擇或輸入網域'}
              >
                {(p) => (
                  <div className="input-suffix">
                    <input
                      {...p}
                      className="input mono"
                      spellCheck={false}
                      autoCapitalize="off"
                      autoComplete="off"
                      placeholder="admin"
                      value={firstUserLocal}
                      onChange={(e) => setFirstUserLocal(e.target.value.replace(/@.*$/, ''))}
                    />
                    <span className="input-suffix__text mono" aria-hidden="true">
                      @{chosenDomain || '網域'}
                    </span>
                  </div>
                )}
              </FormField>
              <FormField label="驗證信箱" required message={show('verifyEmail')} state={st('verifyEmail')} help="不能是公司網域的信箱，例如個人 Gmail；用來收驗證信。">
                {(p) => <input {...p} className="input mono" type="email" spellCheck={false} autoCapitalize="off" value={verifyEmail} onChange={(e) => setVerifyEmail(e.target.value)} />}
              </FormField>
            </div>
          </fieldset>
          <div className="form-grid">
            <FormField label="語言" required help="送給 Google 的 Language code。">
              {(p) => (
                <select {...p} className="select" value={languageCode} onChange={(e) => setLanguageCode(e.target.value)}>
                  {languageOptions.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField label="CRM ID" help="自動帶我們的客戶編號，送給 Google 對照用，不用輸入。">
              {(p) => <input {...p} className="input mono" readOnly value={target.customerId || '建立客戶後自動帶入'} />}
            </FormField>
          </div>
        <div className="form-grid">
          {planSelect('版本')}
          <FormField label="人數" required message={show('seats')} state={st('seats')}>
            {(p) => <input {...p} className="input tnum" type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} />}
          </FormField>
        </div>
        <OfferPicker customerId={target.customerId || undefined} version={plan} seats={offerSeats} type={type} value={offer} onChange={setOffer} error={show('offerId')} />
        </div>
      )}

      {type === 'renewal' && (
        <>
          <div className="form-grid">
            {planSelect('續約版本')}
            <FormField label="續約人數" required message={show('seats')} state={st('seats')} help={pendingAdd ? `目前 ${target.seats} 席，另有尚未生效的加購 ${pendingAdd} 席，已一併帶入` : `目前 ${target.seats} 席`}>
              {(p) => <input {...p} className="input tnum" type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} />}
            </FormField>
            <FormField label="續約期間" required>
              {(p) => (
                <select {...p} className="select" value={renewMonths} onChange={(e) => setRenewMonths(e.target.value)}>
                  <option value="12">12 個月</option>
                  <option value="24">24 個月</option>
                  <option value="36">36 個月</option>
                  <option value="custom">自訂</option>
                </select>
              )}
            </FormField>
            {renewMonths === 'custom' && (
              <FormField label="新合約到期日" required message={show('renewEndAt')} state={st('renewEndAt')} help={`新合約從 ${formatDate(analysis.newStartsAt ?? '')} 開始`}>
                {(p) => <input {...p} className="input" type="date" min={analysis.newStartsAt} value={renewEndAt} onChange={(e) => setRenewEndAt(e.target.value)} />}
              </FormField>
            )}
            <FormField label="新合約期間">
              {(p) => (
                <input
                  {...p}
                  className="input mono"
                  readOnly
                  value={analysis.newExpiresAt ? formatContractPeriod(analysis.newStartsAt ?? '', analysis.newExpiresAt, target.contractTime) : '—'}
                />
              )}
            </FormField>
          </div>
          <OfferPicker customerId={target.customerId || undefined} version={plan} seats={offerSeats} type={type} value={offer} onChange={setOffer} error={show('offerId')} />
          {plan && Number(seats) > 0 && (
            <div className="inline">
              <span className="muted">這次續約：</span>
              <ChangeTags planChange={analysis.planChange} seatChange={analysis.seatChange} />
            </div>
          )}
          <p className="muted" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
            續約不提供取消；要停止續約請不要建立，或取消已建立的排程。
          </p>
        </>
      )}

      {(type === 'addSeats' || type === 'upgrade') && target.renewalCancelled && (
        <Callout tone="warning" title="這筆訂閱已設定不續約">
          客戶合約到 {formatDate(target.expiresAt ?? '')} 結束後不再續約。{type === 'addSeats' ? '加購' : '升版'}只到合約結束日，請先和客戶確認仍要{type === 'addSeats' ? '加購' : '升版'}。
        </Callout>
      )}

      {combined && (
        <>
          <div className="form-grid">
            {planSelect('版本')}
            <FormField
              label="加購人數"
              required={type === 'addSeats'}
              message={show('addSeats') ?? (Number(addSeats) > 0 ? `之後 ${(target.seats ?? 0) + Number(addSeats)} 席` : undefined)}
              state={st('addSeats')}
              help={`目前 ${target.seats} 席，只能加人，不能減人。${type === 'upgrade' ? '升版時可以不加人。' : ''}`}
            >
              {(p) => <input {...p} className="input tnum" type="number" min={type === 'upgrade' ? 0 : 1} placeholder={type === 'upgrade' ? '0' : undefined} value={addSeats} onChange={(e) => setAddSeats(e.target.value)} />}
            </FormField>
            <FormField label="期間" help="加購、升版都沿用目前合約，到期日不變。" className="is-full">
              {(p) => <input {...p} className="input mono" readOnly value={`生效日起 – ${formatDate(target.expiresAt ?? '')}`} />}
            </FormField>
          </div>
          <div className="inline">
            <span className="muted">這次是：</span>
            <StatusTag tone="info">{operationTypeLabel[type]}</StatusTag>
            {/* 升版同時加人時，兩件事都標出來 */}
            {type === 'upgrade' && Number(addSeats) > 0 && <StatusTag tone="info">加購 {Number(addSeats)} 席</StatusTag>}
            <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
              {[
                type === 'upgrade' ? `${target.plan} → ${plan}` : '版本不變',
                Number(addSeats) > 0 ? `${target.seats} 席 → ${(target.seats ?? 0) + Number(addSeats)} 席` : type === 'upgrade' ? '人數不變' : '',
              ]
                .filter(Boolean)
                .join('，')}
            </span>
          </div>
          {type === 'upgrade' && (
            <OfferPicker customerId={target.customerId || undefined} version={plan} seats={offerSeats} type={type} value={offer} onChange={setOffer} error={show('offerId')} />
          )}
          {renewConflict && Number(addSeats) > 0 && (
            <Callout tone="warning" title="這個網域已經排了續約">
              續約排程在加購之後才生效，排程裡的人數不會跟著加購改變。請先取消原本的續約排程，建立後再重新按一次「續約」。
            </Callout>
          )}
        </>
      )}

      {!combined && type === 'addSeats' && (
        <>
          {renewConflict && (
            <Callout tone="warning" title="這個網域已經排了續約">
              續約排程在加購之後才生效，排程裡的人數不會跟著加購改變。請先取消原本的續約排程，加購建立後再重新按一次「續約」。
              <ul className="bill-list">
                {(pendingSchedules.data ?? []).map((s) => (
                  <li key={s.id}>
                    <span className="inline" style={{ justifyContent: 'space-between', width: '100%' }}>
                      <span>
                        <span className="mono">{s.id}</span> {scheduleActionLabel[s.action]} · <span className="mono">{formatDateTime(s.enabledAt)}</span> · {s.detail}
                      </span>
                      <button type="button" className="btn btn--sm" onClick={() => cancelOne(s.id)}>
                        取消排程
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </Callout>
          )}
          <div className="form-grid">
            <FormField
              label="加購人數"
              required
              message={show('addSeats') ?? (Number(addSeats) > 0 ? `加購後 ${(target.seats ?? 0) + Number(addSeats)} 席` : undefined)}
              state={st('addSeats')}
              help={`目前 ${target.seats} 席。加購只能加人，不能減人。`}
            >
              {(p) => <input {...p} className="input tnum" type="number" min={1} value={addSeats} onChange={(e) => setAddSeats(e.target.value)} />}
            </FormField>
            <FormField label="加購期間" help="加購的期間一律到舊合約結束日，不能改。">
              {(p) => <input {...p} className="input mono" readOnly value={`生效日起 – ${formatDate(target.expiresAt ?? '')}`} />}
            </FormField>
          </div>
        </>
      )}

      {!combined && type === 'upgrade' && (
        <div className="form-grid">
          {planSelect('升級後的版本')}
          <FormField
            label="同時加購人數"
            message={show('addSeats') ?? (Number(addSeats) > 0 ? `升版後 ${(target.seats ?? 0) + Number(addSeats)} 席` : undefined)}
            state={st('addSeats')}
            help={`選填。目前 ${target.seats} 席，只能加人，不能減人。`}
          >
            {(p) => <input {...p} className="input tnum" type="number" min={0} placeholder="0" value={addSeats} onChange={(e) => setAddSeats(e.target.value)} />}
          </FormField>
          <FormField label="期間" help="升版後仍沿用目前合約，到期日不變。" className="is-full">
            {(p) => <input {...p} className="input mono" readOnly value={`生效日起 – ${formatDate(target.expiresAt ?? '')}`} />}
          </FormField>
          <div className="is-full">
            <OfferPicker customerId={target.customerId || undefined} version={plan} seats={offerSeats} type={type} value={offer} onChange={setOffer} error={show('offerId')} />
          </div>
        </div>
      )}


      {type === 'transfer' && (
        <>
          <fieldset className="plain-fieldset">
            <legend className="form-field__label">
              轉入來源 <span className="form-field__req">必填</span>
            </legend>
            {(['selfPaid', 'otherDealer'] as TransferSource[]).map((s) => (
              <label key={s} className="radio-row">
                <input type="radio" name="source" checked={source === s} onChange={() => setSource(s)} />
                <span>
                  <strong>{transferSourceLabel[s]}</strong>
                  <span className="muted">{s === 'selfPaid' ? '：客戶原本直接向 Google 付款。' : '：客戶原本向其他經銷商購買。'}</span>
                </span>
              </label>
            ))}
            {show('source') && <div className="form-field__msg form-field__msg--error">{show('source')}</div>}
          </fieldset>
          <Callout tone="neutral">客戶已經在 Google 申請完轉移。送出後立即呼叫 Google API 轉入，成功就完成；失敗時可以重新送出，或改為在 Google 後台手動接受轉入。Prototype：網域含「fail」會模擬失敗。</Callout>
        </>
      )}

      <FormField label="備註">
        {(p) => <textarea {...p} className="textarea" value={memo} onChange={(e) => setMemo(e.target.value)} />}
      </FormField>

      <div className={`exec-box exec-box--${analysis.execution}`}>
        <div className="exec-box__head">
          <StatusTag tone={analysis.execution === 'manual' ? 'warning' : 'info'}>{executionModeLabel[analysis.execution]}</StatusTag>
          {analysis.pendingId && <PendingTag id={analysis.pendingId} />}
        </div>
        <ul className="exec-box__reasons">
          {analysis.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {analysis.execution === 'schedule' && type !== 'renewal' && (
          <FormField label="啟用日" required message={show('scheduledAt')} state={st('scheduledAt')} help="排程在這天由系統送 Google，可以到「GWS 排程中心」查看或取消。">
            {(p) => <input {...p} className="input" type="date" min={TODAY} max={maxDate} value={date} onChange={(e) => setScheduledAt(e.target.value)} />}
          </FormField>
        )}
        {analysis.execution === 'schedule' && afternoon && (
          <FormField
            label="啟用時間（GMT+8）"
            required
            message={show('scheduledTime')}
            state={st('scheduledTime')}
            help="新購、加購一律排在下午 4 點（GMT+8）之後。"
          >
            {(p) => <input {...p} className="input" type="time" min={AFTERNOON_START} max="23:59" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />}
          </FormField>
        )}
        {analysis.execution === 'manual' && (
          <p className="muted" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
            建立後狀態為「待人工執行」。請在 Google 後台完成後，回到這筆操作標記完成並寫下處理內容，下次同步時系統會比對確認。
          </p>
        )}
      </div>
    </div>
  );

  // 整頁模式（GWS 新訂頁）：不用彈窗，內容放在卡片裡，按鈕在卡片底部
  if (layout === 'page')
    return (
      <div className="card form-card">
        <div className="card__body">{bodyEl}</div>
        <div className="form-actions">{footerEl}</div>
      </div>
    );

  return (
    <Modal open={open} onClose={onClose} width={600} title={combined ? '加購／升版' : operationTypeLabel[type]} footer={footerEl}>
      {bodyEl}
    </Modal>
  );
}
