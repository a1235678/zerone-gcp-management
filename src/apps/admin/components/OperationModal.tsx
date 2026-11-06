import { useEffect, useMemo, useState } from 'react';
import { TODAY, TRANSFER_TOKEN_VALID_DAYS, addDays, checkTransferToken, createOperation, getPlans } from '@data/api';
import { operationTypeLabel } from '@data/labels';
import type { OperationListItem, OperationPayload, OperationType } from '@data/types';
import { Callout, FormField } from '@shared/components/Form';
import { Modal } from '@shared/components/Modal';
import { PendingTag } from '@shared/components/PendingTag';
import { useToast } from '@shared/components/Toast';
import { useAsync } from '@shared/hooks/useAsync';

export interface OperationTarget {
  customerId: string;
  customerName: string;
  primaryDomain: string;
  subscriptionId?: string;
  plan?: string;
  seats?: number | null;
  expiresAt?: string;
}

/**
 * 後勤直接送 Google 的操作：新增訂閱、續約、調整席次、取消訂閱、客戶轉移。
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
  const plans = useAsync(getPlans);
  const [plan, setPlan] = useState('');
  const [seats, setSeats] = useState('');
  const [toSeats, setToSeats] = useState('');
  const [renewMonths, setRenewMonths] = useState('12');
  const [token, setToken] = useState('');
  const [tokenExpiresAt, setTokenExpiresAt] = useState('');
  const [memo, setMemo] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlan(initial?.plan ?? '');
    setSeats(initial?.seats ? String(initial.seats) : '');
    setToSeats(initial?.toSeats ? String(initial.toSeats) : target.seats ? String(target.seats) : '');
    setRenewMonths(String(initial?.renewMonths ?? 12));
    setToken('');
    setTokenExpiresAt('');
    setMemo(initial?.memo ?? '');
    setTried(false);
    setSaving(false);
    // initial 用內容比較，避免父元件每次重繪都重設欄位
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, JSON.stringify(initial), target.seats]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (type === 'new') {
      if (!plan) e.plan = '請選擇方案';
      if (!(Number(seats) >= 1)) e.seats = '席次至少 1';
    }
    if (type === 'seats') {
      const n = Number(toSeats);
      if (!Number.isInteger(n) || n < 1) e.toSeats = '席次需為大於 0 的整數';
      else if (n === target.seats) e.toSeats = '與目前席次相同';
    }
    if (type === 'cancel' && !memo.trim()) e.memo = '請填寫取消原因';
    if (type === 'transfer') Object.assign(e, checkTransferToken(token, tokenExpiresAt));
    return e;
  }, [type, plan, seats, toSeats, memo, token, tokenExpiresAt, target.seats]);
  const show = (k: string) => (tried ? errors[k] : undefined);

  const submit = async () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    const payload: OperationPayload = { memo: memo.trim() || undefined };
    if (type === 'new') Object.assign(payload, { plan, seats: Number(seats) });
    if (type === 'seats') payload.toSeats = Number(toSeats);
    if (type === 'renewal') payload.renewMonths = Number(renewMonths);
    if (type === 'transfer') Object.assign(payload, { transferToken: token.trim(), tokenExpiresAt });
    setSaving(true);
    try {
      const op = await createOperation({ type, customerId: target.customerId, subscriptionId: target.subscriptionId, workOrderId, payload });
      toast(`已送出 Google（${op.id}），等待回應`);
      onSubmitted(op);
    } catch (e) {
      toast((e as Error).message, 'danger');
      setSaving(false);
    }
  };

  const diff = type === 'seats' && target.seats && Number(toSeats) ? Number(toSeats) - target.seats : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${operationTypeLabel[type]}`}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className={`btn ${type === 'cancel' ? 'btn--danger' : 'btn--primary'}`} disabled={saving} onClick={submit}>
            {saving ? '送出中…' : '送出 Google'}
          </button>
        </>
      }
    >
      <Callout tone="neutral">
        <strong>{target.customerName}</strong>
        <span className="mono"> · {target.primaryDomain}</span>
        {target.plan && (
          <>
            <br />
            {target.plan} · {target.seats} 席 · 到期日 <span className="mono">{target.expiresAt?.replace(/-/g, '/')}</span>
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
        <>
          <FormField label="方案" required addon={<PendingTag id={3} hint="方案清單來源" />} message={show('plan')} state={show('plan') ? 'error' : undefined}>
            {(p) => (
              <select {...p} className="select" value={plan} onChange={(e) => setPlan(e.target.value)}>
                <option value="">請選擇</option>
                {(plans.data ?? []).map((pl) => (
                  <option key={pl}>{pl}</option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="席次" required message={show('seats')} state={show('seats') ? 'error' : undefined}>
            {(p) => <input {...p} className="input tnum" type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} />}
          </FormField>
        </>
      )}

      {type === 'renewal' && (
        <FormField label="續約期間" required>
          {(p) => (
            <select {...p} className="select" value={renewMonths} onChange={(e) => setRenewMonths(e.target.value)}>
              <option value="12">12 個月</option>
              <option value="24">24 個月</option>
              <option value="36">36 個月</option>
            </select>
          )}
        </FormField>
      )}

      {type === 'seats' && (
        <FormField
          label="調整後席次"
          required
          message={show('toSeats') ?? (diff ? `${diff > 0 ? '增加' : '減少'} ${Math.abs(diff)} 席` : undefined)}
          state={show('toSeats') ? 'error' : undefined}
          help={`目前 ${target.seats ?? 0} 席。減少席次時，不可低於客戶已指派的授權數。`}
        >
          {(p) => <input {...p} className="input tnum" type="number" min={1} value={toSeats} onChange={(e) => setToSeats(e.target.value)} />}
        </FormField>
      )}

      {type === 'cancel' && <Callout tone="warning" title="取消後無法復原">Google 完成後，這筆訂閱的所有授權會停止。</Callout>}

      {type === 'transfer' && (
        <>
          <div className="inline">
            <PendingTag id={4} hint="是否使用 Cloud Channel API" />
          </div>
          <Callout tone="info" title="轉移碼由客戶提供">
            客戶的 Google 管理員在 Google 管理控制台產生轉移碼，產生時需要我方的經銷商識別碼。轉移碼 {TRANSFER_TOKEN_VALID_DAYS} 天內有效。
          </Callout>
          <FormField label="主網域">{(p) => <input {...p} className="input mono" value={target.primaryDomain} readOnly />}</FormField>
          <FormField label="轉移碼" required message={show('token')} state={show('token') ? 'error' : undefined}>
            {(p) => <input {...p} className="input mono" autoCapitalize="characters" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} />}
          </FormField>
          <FormField label="轉移碼到期日" required message={show('tokenExpiresAt')} state={show('tokenExpiresAt') ? 'error' : undefined}>
            {(p) => (
              <input
                {...p}
                className="input"
                type="date"
                min={TODAY}
                max={addDays(TODAY, TRANSFER_TOKEN_VALID_DAYS)}
                value={tokenExpiresAt}
                onChange={(e) => setTokenExpiresAt(e.target.value)}
              />
            )}
          </FormField>
          <Callout tone="neutral">客戶的訂閱會全部轉入，不能只轉一部分。原訂閱會取消並在我方底下重建，承諾期方案的承諾期會重新計算。</Callout>
        </>
      )}

      <FormField label={type === 'cancel' ? '取消原因' : '備註'} required={type === 'cancel'} message={show('memo')} state={show('memo') ? 'error' : undefined}>
        {(p) => <textarea {...p} className="textarea" value={memo} onChange={(e) => setMemo(e.target.value)} />}
      </FormField>
      <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
        按下「送出 Google」就會直接送出，畫面會顯示 Google 的處理結果。
      </p>
    </Modal>
  );
}
