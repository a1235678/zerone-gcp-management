export function Card({
  title,
  actions,
  children,
  bodyless,
  className = '',
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** true 時不包 padding，給表格、篩選列直接貼齊卡片邊緣 */
  bodyless?: boolean;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card__header">
          {title && <h2 className="card__title">{title}</h2>}
          {actions}
        </header>
      )}
      {bodyless ? children : <div className="card__body">{children}</div>}
    </section>
  );
}
