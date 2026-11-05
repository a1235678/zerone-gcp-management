import { Link } from 'react-router-dom';
import { EXPIRING_DAYS, daysUntil, getDashboard } from '@data/api';
import { workOrderTypeLabel } from '@data/labels';
import { Card } from '@shared/components/Card';
import { LineChart } from '@shared/components/LineChart';
import { PageHeader } from '@shared/components/PageHeader';
import { PendingTag } from '@shared/components/PendingTag';
import { Stat, StatGrid } from '@shared/components/Stat';
import { formatDate, formatDateTime, formatNumber, formatPct, formatUsd } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { SubscriptionStatusTag, WorkOrderStatusTag } from '../tags';

export function HomePage() {
  const dash = useAsync(getDashboard);
  const d = dash.data;
  if (!d) return <p className="muted">載入中…</p>;

  const open = d.orderCounts.draft + d.orderCounts.pending + d.orderCounts.submitted;
  const gcpChange = Math.round(((d.gcp.totalCostCents - d.gcp.prevTotalCostCents) / d.gcp.prevTotalCostCents) * 1000) / 10;

  return (
    <>
      <PageHeader
        title="首頁"
        titleAddon={<PendingTag hint="版面細節再討論" />}
        description={`以 ${formatDate('2026-11-05')} 為基準。`}
      />

      <StatGrid>
        <Stat label="啟用客戶" value={d.activeCustomers} unit="個" sub={<Link to="/customers">共 {d.totalCustomers} 個客戶</Link>} />
        <Stat label="GWS 總席次" value={formatNumber(d.totalSeats)} unit="席" sub={<Link to="/products/gws">{d.liveSubscriptions} 筆有效訂閱</Link>} />
        <Stat
          label={`${EXPIRING_DAYS} 天內到期`}
          value={d.expiring.length}
          unit="筆"
          tone={d.expiring.length ? 'warning' : undefined}
          sub={<Link to="/products/gws?status=expiring">查看即將到期</Link>}
        />
        <Stat
          label="處理中的執行單"
          value={open}
          unit="張"
          tone={d.orderCounts.failed ? 'danger' : undefined}
          sub={
            d.orderCounts.failed ? (
              <Link to="/work-orders?status=failed" className="text-danger">
                另有失敗 {d.orderCounts.failed} 張待重送
              </Link>
            ) : (
              '沒有失敗的執行單'
            )
          }
        />
        <Stat label="GCP 近 30 天費用" value={formatUsd(d.gcp.totalCostCents, 0)} unit="USD" sub={<>較前期 {formatPct(gcpChange)}</>} />
      </StatGrid>

      <div className="stack">
        <div className="split split--even">
          <Card
            title="到期訂閱"
            bodyless
            actions={
              <Link to="/products/gws" style={{ fontSize: 'var(--text-sm)' }}>
                全部訂閱
              </Link>
            }
          >
            <p className="card-note">60 天內到期，依到期日排序</p>
            <ul className="list-plain">
              {d.expiringWithin60.map((s) => {
                const left = daysUntil(s.expiresAt);
                return (
                  <li key={s.id}>
                    <div style={{ minWidth: 0 }}>
                      <Link to={`/customers/${s.customerId}`} className="table__primary">
                        {s.customerName}
                      </Link>
                      <div className="table__secondary">
                        {s.plan} · {s.seats} 席 · {s.dealerName}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <SubscriptionStatusTag value={s.status} />
                      <div className="table__secondary mono">
                        {formatDate(s.expiresAt)} · 剩 {left} 天
                      </div>
                    </div>
                  </li>
                );
              })}
              {d.expiringWithin60.length === 0 && <li className="muted">60 天內沒有到期的訂閱</li>}
            </ul>
          </Card>

          <Card
            title="近期執行單"
            bodyless
            actions={
              <Link to="/work-orders" style={{ fontSize: 'var(--text-sm)' }}>
                全部執行單
              </Link>
            }
          >
            <div className="mini-counts" aria-label="執行單狀態統計">
              {(['draft', 'pending', 'submitted', 'failed', 'completed'] as const).map((s) => (
                <Link key={s} to={`/work-orders?status=${s}`} className="mini-counts__item">
                  <WorkOrderStatusTag value={s} />
                  <span className="tnum">{d.orderCounts[s]}</span>
                </Link>
              ))}
            </div>
            <ul className="list-plain">
              {d.recentOrders.map((w) => (
                <li key={w.id}>
                  <div style={{ minWidth: 0 }}>
                    <Link to={`/work-orders/${w.id}`} className="mono">
                      {w.id}
                    </Link>
                    <span className="muted"> · {workOrderTypeLabel[w.type]}</span>
                    <div className="table__secondary">
                      {w.customerName} · {w.summary}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <WorkOrderStatusTag value={w.status} />
                    <div className="table__secondary mono">{formatDateTime(w.updatedAt).slice(5)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card
          title="GCP 用量摘要"
          actions={
            <Link to="/products/gcp" style={{ fontSize: 'var(--text-sm)' }}>
              查看明細
            </Link>
          }
        >
          <div className="split">
            <LineChart
              height={200}
              ariaLabel="近 30 天每日 GCP 費用"
              data={d.gcp.daily.map((x) => ({ label: x.date, value: x.costCents }))}
              formatValue={(v) => `${formatUsd(v)} USD`}
              formatAxis={(v) => `$${formatNumber(Math.round(v / 100))}`}
              formatLabel={(x) => x.slice(5).replace('-', '/')}
            />
            <div>
              <div className="form-field__label" style={{ marginBottom: 'var(--space-2)' }}>
                費用前 3 名客戶
              </div>
              <ol className="rank-list">
                {d.gcp.rows.slice(0, 3).map((r) => (
                  <li key={r.customerId}>
                    <Link to={`/customers/${r.customerId}`}>{r.customerName}</Link>
                    <span className="tnum">{formatUsd(r.costCents, 0)}</span>
                  </li>
                ))}
              </ol>
              <p className="muted" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-3)' }}>
                {d.gcp.rows.length} 個客戶 · {d.gcp.totalProjects} 個專案 · 網路輸出 {formatNumber(d.gcp.totalEgressGb)} GB
              </p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
