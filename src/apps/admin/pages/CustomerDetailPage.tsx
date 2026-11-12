import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { addCustomerContact, formatAddress, getSubscriptions, getUsers, getWorkOrders, addCustomerDomain, checkDomain, getAuditLogs, getCustomer, getOperations, getSalesPeople, recheckDomainVerification, removeCustomerDomain, saveSalesAssignments, setCustomerStatus } from '@data/api';
import { Card } from '@shared/components/Card';
import { DescriptionList } from '@shared/components/DescriptionList';
import { DataTable, EmptyState } from '@shared/components/DataTable';
import { Tabs } from '@shared/components/Tabs';
import { customerAttributeLabel, workOrderTypeLabel } from '@data/labels';
import type { CustomerContact } from '@data/types';
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
import { CustomerStatusTag, DomainVerificationTag, OperationStatusTag, SubscriptionStatusTag, UserStatusTag, WorkOrderStatusTag } from '../tags';
import { usePermission } from '../auth';

type DetailTab = 'org' | 'users' | 'contacts' | 'subscriptions' | 'workOrders' | 'logs';

export function CustomerDetailPage() {
  const { can } = usePermission();
  const { id = '' } = useParams();
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  const customer = useAsync(() => getCustomer(id), [id, version]);
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') ?? 'org') as DetailTab;
  const navigate = useNavigate();
  const users = useAsync(() => getUsers({ orgType: 'customer', orgId: id }), [id, version]);
  const subs = useAsync(() => (can('subscriptions') ? getSubscriptions({ customerId: id }) : Promise.resolve([])), [id, version]);
  const orders = useAsync(() => (can('workOrders') ? getWorkOrders({ customerId: id }) : Promise.resolve([])), [id, version]);
  const [contactOpen, setContactOpen] = useState(false);
  const [contact, setContact] = useState<CustomerContact>({ name: '', title: '', email: '', phone: '' });
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
  const saveContact = async () => {
    try {
      await addCustomerContact(c.id, contact);
      toast(`已新增聯絡人 ${contact.name.trim()}`);
      setContactOpen(false);
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
              <button className="btn btn--primary" onClick={() => setTransferOpen(true)} disabled={Boolean(openTransfer)} title={openTransfer ? `已有處理中的客戶轉入 ${openTransfer.id}` : undefined}>
                客戶轉入
              </button>
            )}
          </>
        }
      />

      <div className="page-tabs">
        <Tabs<DetailTab>
          label="客戶詳情分頁"
          value={tab}
          onChange={(v) => setParams(v === 'org' ? {} : { tab: v }, { replace: true })}
          tabs={[
            { value: 'org', label: '組織資訊' },
            { value: 'users', label: '客戶使用者', count: users.data?.length },
            { value: 'contacts', label: '一般聯絡人', count: c.contacts.length },
            { value: 'subscriptions', label: '訂閱', count: subs.data?.length },
            { value: 'workOrders', label: '執行單', count: orders.data?.length },
            { value: 'logs', label: '異動歷程' },
          ]}
        />
      </div>

      {tab === 'org' && (
        <div className="stack">
        <div className="split">
          <Card title="基本資訊">
            <DescriptionList
              items={[
                { label: '客戶屬性', value: <StatusTag tone="neutral">{customerAttributeLabel[c.attribute]}</StatusTag> },
                { label: '公司全名', value: c.name },
                { label: '公司簡稱', value: c.shortNames.join('、') },
                { label: '統一編號', value: <span className="mono">{c.taxId}</span> },
                { label: '登記地址', value: formatAddress(c.registeredAddress), full: true },
                { label: '聯絡地址', value: c.contactSameAsRegistered ? <>同登記地址</> : formatAddress(c.contactAddress), full: true },
                { label: '聯絡電話', value: <span className="mono">{c.contactPhone}</span> },
                { label: 'Email', value: <span className="mono">{c.contactEmail}</span> },
                { label: '是否為經銷商', value: c.isDealer ? '是' : '否' },
                { label: '所屬經銷商', value: c.dealerName },
                { label: '主網域', value: <span className="mono">{c.primaryDomain}</span> },
                { label: '其他網域', value: c.otherDomains.length ? <span className="mono">{c.otherDomains.join('、')}</span> : '' },
                { label: '聯絡人', value: c.contactName },
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

            <Card title={<span className="inline">客戶轉入 <PendingTag id={4} /></span>} bodyless>
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
                    這個客戶沒有轉入紀錄。新客戶要轉進來時，請用客戶管理的「轉入客戶」；已在系統裡的客戶才從這裡建立客戶轉入。
                  </p>
                </div>
              )}
              {openTransfer && (
                <div className="card__body" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <Callout tone="neutral">
                    已有處理中的客戶轉入 {openTransfer.id}，處理完才能再建立。
                  </Callout>
                </div>
              )}
            </Card>
          </div>
        </div>

        </div>
      )}

      {tab === 'users' && (
        <Card bodyless title="客戶使用者" actions={<span className="muted" style={{ fontSize: 'var(--text-sm)' }}>零壹只建立第一個組織管理員帳號，其他由客戶自己建立</span>}>
          <DataTable
            caption="客戶使用者"
            rows={users.data ?? []}
            rowKey={(u) => u.id}
            columns={[
              { key: 'name', header: '姓名', render: (u) => <span className="table__primary">{u.name}</span> },
              { key: 'email', header: 'Email', render: (u) => <span className="mono">{u.email}</span> },
              { key: 'role', header: '角色', render: (u) => u.roleName },
              { key: 'status', header: '狀態', render: (u) => <UserStatusTag value={u.status} /> },
              { key: 'login', header: '最後登入', render: (u) => <span className="mono">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}</span> },
            ]}
            empty={<EmptyState title="還沒有使用者" />}
          />
        </Card>
      )}

      {tab === 'contacts' && (
        <Card bodyless title="一般聯絡人" actions={canEdit ? <button className="btn btn--sm" onClick={() => { setContact({ name: '', title: '', email: '', phone: '' }); setContactOpen(true); }}>新增聯絡人</button> : undefined}>
          <DataTable
            caption="一般聯絡人"
            rows={c.contacts}
            rowKey={(x) => x.name + x.email}
            columns={[
              { key: 'name', header: '姓名', render: (x) => <span className="table__primary">{x.name}</span> },
              { key: 'title', header: '職稱／用途', render: (x) => x.title || '—' },
              { key: 'email', header: 'Email', render: (x) => <span className="mono">{x.email || '—'}</span> },
              { key: 'phone', header: '電話', render: (x) => <span className="mono">{x.phone || '—'}</span> },
            ]}
            empty={<EmptyState title="沒有聯絡人" />}
          />
        </Card>
      )}

      {tab === 'subscriptions' && (
        <Card bodyless title="訂閱">
          <DataTable
            caption="客戶的訂閱"
            rows={subs.data ?? []}
            rowKey={(x) => x.id}
            onRowClick={(x) => navigate(`/products/gws/${x.id}`)}
            columns={[
              { key: 'product', header: '產品', render: (x) => x.product },
              { key: 'plan', header: '方案', render: (x) => <span className="table__primary">{x.plan}</span> },
              { key: 'seats', header: '人數', align: 'right', render: (x) => <span className="tnum">{x.seats}</span> },
              { key: 'contract', header: '合約期間', render: (x) => <span className="mono">{formatDate(x.startsAt)} – {formatDate(x.expiresAt)}</span> },
              { key: 'status', header: '狀態', render: (x) => <SubscriptionStatusTag value={x.status} /> },
            ]}
            empty={<EmptyState title="沒有訂閱" />}
          />
        </Card>
      )}

      {tab === 'workOrders' && (
        <Card bodyless title="執行單">
          <DataTable
            caption="客戶的執行單"
            rows={orders.data ?? []}
            rowKey={(w) => w.id}
            onRowClick={(w) => navigate(`/work-orders/${w.id}`)}
            columns={[
              { key: 'id', header: '單號', render: (w) => <span className="mono table__primary">{w.id}</span> },
              { key: 'type', header: '類型', render: (w) => workOrderTypeLabel[w.type] },
              { key: 'summary', header: '內容', render: (w) => w.summary },
              { key: 'status', header: '狀態', render: (w) => <WorkOrderStatusTag value={w.status} /> },
              { key: 'by', header: '開單人', render: (w) => w.createdBy },
              { key: 'at', header: '開單時間', render: (w) => <span className="mono">{formatDateTime(w.createdAt)}</span> },
            ]}
            empty={<EmptyState title="沒有執行單" />}
          />
        </Card>
      )}

      {tab === 'logs' && (
        <Card title="異動歷程" bodyless actions={<span className="muted" style={{ fontSize: 'var(--text-sm)' }}>{logs.data?.length ?? 0} 筆</span>}>
          <AuditLogTable rows={logs.data ?? []} loading={logs.loading && !logs.data} />
        </Card>
      )}

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
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        title="新增一般聯絡人"
        width={480}
        footer={
          <>
            <button className="btn" onClick={() => setContactOpen(false)}>
              取消
            </button>
            <button className="btn btn--primary" disabled={!contact.name.trim()} onClick={saveContact}>
              新增
            </button>
          </>
        }
      >
        <div className="form-grid">
          <FormField label="姓名" required>{(p) => <input {...p} className="input" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />}</FormField>
          <FormField label="職稱／用途" help="例如：帳務、IT 窗口">{(p) => <input {...p} className="input" value={contact.title} onChange={(e) => setContact({ ...contact, title: e.target.value })} />}</FormField>
          <FormField label="Email">{(p) => <input {...p} className="input" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />}</FormField>
          <FormField label="電話">{(p) => <input {...p} className="input" type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />}</FormField>
        </div>
      </Modal>
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
