import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getDealers, getWorkOrders } from '@data/api';
import { workOrderStatusLabel, workOrderTypeLabel } from '@data/labels';
import type { WorkOrderListItem, WorkOrderStatus, WorkOrderType } from '@data/types';
import { Card } from '@shared/components/Card';
import { DataTable, EmptyState, type Column } from '@shared/components/DataTable';
import { FilterBar, SearchField, SelectField } from '@shared/components/FilterBar';
import { Icon } from '@shared/components/Icon';
import { PageHeader } from '@shared/components/PageHeader';
import { Pagination, paginate } from '@shared/components/Pagination';
import { StatusTag } from '@shared/components/StatusTag';
import { formatDateTime } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { WorkOrderStatusTag } from '../tags';
import { usePermission } from '../auth';

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
        {w.operation?.status === 'failed' && <div className="table__secondary text-danger">Google 失敗：{w.operation.failureReason}</div>}
        {w.operation?.status === 'manual' && <div className="table__secondary text-warning">手動處理，待同步確認</div>}
        {w.status === 'returned' && <div className="table__secondary text-danger">退回：{w.returnReason}</div>}
      </div>
    ),
  },
  { key: 'createdBy', header: '開單人', render: (w) => w.createdBy },
  { key: 'createdAt', header: '開單時間', render: (w) => <span className="mono">{formatDateTime(w.createdAt)}</span> },
];

const statusOrder: WorkOrderStatus[] = ['draft', 'returned', 'salesReview', 'techReview', 'approved', 'processing', 'completed'];

export function WorkOrdersPage() {
  const { can } = usePermission();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const keyword = params.get('q') ?? '';
  const type = (params.get('type') ?? '') as WorkOrderType | '';
  const status = (params.get('status') ?? '') as WorkOrderStatus | '';
  const dealerId = params.get('dealer') ?? '';
  const page = Number(params.get('page') ?? '1');

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
        titleAddon={<StatusTag tone="neutral">第二階段</StatusTag>}
        description="業務接到客戶需求後開立，依序由業務主管、技術主管簽核，核准後由後勤處理。後勤也可以不經執行單，直接在「產品 › GWS」操作訂閱。"
        actions={
          can('workOrders', 'create') ? (
            <Link to="/work-orders/new" className="btn btn--primary">
              <Icon name="plus" size={16} />
              開立執行單
            </Link>
          ) : undefined
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
            options={(dealers.data ?? []).map((d) => ({ value: d.id, label: d.shortNames[0] ?? d.name }))}
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

    </>
  );
}
