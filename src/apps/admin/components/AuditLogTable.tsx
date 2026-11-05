import { logCategoryLabel } from '@data/labels';
import type { AuditLog } from '@data/types';
import { DataTable, EmptyState, type Column } from '@shared/components/DataTable';
import { formatDateTime } from '@shared/format';
import { LogResultTag } from '../tags';

const columns: Column<AuditLog>[] = [
  { key: 'at', header: '時間', render: (l) => <span className="mono">{formatDateTime(l.at)}</span> },
  {
    key: 'actor',
    header: '操作人',
    render: (l) => (
      <div>
        <div>{l.actor}</div>
        <div className="table__secondary">{l.actorRole}</div>
      </div>
    ),
  },
  { key: 'category', header: '類型', render: (l) => logCategoryLabel[l.category] },
  { key: 'target', header: '對象', render: (l) => <span className={/[a-z0-9.-]+\.[a-z]+$|^WO-|@/.test(l.target) ? 'mono' : undefined}>{l.target}</span> },
  { key: 'action', header: '動作', minWidth: 260, render: (l) => <span style={{ whiteSpace: 'normal', display: 'block', minWidth: 260 }}>{l.action}</span> },
  { key: 'result', header: '結果', render: (l) => <LogResultTag value={l.result} /> },
];

export function AuditLogTable({ rows, loading }: { rows: AuditLog[]; loading?: boolean; }) {
  return (
    <DataTable
      caption="操作紀錄"
      columns={columns}
      rows={rows}
      rowKey={(l) => l.id}
      loading={loading}
      empty={<EmptyState title="沒有操作紀錄" />}
    />
  );
}
