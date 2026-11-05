import { useEffect, useMemo, useState } from 'react';
import { TODAY, addDays, createWorkOrder, getCustomers, getPlans } from '@data/api';
import { workOrderTypeLabel } from '@data/labels';
import type { CustomerListItem, SubscriptionListItem, WorkOrderListItem, WorkOrderPayload, WorkOrderType } from '@data/types';
import { Callout, FormField } from '@shared/components/Form';
import { Modal } from '@shared/components/Modal';
import { PendingTag } from '@shared/components/PendingTag';
import { useToast } from '@shared/components/Toast';
import { useAsync } from '@shared/hooks/useAsync';

/** 轉移碼有效天數（依 Google Cloud Channel 文件，待 Ray 確認） */
const TOKEN_VALID_DAYS = 14;

/**
 * 開立執行單。依類型顯示不同欄位：
 * - 新訂閱：選客戶、方案、席次
 * - 續約／調整席次／取消訂閱：從某筆訂閱開立
 * - 客戶轉移：從客戶詳情開立（只做轉入）
 */
export function WorkOrderModal({
  open,
  type,
  onClose,
  onCreated,
  customer,
  subscription,
}: {
  open: boolean;
  type: WorkOrderType;
  onClose: () => void;
  onCreated: (wo: WorkOrderListItem) => void;
  customer?: CustomerListItem;
  subscription?: SubscriptionListItem;
}) {
  const toast = useToast();
  const plans = useAsync(getPlans);
  const customers = useAsync(() => (type === 'new' && !customer ? getCustomers({ status: 'active' }) : Promise.resolve([])), [type, customer?.id]);

  const [customerId, setCustomerId] = useState('');
  const [plan, setPlan] = useState('');
  const [seats, setSeats] = useState('');
  const [toSeats, setToSeats] = useState('');
  const [renewMonths, setRenewMonths] = useState('12');
  const [token, setToken] = useState('');
  const [tokenExpiresAt, setTokenExpiresAt] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCustomerId(customer?.id ?? '');
    setPlan('');
    setSeats('');
    setToSeats(subscription?.seats ? String(subscription.seats) : '');
    setRenewMonths('12');
    setToken('');
    setTokenExpiresAt('');
    setMemo('');
    setSaving(false);
    setTried(false);
  }, [open, customer?.id, subscription?.id, subscription?.seats]);

  const maxTokenDate = addDays(TODAY, TOKEN_VALID_DAYS);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (type === 'new') {
      if (!customerId) e.customerId = '請選擇客戶';
      if (!plan) e.plan = '請選擇方案';
      if (!(Number(seats) >= 1)) e.seats = '席次至少 1';
    }
    if (type === 'seats') {
      const n = Number(toSeats);
      if (!Number.isInteger(n) || n < 1) e.toSeats = '席次需為大於 0 的整數';
      else if (n === subscription?.seats) e.toSeats = '與目前席次相同';
    }
    if (type === 'cancel' && !memo.trim()) e.memo = '請填寫取消原因';
    if (type === 'transfer') {
      if (!token.trim()) e.token = '請輸入客戶提供的轉移碼';
      if (!tokenExpiresAt) e.tokenExpiresAt = '請輸入轉移碼到期日';
      else if (tokenExpiresAt < TODAY) e.tokenExpiresAt = '轉移碼已過期，請客戶重新產生';
      else if (tokenExpiresAt > maxTokenDate) e.tokenExpiresAt = `轉移碼最長 ${TOKEN_VALID_DAYS} 天有效，到期日不會晚於 ${maxTokenDate}`;
    }
    return e;
  }, [type, customerId, plan, seats, toSeats, memo, token, tokenExpiresAt, subscription?.seats, maxTokenDate]);

  const show = (k: string) => (tried ? errors[k] : undefined);

  const submit = async (submitNow: boolean) => {
    setTried(true);
    if (Object.keys(errors).length) return;
    const payload: WorkOrderPayload = { memo: memo.trim() || undefined };
    if (type === 'new') Object.assign(payload, { plan, seats: Number(seats) });
    if (type === 'seats') Object.assign(payload, { fromSeats: subscription?.seats ?? 0, toSeats: Number(toSeats) });
    if (type === 'renewal') payload.renewMonths = Number(renewMonths);
    if (type === 'transfer') Object.assign(payload, { transferToken: token.trim(), tokenExpiresAt });
    setSaving(true);
    try {
      const wo = await createWorkOrder({
        type,
        customerId: customerId || subscription!.customerId,
        subscriptionId: subscription?.id,
        payload,
        submit: submitNow,
      });
      toast(`已開立 ${wo.id}（${submitNow ? '待確認' : '草稿'}）`);
      onCreated(wo);
    } catch (e) {
      toast((e as Error).message, 'danger');
      setSaving(false);
    }
  };

  const seatDiff = type === 'seats' && subscription?.seats && Number(toSeats) ? Number(toSeats) - subscription.seats : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`開立${workOrderTypeLabel[type]}執行單`}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn" disabled={saving} onClick={() => submit(false)}>
            存成草稿
          </button>
          <button type="button" className="btn btn--primary" disabled={saving} onClick={() => submit(true)}>
            送出確認
          </button>
        </>
      }
    >
      {subscription && (
        <Callout tone="neutral">
          <strong>{subscription.customerName}</strong>
          <span className="mono"> · {subscription.primaryDomain}</span>
          <br />
          {subscription.plan} · {subscription.seats} 席 · 到期日 <span className="mono">{subscription.expiresAt.replace(/-/g, '/')}</span>
        </Callout>
      )}

      {type === 'new' && (
        <>
          {customer ? (
            <Callout tone="neutral">
              <strong>{customer.name}</strong>
              <span className="mono"> · {customer.primaryDomain}</span>
            </Callout>
          ) : (
            <FormField label="客戶" required message={show('customerId')} state={show('customerId') ? 'error' : undefined}>
              {(p) => (
                <select {...p} className="select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">請選擇</option>
                  {(customers.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}（{c.primaryDomain}）
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          )}
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
          message={show('toSeats') ?? (seatDiff ? `${seatDiff > 0 ? '增加' : '減少'} ${Math.abs(seatDiff)} 席` : undefined)}
          state={show('toSeats') ? 'error' : undefined}
          help={`目前 ${subscription?.seats ?? 0} 席。減少席次時，不可低於客戶已指派的授權數。`}
        >
          {(p) => <input {...p} className="input tnum" type="number" min={1} value={toSeats} onChange={(e) => setToSeats(e.target.value)} />}
        </FormField>
      )}

      {type === 'cancel' && (
        <Callout tone="warning" title="取消後無法復原">
          送出 Google 並完成後，這筆訂閱的所有授權會停止。
        </Callout>
      )}

      {type === 'transfer' && customer && (
        <>
          <div className="inline">
            <PendingTag id={4} hint="是否使用 Cloud Channel API" />
          </div>
          <Callout tone="info" title="請客戶先取得轉移碼">
            客戶的 Google 管理員產生轉移碼時，需要我方的經銷商識別碼。轉移碼 {TOKEN_VALID_DAYS} 天內有效。
          </Callout>
          <FormField label="主網域">
            {(p) => <input {...p} className="input mono" value={customer.primaryDomain} readOnly />}
          </FormField>
          <FormField label="轉移碼" required message={show('token')} state={show('token') ? 'error' : undefined}>
            {(p) => (
              <input
                {...p}
                className="input mono"
                autoCapitalize="characters"
                spellCheck={false}
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="轉移碼到期日" required message={show('tokenExpiresAt')} state={show('tokenExpiresAt') ? 'error' : undefined}>
            {(p) => (
              <input {...p} className="input" type="date" min={TODAY} max={maxTokenDate} value={tokenExpiresAt} onChange={(e) => setTokenExpiresAt(e.target.value)} />
            )}
          </FormField>
          <Callout tone="neutral">
            客戶的訂閱會全部轉入，不能只轉一部分。原訂閱會取消並在我方底下重建，承諾期方案的承諾期會重新計算。
          </Callout>
        </>
      )}

      <FormField
        label={type === 'cancel' ? '取消原因' : '備註'}
        required={type === 'cancel'}
        message={show('memo')}
        state={show('memo') ? 'error' : undefined}
      >
        {(p) => <textarea {...p} className="textarea" value={memo} onChange={(e) => setMemo(e.target.value)} />}
      </FormField>
      <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
        「送出確認」後狀態變成「待確認」，確認後才會送出 Google；「存成草稿」可以之後再送出。
      </p>
    </Modal>
  );
}
