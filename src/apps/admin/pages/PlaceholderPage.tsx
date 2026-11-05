import { Card } from '@shared/components/Card';
import { EmptyState } from '@shared/components/DataTable';
import { PageHeader } from '@shared/components/PageHeader';

/** 尚未製作的頁面。版型確認後依 handoff 順序逐頁替換。 */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <EmptyState title="此頁尚未製作" description="版型確認後會依序完成。" />
      </Card>
    </>
  );
}
