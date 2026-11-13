import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { checkNewDomain, addressComplete, addCustomerContact, formatAddress, updateCustomer, type CustomerEdit, getUsers, getWorkOrders, addCustomerDomain, getAuditLogs, getCustomer, getOperations, recheckDomainVerification, removeCustomerDomain, saveSalesAssignments, setCustomerStatus } from '@data/api';
import { Card } from '@shared/components/Card';
import { DescriptionList } from '@shared/components/DescriptionList';
import { DataTable, EmptyState } from '@shared/components/DataTable';
import { Tabs } from '@shared/components/Tabs';
import { workOrderTypeLabel } from '@data/labels';
import type { CustomerContact, SalesAssignment } from '@data/types';
import { SalesAssignmentEditor, SalesAssignmentTable } from '../components/SalesAssignments';
import { FormField } from '@shared/components/Form';
import { StatusTag } from '@shared/components/StatusTag';
import { Icon } from '@shared/components/Icon';
import { Modal } from '@shared/components/Modal';
import { PageHeader } from '@shared/components/PageHeader';
import { PendingTag } from '@shared/components/PendingTag';
import { useToast } from '@shared/components/Toast';
import { formatDate, formatDateTime } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { AuditLogTable } from '../components/AuditLogTable';
import { OperationPanel } from '../components/OperationPanel';
import { CustomerStatusTag, DomainVerificationTag, OperationStatusTag, UserStatusTag, WorkOrderStatusTag } from '../tags';
import { usePermission } from '../auth';
import { AddressFields, TagInput } from '../components/CustomerFields';

/** 網域的 GWS 狀態 */
const GwsDomainTag = ({ on }: { on: boolean }) => (on ? <StatusTag tone="success">已開通 GWS</StatusTag> : <StatusTag tone="neutral">尚未開通 GWS</StatusTag>);

type DetailTab = 'org' | 'users' | 'contacts' | 'workOrders' | 'logs';

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
  const orders = useAsync(() => (can('workOrders') ? getWorkOrders({ customerId: id }) : Promise.resolve([])), [id, version]);
  const [editForm, setEditForm] = useState<CustomerEdit | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [contact, setContact] = useState<CustomerContact>({ name: '', title: '', email: '', phone: '' });
  const transfers = useAsync(() => getOperations({ customerId: id, type: 'transfer' }), [id, version]);
  const [panelId, setPanelId] = useState<string | null>(null);
  const logs = useAsync(() => getAuditLogs({ customerId: id }), [id, version]);

  const [domainOpen, setDomainOpen] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [domainHasGws, setDomainHasGws] = useState(true);
  const [salesOpen, setSalesOpen] = useState(false);
  const [salesForm, setSalesForm] = useState<SalesAssignment[]>([]);
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
    setSalesForm(c.salesAssignments.map((x) => ({ ...x })));
    setSalesOpen(true);
  };
  const saveSales = async () => {
    try {
      await saveSalesAssignments(c.id, salesForm);
      toast('已更新負責業務');
      setSalesOpen(false);
      reload();
    } catch (e) {
      toast((e as Error).message, 'danger');
    }
  };
  const domainCheck = domainInput ? checkNewDomain(domainInput, domainHasGws) : undefined;
  const addDomain = async () => {
    try {
      await addCustomerDomain(c.id, domainInput, domainHasGws);
      toast(`已新增網域 ${domainInput.trim()}`);
      setDomainOpen(false);
      reload();
    } catch (e) {
      toast((e as Error).message, 'danger');
    }
  };
  const openEdit = () =>
    setEditForm({
      name: c.name,
      shortNames: [...c.shortNames],
      contactPhone: c.contactPhone,
      contactEmail: c.contactEmail,
      contactName: c.contactName,
      registeredAddress: { ...c.registeredAddress },
      contactAddress: { ...c.contactAddress },
      contactSameAsRegistered: c.contactSameAsRegistered,
      note: c.note,
    });
  const saveEdit = async () => {
    if (!editForm) return;
    setSavingEdit(true);
    try {
      await updateCustomer(c.id, editForm);
      toast('已更新客戶資料');
      setEditForm(null);
      reload();
    } catch (e) {
      toast((e as Error).message, 'danger');
    } finally {
      setSavingEdit(false);
    }
  };
  const ef = <K extends keyof CustomerEdit>(k: K, v: CustomerEdit[K]) => setEditForm((f) => (f ? { ...f, [k]: v } : f));
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
            { value: 'users', label: '使用者帳號', count: users.data?.length },
            { value: 'contacts', label: '一般聯絡人', count: c.contacts.length },
            { value: 'workOrders', label: '執行單', count: orders.data?.length },
            { value: 'logs', label: '異動歷程' },
          ]}
        />
      </div>

      {tab === 'org' && (
        <div className="stack">
        <div className="split">
          <Card title="基本資訊" actions={canEdit ? <button className="btn btn--sm" onClick={openEdit}>編輯</button> : undefined}>
            <DescriptionList
              items={[
                { label: '公司全名', value: c.name },
                { label: '公司簡稱', value: c.shortNames.join('、') },
                { label: '統一編號', value: <span className="mono">{c.taxId}</span> },
                { label: '登記地址', value: formatAddress(c.registeredAddress), full: true },
                { label: '所屬經銷商', value: c.dealerName },
                { label: '經銷商 ID', value: <span className="mono">{c.dealerId}</span> },
                { label: '主網域', value: c.primaryDomain ? <span className="mono">{c.primaryDomain}</span> : <span className="muted">尚未有網域（GWS 新訂時填寫）</span> },
                { label: '其他網域', value: c.otherDomains.length ? <span className="mono">{c.otherDomains.join('、')}</span> : '' },
                { label: '聯絡地址', value: c.contactSameAsRegistered ? <>同登記地址</> : formatAddress(c.contactAddress), full: true },
                { label: '聯絡人姓名', value: c.contactName },
                { label: '聯絡電話', value: <span className="mono">{c.contactPhone}</span> },
                { label: '聯絡人信箱', value: <span className="mono">{c.contactEmail}</span>, full: true },
                { label: '客戶編號', value: <span className="mono">{c.id}</span> },
                { label: '建立人', value: c.createdBy },
                { label: '建立日期', value: <span className="mono">{formatDate(c.createdAt)}</span> },
                { label: '備註', value: c.note, full: true },
              ]}
            />
          </Card>

          <div className="stack">
            <Card title="負責業務" actions={canEdit ? <button className="btn btn--sm" onClick={openSales}>編輯</button> : undefined} bodyless>
              <SalesAssignmentTable rows={c.salesAssignments} />
              <p className="muted card__body" style={{ fontSize: 'var(--text-sm)', margin: 0, paddingTop: 'var(--space-3)' }}>
                GWS 到期通知會寄給所有「GWS 續約」的業務和後勤。
              </p>
            </Card>

            <Card title="網域" actions={canEdit ? <button className="btn btn--sm" onClick={() => { setDomainInput(''); setDomainHasGws(true); setDomainOpen(true); }}>新增網域</button> : undefined} bodyless>
              <ul className="list-plain domain-list">
                {c.primaryDomain ? (
                  <li>
                    <span className="mono">{c.primaryDomain}</span>
                    <span className="op-chips">
                      <StatusTag tone="info">主網域</StatusTag>
                      <GwsDomainTag on={c.gwsDomains.includes(c.primaryDomain)} />
                    </span>
                  </li>
                ) : (
                  <li>
                    <span className="muted">尚未有網域。GWS 新訂時填寫，訂閱成功後自動寫回；也可以在這裡新增。</span>
                  </li>
                )}
                {c.otherDomains.map((d) => (
                  <li key={d}>
                    <span className="mono">{d}</span>
                    <span className="op-chips">
                      <GwsDomainTag on={c.gwsDomains.includes(d)} />
                      {canEdit && (
                        <button className="btn btn--sm btn--ghost" onClick={() => removeDomain(d)}>
                          移除
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            {c.primaryDomain && (
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
            )}

            {transfers.data && transfers.data.length > 0 && (
            <Card title="客戶轉入紀錄" bodyless>
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
              ) : null}
              <p className="muted card__body" style={{ fontSize: 'var(--text-sm)', margin: 0, paddingTop: 'var(--space-3)' }}>
                點編號可以查看處理狀態，或標記人工處理完成。
              </p>
            </Card>
            )}
          </div>
        </div>

        </div>
      )}

      {tab === 'users' && (
        <Card bodyless title="使用者帳號" actions={<span className="muted" style={{ fontSize: 'var(--text-sm)' }}>零壹只建立第一個組織管理員帳號，其他由客戶自己建立</span>}>
          <DataTable
            caption="使用者帳號"
            rows={users.data ?? []}
            rowKey={(u) => u.id}
            columns={[
              { key: 'name', header: '姓名', render: (u) => <span className="table__primary">{u.name}</span> },
              { key: 'email', header: 'Email', render: (u) => <span className="mono">{u.email}</span> },
              { key: 'role', header: '角色', render: (u) => u.roleName },
              {
                key: 'products',
                header: '產品',
                render: (u) => (
                  <span className="op-chips">
                    {(u.products ?? []).map((pr) => (
                      <StatusTag key={pr} tone="neutral">
                        {pr}
                      </StatusTag>
                    ))}
                  </span>
                ),
              },
              { key: 'status', header: '狀態', render: (u) => <UserStatusTag value={u.status} /> },
              { key: 'login', header: '最後登入', render: (u) => <span className="mono">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}</span> },
            ]}
            empty={<EmptyState title="還沒有使用者" />}
          />
        </Card>
      )}

      {tab === 'contacts' && (
        <Card bodyless title={<span className="inline">一般聯絡人 <PendingTag id={26} /></span>} actions={canEdit ? <button className="btn btn--sm" onClick={() => { setContact({ name: '', title: '', email: '', phone: '' }); setContactOpen(true); }}>新增聯絡人</button> : undefined}>
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

      <OperationPanel id={panelId} onClose={() => setPanelId(null)} onChanged={reload} />
      <Modal
        open={Boolean(editForm)}
        onClose={() => setEditForm(null)}
        title="編輯客戶資料"
        width={760}
        footer={
          <>
            <button className="btn" onClick={() => setEditForm(null)}>
              取消
            </button>
            <button className="btn btn--primary" disabled={savingEdit || !editForm?.name.trim()} onClick={saveEdit}>
              儲存
            </button>
          </>
        }
      >
        {editForm && (
          <div className="stack">
            <div className="form-grid">
              <FormField label="統一編號" help="統一編號不能修改。">
                {(p) => <input {...p} className="input mono" value={c.taxId} readOnly disabled />}
              </FormField>
              <FormField label="公司全名" required message={!editForm.name.trim() ? '請輸入公司全名' : undefined} state={!editForm.name.trim() ? 'error' : undefined}>
                {(p) => <input {...p} className="input" value={editForm.name} onChange={(e) => ef('name', e.target.value)} />}
              </FormField>
              <FormField label="公司簡稱" help="可輸入多個別名，按 Enter 確認。">
                {(p) => <TagInput id={p.id} values={editForm.shortNames} onChange={(v) => ef('shortNames', v)} />}
              </FormField>
              <FormField label="所屬經銷商" help="所屬經銷商不在這裡修改。">
                {(p) => <input {...p} className="input" value={`${c.dealerName}（${c.dealerId}）`} readOnly disabled />}
              </FormField>
            </div>
            <div>
              <h3 className="form-section__title" style={{ marginBottom: 'var(--space-3)' }}>登記地址</h3>
              <AddressFields label="登記地址" value={editForm.registeredAddress} onChange={(a) => ef('registeredAddress', a)} />
            </div>
            <div>
              <div className="inline" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <h3 className="form-section__title" style={{ margin: 0 }}>
                  聯絡地址 <span className="form-field__req">必填</span>
                </h3>
                <label className="inline checkbox-row">
                  <input type="checkbox" checked={editForm.contactSameAsRegistered} onChange={(e) => ef('contactSameAsRegistered', e.target.checked)} />
                  同登記地址
                </label>
              </div>
              <AddressFields
                label="聯絡地址"
                value={editForm.contactSameAsRegistered ? editForm.registeredAddress : editForm.contactAddress}
                onChange={(a) => ef('contactAddress', a)}
                disabled={editForm.contactSameAsRegistered}
              />
              {!addressComplete(editForm.contactSameAsRegistered ? editForm.registeredAddress : editForm.contactAddress) && (
                <div className="form-field__msg form-field__msg--error">請填寫完整的聯絡地址（縣市、鄉鎮區、街道）</div>
              )}
            </div>
            <div>
              <h3 className="form-section__title" style={{ marginBottom: 'var(--space-3)' }}>聯絡人</h3>
              <div className="form-grid">
                <FormField label="聯絡人姓名" required>{(p) => <input {...p} className="input" value={editForm.contactName} onChange={(e) => ef('contactName', e.target.value)} />}</FormField>
                <FormField label="聯絡電話">{(p) => <input {...p} className="input" type="tel" value={editForm.contactPhone} onChange={(e) => ef('contactPhone', e.target.value)} />}</FormField>
                <FormField label="聯絡人信箱" required>{(p) => <input {...p} className="input" type="email" value={editForm.contactEmail} onChange={(e) => ef('contactEmail', e.target.value)} />}</FormField>
              </div>
            </div>
            <FormField label="備註" help={`${editForm.note.length} / 2000`}>
              {(p) => <textarea {...p} className="textarea" maxLength={2000} value={editForm.note} onChange={(e) => ef('note', e.target.value)} />}
            </FormField>
            <p className="muted" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
              主網域、其他網域請在「網域」卡片管理；所屬經銷商不在這裡修改。
            </p>
          </div>
        )}
      </Modal>
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
        width={520}
        footer={
          <>
            <button className="btn" onClick={() => setDomainOpen(false)}>
              取消
            </button>
            <button className="btn btn--primary" disabled={!domainCheck?.ok} onClick={addDomain}>
              {domainHasGws ? '綁定網域' : '新增網域'}
            </button>
          </>
        }
      >
        <fieldset className="plain-fieldset" style={{ marginBottom: 'var(--space-4)' }}>
          <legend className="form-field__label">這個網域的 GWS 狀態</legend>
          <label className="radio-row">
            <input type="radio" name="domainGws" checked={domainHasGws} onChange={() => setDomainHasGws(true)} />
            <span>
              <strong>綁定已開通 GWS 的網域</strong>
              <br />
              <span className="muted">這個網域已經在使用 Google Workspace（例如客戶先前自己向 Google 購買）。網域必須在 GWS 訂閱主檔裡；綁定後，它的 GWS 訂閱會掛到這個客戶。</span>
            </span>
          </label>
          <label className="radio-row">
            <input type="radio" name="domainGws" checked={!domainHasGws} onChange={() => setDomainHasGws(false)} />
            <span>
              <strong>新增尚未開通 GWS 的網域</strong>
              <br />
              <span className="muted">客戶有這個網域，但還沒開通 Google Workspace。網域不可以在 GWS 訂閱主檔裡；先登記到客戶主檔，之後新訂 GWS 時可以直接選用。</span>
            </span>
          </label>
          {domainHasGws && (
            <div className="inline">
              <PendingTag id={3} hint="能否從 API 抓到已購買的方案" />
            </div>
          )}
        </fieldset>
        <FormField
          label="網域"
          required
          help={`${c.primaryDomain ? '會加到其他網域。' : '這個客戶還沒有網域，新增的網域會成為主網域。'}${domainHasGws ? 'Prototype 測試用：hefeng-shop.example、galaxy-esports.example、oneleaf-cafe.example 在 GWS 訂閱主檔裡。' : ''}`}
          message={domainCheck && !domainCheck.ok ? domainCheck.message : domainCheck?.ok ? (domainHasGws ? '在 GWS 訂閱主檔裡找到這個網域，可以綁定' : 'GWS 訂閱主檔裡沒有這個網域，可以新增') : undefined}
          state={domainCheck ? (domainCheck.ok ? 'success' : 'error') : undefined}
        >
          {(p) => <input {...p} className="input mono" spellCheck={false} autoCapitalize="off" value={domainInput} onChange={(e) => setDomainInput(e.target.value)} />}
        </FormField>
      </Modal>
      <Modal
        open={salesOpen}
        onClose={() => setSalesOpen(false)}
        title="編輯負責業務"
        width={720}
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
        <SalesAssignmentEditor value={salesForm} onChange={setSalesForm} />
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
