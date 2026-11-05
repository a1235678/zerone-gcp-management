import { Icon } from './Icon';

export function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (p: number) => void }) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  return (
    <nav className="pagination" aria-label="分頁">
      <button className="pagination__btn" disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="上一頁">
        <Icon name="chevronLeft" size={14} />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          className={`pagination__btn ${p === page ? 'is-current' : ''}`}
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
      <button className="pagination__btn" disabled={page === pageCount} onClick={() => onChange(page + 1)} aria-label="下一頁">
        <Icon name="chevronRight" size={14} />
      </button>
    </nav>
  );
}

export function paginate<T>(rows: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  return { pageRows: rows.slice((safePage - 1) * pageSize, safePage * pageSize), pageCount, page: safePage };
}
