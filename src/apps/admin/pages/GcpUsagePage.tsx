import { Link } from 'react-router-dom';
import { getGcpUsage } from '@data/api';
import type { GcpUsageRow } from '@data/types';
import { Card } from '@shared/components/Card';
import { DataTable, type Column } from '@shared/components/DataTable';
import { LineChart } from '@shared/components/LineChart';
import { PageHeader } from '@shared/components/PageHeader';
import { PendingTag } from '@shared/components/PendingTag';
import { Stat, StatGrid } from '@shared/components/Stat';
import { formatDate, formatNumber, formatPct, formatUsd } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';

const Change = ({ pct }: { pct: number }) => (
  <span className={`tnum ${pct > 10 ? 'text-warning' : ''}`} title="較前 30 天">
    {pct > 0 ? '▲' : pct < 0 ? '▼' : '–'} {formatPct(pct)}
  </span>
);

export function GcpUsagePage() {
  const usage = useAsync(getGcpUsage);
  const u = usage.data;

  if (!u) return <p className="muted">載入中…</p>;

  const totalChange = Math.round(((u.totalCostCents - u.prevTotalCostCents) / u.prevTotalCostCents) * 1000) / 10;
  const max = Math.max(...u.rows.map((r) => r.costCents));

  const columns: Column<GcpUsageRow>[] = [
    {
      key: 'customer',
      header: '客戶',
      render: (r) => (
        <div>
          <Link to={`/customers/${r.customerId}`} className="table__primary">
            {r.customerName}
          </Link>
          <div className="table__secondary">{r.dealerName}</div>
        </div>
      ),
    },
    { key: 'projects', header: '專案數', align: 'right', render: (r) => <span className="tnum">{r.projects}</span> },
    { key: 'cost', header: '費用（USD）', align: 'right', render: (r) => <span className="tnum">{formatUsd(r.costCents)}</span> },
    {
      key: 'share',
      header: '佔比',
      render: (r) => (
        <div className="inline" style={{ flexWrap: 'nowrap' }}>
          <div className="bar" style={{ width: 120 }} aria-hidden="true">
            <div className="bar__fill" style={{ width: `${(r.costCents / max) * 100}%` }} />
          </div>
          <span className="tnum muted" style={{ minWidth: 44, textAlign: 'right' }}>
            {((r.costCents / u.totalCostCents) * 100).toFixed(1)}%
          </span>
        </div>
      ),
    },
    { key: 'egress', header: '網路輸出（GB）', align: 'right', render: (r) => <span className="tnum">{formatNumber(r.egressGb)}</span> },
    { key: 'change', header: '較前期', align: 'right', render: (r) => <Change pct={r.changePct} /> },
  ];

  return (
    <>
      <PageHeader
        title="GCP 流量與用量"
        titleAddon={
          <>
            <PendingTag hint="第一階段不納入，保留供討論" />
            <PendingTag hint="資料來源預計為 GCP Billing 匯出，待 Terry 確認" />
          </>
        }
        description={
          <>
            統計期間 <span className="mono">{formatDate(u.periodStart)}</span> 至 <span className="mono">{formatDate(u.periodEnd)}</span>（近 30 天）。
          </>
        }
      />

      <StatGrid>
        <Stat label="近 30 天費用" value={formatUsd(u.totalCostCents, 0)} unit="USD" sub={<>較前 30 天 <Change pct={totalChange} /></>} />
        <Stat label="網路輸出" value={formatNumber(u.totalEgressGb)} unit="GB" sub="近 30 天合計" />
        <Stat label="專案數" value={u.totalProjects} unit="個" sub={`${u.rows.length} 個客戶`} />
        <Stat label="平均每日費用" value={formatUsd(Math.round(u.totalCostCents / u.daily.length), 0)} unit="USD" sub="近 30 天" />
      </StatGrid>

      <div className="stack">
        <Card title="每日費用（USD）">
          <LineChart
            ariaLabel={`近 30 天每日 GCP 費用，合計 ${formatUsd(u.totalCostCents)}`}
            data={u.daily.map((d) => ({ label: d.date, value: d.costCents }))}
            formatValue={(v) => `${formatUsd(v)} USD`}
            formatAxis={(v) => `$${formatNumber(Math.round(v / 100))}`}
            formatLabel={(d) => d.slice(5).replace('-', '/')}
          />
        </Card>

        <Card title="各客戶用量" bodyless actions={<span className="muted" style={{ fontSize: 'var(--text-sm)' }}>依費用排序</span>}>
          <DataTable caption="各客戶 GCP 用量" columns={columns} rows={u.rows} rowKey={(r) => r.customerId} />
          <div className="table-total">
            <span>合計 {u.rows.length} 個客戶</span>
            <span className="tnum">
              {u.totalProjects} 個專案 · {formatUsd(u.totalCostCents)} USD · {formatNumber(u.totalEgressGb)} GB
            </span>
          </div>
        </Card>
      </div>
    </>
  );
}
