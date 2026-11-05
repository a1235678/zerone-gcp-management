export interface DescItem {
  label: React.ReactNode;
  value: React.ReactNode;
  full?: boolean;
}
export function DescriptionList({ items, columns = 2 }: { items: DescItem[]; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={`desc-list desc-list--${columns}`}>
      {items.map((it, i) => (
        <div key={i} className={`desc-list__item ${it.full ? 'is-full' : ''}`}>
          <dt>{it.label}</dt>
          <dd>{it.value === '' || it.value === null || it.value === undefined ? <span className="muted">—</span> : it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
