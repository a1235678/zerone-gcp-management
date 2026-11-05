import { Link } from 'react-router-dom';
import { Card } from '@shared/components/Card';
import { EmptyState } from '@shared/components/DataTable';
import { PageHeader } from '@shared/components/PageHeader';

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <EmptyState title="這個網址沒有對應的頁面" description="請從左側選單選擇頁面。" />
        <p style={{ textAlign: 'center' }}>
          <Link to="/">回首頁</Link>
        </p>
      </Card>
    </>
  );
}
