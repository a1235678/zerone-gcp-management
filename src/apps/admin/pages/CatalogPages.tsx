import { useState } from 'react';
import { createBrand, createProduct, getBrands, getProducts } from '@data/api';
import type { BrandListItem, ProductListItem } from '@data/types';
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

// 品牌管理、產品管理：先做空殼（清單加新增），欄位待確認

const statusTag = (s: 'active' | 'draft') => <StatusTag tone={s === 'active' ? 'success' : 'neutral'}>{s === 'active' ? '上架' : '草稿'}</StatusTag>;

export function BrandsPage() {
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
          <button className="btn btn--primary" onClick={() => setOpen(true)}>
            <Icon name="plus" size={16} />
            新增品牌
          </button>
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
          <button className="btn btn--primary" onClick={() => setOpen(true)}>
            <Icon name="plus" size={16} />
            新增產品
          </button>
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
