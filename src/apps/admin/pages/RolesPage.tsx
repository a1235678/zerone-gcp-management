import { useState } from 'react';
import { getMyPermissions, getOrganizations, getRoles, saveRole } from '@data/api';
import { orgTypeLabel, permissionLabel, resourceLabel, resourceOrder } from '@data/labels';
import type { OrgType, PermissionLevel, ResourceKey, Role, RoleListItem } from '@data/types';
import { Card } from '@shared/components/Card';
import { DataTable, type Column } from '@shared/components/DataTable';
import { Callout, FormField } from '@shared/components/Form';
import { Icon } from '@shared/components/Icon';
import { Modal } from '@shared/components/Modal';
import { PageHeader } from '@shared/components/PageHeader';
import { PendingTag } from '@shared/components/PendingTag';
import { StatusTag } from '@shared/components/StatusTag';
import { Tabs } from '@shared/components/Tabs';
import { useToast } from '@shared/components/Toast';
import { useAsync } from '@shared/hooks/useAsync';
import { useAuth, usePermission } from '../auth';

const levels: PermissionLevel[] = ['none', 'read', 'write'];
const rank: Record<PermissionLevel, number> = { none: 0, read: 1, write: 2 };

// 可編輯、唯讀用標籤；禁止只顯示淡色文字，讓表格一眼看出有權限的地方
const LevelTag = ({ level }: { level: PermissionLevel }) =>
  level === 'none' ? <span className="muted">{permissionLabel[level]}</span> : <StatusTag tone={level === 'write' ? 'info' : 'neutral'}>{permissionLabel[level]}</StatusTag>;

/** 資源欄位標題；「帳單」是否為獨立權限尚未決定 */
const ResourceHeader = ({ r }: { r: ResourceKey }) =>
  r === 'billing' ? (
    <span className="inline">
      {resourceLabel[r]}
      <PendingTag id={2} />
    </span>
  ) : (
    <>{resourceLabel[r]}</>
  );

type Draft = Omit<Role, 'id'> & { id?: string };

export function RolesPage() {
  const { can } = usePermission();
  const toast = useToast();
  const [orgType, setOrgType] = useState<OrgType | ''>('');
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<Draft | null>(null);
  const all = useAsync(() => getRoles(), [version]);
  const rows = (all.data ?? []).filter((r) => !orgType || r.orgType === orgType);
  const count = (t: OrgType | '') => (all.data ?? []).filter((r) => !t || r.orgType === t).length;

  const columns: Column<RoleListItem>[] = [
    {
      key: 'name',
      header: '角色',
      render: (r) => (
        <div>
          <div className="table__primary">{r.name}</div>
          <div className="table__secondary">{r.isPreset ? `預設角色 · ${orgTypeLabel[r.orgType]}` : `自建 · ${r.orgName}`}</div>
        </div>
      ),
    },
    { key: 'users', header: '帳號數', align: 'right', render: (r) => <span className="tnum">{r.userCount}</span> },
    ...resourceOrder.map((res) => ({
      key: res,
      header: <ResourceHeader r={res} />,
      render: (r: RoleListItem) => <LevelTag level={r.permissions[res]} />,
    })),
  ];

  const startNew = () =>
    setEditing({
      name: '',
      orgType: 'internal',
      orgId: null,
      description: '',
      isPreset: false,
      permissions: Object.fromEntries(resourceOrder.map((r) => [r, 'none'])) as Role['permissions'],
    });

  return (
    <>
      <PageHeader
        title="角色管理"
        description="每個資源設定「禁止、唯讀、可編輯」三種等級。經銷商與客戶的組織管理員可以自建角色；任何帳號都不能授予比自己更大的權限。"
        actions={
          can('roles', 'write') ? (
            <button className="btn btn--primary" onClick={startNew}>
              <Icon name="plus" size={16} />
              新增角色
            </button>
          ) : undefined
        }
      />
      <Card bodyless>
        <Tabs
          label="依組織類型篩選"
          value={orgType}
          onChange={setOrgType}
          tabs={[
            { value: '' as const, label: '全部', count: count('') },
            { value: 'internal' as const, label: '內部', count: count('internal') },
            { value: 'dealer' as const, label: '經銷商', count: count('dealer') },
            { value: 'customer' as const, label: '客戶', count: count('customer') },
          ]}
        />
        <div className="result-meta">
          <span>{can('roles', 'write') ? '點選角色可以修改權限' : '點選角色可以查看權限'}</span>
        </div>
        <DataTable
          caption="角色與權限對照"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={all.loading && !all.data}
          onRowClick={(r) => setEditing(structuredClone(r))}
        />
      </Card>

      {editing && (
        <RoleEditor
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={(name, isNew) => {
            setEditing(null);
            setVersion((v) => v + 1);
            toast(isNew ? `已新增角色「${name}」` : `已更新「${name}」的權限`);
          }}
        />
      )}
    </>
  );
}

function RoleEditor({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: (name: string, isNew: boolean) => void }) {
  const toast = useToast();
  const { session } = useAuth();
  const mine = useAsync(getMyPermissions);
  const orgs = useAsync(getOrganizations);
  const [role, setRole] = useState<Draft>(draft);
  const [tried, setTried] = useState(false);
  const isNew = !draft.id;
  const readOnly = !usePermission().can('roles', 'write');

  const setLevel = (r: ResourceKey, level: PermissionLevel) => setRole((x) => ({ ...x, permissions: { ...x.permissions, [r]: level } }));
  const nameError = tried && !role.name.trim() ? '請輸入角色名稱' : undefined;
  const orgError = tried && role.orgType !== 'internal' && !role.orgId && isNew ? '請選擇組織' : undefined;

  const save = async () => {
    setTried(true);
    if (!role.name.trim() || (isNew && role.orgType !== 'internal' && !role.orgId)) return;
    try {
      await saveRole(role);
      onSaved(role.name.trim(), isNew);
    } catch (e) {
      toast((e as Error).message, 'danger');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={640}
      title={isNew ? '新增角色' : readOnly ? `查看角色：${draft.name}` : `編輯角色：${draft.name}`}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            取消
          </button>
          {!readOnly && (
            <button className="btn btn--primary" onClick={save}>
              儲存
            </button>
          )}
        </>
      }
    >
      <fieldset className="plain-fieldset" disabled={readOnly}>
      <FormField label="角色名稱" required message={nameError} state={nameError ? 'error' : undefined}>
        {(p) => <input {...p} className="input" value={role.name} onChange={(e) => setRole({ ...role, name: e.target.value })} />}
      </FormField>
      {isNew ? (
        <>
          <FormField label="所屬組織類型" required>
            {(p) => (
              <div className="segmented" role="group" aria-labelledby={p.id}>
                {(['internal', 'dealer', 'customer'] as OrgType[]).map((t) => (
                  <button key={t} type="button" aria-pressed={role.orgType === t} onClick={() => setRole({ ...role, orgType: t, orgId: null })}>
                    {orgTypeLabel[t]}
                  </button>
                ))}
              </div>
            )}
          </FormField>
          {role.orgType !== 'internal' && (
            <FormField label={role.orgType === 'dealer' ? '經銷商' : '客戶'} required message={orgError} state={orgError ? 'error' : undefined} help="代替該組織建立角色，只有該組織的帳號可以使用。">
              {(p) => (
                <select {...p} className="select" value={role.orgId ?? ''} onChange={(e) => setRole({ ...role, orgId: e.target.value || null })}>
                  <option value="">請選擇</option>
                  {(orgs.data ?? [])
                    .filter((o) => o.orgType === role.orgType)
                    .map((o) => (
                      <option key={o.orgId} value={o.orgId}>
                        {o.name}
                      </option>
                    ))}
                </select>
              )}
            </FormField>
          )}
        </>
      ) : (
        <Callout tone="neutral">
          {draft.isPreset ? `預設角色 · ${orgTypeLabel[draft.orgType]}` : `自建角色 · ${orgTypeLabel[draft.orgType]}`}。修改後會立即套用到使用這個角色的所有帳號。
        </Callout>
      )}
      <FormField label="說明">
        {(p) => <input {...p} className="input" value={role.description} onChange={(e) => setRole({ ...role, description: e.target.value })} />}
      </FormField>

      <div>
        <div className="form-field__label" style={{ marginBottom: 'var(--space-2)' }}>
          資源權限
        </div>
        <div className="perm-table" role="table" aria-label="資源權限">
          {resourceOrder.map((r) => {
            const cap = mine.data?.[r] ?? 'write';
            return (
              <div className="perm-row" role="row" key={r}>
                <div role="rowheader" className="perm-row__name">
                  <ResourceHeader r={r} />
                </div>
                <div role="cell" className="segmented" aria-label={`${resourceLabel[r]}權限`}>
                  {levels.map((l) => (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={role.permissions[r] === l}
                      disabled={rank[l] > rank[cap]}
                      title={rank[l] > rank[cap] ? '超過你自己的權限，不能授予' : undefined}
                      onClick={() => setLevel(r, l)}
                    >
                      {permissionLabel[l]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="muted" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
          超過你自己權限的選項會停用（你目前的角色是「{session?.role}」）。
        </p>
      </div>
      </fieldset>
    </Modal>
  );
}
