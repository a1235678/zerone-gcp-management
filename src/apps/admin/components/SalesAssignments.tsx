import { getBrandProducts, getSalesPeople } from '@data/api';
import type { ProductCode, SalesAssignment } from '@data/types';
import { DataTable, EmptyState } from '@shared/components/DataTable';
import { Icon } from '@shared/components/Icon';
import { useAsync } from '@shared/hooks/useAsync';

/** 依「品牌 + 產品」整理成一列：新約、續約各自列出業務，多位用頓號隔開；沒設定的產品不顯示 */
export function groupSalesAssignments(rows: SalesAssignment[]) {
  const map = new Map<string, { brand: string; product: ProductCode; newSales: string[]; renewalSales: string[] }>();
  for (const a of rows) {
    const k = `${a.brand}-${a.product}`;
    const g = map.get(k) ?? { brand: a.brand, product: a.product, newSales: [], renewalSales: [] };
    const list = a.term === 'new' ? g.newSales : g.renewalSales;
    if (!list.includes(a.salesName)) list.push(a.salesName);
    map.set(k, g);
  }
  return [...map.values()].sort((a, b) => a.brand.localeCompare(b.brand) || a.product.localeCompare(b.product));
}

/** 負責業務顯示：品牌、產品、新約、續約 */
export function SalesAssignmentTable({ rows, empty = '尚未指定負責業務' }: { rows: SalesAssignment[]; empty?: string }) {
  return (
    <DataTable
      caption="負責業務"
      rows={groupSalesAssignments(rows)}
      rowKey={(g) => `${g.brand}-${g.product}`}
      columns={[
        { key: 'brand', header: '品牌', render: (g) => g.brand },
        { key: 'product', header: '產品', render: (g) => g.product },
        { key: 'new', header: '新約', render: (g) => (g.newSales.length ? g.newSales.join('、') : <span className="muted">—</span>) },
        { key: 'renewal', header: '續約', render: (g) => (g.renewalSales.length ? g.renewalSales.join('、') : <span className="muted">—</span>) },
      ]}
      empty={<EmptyState title={empty} />}
    />
  );
}

/** 負責業務編輯：一列一位業務，可以新增、移除，一個客戶可以有多位業務 */
export function SalesAssignmentEditor({ value, onChange }: { value: SalesAssignment[]; onChange: (v: SalesAssignment[]) => void }) {
  const options = useAsync(getBrandProducts);
  const people = useAsync(getSalesPeople);
  const brands = [...new Set((options.data ?? []).map((o) => o.brand))];
  const productsOf = (brand: string) => (options.data ?? []).filter((o) => o.brand === brand).map((o) => o.product);
  const update = (i: number, patch: Partial<SalesAssignment>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const add = () => onChange([...value, { brand: brands[0] ?? 'Google', product: 'GWS', term: 'new', salesName: '' }]);

  return (
    <div className="sales-editor">
      {value.length > 0 && (
        <div className="sales-editor__head" aria-hidden="true">
          <span>品牌</span>
          <span>產品</span>
          <span>新約／續約</span>
          <span>業務</span>
          <span />
        </div>
      )}
      {value.map((r, i) => (
        <div className="sales-editor__row" key={i} role="group" aria-label={`負責業務第 ${i + 1} 列`}>
          <select className="select" aria-label="品牌" value={r.brand} onChange={(e) => update(i, { brand: e.target.value, product: productsOf(e.target.value)[0] ?? r.product })}>
            {brands.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <select className="select" aria-label="產品" value={r.product} onChange={(e) => update(i, { product: e.target.value as ProductCode })}>
            {productsOf(r.brand).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select className="select" aria-label="新約或續約" value={r.term} onChange={(e) => update(i, { term: e.target.value as SalesAssignment['term'] })}>
            <option value="new">新約</option>
            <option value="renewal">續約</option>
          </select>
          <select className="select" aria-label="業務" value={r.salesName} onChange={(e) => update(i, { salesName: e.target.value })}>
            <option value="">請選擇業務</option>
            {(people.data ?? []).map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <button type="button" className="btn btn--ghost btn--icon" aria-label="移除這一列" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn--sm" onClick={add}>
        <Icon name="plus" size={14} />
        新增一位業務
      </button>
      <p className="muted" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
        沒有選業務的列不會儲存。GWS 到期通知會寄給所有「GWS 續約」的業務和後勤。
      </p>
    </div>
  );
}
