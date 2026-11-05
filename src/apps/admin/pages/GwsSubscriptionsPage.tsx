import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { EXPIRING_DAYS, daysUntil, getDealers, getPlans, getSubscriptions } from '@data/api';
import { subscriptionStatusLabel } from '@data/labels';
import type { SubscriptionListItem, SubscriptionStatus, WorkOrderType } from '@data/types';
import { Card } from '@shared/components/Card';
import { DataTable, EmptyState, type Column } from '@shared/components/DataTable';
import { FilterBar, SearchField, SelectField } from '@shared/components/FilterBar';
import { PageHeader } from '@shared/components/PageHeader';
import { Pagination, paginate } from '@shared/components/Pagination';
import { PendingTag } from '@shared/components/PendingTag';
import { Stat, StatGrid } from '@shared/components/Stat';
import { formatDate, formatDateTime, formatNumber } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { WorkOrderModal } from '../components/WorkOrderModal';
import { SubscriptionStatusTag } from '../tags';

const PAGE_SIZE = 15;

export function GwsSubscriptionsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const keyword = params.get('q') ?? '';
  const dealerId = params.get('dealer') ?? '';
  const status = (params.get('status') ?? '') as SubscriptionStatus | '';
  const plan = params.get('plan') ?? '';
  const page = Number(params.get('page') ?? '1');
  const [version, setVersion] = useState(0);
  const [action, setAction] = useState<{ type: WorkOrderType; sub: SubscriptionListItem } | null>(null);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const dealers = useAsync(getDealers);
  const plans = useAsync(getPlans);
  const all = useAsync(() => getSubscriptions({ product: 'GWS' }), [version]);
  const result = useAsync(() => getSubscriptions({ product: 'GWS', keyword, dealerId, status, plan }), [keyword, dealerId, status, plan, version]);
  const rows = result.data ?? [];
  const { pageRows, pageCount, page: safePage } = paginate(rows, page, PAGE_SIZE);
  const hasFilter = Boolean(keyword || dealerId || status || plan);

  const live = (all.data ?? []).filter((s) => s.status !== 'cancelled');
  const expiring = live.filter((s) => s.status === 'expiring');

  const columns: Column<SubscriptionListItem>[] = [
    {
      key: 'customer',
      header: '客戶',
      render: (s) => (
        <div>
          <Link to={`/customers/${s.customerId}`} onClick={(e) => e.stopPropagation()} className="table__primary">
            {s.customerName}
          </Link>
          <div className="table__secondary mono">{s.primaryDomain}</div>
        </div>
      ),
    },
    { key: 'dealer', header: '經銷商', render: (s) => s.dealerName },
    { key: 'plan', header: '方案', render: (s) => s.plan },
    { key: 'seats', header: '席次', align: 'right', render: (s) => <span className="tnum">{s.seats}</span> },
    { key: 'status', header: '狀態', render: (s) => <SubscriptionStatusTag value={s.status} /> },
    {
      key: 'expiresAt',
      header: '到期日',
      render: (s) => {
        const d = daysUntil(s.expiresAt);
        return (
          <div>
            <div className="mono">{formatDate(s.expiresAt)}</div>
            {s.status !== 'cancelled' && (
              <div className={`table__secondary ${d <= EXPIRING_DAYS ? 'text-warning' : ''}`}>{d >= 0 ? `剩 ${d} 天` : `已過 ${-d} 天`}</div>
            )}
          </div>
        );
      },
    },
    { key: 'sync', header: '最後同步', render: (s) => <span className={`mono ${s.lastSyncedAt < '2026-11-05' ? 'text-warning' : ''}`}>{formatDateTime(s.lastSyncedAt)}</span> },
    {
      key: 'actions',
      header: <span className="visually-hidden">操作</span>,
      render: (s) =>
        s.status === 'cancelled' ? (
          <span className="muted">—</span>
        ) : s.openWorkOrderId ? (
          <Link to={`/work-orders/${s.openWorkOrderId}`} className="inline" onClick={(e) => e.stopPropagation()}>
            處理中 <span className="mono">{s.openWorkOrderId}</span>
          </Link>
        ) : (
          <div className="row-actions">
            <button className="btn btn--sm" onClick={() => setAction({ type: 'renewal', sub: s })}>
              續約
            </button>
            <button className="btn btn--sm" onClick={() => setAction({ type: 'seats', sub: s })}>
              調整席次
            </button>
            <button className="btn btn--sm btn--danger" onClick={() => setAction({ type: 'cancel', sub: s })}>
              取消訂閱
            </button>
          </div>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="GWS 訂閱"
        titleAddon={<PendingTag id={5} hint="PM 想看哪些 GWS 資訊" />}
        description={
          <span className="inline">
            以訂閱為單位，資料由 Google 同步回來。可在這裡開立續約、調整席次、取消訂閱執行單。
            <PendingTag id={3} hint="能否抓到已購買方案" />
          </span>
        }
      />

      <StatGrid>
        <Stat label="有效訂閱" value={live.length} unit="筆" sub={`共 ${new Set(live.map((s) => s.customerId)).size} 個客戶`} />
        <Stat label="總席次" value={formatNumber(live.reduce((n, s) => n + (s.seats ?? 0), 0))} unit="席" sub="不含已取消" />
        <Stat label={`${EXPIRING_DAYS} 天內到期`} value={expiring.length} unit="筆" tone={expiring.length ? 'warning' : undefined} sub={
          <button type="button" className="link-button" onClick={() => setParam('status', 'expiring')}>
            只看即將到期
          </button>
        } />
        <Stat label="處理中的執行單" value={live.filter((s) => s.openWorkOrderId).length} unit="筆" sub={<Link to="/work-orders">前往執行單</Link>} />
      </StatGrid>

      <Card bodyless>
        <FilterBar onReset={hasFilter ? () => setParams({}, { replace: true }) : undefined}>
          <SearchField label="關鍵字" value={keyword} onChange={(v) => setParam('q', v)} placeholder="客戶、網域或方案" />
          <SelectField label="經銷商" value={dealerId} onChange={(v) => setParam('dealer', v)} options={(dealers.data ?? []).map((d) => ({ value: d.id, label: d.name }))} />
          <SelectField label="方案" value={plan} onChange={(v) => setParam('plan', v)} options={(plans.data ?? []).map((p) => ({ value: p, label: p }))} />
          <SelectField
            label="狀態"
            value={status}
            onChange={(v) => setParam('status', v)}
            options={Object.entries(subscriptionStatusLabel).map(([value, label]) => ({ value, label }))}
          />
        </FilterBar>
        <div className="result-meta">
          <span>{hasFilter ? `符合條件 ${rows.length} 筆` : `共 ${rows.length} 筆`}，依到期日排序</span>
          <Pagination page={safePage} pageCount={pageCount} onChange={(p) => setParam('page', String(p))} />
        </div>
        <DataTable
          caption="GWS 訂閱清單"
          columns={columns}
          rows={pageRows}
          rowKey={(s) => s.id}
          loading={result.loading && !result.data}
          empty={<EmptyState title="沒有符合條件的訂閱" />}
        />
      </Card>

      {action && (
        <WorkOrderModal
          open
          type={action.type}
          subscription={action.sub}
          onClose={() => setAction(null)}
          onCreated={(wo) => {
            setAction(null);
            setVersion((v) => v + 1);
            navigate(`/work-orders/${wo.id}`);
          }}
        />
      )}
    </>
  );
}
