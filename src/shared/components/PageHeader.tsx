export function PageHeader({
  title,
  description,
  actions,
  titleAddon,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  titleAddon?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-header__title">
          {title}
          {titleAddon}
        </h1>
        {description && <p className="page-header__desc">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}
