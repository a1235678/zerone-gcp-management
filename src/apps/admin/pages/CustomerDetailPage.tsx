import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAuditLogs, getCustomer, getWorkOrders, recheckDomainVerification, setCustomerStatus } from '@data/api';
import { workOrderStatusLabel } from '@data/labels';
import { Card } from '@shared/components/Card';
import { DescriptionList } from '@shared/components/DescriptionList';
import { EmptyState } from '@shared/components/DataTable';
import { Callout } from '@shared/components/Form';
import { Icon } from '@shared/components/Icon';
import { Modal } from '@shared/components/Modal';
import { PageHeader } from '@shared/components/PageHeader';
import { PendingTag } from '@shared/components/PendingTag';
import { useToast } from '@shared/components/Toast';
import { formatDate, formatDateTime } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { AuditLogTable } from '../components/AuditLogTable';
import { WorkOrderModal } from '../components/WorkOrderModal';
import { CustomerStatusTag, DomainVerificationTag, WorkOrderStatusTag } from '../tags';

export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  const customer = useAsync(() => getCustomer(id), [id, version]);
  const transfers = useAsync(() => getWorkOrders({ customerId: id, type: 'transfer' }), [id, version]);
  const logs = useAsync(() => getAuditLogs({ customerId: id }), [id, version]);

  const [transferOpen, setTransferOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [checking, setChecking] = useState(false);

  const c = customer.data;
  if (customer.loading && !c) return <p className="muted">載入中…</p>;
  if (!c)
    return (
      <Card>
        <EmptyState title="找不到這個客戶" description="可能已被刪除或網址有誤。" />
        <p style={{ textAlign: 'center' }}>
          <Link to="/customers">回客戶管理</Link>
        </p>
      </Card>
    );

  const openTransfer = transfers.data?.find((w) => ['draft', 'pending', 'submitted'].includes(w.status));

  const recheck = async () => {
    setChecking(true);
    const r = await recheckDomainVerification(c.id);
    setChecking(false);
    reload();
    toast(r.domainVerification === 'verified' ? 'Google 網域驗證通過' : '仍未通過：Google 尚未找到驗證 TXT 記錄，請客戶確認 DNS 設定', r.domainVerification === 'verified' ? 'success' : 'info');
  };

  const toggleStatus = async () => {
    const next = c.status === 'active' ? 'disabled' : 'active';
    await setCustomerStatus(c.id, next);
    setStatusOpen(false);
    reload();
    toast(next === 'disabled' ? `已停用「${c.name}」` : `已啟用「${c.name}」`);
  };

  return (
    <>
      <Link to="/customers" className="back-link">
        <Icon name="chevronLeft" size={14} />
        客戶管理
      </Link>
      <PageHeader
        title={c.name}
        titleAddon={<CustomerStatusTag value={c.status} />}
        description={
          <span className="inline">
            <span className="mono">{c.primaryDomain}</span>
            <span>·</span>
            <span>{c.dealerName}</span>
          </span>
        }
        actions={
          <>
            <button className={`btn ${c.status === 'active' ? 'btn--danger' : ''}`} onClick={() => setStatusOpen(true)}>
              {c.status === 'active' ? '停用客戶' : '啟用客戶'}
            </button>
            <button className="btn btn--primary" onClick={() => setTransferOpen(true)} disabled={Boolean(openTransfer)} title={openTransfer ? `已有處理中的轉移執行單 ${openTransfer.id}` : undefined}>
              開立客戶轉移
            </button>
          </>
        }
      />

      <div className="stack">
        <div className="split">
          <Card title="客戶資料">
            <DescriptionList
              items={[
                { label: '客戶名稱', value: c.name },
                { label: '統一編號', value: <span className="mono">{c.taxId}</span> },
                { label: '主網域', value: <span className="mono">{c.primaryDomain}</span> },
                { label: '經銷商', value: c.dealerName },
                { label: '聯絡人', value: c.contactName },
                { label: 'Email', value: <span className="mono">{c.contactEmail}</span> },
                { label: '電話', value: <span className="mono">{c.contactPhone}</span> },
                { label: '客戶編號', value: <span className="mono">{c.id}</span> },
                { label: '建立人', value: c.createdBy },
                { label: '建立日期', value: <span className="mono">{formatDate(c.createdAt)}</span> },
                { label: '備註', value: c.note, full: true },
              ]}
            />
          </Card>

          <div className="stack">
            <Card title="Google 網域驗證">
              <div className="stack" style={{ gap: 'var(--space-3)' }}>
                <div className="inline">
                  <DomainVerificationTag value={c.domainVerification} />
                  <span className="mono muted">{c.primaryDomain}</span>
                </div>
                {c.domainVerification === 'verified' ? (
                  <p className="muted">客戶已在 DNS 加上 Google 驗證記錄。</p>
                ) : (
                  <>
                    <p className="muted">建立客戶後才檢查。請客戶在 DNS 加上 Google 提供的 TXT 驗證記錄，再按「重新檢查」。</p>
                    <div>
                      <button className="btn btn--sm" onClick={recheck} disabled={checking}>
                        <Icon name="reset" size={14} />
                        {checking ? '檢查中…' : '重新檢查'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </Card>

            <Card title={<span className="inline">客戶轉移 <PendingTag id={4} /></span>} bodyless>
              {transfers.data && transfers.data.length > 0 ? (
                <ul className="list-plain">
                  {transfers.data.map((w) => (
                    <li key={w.id}>
                      <div style={{ minWidth: 0 }}>
                        <Link to={`/work-orders/${w.id}`} className="mono">
                          {w.id}
                        </Link>
                        <div className="table__secondary">
                          {formatDateTime(w.createdAt)} · 轉移碼 <span className="mono">{w.payload.transferToken}</span>
                        </div>
                        {w.status === 'failed' && <div className="text-danger" style={{ fontSize: 'var(--text-sm)' }}>Google 回應：{w.failureReason}</div>}
                      </div>
                      <WorkOrderStatusTag value={w.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="card__body">
                  <p className="muted">
                    這個客戶沒有轉移紀錄。新客戶從其他經銷商轉入時，請用客戶管理的「轉入客戶」；已在系統裡的客戶（或前一次轉移失敗要重開）才從這裡開立。
                  </p>
                </div>
              )}
              {openTransfer && (
                <div className="card__body" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <Callout tone="neutral">
                    已有處理中的轉移執行單 {openTransfer.id}（{workOrderStatusLabel[openTransfer.status]}），處理完才能再開立。
                  </Callout>
                </div>
              )}
            </Card>
          </div>
        </div>

        <Card title="操作紀錄" bodyless actions={<span className="muted" style={{ fontSize: 'var(--text-sm)' }}>{logs.data?.length ?? 0} 筆</span>}>
          <AuditLogTable rows={logs.data ?? []} loading={logs.loading && !logs.data} />
        </Card>
      </div>

      <WorkOrderModal
        open={transferOpen}
        type="transfer"
        customer={c}
        onClose={() => setTransferOpen(false)}
        onCreated={() => {
          setTransferOpen(false);
          reload();
        }}
      />

      <Modal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title={c.status === 'active' ? '停用客戶' : '啟用客戶'}
        width={440}
        footer={
          <>
            <button className="btn" onClick={() => setStatusOpen(false)}>
              取消
            </button>
            <button className={`btn ${c.status === 'active' ? 'btn--danger' : 'btn--primary'}`} onClick={toggleStatus}>
              {c.status === 'active' ? '停用' : '啟用'}
            </button>
          </>
        }
      >
        <p>
          確定要{c.status === 'active' ? '停用' : '啟用'}「{c.name}」嗎？
        </p>
        <p>
          <PendingTag hint="停用後帳號能否登入、訂閱怎麼處理" />
        </p>
      </Modal>
    </>
  );
}
