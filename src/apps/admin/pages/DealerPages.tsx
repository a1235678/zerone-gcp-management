import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  addressComplete,
  createDealer,
  emptyAddress,
  formatAddress,
  getAuditLogs,
  getCustomers,
  getDealer,
  getUsers,
  lookupTaxId,
  nextDealerId,
  updateDealer,
  type DealerInput,
} from '@data/api';
import { Card } from '@shared/components/Card';
import { DataTable, EmptyState } from '@shared/components/DataTable';
import { DescriptionList } from '@shared/components/DescriptionList';
import { Callout, FormField, FormSection } from '@shared/components/Form';
import { Icon } from '@shared/components/Icon';
import { Modal } from '@shared/components/Modal';
import { PageHeader } from '@shared/components/PageHeader';
import { PendingTag } from '@shared/components/PendingTag';
import { Tabs } from '@shared/components/Tabs';
import { useToast } from '@shared/components/Toast';
import { formatDate, formatDateTime } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { AuditLogTable } from '../components/AuditLogTable';
import { AddressFields, TagInput } from '../components/CustomerFields';
import { CustomerStatusTag, DealerStatusTag, UserStatusTag } from '../tags';
import { usePermission } from '../auth';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emptyDealer = (): DealerInput => ({
  name: '',
  shortNames: [],
  taxId: '',
  registeredAddress: emptyAddress(),
  contactAddress: emptyAddress(),
  contactSameAsRegistered: true,
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  note: '',
});

/** 經銷商主檔欄位（新增頁與編輯視窗共用）。第一版，欄位待 Connie 確認 #29 */
function DealerFields({ value, onChange, idText, taxIdLocked, showErrors }: { value: DealerInput; onChange: (v: DealerInput) => void; idText: string; taxIdLocked?: boolean; showErrors: boolean }) {
  const set = <K extends keyof DealerInput>(k: K, v: DealerInput[K]) => onChange({ ...value, [k]: v });
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<{ text: string; tone: 'success' | 'error' }>();
  const err = (cond: boolean, msg: string) => (showErrors && cond ? msg : undefined);
  const lookup = async () => {
    setLookingUp(true);
    setLookupMsg(undefined);
    try {
      const r = await lookupTaxId(value.taxId);
      if (r) {
        onChange({ ...value, name: r.name, registeredAddress: r.address });
        setLookupMsg({ text: `已帶入：${r.name}`, tone: 'success' });
      } else setLookupMsg({ text: '查無登記資料，請手動輸入', tone: 'error' });
    } catch (e) {
      setLookupMsg({ text: (e as Error).message, tone: 'error' });
    } finally {
      setLookingUp(false);
    }
  };
  const contactAddrOk = addressComplete(value.contactSameAsRegistered ? value.registeredAddress : value.contactAddress);
  return (
    <>
      <FormSection title="基本資訊">
        <FormField label="經銷商 ID" help="建立時自動產生；客戶主檔選擇經銷商後會帶出這個 ID。">
          {(p) => <input {...p} className="input mono" readOnly value={idText} />}
        </FormField>
        <FormField
          label="統一編號"
          required
          message={err(!/^\d{8}$/.test(value.taxId), '統一編號為 8 位數字') ?? lookupMsg?.text}
          state={err(!/^\d{8}$/.test(value.taxId), 'x') ? 'error' : lookupMsg?.tone}
          help={taxIdLocked ? '統一編號不能修改。' : '輸入 8 碼後按「查詢」，會帶入名稱與登記地址。'}
        >
          {(p) => (
            <div className="input-with-button">
              <input {...p} className="input mono" inputMode="numeric" maxLength={8} disabled={taxIdLocked} value={value.taxId} onChange={(e) => set('taxId', e.target.value)} />
              {!taxIdLocked && (
                <button type="button" className="btn" disabled={lookingUp || !/^\d{8}$/.test(value.taxId)} onClick={lookup}>
                  <Icon name="search" size={16} />
                  {lookingUp ? '查詢中…' : '查詢'}
                </button>
              )}
            </div>
          )}
        </FormField>
        <FormField label="經銷商名稱（公司全名）" required message={err(!value.name.trim(), '請輸入經銷商名稱')} state={err(!value.name.trim(), 'x') ? 'error' : undefined}>
          {(p) => <input {...p} className="input" value={value.name} onChange={(e) => set('name', e.target.value)} />}
        </FormField>
        <FormField label="公司簡稱" help="清單上顯示第一個簡稱。可輸入多個，按 Enter 確認。">
          {(p) => <TagInput id={p.id} values={value.shortNames} onChange={(v) => set('shortNames', v)} />}
        </FormField>
      </FormSection>

      <FormSection title="登記地址（公司法定登記地）">
        <div className="is-full">
          <AddressFields label="登記地址" value={value.registeredAddress} onChange={(a) => set('registeredAddress', a)} />
        </div>
      </FormSection>

      <FormSection title="聯絡資訊">
        <div className="is-full section-subhead">
          <span className="form-field__label">
            聯絡地址 <span className="form-field__req">必填</span>
          </span>
          <label className="inline checkbox-row">
            <input type="checkbox" checked={value.contactSameAsRegistered} onChange={(e) => set('contactSameAsRegistered', e.target.checked)} />
            同登記地址
          </label>
        </div>
        <div className="is-full">
          <AddressFields
            label="聯絡地址"
            value={value.contactSameAsRegistered ? value.registeredAddress : value.contactAddress}
            onChange={(a) => set('contactAddress', a)}
            disabled={value.contactSameAsRegistered}
          />
          {showErrors && !contactAddrOk && <div className="form-field__msg form-field__msg--error">請填寫完整的聯絡地址（縣市、鄉鎮區、街道）</div>}
        </div>
        <div className="is-full section-subhead">
          <span className="form-field__label">聯絡人</span>
        </div>
        <FormField label="聯絡人姓名" required message={err(!value.contactName.trim(), '請輸入聯絡人姓名')} state={err(!value.contactName.trim(), 'x') ? 'error' : undefined}>
          {(p) => <input {...p} className="input" value={value.contactName} onChange={(e) => set('contactName', e.target.value)} />}
        </FormField>
        <FormField label="聯絡電話">{(p) => <input {...p} className="input" type="tel" value={value.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />}</FormField>
        <FormField label="聯絡人信箱" required message={err(!EMAIL.test(value.contactEmail), '信箱格式不正確')} state={err(!EMAIL.test(value.contactEmail), 'x') ? 'error' : undefined}>
          {(p) => <input {...p} className="input" type="email" value={value.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />}
        </FormField>
        <div />
      </FormSection>

      <FormSection title="其他資訊">
        <FormField label="備註" className="is-full" help={`${value.note.length} / 2000`}>
          {(p) => <textarea {...p} className="textarea" maxLength={2000} value={value.note} onChange={(e) => set('note', e.target.value)} />}
        </FormField>
      </FormSection>
    </>
  );
}

const dealerValid = (v: DealerInput) =>
  Boolean(v.name.trim() && /^\d{8}$/.test(v.taxId) && v.contactName.trim() && EMAIL.test(v.contactEmail) && addressComplete(v.contactSameAsRegistered ? v.registeredAddress : v.contactAddress));

export function NewDealerPage() {
  const { can } = usePermission();
  const navigate = useNavigate();
  const toast = useToast();
  const [value, setValue] = useState<DealerInput>(emptyDealer());
  const [sameAsContact, setSameAsContact] = useState(true);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const admin = sameAsContact ? { adminName: value.contactName, adminEmail: value.contactEmail } : { adminName, adminEmail };

  if (!can('dealers', 'create'))
    return (
      <Callout tone="warning" title="你的角色沒有權限">
        你的角色不能新增經銷商。
      </Callout>
    );

  const submit = async () => {
    setTried(true);
    if (!dealerValid(value) || !admin.adminName.trim() || !EMAIL.test(admin.adminEmail)) {
      toast('還有欄位要處理', 'danger');
      return;
    }
    setSaving(true);
    try {
      const d = await createDealer({ ...value, ...admin });
      toast(`已新增「${d.name}」（${d.id}），並寄出組織管理員邀請`);
      navigate(`/dealers/${d.id}`);
    } catch (e) {
      toast((e as Error).message, 'danger');
      setSaving(false);
    }
  };

  return (
    <>
      <Link to="/dealers" className="back-link">
        <Icon name="chevronLeft" size={14} />
        經銷商管理
      </Link>
      <PageHeader title="新增經銷商" titleAddon={<PendingTag id={29} />} description="建立經銷商主檔，同時建立經銷商的第一個「組織管理員」帳號。經銷商統一在這裡維護，客戶主檔不再標示「是否為經銷商」。" />
      <form className="card form-card" onSubmit={(e) => e.preventDefault()} noValidate>
        <div className="card__body">
          <DealerFields value={value} onChange={setValue} idText={`${nextDealerId()}（建立後產生）`} showErrors={tried} />
          <FormSection title="第一個組織管理員帳號" description="零壹只建立這一個帳號；其他帳號與角色由經銷商自己建立。">
            <label className="inline is-full">
              <input type="checkbox" checked={sameAsContact} onChange={(e) => setSameAsContact(e.target.checked)} />
              與聯絡人相同
            </label>
            <FormField label="姓名" required message={tried && !admin.adminName.trim() ? '請輸入姓名' : undefined} state={tried && !admin.adminName.trim() ? 'error' : undefined}>
              {(p) => <input {...p} className="input" disabled={sameAsContact} value={admin.adminName} onChange={(e) => setAdminName(e.target.value)} />}
            </FormField>
            <FormField label="Email（登入帳號）" required message={tried && !EMAIL.test(admin.adminEmail) ? 'Email 格式不正確' : undefined} state={tried && !EMAIL.test(admin.adminEmail) ? 'error' : undefined}>
              {(p) => <input {...p} className="input" type="email" disabled={sameAsContact} value={admin.adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />}
            </FormField>
          </FormSection>
        </div>
        <div className="form-actions">
          <span className="form-actions__hint">{dealerValid(value) ? '資料完整，可以建立' : '請完成必填欄位'}</span>
          <Link to="/dealers" className="btn">
            取消
          </Link>
          <button type="button" className="btn btn--primary" disabled={saving} onClick={submit}>
            建立經銷商
          </button>
        </div>
      </form>
    </>
  );
}

type DealerTab = 'info' | 'customers' | 'users' | 'logs';

export function DealerDetailPage() {
  const { id = '' } = useParams();
  const { can } = usePermission();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') ?? 'info') as DealerTab;
  const [version, setVersion] = useState(0);
  const dealer = useAsync(() => getDealer(id), [id, version]);
  const customers = useAsync(() => getCustomers({ dealerId: id }), [id, version]);
  const users = useAsync(() => getUsers({ orgType: 'dealer', orgId: id }), [id, version]);
  const logs = useAsync(() => (dealer.data ? getAuditLogs({ keyword: dealer.data.shortNames[0] ?? dealer.data.name }) : Promise.resolve([])), [dealer.data?.name, version]);
  const [edit, setEdit] = useState<DealerInput | null>(null);
  const [tried, setTried] = useState(false);

  const d = dealer.data;
  if (dealer.loading && !d) return <p className="muted">載入中…</p>;
  if (!d)
    return (
      <Card>
        <EmptyState title="找不到這個經銷商" />
      </Card>
    );

  const save = async () => {
    if (!edit) return;
    setTried(true);
    if (!dealerValid(edit)) return;
    try {
      await updateDealer(d.id, edit);
      toast('已更新經銷商資料');
      setEdit(null);
      setVersion((v) => v + 1);
    } catch (e) {
      toast((e as Error).message, 'danger');
    }
  };

  return (
    <>
      <Link to="/dealers" className="back-link">
        <Icon name="chevronLeft" size={14} />
        經銷商管理
      </Link>
      <PageHeader
        title={d.name}
        titleAddon={
          <>
            <DealerStatusTag value={d.status} />
            <PendingTag id={29} />
          </>
        }
        description={
          <span className="inline">
            <span className="mono">{d.id}</span>
            <span>·</span>
            <span>名下客戶 {d.customerCount}</span>
            <span>·</span>
            <span>總席次 {d.totalSeats}</span>
          </span>
        }
        actions={
          can('dealers', 'write') && !d.isDirect ? (
            <button
              className="btn"
              onClick={() => {
                setTried(false);
                const { name, shortNames, taxId, registeredAddress, contactAddress, contactSameAsRegistered, contactName, contactPhone, contactEmail, note } = d;
                setEdit({ name, shortNames: [...shortNames], taxId, registeredAddress: { ...registeredAddress }, contactAddress: { ...contactAddress }, contactSameAsRegistered, contactName, contactPhone, contactEmail, note });
              }}
            >
              編輯
            </button>
          ) : undefined
        }
      />

      <div className="page-tabs">
        <Tabs<DealerTab>
          label="經銷商分頁"
          value={tab}
          onChange={(v) => setParams(v === 'info' ? {} : { tab: v }, { replace: true })}
          tabs={[
            { value: 'info', label: '經銷商資訊' },
            { value: 'customers', label: '名下客戶', count: customers.data?.length },
            { value: 'users', label: '使用者帳號', count: users.data?.length },
            { value: 'logs', label: '異動歷程' },
          ]}
        />
      </div>

      {tab === 'info' && (
        <Card title="基本資訊">
          <DescriptionList
            items={[
              { label: '經銷商 ID', value: <span className="mono">{d.id}</span> },
              { label: '統一編號', value: <span className="mono">{d.taxId}</span> },
              { label: '經銷商名稱（公司全名）', value: d.name },
              { label: '公司簡稱', value: d.shortNames.join('、') },
              { label: '登記地址', value: formatAddress(d.registeredAddress), full: true },
              { label: '聯絡地址', value: d.contactSameAsRegistered ? '同登記地址' : formatAddress(d.contactAddress), full: true },
              { label: '聯絡人姓名', value: d.contactName },
              { label: '聯絡電話', value: <span className="mono">{d.contactPhone}</span> },
              { label: '聯絡人信箱', value: <span className="mono">{d.contactEmail}</span> },
              { label: '建立日期', value: <span className="mono">{formatDate(d.createdAt)}</span> },
              { label: '備註', value: d.note, full: true },
            ]}
          />
          {d.isDirect && (
            <p className="muted" style={{ margin: 'var(--space-3) 0 0', fontSize: 'var(--text-sm)' }}>
              「直銷（零壹）」是零壹自己，不能修改。
            </p>
          )}
        </Card>
      )}

      {tab === 'customers' && (
        <Card bodyless title="名下客戶">
          <DataTable
            caption="名下客戶"
            rows={customers.data ?? []}
            rowKey={(c) => c.id}
            onRowClick={(c) => navigate(`/customers/${c.id}`)}
            columns={[
              { key: 'name', header: '客戶', render: (c) => <span className="table__primary">{c.name}</span> },
              { key: 'taxId', header: '統一編號', render: (c) => <span className="mono">{c.taxId}</span> },
              { key: 'domain', header: '主網域', render: (c) => <span className="mono">{c.primaryDomain || '—'}</span> },
              { key: 'status', header: '狀態', render: (c) => <CustomerStatusTag value={c.status} /> },
            ]}
            empty={<EmptyState title="還沒有客戶" />}
          />
        </Card>
      )}

      {tab === 'users' && (
        <Card bodyless title="使用者帳號" actions={<span className="muted" style={{ fontSize: 'var(--text-sm)' }}>零壹只建立第一個組織管理員帳號，其他由經銷商自己建立</span>}>
          <DataTable
            caption="經銷商使用者帳號"
            rows={users.data ?? []}
            rowKey={(u) => u.id}
            columns={[
              { key: 'name', header: '姓名', render: (u) => <span className="table__primary">{u.name}</span> },
              { key: 'email', header: 'Email', render: (u) => <span className="mono">{u.email}</span> },
              { key: 'role', header: '角色', render: (u) => u.roleName },
              { key: 'status', header: '狀態', render: (u) => <UserStatusTag value={u.status} /> },
              { key: 'login', header: '最後登入', render: (u) => <span className="mono">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}</span> },
            ]}
            empty={<EmptyState title={d.isDirect ? '直銷由零壹內部帳號處理' : '還沒有帳號'} />}
          />
        </Card>
      )}

      {tab === 'logs' && (
        <Card bodyless title="異動歷程">
          <AuditLogTable rows={logs.data ?? []} loading={logs.loading && !logs.data} />
        </Card>
      )}

      <Modal
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title="編輯經銷商資料"
        width={760}
        footer={
          <>
            <button className="btn" onClick={() => setEdit(null)}>
              取消
            </button>
            <button className="btn btn--primary" onClick={save}>
              儲存
            </button>
          </>
        }
      >
        {edit && <DealerFields value={edit} onChange={setEdit} idText={d.id} taxIdLocked showErrors={tried} />}
      </Modal>
    </>
  );
}
