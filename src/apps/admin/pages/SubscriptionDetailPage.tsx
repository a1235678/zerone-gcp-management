import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EXPIRING_DAYS, daysUntil, getExpiryNoticeFor, getOperations, getPlans, getSchedules, getSubscription, getWorkOrders } from '@data/api';
import { executionModeLabel, operationTypeLabel, scheduleActionLabel, workOrderTypeLabel } from '@data/labels';
import type { OperationListItem, OperationType, ScheduleListItem, WorkOrderListItem } from '@data/types';
import { Card } from '@shared/components/Card';
import { DataTable, EmptyState, type Column } from '@shared/components/DataTable';
import { DescriptionList } from '@shared/components/DescriptionList';
import { Icon } from '@shared/components/Icon';
import { PageHeader } from '@shared/components/PageHeader';
import { PendingTag } from '@shared/components/PendingTag';
import { StatusTag } from '@shared/components/StatusTag';
import { formatDate, formatDateTime } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { OperationModal, type OperationTarget } from '../components/OperationModal';
import { OperationBody, OperationPanel } from '../components/OperationPanel';
import { OperationStatusTag, ScheduleStatusTag, SubscriptionStatusTag, WorkOrderStatusTag } from '../tags';
import { usePermission } from '../auth';

const OPEN = ['scheduled', 'pendingManual', 'submitted', 'manual', 'failed'];

/** 訂閱詳情：基本資料、操作、進行中的訂單、排程、歷史紀錄、到期通知 */
export function SubscriptionDetailPage() {
  const { id = '' } = useParams();
  const { can } = usePermission();
  const canOperate = can('subscriptions', 'write');
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  const [action, setAction] = useState<OperationType | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);

  const sub = useAsync(() => getSubscription(id), [id, version]);
  const plans = useAsync(getPlans);
  const ops = useAsync(() => getOperations({ subscriptionId: id }), [id, version]);
  const schedules = useAsync(() => getSchedules({ subscriptionId: id }), [id, version]);
  const orders = useAsync(() => (can('workOrders') ? getWorkOrders({ subscriptionId: id }) : Promise.resolve([])), [id, version]);
  const notice = useAsync(() => getExpiryNoticeFor(id), [id, version]);

  const s = sub.data;
  if (sub.loading && !s) return <p className="muted">載入中…</p>;
  if (!s)
    return (
      <Card>
        <EmptyState title="找不到這筆訂閱" />
        <p style={{ textAlign: 'center' }}>
          <Link to="/products/gws">回 GWS 訂閱</Link>
        </p>
      </Card>
    );

  const days = daysUntil(s.expiresAt);
  const topPlan = plans.data?.[plans.data.length - 1];
  const live = s.status !== 'cancelled';
  const openOps = (ops.data ?? []).filter((o) => OPEN.includes(o.status));
  const pastOps = (ops.data ?? []).filter((o) => !OPEN.includes(o.status));
  const target: OperationTarget = {
    customerId: s.customerId,
    customerName: s.customerName,
    primaryDomain: s.primaryDomain,
    subscriptionId: s.id,
    plan: s.plan,
    seats: s.seats,
    startsAt: s.startsAt,
    expiresAt: s.expiresAt,
  };

  const historyColumns: Column<OperationListItem>[] = [
    {
      key: 'id',
      header: '編號',
      render: (o) => (
        <button type="button" className="link-button mono" onClick={() => setPanelId(o.id)}>
          {o.id}
        </button>
      ),
    },
    { key: 'type', header: '類型', render: (o) => operationTypeLabel[o.type] },
    { key: 'summary', header: '內容', render: (o) => o.summary },
    { key: 'exec', header: '執行方式', render: (o) => executionModeLabel[o.execution] },
    { key: 'status', header: '結果', render: (o) => <OperationStatusTag value={o.status} /> },
    { key: 'by', header: '建立人', render: (o) => o.createdBy },
    { key: 'at', header: '最後更新', render: (o) => <span className="mono">{formatDateTime(o.updatedAt)}</span> },
  ];
  const scheduleColumns: Column<ScheduleListItem>[] = [
    { key: 'id', header: '排程編號', render: (x) => <span className="mono">{x.id}</span> },
    { key: 'action', header: '執行動作', render: (x) => scheduleActionLabel[x.action] },
    { key: 'detail', header: '內容', render: (x) => x.detail },
    { key: 'at', header: '啟用時間', render: (x) => <span className="mono">{formatDateTime(x.enabledAt)}</span> },
    { key: 'status', header: '狀態', render: (x) => <ScheduleStatusTag value={x.status} /> },
  ];
  const orderColumns: Column<WorkOrderListItem>[] = [
    { key: 'id', header: '單號', render: (w) => <Link to={`/work-orders/${w.id}`} className="mono">{w.id}</Link> },
    { key: 'type', header: '類型', render: (w) => workOrderTypeLabel[w.type] },
    { key: 'summary', header: '內容', render: (w) => w.summary },
    { key: 'status', header: '狀態', render: (w) => <WorkOrderStatusTag value={w.status} /> },
    { key: 'by', header: '開單人', render: (w) => w.createdBy },
  ];

  return (
    <>
      <Link to="/products/gws" className="back-link">
        <Icon name="chevronLeft" size={14} />
        GWS 訂閱
      </Link>
      <PageHeader
        title={`${s.customerName} · ${s.plan}`}
        titleAddon={<SubscriptionStatusTag value={s.status} />}
        description={
          <span className="inline">
            <span className="mono">{s.primaryDomain}</span>
            <span>·</span>
            <span>{s.dealerName}</span>
            <span>·</span>
            <span className="mono">{s.id}</span>
          </span>
        }
        actions={
          canOperate && live ? (
            <>
              <button className="btn" onClick={() => setAction('addSeats')}>
                加購
              </button>
              <button className="btn" disabled={topPlan === s.plan} title={topPlan === s.plan ? '已經是最高等級的方案' : undefined} onClick={() => setAction('upgrade')}>
                中途升版
              </button>
              <button className="btn btn--primary" onClick={() => setAction('renewal')}>
                續約
              </button>
            </>
          ) : undefined
        }
      />

      <div className="stack">
        <div className="split">
          <Card title="訂閱資料">
            <DescriptionList
              items={[
                { label: '客戶', value: <Link to={`/customers/${s.customerId}`}>{s.customerName}</Link> },
                { label: '主網域', value: <span className="mono">{s.primaryDomain}</span> },
                { label: '經銷商', value: s.dealerName },
                { label: '產品', value: 'Google Workspace' },
                {
                  label: '方案',
                  value: (
                    <span className="inline">
                      {s.plan}
                      <span className="tier-badge tnum" title="數字越大版本越高">
                        {s.planTier}
                      </span>
                    </span>
                  ),
                },
                { label: '人數', value: `${s.seats} 席` },
                {
                  label: '合約期間',
                  value: (
                    <span className="mono">
                      {formatDate(s.startsAt)} – {formatDate(s.expiresAt)}
                    </span>
                  ),
                },
                {
                  label: '剩餘天數',
                  value: live ? <span className={days <= EXPIRING_DAYS ? 'text-warning' : ''}>{days >= 0 ? `${days} 天` : `已過 ${-days} 天`}</span> : '',
                },
                { label: '最後同步', value: <span className="mono">{formatDateTime(s.lastSyncedAt)}</span> },
                { label: '訂閱編號', value: <span className="mono">{s.id}</span> },
              ]}
            />
            {!live && (
              <p className="muted" style={{ margin: 'var(--space-3) 0 0', fontSize: 'var(--text-sm)' }}>
                這筆訂閱在 Google 已取消（同步回來的狀態），系統不提供取消訂閱。
              </p>
            )}
          </Card>

          <div className="stack">
            <Card title="負責業務">
              <DescriptionList
                columns={1}
                items={[
                  { label: '新約', value: s.salesNew ?? <span className="muted">未指定</span> },
                  { label: '續約', value: s.salesRenewal ?? <span className="text-warning">未指定，到期通知只會寄給後勤</span> },
                ]}
              />
            </Card>
            <Card title={<span className="inline">到期通知 <PendingTag id={18} /></span>}>
              {notice.data && live ? (
                <div className="stack" style={{ gap: 'var(--space-2)' }}>
                  <div className="inline">
                    {notice.data.sentAt ? <StatusTag tone="success">已寄出</StatusTag> : <StatusTag tone="neutral">待寄出</StatusTag>}
                    <span className="mono muted">{notice.data.sentAt ? formatDateTime(notice.data.sentAt) : `預計 ${formatDate(notice.data.noticeDate)}`}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                    收件人：{notice.data.recipients.map((r) => `${r.name}（${r.role}）`).join('、')}
                  </div>
                  <Link to="/schedules/notifications" style={{ fontSize: 'var(--text-sm)' }}>
                    到期通知設定
                  </Link>
                </div>
              ) : (
                <p className="muted">已取消的訂閱不會寄到期通知。</p>
              )}
            </Card>
          </div>
        </div>

        <Card title="進行中的訂單" actions={<span className="muted" style={{ fontSize: 'var(--text-sm)' }}>{openOps.length} 筆</span>}>
          {openOps.length ? (
            <div className="stack">
              {openOps.map((o) => (
                <div key={o.id} className="op-block">
                  <OperationBody op={o} onChanged={reload} />
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">目前沒有進行中的續約、加購或升版。</p>
          )}
        </Card>

        <Card title="這筆訂閱的排程" bodyless>
          <DataTable caption="訂閱排程" columns={scheduleColumns} rows={schedules.data ?? []} rowKey={(x) => x.id} empty={<EmptyState title="沒有排程" />} />
        </Card>

        <Card title="歷史紀錄" bodyless>
          <DataTable caption="訂閱歷史訂單" columns={historyColumns} rows={pastOps} rowKey={(o) => o.id} empty={<EmptyState title="沒有已結束的訂單" />} />
        </Card>

        {can('workOrders') && (
          <Card title="相關執行單" bodyless>
            <DataTable caption="相關執行單" columns={orderColumns} rows={orders.data ?? []} rowKey={(w) => w.id} empty={<EmptyState title="沒有相關的執行單" />} />
          </Card>
        )}
      </div>

      {action && (
        <OperationModal
          open
          type={action}
          target={target}
          onClose={() => setAction(null)}
          onSubmitted={() => {
            setAction(null);
            reload();
          }}
        />
      )}
      <OperationPanel id={panelId} onClose={() => setPanelId(null)} onChanged={reload} />
    </>
  );
}
