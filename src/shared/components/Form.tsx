import { useId } from 'react';

type FieldState = 'error' | 'success' | 'checking' | undefined;

/** 表單欄位：標籤、必填記號、說明文字、錯誤訊息。子元素拿到 id 與 aria 屬性 */
export function FormField({
  label,
  required,
  help,
  message,
  state,
  addon,
  children,
  className = '',
}: {
  label: React.ReactNode;
  required?: boolean;
  help?: React.ReactNode;
  message?: React.ReactNode;
  state?: FieldState;
  addon?: React.ReactNode;
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const descId = `${id}-desc`;
  const hasDesc = Boolean(help || message);
  return (
    <div className={`form-field ${state ? `is-${state}` : ''} ${className}`}>
      <label htmlFor={id} className="form-field__label">
        {label}
        {required && <span className="form-field__req">必填</span>}
        {addon}
      </label>
      {children({ id, 'aria-invalid': state === 'error' || undefined, 'aria-describedby': hasDesc ? descId : undefined })}
      {hasDesc && (
        <div id={descId} className="form-field__desc">
          {message && <div className={`form-field__msg form-field__msg--${state ?? 'info'}`}>{message}</div>}
          {help && <div className="form-field__help">{help}</div>}
        </div>
      )}
    </div>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="form-section">
      <div className="form-section__head">
        <h3 className="form-section__title">{title}</h3>
        {description && <p className="form-section__desc">{description}</p>}
      </div>
      <div className="form-grid">{children}</div>
    </section>
  );
}

/** 說明／提示框 */
export function Callout({ tone = 'info', title, children }: { tone?: 'info' | 'warning' | 'danger' | 'neutral'; title?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={`callout callout--${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      {title && <div className="callout__title">{title}</div>}
      <div>{children}</div>
    </div>
  );
}
