import { useEffect, useMemo, useState } from 'react';
import {
  TODAY,
  analyzeOrder,
  cancelSchedule,
  createOperation,
  getOperations,
  getPendingSchedules,
  getPlanList,
} from '@data/api';
import { executionModeLabel, operationTypeLabel, scheduleActionLabel, transferSourceLabel } from '@data/labels';
import type { OperationListItem, OperationPayload, OperationType, TransferSource } from '@data/types';
import { Callout, FormField } from '@shared/components/Form';
import { Modal } from '@shared/components/Modal';
import { PendingTag } from '@shared/components/PendingTag';
import { StatusTag } from '@shared/components/StatusTag';
import { useToast } from '@shared/components/Toast';
import { TransferCodes } from './TransferCodes';
import { formatDate, formatDateTime } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';

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
}

const intOrUndef = (v: string) => (v === '' ? undefined : Number(v));

/** 方案變動、人數變動的標示（文字加符號，不只靠顏色） */
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
  type,
  target,
  workOrderId,
  initial,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  type: OperationType;
  target: OperationTarget;
  workOrderId?: string;
  initial?: OperationPayload;
  onClose: () => void;
  onSubmitted: (op: OperationListItem) => void;
}) {
  const toast = useToast();
  const plans = useAsync(getPlanList);
  const [version, setVersion] = useState(0);
  const pendingSchedules = useAsync(() => (type === 'addSeats' ? getPendingSchedules(target.customerId) : Promise.resolve([])), [type, target.customerId, version]);
  // 續約時，把還沒生效的加購算進預設人數（會議：加購後要重新按一次續約）
  const subOps = useAsync(() => (type === 'renewal' && target.subscriptionId ? getOperations({ customerId: target.customerId, type: 'addSeats' }) : Promise.resolve([])), [type, target.subscriptionId]);
  const pendingAdd = (subOps.data ?? [])
    .filter((o) => o.subscriptionId === target.subscriptionId && ['scheduled', 'submitted', 'manual'].includes(o.status))
    .reduce((n, o) => n + (o.payload.addSeats ?? 0), 0);
  const [plan, setPlan] = useState('');
  const [seats, setSeats] = useState('');
  const [addSeats, setAddSeats] = useState('');
  const [renewMonths, setRenewMonths] = useState('12');
  const [scheduledAt, setScheduledAt] = useState('');
  const [source, setSource] = useState<TransferSource | ''>('');
  const [memo, setMemo] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlan(initial?.plan ?? (type === 'renewal' ? target.plan ?? '' : ''));
    setSeats(initial?.seats ? String(initial.seats) : type === 'renewal' && target.seats ? String(target.seats + pendingAdd) : '');
    setAddSeats(initial?.addSeats ? String(initial.addSeats) : '');
    setRenewMonths(String(initial?.renewMonths ?? 12));
    setScheduledAt('');
    setSource(initial?.transferSource ?? '');
    setMemo(initial?.memo ?? '');
    setTried(false);
    setSaving(false);
    // initial 用內容比較，避免父元件每次重繪都重設欄位
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, JSON.stringify(initial), target.subscriptionId, type, pendingAdd]);

  const activePlans = (plans.data ?? []).filter((p) => p.productId === 'P01' && p.status === 'active');
  const currentTier = activePlans.find((p) => p.name === target.plan)?.tier ?? plans.data?.find((p) => p.name === target.plan)?.tier ?? 0;
  const planOptions = type === 'upgrade' ? activePlans.filter((p) => p.tier > currentTier) : activePlans;

  const payload: OperationPayload = {
    plan: plan || undefined,
    seats: intOrUndef(seats),
    addSeats: intOrUndef(addSeats),
    renewMonths: Number(renewMonths),
    transferSource: source || undefined,
  };
  const sub = target.subscriptionId ? { plan: target.plan ?? '', seats: target.seats ?? 0, expiresAt: target.expiresAt ?? TODAY } : undefined;
  const analysis = analyzeOrder(type, sub, payload);
  const date = type === 'renewal' ? analysis.defaultDate! : scheduledAt || analysis.defaultDate || TODAY;
  const maxDate = type === 'addSeats' || type === 'upgrade' ? target.expiresAt : undefined;

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (type === 'new' || type === 'renewal' || type === 'upgrade') if (!plan) e.plan = type === 'upgrade' ? '請選擇升級後的方案' : '請選擇方案';
    if (type === 'new' || type === 'renewal') {
      const n = Number(seats);
      if (!Number.isInteger(n) || n < 1) e.seats = '人數需為大於 0 的整數';
    }
    if (type === 'addSeats') {
      const n = Number(addSeats);
      if (!Number.isInteger(n) || n < 1) e.addSeats = '加購人數需為大於 0 的整數（加購不能減人）';
    }
    if (analysis.execution === 'schedule' && type !== 'renewal') {
      if (date < TODAY) e.scheduledAt = '啟用日不能早於今天';
      else if (maxDate && date > maxDate) e.scheduledAt = `啟用日不能晚於合約結束日 ${formatDate(maxDate)}`;
    }
    if (type === 'transfer') {
      if (!source) e.source = '請選擇移轉來源';
    }
    return e;
  }, [type, plan, seats, addSeats, memo, source, date, maxDate, analysis.execution]);
  const show = (k: string) => (tried ? errors[k] : undefined);
  const st = (k: string) => (show(k) ? ('error' as const) : undefined);

  const renewConflict = (pendingSchedules.data ?? []).some((s) => s.action === 'renew' && s.subscriptionId === target.subscriptionId);

  const submit = async () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    const p: OperationPayload = { memo: memo.trim() || undefined };
    if (type === 'new') Object.assign(p, { plan, seats: Number(seats) });
    if (type === 'renewal') Object.assign(p, { plan, seats: Number(seats), renewMonths: Number(renewMonths) });
    if (type === 'addSeats') p.addSeats = Number(addSeats);
    if (type === 'upgrade') p.plan = plan;
    if (type === 'transfer') p.transferSource = source || undefined;
    if (analysis.execution === 'schedule' && type !== 'renewal') p.scheduledAt = date;
    setSaving(true);
    try {
      const op = await createOperation({ type, customerId: target.customerId, subscriptionId: target.subscriptionId, workOrderId, payload: p });
      toast(op.execution === 'schedule' ? `已建立排程（${op.id}），${formatDate(op.payload.scheduledAt ?? TODAY)} 執行` : `已建立（${op.id}），待後勤人工執行`);
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
    <FormField label={label} required addon={<PendingTag id={3} hint="方案清單來源" />} message={show('plan')} state={st('plan')}>
      {(p) => (
        <select {...p} className="select" value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="">{type === 'upgrade' && !planOptions.length ? '已經是最高等級' : '請選擇'}</option>
          {planOptions.map((pl) => (
            <option key={pl.id} value={pl.name}>
              {pl.name}（等級 {pl.tier}）{pl.name === target.plan ? '・目前' : ''}
            </option>
          ))}
        </select>
      )}
    </FormField>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={600}
      title={operationTypeLabel[type]}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn--primary" disabled={saving} onClick={submit}>
            {saving ? '送出中…' : analysis.execution === 'schedule' ? '建立排程' : '建立人工執行'}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 'var(--space-4)' }}>
        <Callout tone="neutral">
          <strong>{target.customerName}</strong>
          <span className="mono"> · {target.primaryDomain}</span>
          {target.plan && (
            <>
              <br />
              目前：{target.plan} · {target.seats} 席 · 合約 <span className="mono">{formatDate(target.startsAt ?? '')}</span> –{' '}
              <span className="mono">{formatDate(target.expiresAt ?? '')}</span>
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
          <div className="form-grid">
            {planSelect('方案')}
            <FormField label="人數" required message={show('seats')} state={st('seats')}>
              {(p) => <input {...p} className="input tnum" type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} />}
            </FormField>
          </div>
        )}

        {type === 'renewal' && (
          <>
            <div className="form-grid">
              {planSelect('續約方案（版本）')}
              <FormField label="續約人數" required message={show('seats')} state={st('seats')} help={pendingAdd ? `目前 ${target.seats} 席，另有尚未生效的加購 ${pendingAdd} 席，已一併帶入` : `目前 ${target.seats} 席`}>
                {(p) => <input {...p} className="input tnum" type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} />}
              </FormField>
              <FormField label="續約期間" required>
                {(p) => (
                  <select {...p} className="select" value={renewMonths} onChange={(e) => setRenewMonths(e.target.value)}>
                    <option value="12">12 個月</option>
                    <option value="24">24 個月</option>
                    <option value="36">36 個月</option>
                  </select>
                )}
              </FormField>
              <FormField label="新合約期間">
                {(p) => (
                  <input {...p} className="input mono" readOnly value={`${formatDate(analysis.newStartsAt ?? '')} – ${formatDate(analysis.newExpiresAt ?? '')}`} />
                )}
              </FormField>
            </div>
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

        {type === 'addSeats' && (
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

        {type === 'upgrade' && (
          <div className="form-grid">
            {planSelect('升級後的方案')}
            <FormField label="期間" help="升版後仍沿用目前合約，到期日不變。">
              {(p) => <input {...p} className="input mono" readOnly value={`生效日起 – ${formatDate(target.expiresAt ?? '')}`} />}
            </FormField>
          </div>
        )}


        {type === 'transfer' && (
          <>
            <fieldset className="plain-fieldset">
              <legend className="form-field__label">
                移轉來源 <span className="form-field__req">必填</span>
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
            <TransferCodes dealerId={target.dealerId} />
          </>
        )}

        <FormField label="備註">
          {(p) => <textarea {...p} className="textarea" value={memo} onChange={(e) => setMemo(e.target.value)} />}
        </FormField>

        <div className={`exec-box exec-box--${analysis.execution}`}>
          <div className="exec-box__head">
            <StatusTag tone={analysis.execution === 'schedule' ? 'info' : 'warning'}>{executionModeLabel[analysis.execution]}</StatusTag>
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
          {analysis.execution === 'manual' && (
            <p className="muted" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
              建立後狀態為「待人工執行」。請在 Google 後台完成後，回到這筆操作標記完成並寫下處理內容，下次同步時系統會比對確認。
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
