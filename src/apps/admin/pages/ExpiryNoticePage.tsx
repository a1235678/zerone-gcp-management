import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TODAY, daysUntil, getExpiryNotices, saveExpiryNoticeSettings, sendExpiryNoticeNow, type ExpiryNoticeRow } from '@data/api';
import { Card } from '@shared/components/Card';
import { DataTable, EmptyState, type Column } from '@shared/components/DataTable';
import { Callout, FormField } from '@shared/components/Form';
import { Modal } from '@shared/components/Modal';
import { PageHeader } from '@shared/components/PageHeader';
import { PendingTag } from '@shared/components/PendingTag';
import { Stat, StatGrid } from '@shared/components/Stat';
import { StatusTag } from '@shared/components/StatusTag';
import { useToast } from '@shared/components/Toast';
import { formatDate, formatDateTime } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { usePermission } from '../auth';

/** 到期通知：GWS 到期前 N 天寄信給負責續約的業務和後勤（2026/11/10 會議） */
export function ExpiryNoticePage() {
  const { can } = usePermission();
  const canWrite = can('schedules', 'write');
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const data = useAsync(getExpiryNotices, [version]);
  const [days, setDays] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [preview, setPreview] = useState<ExpiryNoticeRow | null>(null);

  useEffect(() => {
    if (!data.data) return;
    setDays(String(data.data.settings.daysBefore));
    setEnabled(data.data.settings.enabled);
  }, [data.data?.settings.daysBefore, data.data?.settings.enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = data.data?.rows ?? [];
  const settings = data.data?.settings;
  const dirty = settings && (String(settings.daysBefore) !== days || settings.enabled !== enabled);

  const save = async () => {
    try {
      await saveExpiryNoticeSettings({ enabled, daysBefore: Number(days) });
      toast('已更新到期通知設定');
      setVersion((v) => v + 1);
    } catch (e) {
      toast((e as Error).message, 'danger');
    }
  };
  const sendNow = async (r: ExpiryNoticeRow) => {
    await sendExpiryNoticeNow(r.subscriptionId);
    toast(`已寄出到期通知給 ${r.recipients.map((x) => x.name).join('、')}`);
    setPreview(null);
    setVersion((v) => v + 1);
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
    { key: 'plan', header: '方案', render: (r) => `${r.plan} · ${r.seats} 席` },
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
    { key: 'notice', header: '通知日', render: (r) => <span className="mono">{formatDate(r.noticeDate)}</span> },
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
    {
      key: 'status',
      header: '狀態',
      render: (r) =>
        r.sentAt ? (
          <div>
            <StatusTag tone="success">已寄出</StatusTag>
            <div className="table__secondary mono">{formatDateTime(r.sentAt)}</div>
          </div>
        ) : (
          <StatusTag tone="neutral">{r.noticeDate <= TODAY ? '未寄出' : '待寄出'}</StatusTag>
        ),
    },
    {
      key: 'actions',
      header: <span className="visually-hidden">操作</span>,
      render: (r) => (
        <button className="btn btn--sm" onClick={() => setPreview(r)}>
          預覽信件
        </button>
      ),
    },
  ];

  const sent = rows.filter((r) => r.sentAt).length;
  const next30 = rows.filter((r) => !r.sentAt && r.noticeDate > TODAY && daysUntil(r.noticeDate) <= 30).length;

  return (
    <>
      <PageHeader
        title="到期通知"
        titleAddon={<PendingTag id={7} hint="信件通知要做，是否放第一階段待定" />}
        description="GWS 訂閱到期前 N 天，系統寄信給這個客戶負責續約的業務和後勤，提醒處理續約。Prototype 不會真的寄信。"
      />

      <StatGrid>
        <Stat label="120 天內到期" value={rows.length} unit="筆訂閱" />
        <Stat label="已寄出通知" value={sent} unit="筆" />
        <Stat label="30 天內要寄" value={next30} unit="筆" />
      </StatGrid>

      <div className="stack">
        <Card title="通知規則">
          <div className="notice-rule">
            <label className="radio-row">
              <input type="checkbox" checked={enabled} disabled={!canWrite} onChange={(e) => setEnabled(e.target.checked)} />
              <span>啟用到期通知</span>
            </label>
            <div className="notice-rule__days">
              <FormField label="到期前幾天寄出" required addon={<PendingTag id={18} />} help="收件人：客戶的 GWS 續約業務、後勤。">
                {(p) => <input {...p} className="input tnum" type="number" min={1} max={180} disabled={!canWrite} value={days} onChange={(e) => setDays(e.target.value)} />}
              </FormField>
            </div>
            {canWrite && (
              <button className="btn btn--primary" disabled={!dirty} onClick={save}>
                儲存設定
              </button>
            )}
          </div>
          {!enabled && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <Callout tone="warning">到期通知已停用，不會自動寄信。</Callout>
            </div>
          )}
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
        title="到期通知信件預覽"
        width={560}
        footer={
          <>
            <button className="btn" onClick={() => setPreview(null)}>
              關閉
            </button>
            {canWrite && preview && (
              <button className="btn btn--primary" onClick={() => sendNow(preview)}>
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
                {preview.recipients.map((x) => `${x.name} <${x.email}>`).join('、')}
              </div>
              <div>
                <span className="muted">主旨：</span>【到期提醒】{preview.customerName} 的 Google Workspace 將於 {formatDate(preview.expiresAt)} 到期
              </div>
            </div>
            <div className="email-preview__body">
              <p>您好，</p>
              <p>
                {preview.customerName}（{preview.primaryDomain}）的 {preview.plan}（{preview.seats} 席）將於 <strong>{formatDate(preview.expiresAt)}</strong> 到期，剩 {daysUntil(preview.expiresAt)} 天。
              </p>
              <p>請和客戶確認續約的版本與人數，並在零壹雲管家建立續約。升版或加人可以排程執行；降版、減人數由後勤人工執行。</p>
              <p className="muted">此信由零壹雲管家自動寄出。</p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
