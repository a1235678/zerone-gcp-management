import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAuditLogs, getCustomer, getOperations, recheckDomainVerification, setCustomerStatus } from '@data/api';
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
import { OperationModal } from '../components/OperationModal';
import { OperationPanel } from '../components/OperationPanel';
import { CustomerStatusTag, DomainVerificationTag, OperationStatusTag } from '../tags';
import { usePermission } from '../auth';

export function CustomerDetailPage() {
  const { can } = usePermission();
  const { id = '' } = useParams();
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  const customer = useAsync(() => getCustomer(id), [id, version]);
  const transfers = useAsync(() => getOperations({ customerId: id, type: 'transfer' }), [id, version]);
  const [panelId, setPanelId] = useState<string | null>(null);
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

  const openTransfer = transfers.data?.find((o) => ['scheduled', 'pendingManual', 'submitted', 'manual'].includes(o.status));

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
            {can('customers', 'write') && (
              <button className={`btn ${c.status === 'active' ? 'btn--danger' : ''}`} onClick={() => setStatusOpen(true)}>
                {c.status === 'active' ? '停用客戶' : '啟用客戶'}
              </button>
            )}
            {can('subscriptions', 'write') && (
              <button className="btn btn--primary" onClick={() => setTransferOpen(true)} disabled={Boolean(openTransfer)} title={openTransfer ? `已有處理中的轉移 ${openTransfer.id}` : undefined}>
                客戶轉移
              </button>
            )}
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
                    <div hidden={!can('customers', 'write')}>
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
                  {transfers.data.map((o) => (
                    <li key={o.id}>
                      <div style={{ minWidth: 0 }}>
                        <button type="button" className="link-button mono" onClick={() => setPanelId(o.id)}>
                          {o.id}
                        </button>
                        <div className="table__secondary">
                          {formatDateTime(o.createdAt)} · {o.summary}
                          {o.workOrderId && (
                            <>
                              {' '}
                              · 執行單 <Link to={`/work-orders/${o.workOrderId}`}>{o.workOrderId}</Link>
                            </>
                          )}
                        </div>
                        {o.status === 'failed' && <div className="text-danger" style={{ fontSize: 'var(--text-sm)' }}>Google 回應：{o.failureReason}</div>}
                      </div>
                      <OperationStatusTag value={o.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="card__body">
                  <p className="muted">
                    這個客戶沒有移轉紀錄。新客戶要移轉進來時，請用客戶管理的「轉入客戶」；已在系統裡的客戶才從這裡建立移轉。
                  </p>
                </div>
              )}
              {openTransfer && (
                <div className="card__body" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <Callout tone="neutral">
                    已有處理中的移轉 {openTransfer.id}，處理完才能再建立。
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

      <OperationModal
        open={transferOpen}
        type="transfer"
        target={{ customerId: c.id, customerName: c.name, primaryDomain: c.primaryDomain }}
        onClose={() => setTransferOpen(false)}
        onSubmitted={(op) => {
          setTransferOpen(false);
          reload();
          setPanelId(op.id);
        }}
      />
      <OperationPanel id={panelId} onClose={() => setPanelId(null)} onChanged={reload} />

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
