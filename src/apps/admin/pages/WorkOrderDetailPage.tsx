import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { actOnWorkOrder, analyzeOrder, getCustomer, getSubscriptions, getWorkOrder } from '@data/api';
import { executionModeLabel, transferSourceLabel, workOrderFlow, workOrderStatusLabel, workOrderTypeLabel } from '@data/labels';
import type { WorkOrderAction, WorkOrderStep } from '@data/types';
import { Card } from '@shared/components/Card';
import { DescriptionList } from '@shared/components/DescriptionList';
import { EmptyState } from '@shared/components/DataTable';
import { Callout, FormField } from '@shared/components/Form';
import { Icon } from '@shared/components/Icon';
import { Modal } from '@shared/components/Modal';
import { PageHeader } from '@shared/components/PageHeader';
import { PendingTag } from '@shared/components/PendingTag';
import { StatusFlow } from '@shared/components/StatusFlow';
import { StatusTag } from '@shared/components/StatusTag';
import { useToast } from '@shared/components/Toast';
import { formatDateTime } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { ChangeTags, OperationModal, type OperationTarget } from '../components/OperationModal';
import { OperationBody } from '../components/OperationPanel';
import { WorkOrderStatusTag } from '../tags';
import { usePermission } from '../auth';

const stepTag: Record<WorkOrderStep['state'], { tone: 'success' | 'info' | 'danger' | 'warning' | 'neutral'; text: string }> = {
  done: { tone: 'success', text: '完成' },
  inProgress: { tone: 'info', text: '進行中' },
  failed: { tone: 'danger', text: '失敗' },
  manual: { tone: 'warning', text: '人工處理中' },
  todo: { tone: 'neutral', text: '待處理' },
  blocked: { tone: 'neutral', text: '尚未開始' },
};

export function WorkOrderDetailPage() {
  const { can, canApprove } = usePermission();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  const order = useAsync(() => getWorkOrder(id), [id, version]);
  const [dialog, setDialog] = useState<null | 'approve' | 'return' | 'discard'>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [opOpen, setOpOpen] = useState(false);

  const w = order.data;
  const customer = useAsync(() => (w?.customerId ? getCustomer(w.customerId) : Promise.resolve(undefined)), [w?.customerId]);
  const subs = useAsync(() => (w?.customerId ? getSubscriptions({ customerId: w.customerId }) : Promise.resolve([])), [w?.customerId, version]);

  if (order.loading && !w) return <p className="muted">載入中…</p>;
  if (!w)
    return (
      <Card>
        <EmptyState title="找不到這張執行單" description="可能已被刪除，或單號有誤。" />
        <p style={{ textAlign: 'center' }}>
          <Link to="/work-orders">回執行單</Link>
        </p>
      </Card>
    );

  const run = async (action: WorkOrderAction, n?: string) => {
    setBusy(true);
    try {
      const r = await actOnWorkOrder(w.id, action, n);
      const msg: Record<WorkOrderAction, string> = {
        submit: '已送出簽核，等待業務主管審核',
        approve: w.status === 'salesReview' ? '業務主管已核准，換技術主管審核' : '技術主管已核准，等待後勤處理',
        return: '已退回給業務修改',
        discard: '執行單已刪除',
      };
      toast(msg[action]);
      setDialog(null);
      setNote('');
      if (r === null) navigate('/work-orders');
      else reload();
    } catch (e) {
      toast((e as Error).message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const reviewer = w.status === 'salesReview' ? '業務主管' : w.status === 'techReview' ? '技術主管' : '';
  const returnedAt = w.status === 'returned' ? [...w.history].reverse().find((h) => h.status !== 'returned' && h.status !== 'draft')?.status : undefined;
  const flowIndex = w.status === 'returned' ? workOrderFlow.indexOf(returnedAt ?? 'salesReview') : w.status === 'completed' ? workOrderFlow.length : workOrderFlow.indexOf(w.status);

  const sub = subs.data?.find((s) => s.id === w.subscriptionId);
  const target: OperationTarget | undefined = customer.data
    ? {
        customerId: customer.data.id,
        customerName: customer.data.name,
        primaryDomain: customer.data.primaryDomain,
        dealerId: customer.data.dealerId,
        subscriptionId: sub?.id,
        plan: sub?.plan,
        seats: sub?.seats,
        startsAt: sub?.startsAt,
        expiresAt: sub?.expiresAt,
      }
    : undefined;

  const p = w.payload;
  const analysis = analyzeOrder(w.type, sub, p);
  const items = [
    { label: '類型', value: workOrderTypeLabel[w.type] },
    { label: '單號', value: <span className="mono">{w.id}</span> },
    {
      label: '客戶',
      value: w.customerId ? (
        <>
          <Link to={`/customers/${w.customerId}`}>{w.customerName}</Link>
          <div className="table__secondary mono">{w.primaryDomain}</div>
        </>
      ) : (
        <>
          {w.customerName} <StatusTag tone="neutral">新客戶・尚未建檔</StatusTag>
          <div className="table__secondary mono">{w.primaryDomain}</div>
        </>
      ),
    },
    { label: '經銷商', value: w.dealerName },
    ...(sub ? [{ label: '訂閱', value: `${sub.plan} · 目前 ${sub.seats} 席 · 合約 ${sub.startsAt.replace(/-/g, '/')} – ${sub.expiresAt.replace(/-/g, '/')}` }] : []),
    ...(p.plan ? [{ label: w.type === 'upgrade' ? '升級後方案' : w.type === 'renewal' ? '續約方案' : '方案', value: <span className="inline">{p.plan} <PendingTag id={3} /></span> }] : []),
    ...(p.seats !== undefined ? [{ label: w.type === 'renewal' ? '續約人數' : '人數', value: `${p.seats} 席` }] : []),
    ...(p.addSeats !== undefined ? [{ label: '加購人數', value: `${p.addSeats} 席${sub ? `（${sub.seats} → ${(sub.seats ?? 0) + p.addSeats}）` : ''}` }] : []),
    ...(w.type === 'renewal' ? [{ label: '續約期間', value: `${p.renewMonths} 個月` }] : []),
    ...(w.type === 'renewal' && sub ? [{ label: '變動', value: <ChangeTags planChange={analysis.planChange} seatChange={analysis.seatChange} /> }] : []),
    ...(p.transferSource ? [{ label: '移轉來源', value: transferSourceLabel[p.transferSource] }] : []),
    {
      label: '執行方式',
      value: (
        <span className="inline">
          {executionModeLabel[analysis.execution]}
          {analysis.pendingId && <PendingTag id={analysis.pendingId} />}
        </span>
      ),
    },
    ...(w.customerMode === 'new' && w.newCustomer
      ? [
          { label: '統一編號', value: <span className="mono">{w.newCustomer.taxId}</span> },
          { label: '聯絡人', value: `${w.newCustomer.contactName}（${w.newCustomer.contactEmail}）` },
        ]
      : []),
    { label: '備註', value: p.memo ?? '', full: true },
    { label: '開單人', value: w.createdBy },
    { label: '開單時間', value: <span className="mono">{formatDateTime(w.createdAt)}</span> },
  ];

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
            {(w.status === 'draft' || w.status === 'returned') && can('workOrders', 'write') && (
              <>
                <button className="btn btn--danger" disabled={busy} onClick={() => setDialog('discard')}>
                  刪除
                </button>
                <Link className="btn" to={`/work-orders/${w.id}/edit`}>
                  修改
                </Link>
                <button className="btn btn--primary" disabled={busy} onClick={() => run('submit')}>
                  {w.status === 'returned' ? '重新送出簽核' : '送出簽核'}
                </button>
              </>
            )}
            {reviewer && canApprove(w.status) && (
              <>
                <button className="btn btn--danger" disabled={busy} onClick={() => setDialog('return')}>
                  退回
                </button>
                <button className="btn btn--primary" disabled={busy} onClick={() => setDialog('approve')}>
                  {reviewer}核准
                </button>
              </>
            )}
          </>
        }
      />

      <div className="stack">
        <Card title="狀態">
          <StatusFlow
            steps={workOrderFlow.map((s) => workOrderStatusLabel[s])}
            currentIndex={flowIndex}
            failedAt={w.status === 'returned' ? flowIndex : undefined}
            failedLabel="已退回"
          />
          {w.status === 'returned' && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <Callout tone="danger" title="已退回給業務">
                {w.returnReason}
                <br />
                修改後重新送出簽核，會從業務主管重新開始審核。
              </Callout>
            </div>
          )}
          {reviewer && (
            <p className="muted" style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
              等待{reviewer}審核。{canApprove(w.status) ? '你是' + reviewer + '，可以核准或退回。' : '只有' + reviewer + '能核准或退回。'}
              <PendingTag hint="實際簽核人選待定" />
            </p>
          )}
        </Card>

        {(w.status === 'approved' || w.status === 'processing' || w.status === 'completed') && (
          <Card title="處理步驟" bodyless actions={<span className="muted" style={{ fontSize: 'var(--text-sm)' }}>由後勤依序處理</span>}>
            <ol className="steps">
              {w.steps.map((s, i) => (
                <li key={s.key} className={`steps__item is-${s.state}`}>
                  <span className="steps__no">{s.state === 'done' ? <Icon name="check" size={14} /> : i + 1}</span>
                  <div className="steps__body">
                    <div className="inline">
                      <strong>{s.label}</strong>
                      <StatusTag tone={stepTag[s.state].tone}>{stepTag[s.state].text}</StatusTag>
                    </div>
                    {s.detail && <div className="table__secondary mono">{s.detail}</div>}
                    {s.key === 'createCustomer' && s.state === 'todo' && !can('customers', 'write') && <div className="table__secondary">由後勤處理（需要「客戶」可編輯權限）</div>}
                    {s.key === 'createCustomer' && s.state === 'todo' && can('customers', 'write') && (
                      <div style={{ marginTop: 'var(--space-2)' }}>
                        <Link className="btn btn--primary btn--sm" to={`/customers/${w.type === 'transfer' ? 'transfer-in' : 'new'}?fromWo=${w.id}`}>
                          {w.type === 'transfer' ? '轉入客戶' : '建立客戶'}（帶入執行單資料）
                        </Link>
                      </div>
                    )}
                    {s.key === 'google' && s.state === 'failed' && can('subscriptions', 'write') && (
                      <div style={{ marginTop: 'var(--space-2)' }}>
                        <button className="btn btn--sm" disabled={!target} onClick={() => setOpOpen(true)}>
                          重新填寫並建立
                        </button>
                      </div>
                    )}
                    {s.key === 'google' && s.state === 'todo' && !can('subscriptions', 'write') && <div className="table__secondary">由後勤處理（需要「訂閱」可編輯權限）</div>}
                    {s.key === 'google' && s.state === 'todo' && can('subscriptions', 'write') && (
                      <div style={{ marginTop: 'var(--space-2)' }}>
                        <button className="btn btn--primary btn--sm" disabled={!target} onClick={() => setOpOpen(true)}>
                          {workOrderTypeLabel[w.type]}（帶入執行單資料）
                        </button>
                      </div>
                    )}
                    {s.key === 'google' && s.state === 'blocked' && w.customerMode === 'new' && <div className="table__secondary">先建立客戶後才能處理</div>}
                    {s.key === 'google' && w.operation && (
                      <div className="steps__op">
                        <OperationBody op={w.operation} onChanged={reload} />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}

        <div className="split">
          <Card title="需求內容">
            <DescriptionList items={items} />
          </Card>
          <Card title="簽核與處理歷程">
            <ol className="timeline">
              {[...w.history].reverse().map((e, i) => (
                <li key={i} className={`timeline__item ${e.status === 'returned' ? 'is-failure' : e.status === 'completed' ? 'is-success' : ''}`}>
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

      {target && (
        <OperationModal
          open={opOpen}
          type={w.type}
          target={target}
          workOrderId={w.id}
          initial={{ plan: p.plan, seats: p.seats, addSeats: p.addSeats, renewMonths: p.renewMonths, transferSource: p.transferSource, memo: p.memo }}
          onClose={() => setOpOpen(false)}
          onSubmitted={() => {
            setOpOpen(false);
            reload();
          }}
        />
      )}

      <Modal
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        width={460}
        title={dialog === 'approve' ? `${reviewer}核准` : dialog === 'return' ? '退回給業務' : '刪除執行單'}
        footer={
          <>
            <button className="btn" onClick={() => setDialog(null)}>
              取消
            </button>
            {dialog === 'approve' && (
              <button className="btn btn--primary" disabled={busy} onClick={() => run('approve', note)}>
                核准
              </button>
            )}
            {dialog === 'return' && (
              <button className="btn btn--danger" disabled={busy || !note.trim()} onClick={() => run('return', note)}>
                退回
              </button>
            )}
            {dialog === 'discard' && (
              <button className="btn btn--danger" disabled={busy} onClick={() => run('discard')}>
                刪除
              </button>
            )}
          </>
        }
      >
        <p>
          <span className="mono">{w.id}</span>：{w.customerName}，{w.summary}
        </p>
        {dialog === 'approve' && (
          <>
            <p className="muted">{w.status === 'salesReview' ? '核准後換技術主管審核。' : '核准後交給後勤處理。'}</p>
            <FormField label="意見（選填）">{(p2) => <input {...p2} className="input" value={note} onChange={(e) => setNote(e.target.value)} />}</FormField>
          </>
        )}
        {dialog === 'return' && (
          <FormField label="退回原因" required help="業務會看到這段說明，修改後重新送出。">
            {(p2) => <textarea {...p2} className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />}
          </FormField>
        )}
        {dialog === 'discard' && <p className="muted">刪除後無法復原，操作紀錄會保留。</p>}
      </Modal>
    </>
  );
}

