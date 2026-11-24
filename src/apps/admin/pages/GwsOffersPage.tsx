import { getGwsSkus } from '@data/api';
import { billingCycleLabel } from '@data/labels';
import { gwsProductId } from '@data/mock/offers';
import type { GwsSku } from '@data/types';
import { Card } from '@shared/components/Card';
import { DataTable, type Column } from '@shared/components/DataTable';
import { PageHeader } from '@shared/components/PageHeader';
import { StatusTag } from '@shared/components/StatusTag';
import { formatDate, formatUsd } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { OfferPlanTag } from '../components/OfferPicker';

/**
 * 可訂閱方案：後端從 Google 平台撈到的 Google Workspace SKU 與方案（2026/11/24）。
 * 只能查看；新訂、續約、中途升版時由後勤在訂單裡選方案。
 */
export function GwsOffersPage() {
  const skus = useAsync(getGwsSkus);

  const columns: Column<GwsSku>[] = [
    {
      key: 'sku',
      header: 'SKU',
      minWidth: 200,
      render: (s) => (
        <div>
          <div className="table__primary">{s.name}</div>
          <div className="table__secondary mono">{s.skuId}</div>
          <div className="table__secondary">{s.version ? `版本：${s.version}` : '系統還沒有對應的版本'}</div>
        </div>
      ),
    },
    {
      key: 'offers',
      header: '方案',
      render: (s) =>
        s.offers.length === 0 ? (
          <StatusTag tone="neutral">目前沒有可販售的方案</StatusTag>
        ) : (
          <div className="offer-table__offers">
            {s.offers.map((o) => (
              <div className="offer-table__row" key={o.offerId}>
                <span className="inline">
                  <OfferPlanTag offer={o} />
                  {o.availableUntil && <span className="muted">供應至 {formatDate(o.availableUntil)}</span>}
                </span>
                <span className="tnum">
                  {o.minSeats}–{o.maxSeats} 授權
                </span>
                <span>{o.billing ? billingCycleLabel[o.billing] : '—'}</span>
                <span className="tnum">
                  <strong>{formatUsd(o.priceCents)}</strong>
                  <span className="muted"> / 授權</span>
                </span>
                <span className="mono muted" style={{ fontSize: 'var(--text-xs)' }}>
                  {o.offerId}
                </span>
              </div>
            ))}
          </div>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="可訂閱方案"
        description="後端從 Google 平台撈到的 Google Workspace 可訂閱方案（年約、彈性、試用），新訂、續約、中途升版時由後勤選擇。這頁只能查看。"
      />
      <Card
        bodyless
        title={
          <span className="inline">
            Google Workspace <span className="mono muted">{gwsProductId}</span>
          </span>
        }
      >
        <div className="offer-table">
          <DataTable caption="Google Workspace 可訂閱方案" columns={columns} rows={skus.data ?? []} rowKey={(s) => s.skuId} loading={skus.loading && !skus.data} />
        </div>
      </Card>
    </>
  );
}
