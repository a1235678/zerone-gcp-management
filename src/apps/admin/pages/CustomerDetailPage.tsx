import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { addCustomerDomain, checkDomain, getAuditLogs, getCustomer, getOperations, getSalesPeople, recheckDomainVerification, removeCustomerDomain, saveSalesAssignments, setCustomerStatus } from '@data/api';
import { Card } from '@shared/components/Card';
import { DescriptionList } from '@shared/components/DescriptionList';
import { EmptyState } from '@shared/components/DataTable';
import { Callout, FormField } from '@shared/components/Form';
import { StatusTag } from '@shared/components/StatusTag';
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
  const [domainOpen, setDomainOpen] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [salesOpen, setSalesOpen] = useState(false);
  const [salesForm, setSalesForm] = useState<Record<string, string>>({});
  const salesPeople = useAsync(getSalesPeople);
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

  const canEdit = can('customers', 'write');
  const openSales = () => {
    setSalesForm(Object.fromEntries(c.salesAssignments.map((a) => [`${a.product}-${a.term}`, a.salesName])));
    setSalesOpen(true);
  };
  const saveSales = async () => {
    try {
      await saveSalesAssignments(
        c.id,
        Object.entries(salesForm).map(([k, salesName]) => {
          const [product, term] = k.split('-') as ['GWS' | 'GCP', 'new' | 'renewal'];
          return { product, term, salesName };
        }),
      );
      toast('已更新負責業務');
      setSalesOpen(false);
      reload();
    } catch (e) {
      toast((e as Error).message, 'danger');
    }
  };
  const domainCheck = domainInput ? checkDomain(domainInput) : undefined;
  const addDomain = async () => {
    try {
      await addCustomerDomain(c.id, domainInput);
      toast(`已新增網域 ${domainInput.trim()}`);
      setDomainOpen(false);
      reload();
    } catch (e) {
      toast((e as Error).message, 'danger');
    }
  };
  const removeDomain = async (d: string) => {
    await removeCustomerDomain(c.id, d);
    toast(`已移除網域 ${d}`);
    reload();
  };
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
                { label: '其他網域', value: c.otherDomains.length ? <span className="mono">{c.otherDomains.join('、')}</span> : '' },
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
            <Card title="負責業務" actions={canEdit ? <button className="btn btn--sm" onClick={openSales}>編輯</button> : undefined} bodyless>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>產品</th>
                      <th>新約</th>
                      <th>續約</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(['GWS', 'GCP'] as const).map((prod) => (
                      <tr key={prod}>
                        <td>
                          {prod}
                          {prod === 'GCP' && <div className="table__secondary">第一階段不納入</div>}
                        </td>
                        {(['new', 'renewal'] as const).map((term) => (
                          <td key={term}>{c.salesAssignments.find((a) => a.product === prod && a.term === term)?.salesName ?? <span className="muted">未指定</span>}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted card__body" style={{ fontSize: 'var(--text-sm)', margin: 0, paddingTop: 'var(--space-3)' }}>
                GWS 到期通知會寄給「續約」的負責業務和後勤。
              </p>
            </Card>

            <Card title="網域" actions={canEdit ? <button className="btn btn--sm" onClick={() => { setDomainInput(''); setDomainOpen(true); }}>新增網域</button> : undefined} bodyless>
              <ul className="list-plain">
                <li>
                  <span className="mono">{c.primaryDomain}</span>
                  <StatusTag tone="info">主網域</StatusTag>
                </li>
                {c.otherDomains.map((d) => (
                  <li key={d}>
                    <span className="mono">{d}</span>
                    {canEdit && (
                      <button className="btn btn--sm btn--ghost" onClick={() => removeDomain(d)}>
                        移除
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>

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
        target={{ customerId: c.id, customerName: c.name, primaryDomain: c.primaryDomain, dealerId: c.dealerId }}
        onClose={() => setTransferOpen(false)}
        onSubmitted={(op) => {
          setTransferOpen(false);
          reload();
          setPanelId(op.id);
        }}
      />
      <OperationPanel id={panelId} onClose={() => setPanelId(null)} onChanged={reload} />
      <Modal
        open={domainOpen}
        onClose={() => setDomainOpen(false)}
        title="新增網域"
        width={440}
        footer={
          <>
            <button className="btn" onClick={() => setDomainOpen(false)}>
              取消
            </button>
            <button className="btn btn--primary" disabled={!domainCheck?.ok} onClick={addDomain}>
              新增
            </button>
          </>
        }
      >
        <FormField
          label="網域"
          required
          help="例如 company-shop.example。和主網域一樣會檢查格式與是否重複。"
          message={domainCheck && !domainCheck.ok ? domainCheck.message : domainCheck?.ok ? '可以使用' : undefined}
          state={domainCheck ? (domainCheck.ok ? 'success' : 'error') : undefined}
        >
          {(p) => <input {...p} className="input mono" spellCheck={false} autoCapitalize="off" value={domainInput} onChange={(e) => setDomainInput(e.target.value)} />}
        </FormField>
      </Modal>
      <Modal
        open={salesOpen}
        onClose={() => setSalesOpen(false)}
        title="編輯負責業務"
        width={520}
        footer={
          <>
            <button className="btn" onClick={() => setSalesOpen(false)}>
              取消
            </button>
            <button className="btn btn--primary" onClick={saveSales}>
              儲存
            </button>
          </>
        }
      >
        <p className="muted" style={{ marginTop: 0 }}>同一個客戶可以依產品、新約或續約指定不同業務。</p>
        <div className="form-grid">
          {(['GWS', 'GCP'] as const).flatMap((prod) =>
            (['new', 'renewal'] as const).map((term) => {
              const k = `${prod}-${term}`;
              return (
                <FormField key={k} label={`${prod} ${term === 'new' ? '新約' : '續約'}`}>
                  {(p) => (
                    <select {...p} className="select" value={salesForm[k] ?? ''} onChange={(e) => setSalesForm({ ...salesForm, [k]: e.target.value })}>
                      <option value="">未指定</option>
                      {(salesPeople.data ?? []).map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  )}
                </FormField>
              );
            }),
          )}
        </div>
      </Modal>

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
