import { Icon } from './Icon';

export function FilterBar({ children, onReset }: { children: React.ReactNode; onReset?: () => void }) {
  return (
    <div className="filter-bar" role="search">
      {children}
      {onReset && (
        <div className="filter-bar__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onReset}>
            <Icon name="reset" size={14} />
            清除篩選
          </button>
        </div>
      )}
    </div>
  );
}

export function SearchField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="field filter-bar__item filter-bar__item--grow">
      <span className="field__label">{label}</span>
      <span className="input-icon">
        <Icon name="search" size={16} />
        <input className="input" type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      </span>
    </label>
  );
}

export interface Option {
  value: string;
  label: string;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  allLabel = '全部',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  allLabel?: string;
}) {
  return (
    <label className="field filter-bar__item">
      <span className="field__label">{label}</span>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** 日期區間（起、迄兩個日期欄位） */
export function DateRangeField({
  label,
  from,
  to,
  onChange,
}: {
  label: string;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  return (
    <fieldset className="field filter-bar__item filter-bar__item--range">
      <legend className="field__label">{label}</legend>
      <div className="date-range">
        <input className="input" type="date" aria-label={`${label}（起）`} value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} />
        <span aria-hidden="true">至</span>
        <input className="input" type="date" aria-label={`${label}（迄）`} value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} />
      </div>
    </fieldset>
  );
}
