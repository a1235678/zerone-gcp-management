import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getCustomers, getDealers } from '@data/api';
import type { CustomerListItem, CustomerStatus } from '@data/types';
import { Card } from '@shared/components/Card';
import { DataTable, EmptyState, type Column } from '@shared/components/DataTable';
import { FilterBar, SearchField, SelectField } from '@shared/components/FilterBar';
import { Icon } from '@shared/components/Icon';
import { PageHeader } from '@shared/components/PageHeader';
import { Pagination, paginate } from '@shared/components/Pagination';
import { PendingTag } from '@shared/components/PendingTag';
import { CustomerStatusTag } from "../tags";
import { formatDate } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';

const PAGE_SIZE = 12;


const columns: Column<CustomerListItem>[] = [
  {
    key: 'name',
    header: '客戶名稱',
    minWidth: 200,
    render: (c) => (
      <div>
        <div className="table__primary">{c.name}</div>
        <div className="table__secondary mono">{c.id}</div>
      </div>
    ),
  },
  { key: 'taxId', header: '統一編號', render: (c) => <span className="mono">{c.taxId}</span> },
  { key: 'domain', header: '主網域', render: (c) => <span className="mono">{c.primaryDomain}</span> },
  { key: 'dealer', header: '經銷商', render: (c) => c.dealerName },
  {
    key: 'contact',
    header: '聯絡人',
    render: (c) => (
      <div>
        <div>{c.contactName}</div>
        <div className="table__secondary mono">{c.contactEmail}</div>
      </div>
    ),
  },
  { key: 'createdAt', header: '建立日期', render: (c) => <span className="mono">{formatDate(c.createdAt)}</span> },
  {
    key: 'status',
    header: '客戶狀態',
    render: (c) => <CustomerStatusTag value={c.status} />,
  },
];

export function CustomersPage() {
  const navigate = useNavigate();
  // 篩選條件放在網址上，從客戶詳情返回時會保留
  const [params, setParams] = useSearchParams();
  const keyword = params.get('q') ?? '';
  const dealerId = params.get('dealer') ?? '';
  const status = (params.get('status') ?? '') as CustomerStatus | '';
  const page = Number(params.get('page') ?? '1');

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const dealers = useAsync(getDealers);
  const all = useAsync(() => getCustomers(), []);
  const result = useAsync(() => getCustomers({ keyword, dealerId, status }), [keyword, dealerId, status]);

  const rows = result.data ?? [];
  const { pageRows, pageCount, page: safePage } = paginate(rows, page, PAGE_SIZE);
  const hasFilter = Boolean(keyword || dealerId || status);

  const counts = useMemo(() => {
    const list = all.data ?? [];
    return { total: list.length, active: list.filter((c) => c.status === 'active').length };
  }, [all.data]);

  return (
    <>
      <PageHeader
        title="客戶管理"
        description={
          all.data ? (
            <>
              共 {counts.total} 位客戶，啟用 {counts.active}、停用 {counts.total - counts.active}。訂閱資訊（方案、席次、到期日）請至「產品」各頁查看。
            </>
          ) : (
            '載入中…'
          )
        }
        actions={
          <>
            <PendingTag id={1} hint="客戶由誰建立" />
            <Link to="/customers/new" className="btn btn--primary">
              <Icon name="plus" size={16} />
              新增客戶
            </Link>
          </>
        }
      />

      <Card bodyless>
        <FilterBar onReset={hasFilter ? () => setParams({}, { replace: true }) : undefined}>
          <SearchField label="關鍵字" value={keyword} onChange={(v) => setParam('q', v)} placeholder="客戶名稱、網域、統一編號或聯絡人" />
          <SelectField
            label="經銷商"
            value={dealerId}
            onChange={(v) => setParam('dealer', v)}
            options={(dealers.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
          />
          <SelectField
            label="客戶狀態"
            value={status}
            onChange={(v) => setParam('status', v)}
            options={[
              { value: 'active', label: '啟用' },
              { value: 'disabled', label: '停用' },
            ]}
          />
        </FilterBar>

        <div className="result-meta">
          <span>{result.loading ? '查詢中…' : hasFilter ? `符合條件 ${rows.length} 筆` : `共 ${rows.length} 筆`}</span>
          <Pagination page={safePage} pageCount={pageCount} onChange={(p) => setParam('page', String(p))} />
        </div>

        <DataTable
          caption="客戶清單"
          columns={columns}
          rows={pageRows}
          rowKey={(c) => c.id}
          loading={result.loading && !result.data}
          onRowClick={(c) => navigate(`/customers/${c.id}`)}
          empty={<EmptyState title="沒有符合條件的客戶" description="請調整關鍵字或篩選條件。" />}
        />
      </Card>
    </>
  );
}
