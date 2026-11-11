import { useState } from 'react';
import { createBrand, createProduct, getBrands, getPlanList, getProducts, savePlan } from '@data/api';
import type { BrandListItem, PlanListItem, ProductListItem } from '@data/types';
import { Card } from '@shared/components/Card';
import { DataTable, type Column } from '@shared/components/DataTable';
import { FormField } from '@shared/components/Form';
import { Icon } from '@shared/components/Icon';
import { Modal } from '@shared/components/Modal';
import { PageHeader } from '@shared/components/PageHeader';
import { PendingTag } from '@shared/components/PendingTag';
import { StatusTag } from '@shared/components/StatusTag';
import { useToast } from '@shared/components/Toast';
import { formatDate } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';
import { usePermission } from '../auth';

// 品牌管理、產品管理：先做空殼（清單加新增），欄位待確認。方案管理：2026/11/10 會議加回來，方案有等級。

const statusTag = (s: 'active' | 'draft') => <StatusTag tone={s === 'active' ? 'success' : 'neutral'}>{s === 'active' ? '上架' : '草稿'}</StatusTag>;

export function BrandsPage() {
  const { can } = usePermission();
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [tried, setTried] = useState(false);
  const brands = useAsync(getBrands, [version]);

  const columns: Column<BrandListItem>[] = [
    { key: 'name', header: '品牌名稱', render: (b) => <span className="table__primary">{b.name}</span> },
    { key: 'products', header: '產品數', align: 'right', render: (b) => <span className="tnum">{b.productCount}</span> },
    { key: 'createdAt', header: '建立日期', render: (b) => <span className="mono">{formatDate(b.createdAt)}</span> },
    { key: 'status', header: '狀態', render: (b) => statusTag(b.status) },
  ];

  const submit = async () => {
    setTried(true);
    if (!name.trim()) return;
    try {
      const b = await createBrand(name);
      toast(`已新增品牌「${b.name}」（草稿）`);
      setOpen(false);
      setName('');
      setTried(false);
      setVersion((v) => v + 1);
    } catch (e) {
      toast((e as Error).message, 'danger');
    }
  };

  return (
    <>
      <PageHeader
        title="品牌管理"
        titleAddon={<PendingTag hint="欄位與內容之後再補" />}
        description="目前整合 Google，之後會支援其他品牌。"
        actions={
          can('catalog', 'write') ? (
            <button className="btn btn--primary" onClick={() => setOpen(true)}>
              <Icon name="plus" size={16} />
              新增品牌
            </button>
          ) : undefined
        }
      />
      <Card bodyless>
        <DataTable caption="品牌清單" columns={columns} rows={brands.data ?? []} rowKey={(b) => b.id} loading={brands.loading && !brands.data} />
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="新增品牌"
        width={440}
        footer={
          <>
            <button className="btn" onClick={() => setOpen(false)}>
              取消
            </button>
            <button className="btn btn--primary" onClick={submit}>
              新增
            </button>
          </>
        }
      >
        <FormField label="品牌名稱" required message={tried && !name.trim() ? '請輸入品牌名稱' : undefined} state={tried && !name.trim() ? 'error' : undefined}>
          {(p) => <input {...p} className="input" value={name} onChange={(e) => setName(e.target.value)} />}
        </FormField>
        <p>
          <PendingTag hint="其他欄位待確認" />
        </p>
      </Modal>
    </>
  );
}

export function ProductsPage() {
  const { can } = usePermission();
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ brandId: '', name: '', code: '' });
  const [tried, setTried] = useState(false);
  const products = useAsync(getProducts, [version]);
  const brands = useAsync(getBrands, [version]);

  const columns: Column<ProductListItem>[] = [
    { key: 'name', header: '產品名稱', render: (p) => <span className="table__primary">{p.name}</span> },
    { key: 'code', header: '代碼', render: (p) => <span className="mono">{p.code}</span> },
    { key: 'brand', header: '品牌', render: (p) => p.brandName },
    { key: 'createdAt', header: '建立日期', render: (p) => <span className="mono">{formatDate(p.createdAt)}</span> },
    { key: 'status', header: '狀態', render: (p) => statusTag(p.status) },
  ];

  const errors: Record<string, string> = {};
  if (!form.brandId) errors.brandId = '請選擇品牌';
  if (!form.name.trim()) errors.name = '請輸入產品名稱';
  if (!/^[A-Za-z0-9-]{2,12}$/.test(form.code.trim())) errors.code = '代碼為 2–12 個英數字';
  const show = (k: string) => (tried ? errors[k] : undefined);

  const submit = async () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    try {
      const p = await createProduct(form);
      toast(`已新增產品「${p.name}」（草稿）`);
      setOpen(false);
      setForm({ brandId: '', name: '', code: '' });
      setTried(false);
      setVersion((v) => v + 1);
    } catch (e) {
      toast((e as Error).message, 'danger');
    }
  };

  return (
    <>
      <PageHeader
        title="產品管理"
        titleAddon={<PendingTag hint="欄位與內容之後再補" />}
        description="目前整合 Google Workspace 與 Google Cloud。"
        actions={
          can('catalog', 'write') ? (
            <button className="btn btn--primary" onClick={() => setOpen(true)}>
              <Icon name="plus" size={16} />
              新增產品
            </button>
          ) : undefined
        }
      />
      <Card bodyless>
        <DataTable caption="產品清單" columns={columns} rows={products.data ?? []} rowKey={(p) => p.id} loading={products.loading && !products.data} />
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="新增產品"
        width={480}
        footer={
          <>
            <button className="btn" onClick={() => setOpen(false)}>
              取消
            </button>
            <button className="btn btn--primary" onClick={submit}>
              新增
            </button>
          </>
        }
      >
        <FormField label="品牌" required message={show('brandId')} state={show('brandId') ? 'error' : undefined}>
          {(p) => (
            <select {...p} className="select" value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
              <option value="">請選擇</option>
              {(brands.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField label="產品名稱" required message={show('name')} state={show('name') ? 'error' : undefined}>
          {(p) => <input {...p} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        </FormField>
        <FormField label="代碼" required message={show('code')} state={show('code') ? 'error' : undefined} help="例如 GWS、GCP">
          {(p) => <input {...p} className="input mono" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />}
        </FormField>
        <p>
          <PendingTag hint="其他欄位待確認" />
        </p>
      </Modal>
    </>
  );
}

type PlanForm = { id?: string; productId: string; name: string; tier: string; status: 'active' | 'draft' };
const emptyPlan: PlanForm = { productId: 'P01', name: '', tier: '', status: 'draft' };

export function PlansPage() {
  const { can } = usePermission();
  const canWrite = can('catalog', 'write');
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const [form, setForm] = useState<PlanForm | null>(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const plans = useAsync(getPlanList, [version]);
  const products = useAsync(getProducts);

  const columns: Column<PlanListItem>[] = [
    {
      key: 'tier',
      header: '等級',
      align: 'right',
      render: (p) => (
        <span className="tier-badge tnum" title="數字越大版本越高">
          {p.tier}
        </span>
      ),
    },
    { key: 'name', header: '方案名稱', render: (p) => <span className="table__primary">{p.name}</span> },
    { key: 'product', header: '產品', render: (p) => `${p.brandName} › ${p.productName}` },
    { key: 'subs', header: '使用中訂閱', align: 'right', render: (p) => <span className="tnum">{p.subscriptionCount}</span> },
    { key: 'status', header: '狀態', render: (p) => statusTag(p.status) },
    {
      key: 'actions',
      header: <span className="visually-hidden">操作</span>,
      render: (p) =>
        canWrite ? (
          <button
            className="btn btn--sm"
            onClick={() => {
              setTried(false);
              setForm({ id: p.id, productId: p.productId, name: p.name, tier: String(p.tier), status: p.status });
            }}
          >
            編輯
          </button>
        ) : null,
    },
  ];

  const errors: Record<string, string> = {};
  if (form) {
    if (!form.name.trim()) errors.name = '請輸入方案名稱';
    if (!/^[1-9]\d*$/.test(form.tier)) errors.tier = '等級請填 1 以上的整數';
  }
  const show = (k: string) => (tried ? errors[k] : undefined);

  const submit = async () => {
    setTried(true);
    if (!form || Object.keys(errors).length) return;
    setSaving(true);
    try {
      const p = await savePlan({ ...form, tier: Number(form.tier) });
      toast(form.id ? `已更新方案「${p.name}」` : `已新增方案「${p.name}」`);
      setForm(null);
      setVersion((v) => v + 1);
    } catch (e) {
      toast((e as Error).message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="方案管理"
        description="方案依等級排序，數字越大版本越高。續約、中途升版時，系統用等級判斷是升版還是降版。"
        actions={
          canWrite ? (
            <button
              className="btn btn--primary"
              onClick={() => {
                setTried(false);
                const max = Math.max(0, ...(plans.data ?? []).filter((p) => p.productId === 'P01').map((p) => p.tier));
                setForm({ ...emptyPlan, tier: String(max + 1) });
              }}
            >
              <Icon name="plus" size={16} />
              新增方案
            </button>
          ) : undefined
        }
      />
      <Card bodyless>
        <div className="result-meta">
          <span>共 {plans.data?.length ?? 0} 個方案</span>
          <PendingTag id={3} hint="能否從 API 取得方案清單" />
        </div>
        <DataTable caption="方案清單" columns={columns} rows={plans.data ?? []} rowKey={(p) => p.id} loading={plans.loading && !plans.data} />
      </Card>
      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? '編輯方案' : '新增方案'}
        width={480}
        footer={
          <>
            <button className="btn" onClick={() => setForm(null)}>
              取消
            </button>
            <button className="btn btn--primary" disabled={saving} onClick={submit}>
              儲存
            </button>
          </>
        }
      >
        {form && (
          <div className="stack">
            <FormField label="產品" required>
              {(p) => (
                <select {...p} className="select" value={form.productId} disabled={Boolean(form.id)} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                  {(products.data ?? []).map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.brandName} › {x.name}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField label="方案名稱" required message={show('name')} state={show('name') ? 'error' : undefined} help={form.id && (plans.data?.find((x) => x.id === form.id)?.subscriptionCount ?? 0) > 0 ? '已有訂閱使用這個方案，不能改名。' : undefined}>
              {(p) => <input {...p} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
            </FormField>
            <FormField label="等級" required message={show('tier')} state={show('tier') ? 'error' : undefined} help="數字越大版本越高；同一個產品的等級不能重複。">
              {(p) => <input {...p} className="input tnum" type="number" min={1} value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} />}
            </FormField>
            <FormField label="狀態" required help="只有上架的方案會出現在新訂、續約、升版的選單。">
              {(p) => (
                <select {...p} className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PlanForm['status'] })}>
                  <option value="active">上架</option>
                  <option value="draft">草稿</option>
                </select>
              )}
            </FormField>
          </div>
        )}
      </Modal>
    </>
  );
}
