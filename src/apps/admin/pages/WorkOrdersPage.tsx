import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getDealers, getWorkOrders } from '@data/api';
import { workOrderStatusLabel, workOrderTypeLabel } from '@data/labels';
import type { WorkOrderListItem, WorkOrderStatus, WorkOrderType } from '@data/types';
import { Card } from '@shared/components/Card';
import { DataTable, EmptyState, type Column } from '@shared/components/DataTable';
import { FilterBar, SearchField, SelectField } from '@shared/components/FilterBar';
import { Icon } from '@shared/components/Icon';
import { PageHeader } from '@shared/components/PageHeader';
import { Pagination, paginate } from '@shared/components/Pagination';
import { PendingTag } from '@shared/components/PendingTag';
import { formatDateTime } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { WorkOrderModal } from '../components/WorkOrderModal';
import { WorkOrderStatusTag } from '../tags';

const PAGE_SIZE = 15;

const columns: Column<WorkOrderListItem>[] = [
  { key: 'id', header: '單號', render: (w) => <span className="mono table__primary">{w.id}</span> },
  { key: 'type', header: '類型', render: (w) => workOrderTypeLabel[w.type] },
  {
    key: 'customer',
    header: '客戶',
    render: (w) => (
      <div>
        <div>{w.customerName}</div>
        <div className="table__secondary mono">{w.primaryDomain}</div>
      </div>
    ),
  },
  { key: 'dealer', header: '經銷商', render: (w) => w.dealerName },
  { key: 'summary', header: '內容', render: (w) => w.summary },
  {
    key: 'status',
    header: '狀態',
    render: (w) => (
      <div>
        <WorkOrderStatusTag value={w.status} />
        {w.status === 'failed' && <div className="table__secondary text-danger">{w.failureReason}</div>}
      </div>
    ),
  },
  { key: 'createdBy', header: '建立人', render: (w) => w.createdBy },
  { key: 'createdAt', header: '建立時間', render: (w) => <span className="mono">{formatDateTime(w.createdAt)}</span> },
];

const statusOrder: WorkOrderStatus[] = ['draft', 'pending', 'submitted', 'failed', 'completed'];

export function WorkOrdersPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const keyword = params.get('q') ?? '';
  const type = (params.get('type') ?? '') as WorkOrderType | '';
  const status = (params.get('status') ?? '') as WorkOrderStatus | '';
  const dealerId = params.get('dealer') ?? '';
  const page = Number(params.get('page') ?? '1');
  const [newOpen, setNewOpen] = useState(false);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const dealers = useAsync(getDealers);
  const all = useAsync(() => getWorkOrders(), []);
  const result = useAsync(() => getWorkOrders({ keyword, type, status, dealerId }), [keyword, type, status, dealerId]);
  const rows = result.data ?? [];
  const { pageRows, pageCount, page: safePage } = paginate(rows, page, PAGE_SIZE);
  const hasFilter = Boolean(keyword || type || status || dealerId);

  const count = (s: WorkOrderStatus) => all.data?.filter((w) => w.status === s).length ?? 0;

  return (
    <>
      <PageHeader
        title="執行單"
        titleAddon={<PendingTag id={6} hint="是否列入第一階段上線" />}
        description="開立後依序：草稿 → 待確認 → 已送出 Google → 完成；失敗可以重送。續約、調整席次、取消訂閱請從「產品 › GWS」的訂閱開立，客戶轉移從客戶詳情開立。"
        actions={
          <button className="btn btn--primary" onClick={() => setNewOpen(true)}>
            <Icon name="plus" size={16} />
            開立新訂閱
          </button>
        }
      />

      <div className="status-strip" role="group" aria-label="依狀態快速篩選">
        {statusOrder.map((s) => (
          <button
            key={s}
            type="button"
            className={`status-strip__item ${status === s ? 'is-active' : ''}`}
            aria-pressed={status === s}
            onClick={() => setParam('status', status === s ? '' : s)}
          >
            <WorkOrderStatusTag value={s} />
            <span className="status-strip__count tnum">{count(s)}</span>
          </button>
        ))}
      </div>

      <Card bodyless>
        <FilterBar onReset={hasFilter ? () => setParams({}, { replace: true }) : undefined}>
          <SearchField label="關鍵字" value={keyword} onChange={(v) => setParam('q', v)} placeholder="單號、客戶、網域或內容" />
          <SelectField
            label="類型"
            value={type}
            onChange={(v) => setParam('type', v)}
            options={Object.entries(workOrderTypeLabel).map(([value, label]) => ({ value, label }))}
          />
          <SelectField
            label="狀態"
            value={status}
            onChange={(v) => setParam('status', v)}
            options={statusOrder.map((s) => ({ value: s, label: workOrderStatusLabel[s] }))}
          />
          <SelectField
            label="經銷商"
            value={dealerId}
            onChange={(v) => setParam('dealer', v)}
            options={(dealers.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
          />
        </FilterBar>
        <div className="result-meta">
          <span>{hasFilter ? `符合條件 ${rows.length} 筆` : `共 ${rows.length} 筆`}</span>
          <Pagination page={safePage} pageCount={pageCount} onChange={(p) => setParam('page', String(p))} />
        </div>
        <DataTable
          caption="執行單清單"
          columns={columns}
          rows={pageRows}
          rowKey={(w) => w.id}
          loading={result.loading && !result.data}
          onRowClick={(w) => navigate(`/work-orders/${w.id}`)}
          empty={<EmptyState title="沒有符合條件的執行單" />}
        />
      </Card>

      <WorkOrderModal
        open={newOpen}
        type="new"
        onClose={() => setNewOpen(false)}
        onCreated={(wo) => {
          setNewOpen(false);
          navigate(`/work-orders/${wo.id}`);
        }}
      />
    </>
  );
}
