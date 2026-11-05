/** 重點數字卡片 */
export function Stat({
  label,
  value,
  unit,
  sub,
  tone,
  addon,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
  tone?: 'warning' | 'danger';
  addon?: React.ReactNode;
}) {
  return (
    <div className={`stat ${tone ? `stat--${tone}` : ''}`}>
      <div className="stat__label">
        {label}
        {addon}
      </div>
      <div className="stat__value tnum">
        {value}
        {unit && <span className="stat__unit">{unit}</span>}
      </div>
      {sub && <div className="stat__sub">{sub}</div>}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="stat-grid">{children}</div>;
}
