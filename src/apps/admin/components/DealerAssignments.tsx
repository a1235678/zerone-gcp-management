import { getBrandProducts, getDealers } from '@data/api';
import type { Dealer, DealerAssignment, ProductCode } from '@data/types';
import { DataTable, EmptyState } from '@shared/components/DataTable';
import { Icon } from '@shared/components/Icon';
import { useAsync } from '@shared/hooks/useAsync';
import { Link } from 'react-router-dom';

/** 合約欄位的名稱：GWS 是網域，GCP 是 Billing Account */
export const contractLabel = (product: ProductCode) => (product === 'GCP' ? 'Billing Account' : '網域');

/**
 * 客戶的經銷商（2026/11/27）：依品牌／產品／合約列出經銷商，同一個客戶可以向不同經銷商買不同合約。
 * 業務綁在經銷商，所以這裡一起帶出該經銷商的新約、續約業務。
 */
export function DealerAssignmentTable({ rows, empty = '尚未指定經銷商' }: { rows: DealerAssignment[]; empty?: string }) {
  const dealers = useAsync(getDealers);
  const dealerOf = (id: string) => dealers.data?.find((d) => d.id === id);
  const salesOf = (d: Dealer | undefined, product: ProductCode, term: 'new' | 'renewal') =>
    (d?.salesAssignments ?? []).filter((a) => a.product === product && a.term === term).map((a) => a.salesName);
  return (
    <DataTable
      caption="經銷商"
      rows={rows}
      rowKey={(a) => `${a.brand}-${a.product}-${a.contract}-${a.dealerId}`}
      columns={[
        { key: 'brand', header: '品牌', render: (a) => a.brand },
        { key: 'product', header: '產品', render: (a) => a.product },
        {
          key: 'contract',
          header: '合約',
          render: (a) => (
            <span>
              <span className="table__secondary">{contractLabel(a.product)}</span>
              <br />
              {a.contract ? <span className="mono">{a.contract}</span> : <span className="muted">尚未填（GWS 新訂後補上）</span>}
            </span>
          ),
        },
        {
          key: 'dealer',
          header: '經銷商',
          render: (a) => {
            const d = dealerOf(a.dealerId);
            if (!d) return '—';
            return (
              <span>
                <Link to={`/dealers/${d.id}`}>{d.shortNames[0] ?? d.name}</Link>
                {d.partnerId && (
                  <>
                    <br />
                    <span className="mono table__secondary">{d.partnerId}</span>
                  </>
                )}
              </span>
            );
          },
        },
        {
          key: 'sales',
          header: '業務（經銷商設定）',
          render: (a) => {
            const d = dealerOf(a.dealerId);
            const n = salesOf(d, a.product, 'new');
            const r = salesOf(d, a.product, 'renewal');
            return (
              <span style={{ fontSize: 'var(--text-sm)' }}>
                新約 {n.join('、') || '—'}
                <br />
                續約 {r.join('、') || '—'}
              </span>
            );
          },
        },
      ]}
      empty={<EmptyState title={empty} />}
    />
  );
}

/** 客戶的經銷商編輯：一列一個合約，可以新增、移除 */
export function DealerAssignmentEditor({
  value,
  onChange,
  domains,
}: {
  value: DealerAssignment[];
  onChange: (v: DealerAssignment[]) => void;
  /** 這個客戶的網域，GWS 的合約可以直接選 */
  domains: string[];
}) {
  const options = useAsync(getBrandProducts);
  const dealers = useAsync(getDealers);
  const brands = [...new Set((options.data ?? []).map((o) => o.brand))];
  const productsOf = (brand: string) => (options.data ?? []).filter((o) => o.brand === brand).map((o) => o.product);
  const update = (i: number, patch: Partial<DealerAssignment>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const add = () => onChange([...value, { brand: brands[0] ?? 'Google', product: 'GWS', contract: '', dealerId: '' }]);
  const listId = 'dealer-assign-domains';

  return (
    <div className="sales-editor">
      <datalist id={listId}>
        {domains.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
      {value.length > 0 && (
        <div className="sales-editor__head dealer-assign__head" aria-hidden="true">
          <span>品牌</span>
          <span>產品</span>
          <span>合約（GWS 網域／GCP Billing Account）</span>
          <span>經銷商</span>
          <span />
        </div>
      )}
      {value.map((r, i) => (
        <div className="sales-editor__row dealer-assign__row" key={i} role="group" aria-label={`經銷商第 ${i + 1} 列`}>
          <select className="select" aria-label="品牌" value={r.brand} onChange={(e) => update(i, { brand: e.target.value, product: productsOf(e.target.value)[0] ?? r.product })}>
            {brands.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <select className="select" aria-label="產品" value={r.product} onChange={(e) => update(i, { product: e.target.value as ProductCode, contract: '' })}>
            {productsOf(r.brand).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <input
            className="input mono"
            aria-label={contractLabel(r.product)}
            list={r.product === 'GWS' ? listId : undefined}
            placeholder={r.product === 'GCP' ? 'XXXXXX-XXXXXX-XXXXXX' : '例如 example.com'}
            spellCheck={false}
            autoCapitalize="off"
            value={r.contract}
            onChange={(e) => update(i, { contract: e.target.value })}
          />
          <select className="select" aria-label="經銷商" value={r.dealerId} onChange={(e) => update(i, { dealerId: e.target.value })}>
            <option value="">請選擇經銷商</option>
            {(dealers.data ?? [])
              .filter((d) => d.status === 'active' || d.id === r.dealerId)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.shortNames[0] ?? d.name}
                  {d.partnerId ? `（${d.partnerId}）` : ''}
                </option>
              ))}
          </select>
          <button type="button" className="btn btn--ghost btn--icon" aria-label="移除這一列" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn--sm" onClick={add}>
        <Icon name="plus" size={14} />
        新增一個合約
      </button>
      <p className="muted" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
        同一個客戶可以向不同經銷商買不同合約：GWS 依網域、GCP 依 Billing Account 指定經銷商。負責業務在經銷商主檔設定。
      </p>
    </div>
  );
}
