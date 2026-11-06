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

export function NoPermissionPage() {
  return (
    <Card>
      <EmptyState title="你的角色沒有這一頁的權限" description="如果需要使用，請聯絡系統管理員調整角色權限。" />
      <p style={{ textAlign: 'center' }}>
        <Link to="/">回首頁</Link>
      </p>
    </Card>
  );
}
