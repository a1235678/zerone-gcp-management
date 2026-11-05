import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createUser, getOrganizations, getRoles, getUsers, resetPassword, setUserStatus } from '@data/api';
import { orgTypeLabel, userStatusLabel } from '@data/labels';
import type { OrgType, UserListItem, UserStatus } from '@data/types';
import { Card } from '@shared/components/Card';
import { DataTable, EmptyState, type Column } from '@shared/components/DataTable';
import { FilterBar, SearchField, SelectField } from '@shared/components/FilterBar';
import { Callout, FormField } from '@shared/components/Form';
import { Icon } from '@shared/components/Icon';
import { Modal } from '@shared/components/Modal';
import { PageHeader } from '@shared/components/PageHeader';
import { Pagination, paginate } from '@shared/components/Pagination';
import { Tabs } from '@shared/components/Tabs';
import { useToast } from '@shared/components/Toast';
import { formatDateTime } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { UserStatusTag } from '../tags';

const PAGE_SIZE = 15;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Confirm = { user: UserListItem; kind: 'disable' | 'enable' | 'reset' };

export function UsersPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const orgType = (params.get('orgType') ?? '') as OrgType | '';
  const orgId = params.get('org') ?? '';
  const roleId = params.get('role') ?? '';
  const status = (params.get('status') ?? '') as UserStatus | '';
  const keyword = params.get('q') ?? '';
  const page = Number(params.get('page') ?? '1');
  const [version, setVersion] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const setParam = (entries: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(entries)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete('page');
    setParams(next, { replace: true });
  };

  const orgs = useAsync(getOrganizations, [version]);
  const roles = useAsync(() => getRoles(), [version]);
  const all = useAsync(() => getUsers(), [version]);
  const result = useAsync(() => getUsers({ orgType, orgId, roleId, status, keyword }), [orgType, orgId, roleId, status, keyword, version]);
  const rows = result.data ?? [];
  const { pageRows, pageCount, page: safePage } = paginate(rows, page, PAGE_SIZE);
  const hasFilter = Boolean(orgId || roleId || status || keyword);

  const count = (t: OrgType | '') => (all.data ?? []).filter((u) => !t || u.orgType === t).length;
  const orgOptions = (orgs.data ?? []).filter((o) => o.orgType !== 'internal' && (!orgType || o.orgType === orgType));
  const roleOptions = (roles.data ?? []).filter((r) => !orgType || r.orgType === orgType);

  const runConfirm = async () => {
    if (!confirm) return;
    const { user, kind } = confirm;
    if (kind === 'reset') {
      await resetPassword(user.id);
      toast(`已寄出重設密碼信給 ${user.email}`);
    } else {
      await setUserStatus(user.id, kind === 'disable' ? 'disabled' : 'active');
      toast(`${kind === 'disable' ? '已停用' : '已啟用'} ${user.name}`);
      setVersion((v) => v + 1);
    }
    setConfirm(null);
  };

  const columns: Column<UserListItem>[] = [
    {
      key: 'name',
      header: '名稱',
      render: (u) => (
        <div>
          <div className="table__primary">{u.name}</div>
          <div className="table__secondary mono">{u.email}</div>
        </div>
      ),
    },
    {
      key: 'org',
      header: '所屬組織',
      render: (u) => (
        <div>
          <div>{u.orgName}</div>
          <div className="table__secondary">{orgTypeLabel[u.orgType]}</div>
        </div>
      ),
    },
    {
      key: 'role',
      header: '角色',
      render: (u) => (
        <div>
          <div>{u.roleName}</div>
          {u.isFirstAdmin && <div className="table__secondary">零壹建立的第一個帳號</div>}
        </div>
      ),
    },
    { key: 'status', header: '狀態', render: (u) => <UserStatusTag value={u.status} /> },
    { key: 'login', header: '最後登入', render: (u) => (u.lastLoginAt ? <span className="mono">{formatDateTime(u.lastLoginAt)}</span> : <span className="muted">尚未登入</span>) },
    {
      key: 'ops',
      header: <span className="visually-hidden">操作</span>,
      render: (u) => (
        <div className="row-actions">
          {u.status !== 'invited' && (
            <button className="btn btn--sm" onClick={() => setConfirm({ user: u, kind: 'reset' })}>
              重設密碼
            </button>
          )}
          {u.status === 'disabled' ? (
            <button className="btn btn--sm" onClick={() => setConfirm({ user: u, kind: 'enable' })}>
              啟用
            </button>
          ) : (
            <button className="btn btn--sm btn--danger" disabled={u.id === 'U001'} title={u.id === 'U001' ? '不能停用自己' : undefined} onClick={() => setConfirm({ user: u, kind: 'disable' })}>
              停用
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="使用者"
        description="管理內部、經銷商、客戶的所有帳號。零壹建立經銷商或客戶時會一併建立第一個組織管理員；其他帳號通常由對方自行建立，零壹也可以代為新增、停用或重設密碼。"
        actions={
          <button className="btn btn--primary" onClick={() => setNewOpen(true)}>
            <Icon name="plus" size={16} />
            新增使用者
          </button>
        }
      />
      <Card bodyless>
        <Tabs
          label="依組織類型篩選"
          value={orgType}
          onChange={(v) => setParams(v ? { orgType: v } : {}, { replace: true })}
          tabs={[
            { value: '' as const, label: '全部', count: count('') },
            { value: 'internal' as const, label: '內部', count: count('internal') },
            { value: 'dealer' as const, label: '經銷商', count: count('dealer') },
            { value: 'customer' as const, label: '客戶', count: count('customer') },
          ]}
        />
        <FilterBar onReset={hasFilter ? () => setParams(orgType ? { orgType } : {}, { replace: true }) : undefined}>
          <SearchField label="關鍵字" value={keyword} onChange={(v) => setParam({ q: v })} placeholder="姓名、Email 或組織" />
          {orgType !== 'internal' && (
            <SelectField label="組織" value={orgId} onChange={(v) => setParam({ org: v })} options={orgOptions.map((o) => ({ value: o.orgId, label: o.name }))} />
          )}
          <SelectField
            label="角色"
            value={roleId}
            onChange={(v) => setParam({ role: v })}
            options={roleOptions.map((r) => ({ value: r.id, label: orgType ? r.name : `${r.name}（${r.orgId ? r.orgName : orgTypeLabel[r.orgType]}）` }))}
          />
          <SelectField label="狀態" value={status} onChange={(v) => setParam({ status: v })} options={Object.entries(userStatusLabel).map(([value, label]) => ({ value, label }))} />
        </FilterBar>
        <div className="result-meta">
          <span>{hasFilter ? `符合條件 ${rows.length} 個帳號` : `共 ${rows.length} 個帳號`}</span>
          <Pagination page={safePage} pageCount={pageCount} onChange={(p) => setParams({ ...Object.fromEntries(params), page: String(p) }, { replace: true })} />
        </div>
        <DataTable caption="帳號清單" columns={columns} rows={pageRows} rowKey={(u) => u.id} loading={result.loading && !result.data} empty={<EmptyState title="沒有符合條件的帳號" />} />
      </Card>

      <NewUserModal
        open={newOpen}
        defaultOrgType={orgType || 'internal'}
        onClose={() => setNewOpen(false)}
        onCreated={(u) => {
          setNewOpen(false);
          setVersion((v) => v + 1);
          toast(`已新增 ${u.name}，邀請信已寄到 ${u.email}`);
        }}
      />

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === 'reset' ? '重設密碼' : confirm?.kind === 'disable' ? '停用帳號' : '啟用帳號'}
        width={440}
        footer={
          <>
            <button className="btn" onClick={() => setConfirm(null)}>
              取消
            </button>
            <button className={`btn ${confirm?.kind === 'disable' ? 'btn--danger' : 'btn--primary'}`} onClick={runConfirm}>
              {confirm?.kind === 'reset' ? '寄出重設密碼信' : confirm?.kind === 'disable' ? '停用' : '啟用'}
            </button>
          </>
        }
      >
        {confirm && (
          <>
            <p>
              {confirm.user.name}（<span className="mono">{confirm.user.email}</span>）· {confirm.user.orgName}
            </p>
            <p className="muted">
              {confirm.kind === 'reset' && '系統會寄出重設密碼連結到這個 Email。'}
              {confirm.kind === 'disable' && '停用後這個帳號無法登入，可以隨時再啟用。'}
              {confirm.kind === 'enable' && '啟用後這個帳號可以再次登入。'}
            </p>
            {confirm.kind === 'disable' && confirm.user.isFirstAdmin && (
              <Callout tone="warning">這是該組織的第一個組織管理員。停用前請確認對方還有其他可管理帳號的人。</Callout>
            )}
          </>
        )}
      </Modal>
    </>
  );
}

function NewUserModal({
  open,
  defaultOrgType,
  onClose,
  onCreated,
}: {
  open: boolean;
  defaultOrgType: OrgType;
  onClose: () => void;
  onCreated: (u: UserListItem) => void;
}) {
  const toast = useToast();
  const orgs = useAsync(getOrganizations, [open]);
  const roles = useAsync(() => getRoles(), [open]);
  const [orgType, setOrgType] = useState<OrgType>(defaultOrgType);
  const [orgId, setOrgId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tried, setTried] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);

  // 每次打開時重設
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setOrgType(defaultOrgType);
      setOrgId(defaultOrgType === 'internal' ? 'ZERONE' : '');
      setRoleId('');
      setName('');
      setEmail('');
      setTried(false);
    }
  }

  const orgList = (orgs.data ?? []).filter((o) => o.orgType === orgType);
  // 可指派的角色：該組織類型的預設角色，加上該組織自建的角色
  const roleList = useMemo(
    () => (roles.data ?? []).filter((r) => r.orgType === orgType && (r.orgId === null || r.orgId === orgId)),
    [roles.data, orgType, orgId],
  );

  const errors: Record<string, string> = {};
  if (!orgId) errors.orgId = '請選擇組織';
  if (!roleId) errors.roleId = '請選擇角色';
  if (!name.trim()) errors.name = '請輸入姓名';
  if (!EMAIL.test(email)) errors.email = 'Email 格式不正確';
  const show = (k: string) => (tried ? errors[k] : undefined);

  const submit = async () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    try {
      onCreated(await createUser({ name, email, orgType, orgId, roleId }));
    } catch (e) {
      toast((e as Error).message, 'danger');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新增使用者"
      footer={
        <>
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn btn--primary" onClick={submit}>
            新增並寄出邀請
          </button>
        </>
      }
    >
      <FormField label="組織類型" required>
        {(p) => (
          <div className="segmented" role="group" aria-labelledby={p.id}>
            {(['internal', 'dealer', 'customer'] as OrgType[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={orgType === t}
                onClick={() => {
                  setOrgType(t);
                  setOrgId(t === 'internal' ? 'ZERONE' : '');
                  setRoleId('');
                }}
              >
                {orgTypeLabel[t]}
              </button>
            ))}
          </div>
        )}
      </FormField>
      {orgType !== 'internal' && (
        <FormField label={orgType === 'dealer' ? '經銷商' : '客戶'} required message={show('orgId')} state={show('orgId') ? 'error' : undefined}>
          {(p) => (
            <select
              {...p}
              className="select"
              value={orgId}
              onChange={(e) => {
                setOrgId(e.target.value);
                setRoleId('');
              }}
            >
              <option value="">請選擇</option>
              {orgList.map((o) => (
                <option key={o.orgId} value={o.orgId}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
        </FormField>
      )}
      <FormField label="角色" required message={show('roleId')} state={show('roleId') ? 'error' : undefined} help="只能指派不超過你自己權限的角色。">
        {(p) => (
          <select {...p} className="select" value={roleId} onChange={(e) => setRoleId(e.target.value)} disabled={!orgId}>
            <option value="">{orgId ? '請選擇' : '請先選擇組織'}</option>
            {roleList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.orgId ? '（自建）' : ''}
              </option>
            ))}
          </select>
        )}
      </FormField>
      <FormField label="姓名" required message={show('name')} state={show('name') ? 'error' : undefined}>
        {(p) => <input {...p} className="input" value={name} onChange={(e) => setName(e.target.value)} />}
      </FormField>
      <FormField label="Email（登入帳號）" required message={show('email')} state={show('email') ? 'error' : undefined}>
        {(p) => <input {...p} className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
      </FormField>
    </Modal>
  );
}
