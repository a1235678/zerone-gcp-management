import { useState } from 'react';
import { addressComplete, emptyAddress, getDealers, lookupTaxId } from '@data/api';
import type { Address, NewCustomerInput, SalesAssignment } from '@data/types';
import { FormField } from '@shared/components/Form';
import { useAsync } from '@shared/hooks/useAsync';
import { AddressFields, TagInput } from './CustomerFields';
import { SalesAssignmentEditor } from './SalesAssignments';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** GWS 新訂時直接填的新客戶資料（第一階段沒有獨立的客戶建檔畫面） */
export interface QuickCustomer {
  name: string;
  taxId: string;
  shortNames: string[];
  dealerId: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  address: Address;
  adminSameAsContact: boolean;
  adminName: string;
  adminEmail: string;
  sales: SalesAssignment[];
  note: string;
}

export const emptyQuickCustomer = (): QuickCustomer => ({
  name: '',
  taxId: '',
  shortNames: [],
  dealerId: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  address: emptyAddress(),
  adminSameAsContact: true,
  adminName: '',
  adminEmail: '',
  sales: [],
  note: '',
});

export function quickCustomerErrors(v: QuickCustomer): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.name.trim()) e.name = '請輸入公司全名';
  if (!/^\d{8}$/.test(v.taxId)) e.taxId = '統一編號為 8 位數字';
  if (!v.dealerId) e.dealerId = '請選擇經銷商';
  if (!v.contactName.trim()) e.contactName = '請輸入聯絡人';
  if (!EMAIL.test(v.contactEmail.trim())) e.contactEmail = '聯絡人信箱格式不正確';
  if (!addressComplete(v.address)) e.address = '請填寫完整的聯絡地址';
  if (!v.adminSameAsContact) {
    if (!v.adminName.trim()) e.adminName = '請輸入組織管理員姓名';
    if (!EMAIL.test(v.adminEmail.trim())) e.adminEmail = '組織管理員 Email 格式不正確';
  }
  return e;
}

export function toNewCustomerInput(v: QuickCustomer): NewCustomerInput {
  return {
    name: v.name.trim(),
    taxId: v.taxId.trim(),
    dealerId: v.dealerId,
    contactName: v.contactName.trim(),
    contactEmail: v.contactEmail.trim(),
    contactPhone: v.contactPhone.trim(),
    note: v.note.trim(),
    adminName: (v.adminSameAsContact ? v.contactName : v.adminName).trim(),
    adminEmail: (v.adminSameAsContact ? v.contactEmail : v.adminEmail).trim(),
    shortNames: v.shortNames,
    registeredAddress: v.address,
    contactAddress: v.address,
    contactSameAsRegistered: true,
    salesAssignments: v.sales,
  };
}

/** 新客戶資料表單：欄位跟客戶主檔一致，地址只填一組（登記地址＝聯絡地址） */
export function QuickCustomerForm({ value, onChange, showErrors }: { value: QuickCustomer; onChange: (v: QuickCustomer) => void; showErrors: boolean }) {
  const dealers = useAsync(getDealers);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<{ text: string; tone: 'success' | 'error' }>();
  const errors = quickCustomerErrors(value);
  const err = (k: string) => (showErrors ? errors[k] : undefined);
  const state = (k: string) => (err(k) ? ('error' as const) : undefined);
  const set = <K extends keyof QuickCustomer>(k: K, v: QuickCustomer[K]) => onChange({ ...value, [k]: v });
  const dealer = dealers.data?.find((d) => d.id === value.dealerId);

  const lookup = async () => {
    setLookingUp(true);
    setLookupMsg(undefined);
    try {
      const r = await lookupTaxId(value.taxId);
      if (r) {
        onChange({ ...value, name: r.name, address: r.address });
        setLookupMsg({ text: `已帶入：${r.name}`, tone: 'success' });
      } else setLookupMsg({ text: '查無登記資料，請手動輸入', tone: 'error' });
    } catch (e) {
      setLookupMsg({ text: (e as Error).message, tone: 'error' });
    } finally {
      setLookingUp(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <section className="quick-section">
        <h3 className="quick-section__title">基本資訊</h3>
        <div className="form-grid">
          <FormField
            label="統一編號"
            required
            message={err('taxId') ?? lookupMsg?.text}
            state={state('taxId') ?? lookupMsg?.tone}
            help="輸入 8 碼統一編號後按「查詢」，會帶入公司全名與地址。"
          >
            {(p) => (
              <div className="input-with-button">
                <input {...p} className="input mono" inputMode="numeric" maxLength={8} value={value.taxId} onChange={(e) => set('taxId', e.target.value.replace(/\D/g, ''))} />
                <button type="button" className="btn" disabled={!/^\d{8}$/.test(value.taxId) || lookingUp} onClick={lookup}>
                  {lookingUp ? '查詢中…' : '查詢'}
                </button>
              </div>
            )}
          </FormField>
          <FormField label="公司全名" required message={err('name')} state={state('name')}>
            {(p) => <input {...p} className="input" value={value.name} onChange={(e) => set('name', e.target.value)} />}
          </FormField>
          <FormField label="公司簡稱" help="可輸入多個別名，按 Enter 確認。">
            {(p) => <TagInput id={p.id} values={value.shortNames} onChange={(v) => set('shortNames', v)} placeholder="例如：零壹" />}
          </FormField>
          <FormField label="所屬經銷商" required message={err('dealerId')} state={state('dealerId')} help={dealer ? `經銷商 ID：${dealer.id}` : undefined}>
            {(p) => (
              <select {...p} className="select" value={value.dealerId} onChange={(e) => set('dealerId', e.target.value)}>
                <option value="">請選擇</option>
                {(dealers.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.shortNames[0] ?? d.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </div>
      </section>

      <section className="quick-section">
        <h3 className="quick-section__title">聯絡資訊</h3>
        <div className="form-grid">
          <FormField label="聯絡人姓名" required message={err('contactName')} state={state('contactName')}>
            {(p) => <input {...p} className="input" value={value.contactName} onChange={(e) => set('contactName', e.target.value)} />}
          </FormField>
          <FormField label="聯絡電話">{(p) => <input {...p} className="input" type="tel" value={value.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />}</FormField>
          <FormField label="聯絡人信箱" required message={err('contactEmail')} state={state('contactEmail')}>
            {(p) => <input {...p} className="input" type="email" value={value.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />}
          </FormField>
        </div>
        <div style={{ marginTop: 'var(--space-4)' }}>
          <span className="form-field__label">
            聯絡地址 <span className="form-field__req">必填</span>
          </span>
          <AddressFields label="聯絡地址" value={value.address} onChange={(a) => set('address', a)} />
          {err('address') && <div className="form-field__msg form-field__msg--error">請填寫完整的聯絡地址（縣市、鄉鎮區、街道）</div>}
        </div>
      </section>

      <section className="quick-section">
        <h3 className="quick-section__title">第一個組織管理員帳號</h3>
        <label className="inline checkbox-row">
          <input type="checkbox" checked={value.adminSameAsContact} onChange={(e) => set('adminSameAsContact', e.target.checked)} />
          <span>同聯絡人（用聯絡人信箱登入）</span>
        </label>
        {!value.adminSameAsContact && (
          <div className="form-grid" style={{ marginTop: 'var(--space-3)' }}>
            <FormField label="姓名" required message={err('adminName')} state={state('adminName')}>
              {(p) => <input {...p} className="input" value={value.adminName} onChange={(e) => set('adminName', e.target.value)} />}
            </FormField>
            <FormField label="Email（登入帳號）" required message={err('adminEmail')} state={state('adminEmail')}>
              {(p) => <input {...p} className="input" type="email" value={value.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} />}
            </FormField>
          </div>
        )}
      </section>

      <section className="quick-section">
        <h3 className="quick-section__title">負責業務</h3>
        <SalesAssignmentEditor value={value.sales} onChange={(v) => set('sales', v)} />
      </section>

      <FormField label="備註" help={`${value.note.length} / 2000`}>
        {(p) => <textarea {...p} className="textarea" rows={2} maxLength={2000} value={value.note} onChange={(e) => set('note', e.target.value)} />}
      </FormField>
    </div>
  );
}
