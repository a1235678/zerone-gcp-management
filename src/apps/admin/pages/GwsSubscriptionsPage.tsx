import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { EXPIRING_DAYS, daysUntil, getDealers, getPlans, getSubscriptions } from '@data/api';
import { operationTypeLabel, subscriptionStatusLabel } from '@data/labels';
import type { OperationType, SubscriptionListItem, SubscriptionStatus } from '@data/types';
import { Card } from '@shared/components/Card';
import { DataTable, EmptyState, type Column } from '@shared/components/DataTable';
import { FilterBar, SearchField, SelectField } from '@shared/components/FilterBar';
import { PageHeader } from '@shared/components/PageHeader';
import { Pagination, paginate } from '@shared/components/Pagination';
import { PendingTag } from '@shared/components/PendingTag';
import { Stat, StatGrid } from '@shared/components/Stat';
import { formatContractPeriod, formatDateTime, formatNumber } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { OperationModal, type OperationTarget } from '../components/OperationModal';
import { OperationPanel } from '../components/OperationPanel';
import { Icon } from '@shared/components/Icon';
import { OperationStatusTag } from '../tags';
import { SubscriptionStatusTag } from '../tags';
import { StatusTag } from '@shared/components/StatusTag';
import { usePermission } from '../auth';

const PAGE_SIZE = 15;

export function GwsSubscriptionsPage() {
  const { can } = usePermission();
  const navigate = useNavigate();
  const canOperate = can('subscriptions', 'write');
  const [params, setParams] = useSearchParams();
  const keyword = params.get('q') ?? '';
  const dealerId = params.get('dealer') ?? '';
  const status = (params.get('status') ?? '') as SubscriptionStatus | '';
  const plan = params.get('plan') ?? '';
  const page = Number(params.get('page') ?? '1');
  const [version, setVersion] = useState(0);
  const [action, setAction] = useState<{ type: OperationType; target: OperationTarget; combined?: boolean } | null>(null);
  // 從新訂頁送出後回到這裡，直接打開那筆的處理狀態
  const [panelId, setPanelId] = useState<string | null>(() => params.get('op'));
  const toTarget = (s: SubscriptionListItem): OperationTarget => ({
    customerId: s.customerId,
    customerName: s.customerName,
    primaryDomain: s.primaryDomain,
    dealerId: s.dealerId,
    subscriptionId: s.id,
    plan: s.plan,
    seats: s.seats,
    startsAt: s.startsAt,
    contractTime: s.contractTime,
    expiresAt: s.expiresAt,
    renewalCancelled: Boolean(s.renewalCancelled),
  });

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
    { key: 'plan', header: '版本', render: (s) => s.plan },
    { key: 'seats', header: '席次', align: 'right', render: (s) => <span className="tnum">{s.seats}</span> },
    {
      key: 'status',
      header: '狀態',
      render: (s) => (
        <div className="op-chips">
          <SubscriptionStatusTag value={s.status} />
          {s.renewalCancelled && <StatusTag tone="warning">不續約</StatusTag>}
        </div>
      ),
    },
    {
      key: 'contract',
      header: '合約期間',
      render: (s) => {
        const d = daysUntil(s.expiresAt);
        return (
          <div>
            <div className="mono">
              {formatContractPeriod(s.startsAt, s.expiresAt, s.contractTime)}
            </div>
            {s.status !== 'cancelled' && (
              <div className={`table__secondary ${d <= EXPIRING_DAYS ? 'text-warning' : ''}`}>
                {d >= 0 ? `剩 ${d} 天` : `已過 ${-d} 天`}
                {s.term === 'flexible' && ' · 彈性合約'}
              </div>
            )}
          </div>
        );
      },
    },
    { key: 'sync', header: '最後同步', render: (s) => <span className={`mono ${s.lastSyncedAt < '2026-11-05' ? 'text-warning' : ''}`}>{formatDateTime(s.lastSyncedAt)}</span> },
    {
      key: 'ops',
      header: '進行中',
      render: (s) =>
        s.openOperations.length ? (
          <div className="op-chips" onClick={(e) => e.stopPropagation()}>
            {s.openOperations.map((o) => (
              <button key={o.id} type="button" className="link-button inline" onClick={() => setPanelId(o.id)} title={`查看 ${o.id}`}>
                <OperationStatusTag value={o.status} />
                <span className="table__secondary">{operationTypeLabel[o.type]}</span>
              </button>
            ))}
          </div>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      key: 'actions',
      header: <span className="visually-hidden">操作</span>,
      render: (s) =>
        s.status === 'cancelled' || !canOperate ? null : (
          <div className="row-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className="btn btn--sm"
              disabled={Boolean(s.renewalCancelled)}
              title={s.renewalCancelled ? '已設定不續約，要續約請到訂閱詳情恢復續約' : undefined}
              onClick={() => setAction({ type: 'renewal', target: toTarget(s) })}
            >
              續約
            </button>
            {/* 加購與中途升版合併成一個按鈕（2026/11/24） */}
            <button className="btn btn--sm" onClick={() => setAction({ type: 'addSeats', target: toTarget(s), combined: true })}>
              加購／升版
            </button>
          </div>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="GWS 訂閱"
        actions={
          can('subscriptions', 'create') ? (
            <>
              {/* 客戶轉入屬於 GWS 訂閱，不在客戶管理（2026/11/24） */}
              <button className="btn" onClick={() => navigate('/products/gws/transfer-in')}>
                客戶轉入
              </button>
              <button className="btn btn--primary" onClick={() => navigate('/products/gws/new')}>
                <Icon name="plus" size={16} />
                新訂
              </button>
            </>
          ) : undefined
        }
        titleAddon={<PendingTag id={5} hint="PM 想看哪些 GWS 資訊" />}
        description={
          <span className="inline">
            以訂閱為單位，資料由 Google 同步回來；點一列可以看訂閱詳情。{canOperate ? '可以直接在這裡新訂、客戶轉入、續約、加購、中途升版，依類型排程執行或人工執行。' : '你的角色只能查看；需要變更請開立執行單。'}
            <PendingTag id={3} hint="能否抓到已購買版本" />
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
        <Stat
          label="進行中的訂單"
          value={live.filter((s) => s.openOperations.some((o) => o.status !== 'failed')).length}
          unit="筆訂閱"
          tone={live.some((s) => s.openOperations.some((o) => o.status === 'failed')) ? 'danger' : undefined}
          sub={`待人工執行 ${live.filter((s) => s.openOperations.some((o) => o.status === 'pendingManual')).length} 筆 · 失敗 ${live.filter((s) => s.openOperations.some((o) => o.status === 'failed')).length} 筆`}
        />
      </StatGrid>

      <Card bodyless>
        <FilterBar onReset={hasFilter ? () => setParams({}, { replace: true }) : undefined}>
          <SearchField label="關鍵字" value={keyword} onChange={(v) => setParam('q', v)} placeholder="客戶、網域或版本" />
          <SelectField label="經銷商" value={dealerId} onChange={(v) => setParam('dealer', v)} options={(dealers.data ?? []).map((d) => ({ value: d.id, label: d.shortNames[0] ?? d.name }))} />
          <SelectField label="版本" value={plan} onChange={(v) => setParam('plan', v)} options={(plans.data ?? []).map((p) => ({ value: p, label: p }))} />
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
          onRowClick={(s) => navigate(`/products/gws/${s.id}`)}
          loading={result.loading && !result.data}
          empty={<EmptyState title="沒有符合條件的訂閱" />}
        />
      </Card>

      {action && (
        <OperationModal
          open
          type={action.type}
          combined={action.combined}
          target={action.target}
          onClose={() => setAction(null)}
          onSubmitted={(op) => {
            setAction(null);
            setVersion((v) => v + 1);
            setPanelId(op.id);
          }}
        />
      )}
      <OperationPanel
        id={panelId}
        onClose={() => {
          setPanelId(null);
          if (params.get('op')) setParam('op', '');
        }} onChanged={() => setVersion((v) => v + 1)} />
    </>
  );
}
