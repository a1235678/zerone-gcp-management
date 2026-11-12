import { useNavigate, useSearchParams } from 'react-router-dom';
import { getDealerList } from '@data/api';
import { dealerStatusLabel } from '@data/labels';
import type { DealerListItem } from '@data/types';
import { Card } from '@shared/components/Card';
import { DataTable, EmptyState, type Column } from '@shared/components/DataTable';
import { FilterBar, SearchField, SelectField } from '@shared/components/FilterBar';
import { Icon } from '@shared/components/Icon';
import { PageHeader } from '@shared/components/PageHeader';
import { PendingTag } from '@shared/components/PendingTag';
import { formatDate, formatNumber } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { DealerStatusTag } from '../tags';
import { usePermission } from '../auth';

export function DealersPage() {
  const { can } = usePermission();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const keyword = params.get('q') ?? '';
  const status = params.get('status') ?? '';

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const result = useAsync(() => getDealerList({ keyword, status }), [keyword, status]);
  const rows = result.data ?? [];
  const totals = rows.reduce((t, d) => ({ customers: t.customers + d.customerCount, seats: t.seats + d.totalSeats }), { customers: 0, seats: 0 });

  const columns: Column<DealerListItem>[] = [
    {
      key: 'name',
      header: '經銷商',
      render: (d) => (
        <div>
          <div className="table__primary">{d.shortNames[0] ?? d.name}</div>
          <div className="table__secondary">
            <span className="mono">{d.id}</span>
            {d.taxId && <> · 統編 <span className="mono">{d.taxId}</span></>}
          </div>
        </div>
      ),
    },
    {
      key: 'customers',
      header: '名下客戶',
      align: 'right',
      render: (d) => (
        <button
          type="button"
          className="link-button tnum"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/customers?dealer=${d.id}`);
          }}
        >
          {d.customerCount}
        </button>
      ),
    },
    { key: 'seats', header: '總席次', align: 'right', render: (d) => <span className="tnum">{formatNumber(d.totalSeats)}</span> },
    {
      key: 'accounts',
      header: '帳號數',
      align: 'right',
      render: (d) =>
        d.isDirect ? (
          <span className="muted" title="直銷由零壹內部帳號處理">內部</span>
        ) : (
          <button
            type="button"
            className="link-button tnum"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/system/users?orgType=dealer&org=${d.id}`);
            }}
          >
            {d.accountCount}
          </button>
        ),
    },
    { key: 'createdAt', header: '建立日期', render: (d) => <span className="mono">{formatDate(d.createdAt)}</span> },
    { key: 'status', header: '狀態', render: (d) => <DealerStatusTag value={d.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="經銷商管理"
        description="經銷商主檔統一在這裡維護，點一列看詳情。「直銷（零壹）」也列為一個經銷商。總席次為名下客戶 GWS 訂閱（不含已取消）的席次加總。"
        titleAddon={<PendingTag id={29} />}
        actions={
          can('dealers', 'create') ? (
            <button className="btn btn--primary" onClick={() => navigate('/dealers/new')}>
              <Icon name="plus" size={16} />
              新增經銷商
            </button>
          ) : undefined
        }
      />
      <Card bodyless>
        <FilterBar onReset={keyword || status ? () => setParams({}, { replace: true }) : undefined}>
          <SearchField label="關鍵字" value={keyword} onChange={(v) => setParam('q', v)} placeholder="經銷商名稱、ID 或統編" />
          <SelectField
            label="狀態"
            value={status}
            onChange={(v) => setParam('status', v)}
            options={Object.entries(dealerStatusLabel).map(([value, label]) => ({ value, label }))}
          />
        </FilterBar>
        <div className="result-meta">
          <span>
            共 {rows.length} 家 · 客戶 {totals.customers} · 席次 {formatNumber(totals.seats)}
          </span>
        </div>
        <DataTable
          caption="經銷商清單"
          columns={columns}
          rows={rows}
          rowKey={(d) => d.id}
          loading={result.loading && !result.data}
          onRowClick={(d) => navigate(`/dealers/${d.id}`)}
          empty={<EmptyState title="沒有符合條件的經銷商" />}
        />
      </Card>
    </>
  );
}

