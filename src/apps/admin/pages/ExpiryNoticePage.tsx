import { useState } from 'react';
import { Link } from 'react-router-dom';
import { NOTICE_DAYS, TODAY, daysUntil, getExpiryNotices, sendExpiryNoticeNow, type ExpiryNoticeRow, type NoticeStage } from '@data/api';
import { Card } from '@shared/components/Card';
import { DataTable, EmptyState, type Column } from '@shared/components/DataTable';
import { Modal } from '@shared/components/Modal';
import { PageHeader } from '@shared/components/PageHeader';
import { PendingTag } from '@shared/components/PendingTag';
import { Stat, StatGrid } from '@shared/components/Stat';
import { StatusTag } from '@shared/components/StatusTag';
import { useToast } from '@shared/components/Toast';
import { formatDate, formatDateTime } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { usePermission } from '../auth';

/** 一次通知的狀態：已寄出、待寄出、未寄出（日期已過但沒寄） */
export function NoticeStageTag({ stage, cancelled }: { stage: NoticeStage; cancelled: boolean }) {
  if (cancelled) return <StatusTag tone="neutral">不寄送</StatusTag>;
  if (stage.sentAt) return <StatusTag tone="success">已寄出</StatusTag>;
  return <StatusTag tone="neutral">{stage.date <= TODAY ? '未寄出' : '待寄出'}</StatusTag>;
}

/** 到期通知：GWS 到期前 30 天、3 天寄信給負責續約的業務和後勤（2026/11/12 會議）；已取消續約的不寄 */
export function ExpiryNoticePage() {
  const { can } = usePermission();
  const canWrite = can('schedules', 'write');
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const data = useAsync(getExpiryNotices, [version]);
  const [preview, setPreview] = useState<{ row: ExpiryNoticeRow; stage: NoticeStage } | null>(null);
  const rows = data.data ?? [];

  const sendNow = async () => {
    if (!preview) return;
    try {
      await sendExpiryNoticeNow(preview.row.subscriptionId, preview.stage.daysBefore);
      toast(`已寄出到期前 ${preview.stage.daysBefore} 天通知給 ${preview.row.recipients.map((x) => x.name).join('、')}`);
      setPreview(null);
      setVersion((v) => v + 1);
    } catch (e) {
      toast((e as Error).message, 'danger');
    }
  };

  const columns: Column<ExpiryNoticeRow>[] = [
    {
      key: 'customer',
      header: '客戶',
      render: (r) => (
        <div>
          <Link to={`/customers/${r.customerId}`} className="table__primary">
            {r.customerName}
          </Link>
          <div className="table__secondary mono">{r.primaryDomain}</div>
        </div>
      ),
    },
    {
      key: 'plan',
      header: '訂閱',
      render: (r) => (
        <div>
          <Link to={`/products/gws/${r.subscriptionId}`}>
            {r.plan} · {r.seats} 席
          </Link>
          {r.renewalCancelled && (
            <div>
              <StatusTag tone="warning">已取消續約</StatusTag>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'expires',
      header: '到期日',
      render: (r) => (
        <div>
          <div className="mono">{formatDate(r.expiresAt)}</div>
          <div className="table__secondary">剩 {daysUntil(r.expiresAt)} 天</div>
        </div>
      ),
    },
    ...NOTICE_DAYS.map(
      (d, i): Column<ExpiryNoticeRow> => ({
        key: `stage${d}`,
        header: `到期前 ${d} 天`,
        render: (r) => {
          const st = r.stages[i];
          return (
            <div>
              <div className="inline" style={{ flexWrap: 'nowrap' }}>
                <NoticeStageTag stage={st} cancelled={r.renewalCancelled} />
                {!r.renewalCancelled && (
                  <button type="button" className="link-button" style={{ fontSize: 'var(--text-sm)' }} onClick={() => setPreview({ row: r, stage: st })}>
                    預覽
                  </button>
                )}
              </div>
              <div className="table__secondary mono">{st.sentAt ? formatDateTime(st.sentAt) : formatDate(st.date)}</div>
            </div>
          );
        },
      }),
    ),
    {
      key: 'to',
      header: '收件人',
      render: (r) => (
        <div>
          {r.recipients.map((x) => (
            <div key={x.email}>
              {x.name} <span className="table__secondary">（{x.role}）</span>
            </div>
          ))}
          {!r.recipients.some((x) => x.role === '續約業務') && <div className="text-warning table__secondary">尚未指定續約業務</div>}
        </div>
      ),
    },
  ];

  const sent = rows.reduce((n, r) => n + r.stages.filter((s) => s.sentAt).length, 0);
  const next30 = rows.reduce((n, r) => n + (r.renewalCancelled ? 0 : r.stages.filter((s) => !s.sentAt && s.date > TODAY && daysUntil(s.date) <= 30).length), 0);
  const cancelled = rows.filter((r) => r.renewalCancelled).length;

  return (
    <>
      <PageHeader
        title="到期通知"
        titleAddon={<PendingTag id={7} hint="信件通知要做，是否放第一階段待定" />}
        description="GWS 訂閱到期前 30 天、3 天，系統寄信給這個客戶負責續約的業務和後勤，提醒處理續約。已取消續約的訂閱不寄。Prototype 不會真的寄信。"
      />

      <StatGrid>
        <Stat label="120 天內到期" value={rows.length} unit="筆訂閱" sub={`其中已取消續約 ${cancelled} 筆`} />
        <Stat label="已寄出通知" value={sent} unit="封" />
        <Stat label="30 天內要寄" value={next30} unit="封" />
      </StatGrid>

      <div className="stack">
        <Card title="通知規則">
          <ul className="exec-box__reasons" style={{ margin: 0 }}>
            <li>寄送時間固定：到期前 30 天、到期前 3 天（2026/11/12 會議）。</li>
            <li>收件人：客戶的 GWS 續約業務、後勤。</li>
            <li>已取消續約的訂閱不寄任何到期通知。</li>
          </ul>
          <div className="inline" style={{ marginTop: 'var(--space-3)' }}>
            <PendingTag id={27} />
            <PendingTag id={30} />
          </div>
        </Card>

        <Card bodyless title="120 天內到期的訂閱">
          <DataTable
            caption="到期通知清單"
            columns={columns}
            rows={rows}
            rowKey={(r) => r.subscriptionId}
            loading={data.loading && !data.data}
            empty={<EmptyState title="120 天內沒有到期的訂閱" />}
          />
        </Card>
      </div>

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={`到期前 ${preview?.stage.daysBefore ?? ''} 天通知：信件預覽`}
        width={560}
        footer={
          <>
            <button className="btn" onClick={() => setPreview(null)}>
              關閉
            </button>
            {canWrite && preview && (
              <button className="btn btn--primary" onClick={sendNow}>
                立即寄出
              </button>
            )}
          </>
        }
      >
        {preview && (
          <div className="email-preview">
            <div className="email-preview__meta">
              <div>
                <span className="muted">收件人：</span>
                {preview.row.recipients.map((x) => `${x.name} <${x.email}>`).join('、')}
              </div>
              <div>
                <span className="muted">主旨：</span>【到期提醒】{preview.row.customerName} 的 Google Workspace 將於 {formatDate(preview.row.expiresAt)} 到期
              </div>
            </div>
            <div className="email-preview__body">
              <p>您好，</p>
              <p>
                {preview.row.customerName}（{preview.row.primaryDomain}）的 {preview.row.plan}（{preview.row.seats} 席）將於 <strong>{formatDate(preview.row.expiresAt)}</strong>{' '}
                到期，還有 {preview.stage.daysBefore} 天。
              </p>
              <p>請和客戶確認續約的版本與人數，並在零壹雲管家建立續約；客戶不續約時，請在訂閱按「取消續約」。</p>
              <p className="muted">此信由零壹雲管家自動寄出。</p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
