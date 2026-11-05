import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { actOnWorkOrder, getWorkOrder } from '@data/api';
import { workOrderFlow, workOrderStatusLabel, workOrderTypeLabel } from '@data/labels';
import type { WorkOrderAction } from '@data/types';
import { Card } from '@shared/components/Card';
import { DescriptionList } from '@shared/components/DescriptionList';
import { EmptyState } from '@shared/components/DataTable';
import { Callout, FormField } from '@shared/components/Form';
import { Icon } from '@shared/components/Icon';
import { Modal } from '@shared/components/Modal';
import { PageHeader } from '@shared/components/PageHeader';
import { PendingTag } from '@shared/components/PendingTag';
import { StatusFlow } from '@shared/components/StatusFlow';
import { useToast } from '@shared/components/Toast';
import { formatDate, formatDateTime } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { WorkOrderStatusTag } from '../tags';

const confirmText: Partial<Record<WorkOrderAction, { title: string; body: string; button: string; danger?: boolean }>> = {
  confirmAndSend: {
    title: '確認並送出 Google',
    body: '送出後會向 Google 提出變更，送出後無法撤回。Prototype 不會真的送出，只會改變狀態。',
    button: '送出 Google',
  },
  resend: { title: '重送 Google', body: '用相同內容再向 Google 送出一次。', button: '重送' },
  discard: { title: '刪除草稿', body: '刪除後無法復原，操作紀錄會保留。', button: '刪除', danger: true },
};

const doneToast: Record<WorkOrderAction, string> = {
  requestConfirm: '已送出確認，狀態變為「待確認」',
  backToDraft: '已退回草稿',
  confirmAndSend: '已送出 Google，等待回應',
  simulateSuccess: 'Google 回應完成，訂閱資料已更新',
  simulateFailure: 'Google 回應失敗，可以重送',
  resend: '已重送 Google，等待回應',
  discard: '草稿已刪除',
};

export function WorkOrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const order = useAsync(() => getWorkOrder(id), [id, version]);
  const [confirm, setConfirm] = useState<WorkOrderAction | null>(null);
  const [failOpen, setFailOpen] = useState(false);
  const [failReason, setFailReason] = useState('');
  const [busy, setBusy] = useState(false);

  const w = order.data;
  if (order.loading && !w) return <p className="muted">載入中…</p>;
  if (!w)
    return (
      <Card>
        <EmptyState title="找不到這張執行單" description="可能已刪除草稿，或單號有誤。" />
        <p style={{ textAlign: 'center' }}>
          <Link to="/work-orders">回執行單</Link>
        </p>
      </Card>
    );

  const run = async (action: WorkOrderAction, note?: string) => {
    setBusy(true);
    try {
      const r = await actOnWorkOrder(w.id, action, note);
      toast(doneToast[action], action === 'simulateFailure' ? 'danger' : 'success');
      if (r === null) navigate('/work-orders');
      else setVersion((v) => v + 1);
    } catch (e) {
      toast((e as Error).message, 'danger');
    } finally {
      setBusy(false);
      setConfirm(null);
      setFailOpen(false);
    }
  };

  const ask = (action: WorkOrderAction) => (confirmText[action] ? setConfirm(action) : run(action));

  const flowIndex = w.status === 'failed' ? 2 : workOrderFlow.indexOf(w.status);
  const c = confirm ? confirmText[confirm] : undefined;

  const payloadItems = [
    w.payload.plan && { label: '方案', value: <span className="inline">{w.payload.plan} <PendingTag id={3} /></span> },
    w.payload.seats !== undefined && { label: '席次', value: `${w.payload.seats} 席` },
    w.payload.fromSeats !== undefined && { label: '調整前席次', value: `${w.payload.fromSeats} 席` },
    w.payload.toSeats !== undefined && { label: '調整後席次', value: `${w.payload.toSeats} 席` },
    w.payload.renewMonths !== undefined && { label: '續約期間', value: `${w.payload.renewMonths} 個月` },
    w.payload.transferToken && { label: '轉移碼', value: <span className="mono">{w.payload.transferToken}</span> },
    w.payload.tokenExpiresAt && { label: '轉移碼到期日', value: <span className="mono">{formatDate(w.payload.tokenExpiresAt)}</span> },
    { label: w.type === 'cancel' ? '取消原因' : '備註', value: w.payload.memo ?? '', full: true },
  ].filter(Boolean) as { label: string; value: React.ReactNode; full?: boolean }[];

  return (
    <>
      <Link to="/work-orders" className="back-link">
        <Icon name="chevronLeft" size={14} />
        執行單
      </Link>
      <PageHeader
        title={w.id}
        titleAddon={<WorkOrderStatusTag value={w.status} />}
        description={`${workOrderTypeLabel[w.type]} · ${w.customerName} · ${w.summary}`}
        actions={
          <>
            {w.status === 'draft' && (
              <>
                <button className="btn btn--danger" disabled={busy} onClick={() => ask('discard')}>
                  刪除草稿
                </button>
                <button className="btn btn--primary" disabled={busy} onClick={() => ask('requestConfirm')}>
                  送出確認
                </button>
              </>
            )}
            {w.status === 'pending' && (
              <>
                <button className="btn" disabled={busy} onClick={() => ask('backToDraft')}>
                  退回草稿
                </button>
                <button className="btn btn--primary" disabled={busy} onClick={() => ask('confirmAndSend')}>
                  確認並送出 Google
                </button>
              </>
            )}
            {w.status === 'failed' && (
              <button className="btn btn--primary" disabled={busy} onClick={() => ask('resend')}>
                <Icon name="reset" size={16} />
                重送 Google
              </button>
            )}
          </>
        }
      />

      <div className="stack">
        <Card>
          <StatusFlow
            steps={workOrderFlow.map((s) => workOrderStatusLabel[s])}
            currentIndex={w.status === 'completed' ? 4 : flowIndex}
            failedAt={w.status === 'failed' ? 2 : undefined}
            failedLabel="Google 回應失敗"
          />
          {w.status === 'failed' && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <Callout tone="danger" title="Google 回應失敗">
                {w.failureReason}
                {w.type === 'transfer' && /轉移碼/.test(w.failureReason ?? '') && (
                  <>
                    <br />
                    轉移碼有問題時重送也會失敗，請客戶重新產生轉移碼後，到
                    <Link to={`/customers/${w.customerId}`}>客戶詳情</Link>
                    開立新的轉移執行單。
                  </>
                )}
              </Callout>
            </div>
          )}
          {w.status === 'submitted' && (
            <div className="simulate">
              <div className="simulate__text">
                <strong>等待 Google 回應。</strong>
                <span className="muted">Prototype 沒有連線 Google，請用右邊按鈕模擬回應結果。</span>
              </div>
              <div className="inline">
                <button className="btn btn--sm" disabled={busy} onClick={() => setFailOpen(true)}>
                  模擬失敗
                </button>
                <button className="btn btn--sm" disabled={busy} onClick={() => run('simulateSuccess')}>
                  模擬完成
                </button>
              </div>
            </div>
          )}
        </Card>

        <div className="split">
          <Card title="執行單內容">
            <DescriptionList
              items={[
                { label: '類型', value: workOrderTypeLabel[w.type] },
                { label: '單號', value: <span className="mono">{w.id}</span> },
                {
                  label: '客戶',
                  value: (
                    <>
                      <Link to={`/customers/${w.customerId}`}>{w.customerName}</Link>
                      <div className="table__secondary mono">{w.primaryDomain}</div>
                    </>
                  ),
                },
                { label: '經銷商', value: w.dealerName },
                ...(w.subscriptionId
                  ? [{ label: '訂閱', value: <Link to={`/products/gws?q=${encodeURIComponent(w.primaryDomain)}`}>{w.subscriptionId}</Link> }]
                  : []),
                ...payloadItems,
                { label: '建立人', value: w.createdBy },
                { label: '建立時間', value: <span className="mono">{formatDateTime(w.createdAt)}</span> },
              ]}
            />
          </Card>
          <Card title="處理歷程">
            <ol className="timeline">
              {[...w.history].reverse().map((e, i) => (
                <li key={i} className={`timeline__item ${e.status === 'failed' ? 'is-failure' : e.status === 'completed' ? 'is-success' : ''}`}>
                  <div className="timeline__head">
                    <span className="timeline__action">{e.action}</span>
                    <WorkOrderStatusTag value={e.status} />
                  </div>
                  <div className="timeline__meta">
                    <span className="mono">{formatDateTime(e.at)}</span> · {e.by}
                  </div>
                  {e.note && <div className="timeline__note">{e.note}</div>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={c?.title}
        width={460}
        footer={
          <>
            <button className="btn" onClick={() => setConfirm(null)}>
              取消
            </button>
            <button className={`btn ${c?.danger ? 'btn--danger' : 'btn--primary'}`} disabled={busy} onClick={() => confirm && run(confirm)}>
              {c?.button}
            </button>
          </>
        }
      >
        <p>
          <span className="mono">{w.id}</span>：{w.summary}
        </p>
        <p className="muted">{c?.body}</p>
      </Modal>

      <Modal
        open={failOpen}
        onClose={() => setFailOpen(false)}
        title="模擬 Google 回應失敗"
        width={460}
        footer={
          <>
            <button className="btn" onClick={() => setFailOpen(false)}>
              取消
            </button>
            <button className="btn btn--danger" disabled={busy} onClick={() => run('simulateFailure', failReason.trim() || undefined)}>
              模擬失敗
            </button>
          </>
        }
      >
        <FormField label="失敗原因" help="留白會使用「請求參數不正確」。">
          {(p) => <input {...p} className="input" value={failReason} onChange={(e) => setFailReason(e.target.value)} />}
        </FormField>
      </Modal>
    </>
  );
}
