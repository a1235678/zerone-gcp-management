export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  align?: 'left' | 'right';
  minWidth?: number;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  loading,
  empty,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  empty?: React.ReactNode;
  caption?: string;
}) {
  return (
    // 外層負責水平捲動，表格本身維持 nowrap，窄螢幕不會擠壞欄位
    <div className="table-scroll" tabIndex={0} aria-label={caption ? `${caption}（可左右捲動）` : undefined}>
      <table className="table">
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === 'right' ? 'align-right' : undefined} style={{ minWidth: c.minWidth }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="skeleton-row">
                {columns.map((c) => (
                  <td key={c.key}>
                    <span className="skeleton-bar" />
                  </td>
                ))}
              </tr>
            ))}
          {!loading &&
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? 'is-clickable' : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={c.align === 'right' ? 'align-right' : undefined}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length}>{empty ?? <EmptyState title="沒有符合條件的資料" />}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {description && <p>{description}</p>}
    </div>
  );
}
