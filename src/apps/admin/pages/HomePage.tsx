import { Link } from 'react-router-dom';
import { HOME_EXPIRING_DAYS, daysUntil, getDashboard } from '@data/api';
import { workOrderTypeLabel } from '@data/labels';
import { Card } from '@shared/components/Card';
import { DataTable, EmptyState } from '@shared/components/DataTable';
import { LineChart } from '@shared/components/LineChart';
import { PageHeader } from '@shared/components/PageHeader';
import { PendingTag } from '@shared/components/PendingTag';
import { Stat, StatGrid } from '@shared/components/Stat';
import { formatDate, formatDateTime, formatNumber, formatPct, formatUsd, formatUsdLabel, HIDDEN_PRICE, isPriceVisible } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { usePermission } from '../auth';
import { SubscriptionStatusTag, WorkOrderStatusTag } from '../tags';

/**
 * 首頁先藏起 GCP 與執行單相關的區塊（2026/11/26）：GCP 第一階段不納入、執行單放第二階段。
 * 要顯示時把這兩個開關改成 true 即可，程式都還在。
 */
const SHOW_GCP = false;
const SHOW_WORK_ORDERS = false;

export function HomePage() {
  const { can } = usePermission();
  const dash = useAsync(getDashboard);
  const d = dash.data;
  if (!d) return <p className="muted">載入中…</p>;

  const reviewing = d.orderCounts.salesReview + d.orderCounts.techReview;
  const toProcess = d.orderCounts.approved + d.orderCounts.processing;
  const gwsFailed = d.operationIssues.filter((o) => o.status === 'failed').length;
  // 快到期（90 天內）的合計；客戶已表示不續約的不算（2026/11/27）
  const soon = d.expiringSoon;
  const renewing = soon.filter((s) => !s.renewalCancelled);
  const soonSeats = renewing.reduce((sum, s) => sum + (s.seats ?? 0), 0);
  const soonAmount = renewing.reduce((sum, s) => sum + (s.lastOrder?.amountCents ?? 0), 0);
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
          label={`${HOME_EXPIRING_DAYS} 天內到期`}
          value={soon.length}
          unit="筆"
          tone={soon.length ? 'warning' : undefined}
          sub={soon.length > renewing.length ? `其中 ${soon.length - renewing.length} 筆客戶表示不續約` : '依到期日列在下方'}
        />
        <Stat label="快到期席次" value={formatNumber(soonSeats)} unit="席" sub={`${HOME_EXPIRING_DAYS} 天內到期的目前席次合計（不含不續約）`} />
        <Stat label="快到期金額" value={formatUsdLabel(soonAmount, 0)} sub="上次向原廠下單的金額合計（不含不續約）" />
        {SHOW_WORK_ORDERS && (
        <Stat
          label="執行單"
          value={toProcess}
          unit="張待後勤處理"
          sub={
            <Link to="/work-orders">
              另有 {reviewing} 張簽核中、{d.orderCounts.returned} 張退回
            </Link>
          }
        />
        )}
        <Stat
          label="Google 處理中"
          value={d.operationIssues.length}
          unit="筆"
          tone={gwsFailed ? 'danger' : undefined}
          sub={gwsFailed ? <span className="text-danger">其中失敗 {gwsFailed} 筆，請到 GWS 訂閱或客戶詳情處理</span> : '沒有失敗的操作'}
        />
        {SHOW_GCP && can('gcpUsage') && <Stat label="GCP 近 30 天費用" value={formatUsd(d.gcp.totalCostCents, 0)} unit="USD" sub={<>較前期 {formatPct(gcpChange)}</>} />}
      </StatGrid>

      <div className="stack">
        <div className={SHOW_WORK_ORDERS ? 'split split--even' : undefined}>
          <Card
            title="到期訂閱"
            bodyless
            actions={
              <Link to="/products/gws" style={{ fontSize: 'var(--text-sm)' }}>
                全部訂閱
              </Link>
            }
          >
            <p className="card-note">{HOME_EXPIRING_DAYS} 天內到期，依到期日排序。「上次購買」是上次向原廠（Google）新訂或續約的席次與金額，之後加購的不算。</p>
            <DataTable
              caption="快到期的訂閱"
              rows={soon}
              rowKey={(s) => s.id}
              columns={[
                {
                  key: 'customer',
                  header: '客戶',
                  render: (s) => (
                    <div>
                      <Link to={`/products/gws/${s.id}`} className="table__primary">
                        {s.customerName}
                      </Link>
                      <div className="table__secondary mono">{s.primaryDomain}</div>
                    </div>
                  ),
                },
                { key: 'plan', header: '版本', render: (s) => <span>{s.plan}<div className="table__secondary">{s.dealerName}</div></span> },
                {
                  key: 'expires',
                  header: '到期日',
                  render: (s) => (
                    <span className="mono">
                      {formatDate(s.expiresAt)}
                      <div className="table__secondary">剩 {daysUntil(s.expiresAt)} 天</div>
                    </span>
                  ),
                },
                { key: 'seats', header: '目前席次', align: 'right', render: (s) => <span className="mono">{formatNumber(s.seats ?? 0)}</span> },
                { key: 'lastSeats', header: '上次購買席次', align: 'right', render: (s) => <span className="mono">{s.lastOrder ? formatNumber(s.lastOrder.seats) : '—'}</span> },
                {
                  key: 'lastAmount',
                  header: '上次原廠下單金額',
                  align: 'right',
                  render: (s) => (
                    <span className="mono">
                      {s.lastOrder ? formatUsdLabel(s.lastOrder.amountCents, 0) : '—'}
                      {s.lastOrder && <div className="table__secondary">{s.term === 'flexible' ? '彈性・一個月' : '年約・一年'}</div>}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  header: '狀態',
                  render: (s) => (
                    <span>
                      <SubscriptionStatusTag value={s.status} />
                      {s.renewalCancelled && <div className="table__secondary">不續約</div>}
                    </span>
                  ),
                },
              ]}
              empty={<EmptyState title={`${HOME_EXPIRING_DAYS} 天內沒有到期的訂閱`} />}
            />
          </Card>

          {SHOW_WORK_ORDERS && (
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
              {(['salesReview', 'techReview', 'approved', 'processing', 'returned'] as const).map((s) => (
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
          )}
        </div>

        {SHOW_GCP && can('gcpUsage') && (
        <Card
          title="GCP 用量摘要"
          actions={
            <Link to="/products/gcp/usage" style={{ fontSize: 'var(--text-sm)' }}>
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
              formatAxis={(v) => (isPriceVisible() ? `$${formatNumber(Math.round(v / 100))}` : HIDDEN_PRICE)}
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
        )}
      </div>
    </>
  );
}
