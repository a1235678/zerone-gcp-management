import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { cancelSchedule, getSchedules } from '@data/api';
import { scheduleActionLabel, scheduleKindLabel, scheduleStatusLabel } from '@data/labels';
import type { ScheduleAction, ScheduleKind, ScheduleListItem, ScheduleStatus } from '@data/types';
import { Card } from '@shared/components/Card';
import { DataTable, EmptyState, type Column } from '@shared/components/DataTable';
import { DateRangeField, FilterBar, SelectField } from '@shared/components/FilterBar';
import { Icon } from '@shared/components/Icon';
import { Modal } from '@shared/components/Modal';
import { PageHeader } from '@shared/components/PageHeader';
import { PendingTag } from '@shared/components/PendingTag';
import { useToast } from '@shared/components/Toast';
import { downloadCsv } from '@shared/csv';
import { formatDateTime } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { ScheduleStatusTag } from '../tags';
import { usePermission } from '../auth';

const options = <K extends string>(labels: Record<K, string>) => Object.entries(labels).map(([value, label]) => ({ value, label: label as string }));

export function SchedulesPage() {
  const { can } = usePermission();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const kind = (params.get('kind') ?? '') as ScheduleKind | '';
  const action = (params.get('action') ?? '') as ScheduleAction | '';
  const status = (params.get('status') ?? '') as ScheduleStatus | '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const [version, setVersion] = useState(0);
  const [cancelling, setCancelling] = useState<ScheduleListItem | null>(null);

  const setParam = (entries: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(entries)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const result = useAsync(() => getSchedules({ kind, action, status, from, to }), [kind, action, status, from, to, version]);
  const rows = result.data ?? [];
  const hasFilter = Boolean(kind || action || status || from || to);

  const exportCsv = () => {
    const ok = downloadCsv(
      `GWS排程_${new Date().toISOString().slice(0, 10)}.csv`,
      ['排程編號', '排程類型', '執行動作', '排程狀態', '啟用時間', '客戶', '主網域', '經銷商', '內容', '建立人'],
      rows.map((s) => [
        s.id,
        scheduleKindLabel[s.kind],
        scheduleActionLabel[s.action],
        scheduleStatusLabel[s.status],
        s.enabledAt,
        s.customerName,
        s.primaryDomain,
        s.dealerName,
        s.detail,
        s.createdBy,
      ]),
    );
    toast(ok ? `已匯出 ${rows.length} 筆（CSV，可用 Excel 開啟）` : '瀏覽器擋下了下載，請改用一般瀏覽器開啟網站', ok ? 'success' : 'danger');
  };

  const columns: Column<ScheduleListItem>[] = [
    { key: 'id', header: '排程編號', render: (s) => <span className="mono">{s.id}</span> },
    { key: 'kind', header: '排程類型', render: (s) => scheduleKindLabel[s.kind] },
    { key: 'action', header: '執行動作', render: (s) => scheduleActionLabel[s.action] },
    {
      key: 'customer',
      header: '客戶',
      render: (s) => (
        <div>
          <Link to={`/customers/${s.customerId}`} className="table__primary">
            {s.customerName}
          </Link>
          <div className="table__secondary mono">{s.primaryDomain}</div>
        </div>
      ),
    },
    {
      key: 'detail',
      header: '內容',
      render: (s) => (
        <div>
          <div>{s.detail}</div>
          {s.operationId && <div className="table__secondary">來源訂單 <span className="mono">{s.operationId}</span></div>}
        </div>
      ),
    },
    { key: 'enabledAt', header: '啟用時間', render: (s) => <span className="mono">{formatDateTime(s.enabledAt)}</span> },
    { key: 'status', header: '排程狀態', render: (s) => <ScheduleStatusTag value={s.status} /> },
    { key: 'createdBy', header: '建立人', render: (s) => s.createdBy },
    {
      key: 'ops',
      header: <span className="visually-hidden">操作</span>,
      render: (s) =>
        s.status === 'waiting' && can('schedules', 'write') ? (
          <button className="btn btn--sm" onClick={() => setCancelling(s)}>
            取消排程
          </button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="GWS 排程中心"
        titleAddon={
          <>
            <PendingTag id={9} hint="欄位名稱待對照 API" />
            <PendingTag id={7} hint="排程任務是否不做" />
          </>
        }
        description="依啟用時間自動執行的 GWS 變更與同步。新訂、續約（升版或加人）、加購、中途升版選「排程執行」時，會在這裡建立排程。"
        actions={
          <button className="btn" onClick={exportCsv} disabled={!rows.length}>
            <Icon name="download" size={16} />
            匯出 Excel
          </button>
        }
      />
      <Card bodyless>
        <FilterBar onReset={hasFilter ? () => setParams({}, { replace: true }) : undefined}>
          <SelectField label="排程類型" value={kind} onChange={(v) => setParam({ kind: v })} options={options(scheduleKindLabel)} />
          <SelectField label="執行動作" value={action} onChange={(v) => setParam({ action: v })} options={options(scheduleActionLabel)} />
          <SelectField label="排程狀態" value={status} onChange={(v) => setParam({ status: v })} options={options(scheduleStatusLabel)} />
          <DateRangeField label="啟用時間" from={from} to={to} onChange={(f, t) => setParam({ from: f, to: t })} />
        </FilterBar>
        <div className="result-meta">
          <span>{hasFilter ? `符合條件 ${rows.length} 筆` : `共 ${rows.length} 筆`}，依啟用時間排序（新到舊）</span>
        </div>
        <DataTable
          caption="GWS 排程清單"
          columns={columns}
          rows={rows}
          rowKey={(s) => s.id}
          loading={result.loading && !result.data}
          empty={<EmptyState title="沒有符合條件的排程" />}
        />
      </Card>

      <Modal
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="取消排程"
        width={440}
        footer={
          <>
            <button className="btn" onClick={() => setCancelling(null)}>
              不取消
            </button>
            <button
              className="btn btn--danger"
              onClick={async () => {
                if (!cancelling) return;
                await cancelSchedule(cancelling.id);
                toast(`已取消排程 ${cancelling.id}`);
                setCancelling(null);
                setVersion((v) => v + 1);
              }}
            >
              取消排程
            </button>
          </>
        }
      >
        {cancelling && (
          <p>
            <span className="mono">{cancelling.id}</span>：{cancelling.customerName}，{cancelling.detail}（{formatDateTime(cancelling.enabledAt)}）
          </p>
        )}
      </Modal>
    </>
  );
}
