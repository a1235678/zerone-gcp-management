import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createDealer, getDealerList } from '@data/api';
import { dealerStatusLabel } from '@data/labels';
import type { DealerListItem } from '@data/types';
import { Card } from '@shared/components/Card';
import { DataTable, EmptyState, type Column } from '@shared/components/DataTable';
import { FilterBar, SearchField, SelectField } from '@shared/components/FilterBar';
import { Callout, FormField } from '@shared/components/Form';
import { Icon } from '@shared/components/Icon';
import { Modal } from '@shared/components/Modal';
import { PageHeader } from '@shared/components/PageHeader';
import { useToast } from '@shared/components/Toast';
import { formatDate, formatNumber } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { DealerStatusTag } from '../tags';
import { usePermission } from '../auth';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function DealersPage() {
  const { can } = usePermission();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const keyword = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState(false);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const result = useAsync(() => getDealerList({ keyword, status }), [keyword, status, version]);
  const rows = result.data ?? [];
  const totals = rows.reduce((t, d) => ({ customers: t.customers + d.customerCount, seats: t.seats + d.totalSeats }), { customers: 0, seats: 0 });

  const columns: Column<DealerListItem>[] = [
    {
      key: 'name',
      header: '經銷商',
      render: (d) => (
        <div>
          <div className="table__primary">{d.name}</div>
          <div className="table__secondary mono">{d.id}</div>
        </div>
      ),
    },
    { key: 'code', header: '經銷商代碼', render: (d) => <span className="mono">{d.code}</span> },
    {
      key: 'customers',
      header: '名下客戶',
      align: 'right',
      render: (d) => (
        <button
          type="button"
          className="link-button tnum"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/customers?dealer=${d.id}`);
          }}
        >
          {d.customerCount}
        </button>
      ),
    },
    { key: 'seats', header: '總席次', align: 'right', render: (d) => <span className="tnum">{formatNumber(d.totalSeats)}</span> },
    {
      key: 'accounts',
      header: '帳號數',
      align: 'right',
      render: (d) =>
        d.isDirect ? (
          <span className="muted" title="直銷由零壹內部帳號處理">內部</span>
        ) : (
          <button
            type="button"
            className="link-button tnum"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/system/users?orgType=dealer&org=${d.id}`);
            }}
          >
            {d.accountCount}
          </button>
        ),
    },
    { key: 'createdAt', header: '建立日期', render: (d) => <span className="mono">{formatDate(d.createdAt)}</span> },
    { key: 'status', header: '狀態', render: (d) => <DealerStatusTag value={d.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="經銷商管理"
        description="「直銷（零壹）」也列為一個經銷商。總席次為名下客戶 GWS 訂閱（不含已取消）的席次加總。"
        actions={
          can('dealers', 'write') ? (
            <button className="btn btn--primary" onClick={() => setOpen(true)}>
              <Icon name="plus" size={16} />
              新增經銷商
            </button>
          ) : undefined
        }
      />
      <Card bodyless>
        <FilterBar onReset={keyword || status ? () => setParams({}, { replace: true }) : undefined}>
          <SearchField label="關鍵字" value={keyword} onChange={(v) => setParam('q', v)} placeholder="經銷商名稱" />
          <SelectField
            label="狀態"
            value={status}
            onChange={(v) => setParam('status', v)}
            options={Object.entries(dealerStatusLabel).map(([value, label]) => ({ value, label }))}
          />
        </FilterBar>
        <div className="result-meta">
          <span>
            共 {rows.length} 家 · 客戶 {totals.customers} · 席次 {formatNumber(totals.seats)}
          </span>
        </div>
        <DataTable
          caption="經銷商清單"
          columns={columns}
          rows={rows}
          rowKey={(d) => d.id}
          loading={result.loading && !result.data}
          onRowClick={(d) => navigate(`/customers?dealer=${d.id}`)}
          empty={<EmptyState title="沒有符合條件的經銷商" />}
        />
      </Card>
      <NewDealerModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(name) => {
          setOpen(false);
          setVersion((v) => v + 1);
          toast(`已新增「${name}」，並寄出組織管理員邀請`);
        }}
      />
    </>
  );
}

function NewDealerModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (name: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = '請輸入經銷商名稱';
  if (!adminName.trim()) errors.adminName = '請輸入姓名';
  if (!EMAIL.test(adminEmail)) errors.adminEmail = 'Email 格式不正確';
  const show = (k: string) => (tried ? errors[k] : undefined);

  const reset = () => {
    setName('');
    setAdminName('');
    setAdminEmail('');
    setTried(false);
    setSaving(false);
  };

  const submit = async () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      const d = await createDealer({ name, adminName, adminEmail });
      reset();
      onCreated(d.name);
    } catch (e) {
      toast((e as Error).message, 'danger');
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="新增經銷商"
      footer={
        <>
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn btn--primary" disabled={saving} onClick={submit}>
            建立經銷商
          </button>
        </>
      }
    >
      <FormField label="經銷商名稱" required message={show('name')} state={show('name') ? 'error' : undefined}>
        {(p) => <input {...p} className="input" value={name} onChange={(e) => setName(e.target.value)} />}
      </FormField>
      <Callout tone="neutral" title="第一個組織管理員帳號">
        零壹只建立這一個帳號，其他帳號與角色由經銷商自己建立。
      </Callout>
      <FormField label="姓名" required message={show('adminName')} state={show('adminName') ? 'error' : undefined}>
        {(p) => <input {...p} className="input" value={adminName} onChange={(e) => setAdminName(e.target.value)} />}
      </FormField>
      <FormField label="Email（登入帳號）" required message={show('adminEmail')} state={show('adminEmail') ? 'error' : undefined} help="建立後會寄出邀請信。">
        {(p) => <input {...p} className="input" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />}
      </FormField>
    </Modal>
  );
}
