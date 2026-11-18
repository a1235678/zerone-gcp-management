import { useState } from 'react';
import { addressComplete, emptyAddress, getDealers, lookupTaxId } from '@data/api';
import type { Address, NewCustomerInput, SalesAssignment } from '@data/types';
import { Callout, FormField, FormSection } from '@shared/components/Form';
import { Icon } from '@shared/components/Icon';
import { PendingTag } from '@shared/components/PendingTag';
import { useAsync } from '@shared/hooks/useAsync';
import { AddressFields, TagInput } from './CustomerFields';
import { SalesAssignmentEditor } from './SalesAssignments';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * GWS 新訂時直接填的新客戶資料（第一階段沒有獨立的客戶建檔畫面）。
 * 欄位、順序與「客戶管理 › 新增客戶」相同，兩邊改欄位時要一起改。
 */
export interface QuickCustomer {
  name: string;
  taxId: string;
  shortNames: string[];
  dealerId: string;
  registeredAddress: Address;
  contactAddress: Address;
  contactSameAsRegistered: boolean;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  note: string;
  sales: SalesAssignment[];
  adminSameAsContact: boolean;
  adminName: string;
  adminEmail: string;
}

export const emptyQuickCustomer = (): QuickCustomer => ({
  name: '',
  taxId: '',
  shortNames: [],
  dealerId: '',
  registeredAddress: emptyAddress(),
  contactAddress: emptyAddress(),
  contactSameAsRegistered: true,
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  note: '',
  sales: [],
  adminSameAsContact: true,
  adminName: '',
  adminEmail: '',
});

const contactAddressOf = (v: QuickCustomer) => (v.contactSameAsRegistered ? v.registeredAddress : v.contactAddress);
const adminOf = (v: QuickCustomer) => (v.adminSameAsContact ? { name: v.contactName, email: v.contactEmail } : { name: v.adminName, email: v.adminEmail });

export function quickCustomerErrors(v: QuickCustomer): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.name.trim()) e.name = '請輸入公司全名';
  if (!/^\d{8}$/.test(v.taxId)) e.taxId = '統一編號為 8 位數字';
  if (!v.dealerId) e.dealerId = '請選擇經銷商';
  if (!addressComplete(contactAddressOf(v))) e.contactAddress = '請填寫完整的聯絡地址（縣市、鄉鎮區、街道）';
  if (!v.contactName.trim()) e.contactName = '請輸入聯絡人';
  if (!EMAIL.test(v.contactEmail.trim())) e.contactEmail = '聯絡人信箱格式不正確';
  const admin = adminOf(v);
  if (!admin.name.trim()) e.adminName = '請輸入姓名';
  if (!EMAIL.test(admin.email.trim())) e.adminEmail = 'Email 格式不正確';
  return e;
}

export function toNewCustomerInput(v: QuickCustomer): NewCustomerInput {
  const admin = adminOf(v);
  return {
    name: v.name.trim(),
    taxId: v.taxId.trim(),
    dealerId: v.dealerId,
    contactName: v.contactName.trim(),
    contactEmail: v.contactEmail.trim(),
    contactPhone: v.contactPhone.trim(),
    note: v.note.trim(),
    adminName: admin.name.trim(),
    adminEmail: admin.email.trim(),
    shortNames: v.shortNames,
    registeredAddress: v.registeredAddress,
    contactAddress: contactAddressOf(v),
    contactSameAsRegistered: v.contactSameAsRegistered,
    salesAssignments: v.sales,
  };
}

/** 新客戶資料表單 */
export function QuickCustomerForm({ value, onChange, showErrors }: { value: QuickCustomer; onChange: (v: QuickCustomer) => void; showErrors: boolean }) {
  const dealers = useAsync(getDealers);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<{ text: string; tone: 'success' | 'error' }>();
  const errors = quickCustomerErrors(value);
  const err = (k: string) => (showErrors ? errors[k] : undefined);
  const state = (k: string) => (err(k) ? ('error' as const) : undefined);
  const set = <K extends keyof QuickCustomer>(k: K, v: QuickCustomer[K]) => onChange({ ...value, [k]: v });
  const admin = adminOf(value);

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

  return (
    <div className="quick-customer">
      <FormSection title="基本資訊">
        <FormField
          label="統一編號"
          required
          message={err('taxId') ?? lookupMsg?.text}
          state={state('taxId') ?? lookupMsg?.tone}
          help="輸入 8 碼統一編號後按「查詢」，會帶入公司全名與登記地址。"
          addon={<PendingTag hint="查詢的資料來源待確認" />}
        >
          {(p) => (
            <div className="input-with-button">
              <input {...p} className="input mono" inputMode="numeric" maxLength={8} value={value.taxId} onChange={(e) => set('taxId', e.target.value.replace(/\D/g, ''))} />
              <button type="button" className="btn" disabled={lookingUp || !/^\d{8}$/.test(value.taxId)} onClick={lookup}>
                <Icon name="search" size={16} />
                {lookingUp ? '查詢中…' : '查詢'}
              </button>
            </div>
          )}
        </FormField>
        <FormField label="公司全名" required message={err('name')} state={state('name')}>
          {(p) => <input {...p} className="input" value={value.name} onChange={(e) => set('name', e.target.value)} />}
        </FormField>
        <FormField label="公司簡稱" help="可輸入多個別名，按 Enter 確認。">
          {(p) => <TagInput id={p.id} values={value.shortNames} onChange={(v) => set('shortNames', v)} />}
        </FormField>
        <div />
        <FormField label="所屬經銷商" required message={err('dealerId')} state={state('dealerId')}>
          {(p) => (
            <select {...p} className="select" value={value.dealerId} onChange={(e) => set('dealerId', e.target.value)}>
              <option value="">請選擇</option>
              {(dealers.data ?? [])
                .filter((d) => d.status === 'active')
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          )}
        </FormField>
        <FormField label="經銷商 ID" help="選擇經銷商後自動帶出。">
          {(p) => <input {...p} className="input mono" readOnly value={value.dealerId} placeholder="—" />}
        </FormField>
        <p className="muted is-full" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
          網域在下一步「訂閱內容」填寫，訂閱成功後會自動寫回客戶主檔。
        </p>
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
            value={contactAddressOf(value)}
            onChange={(a) => set('contactAddress', a)}
            disabled={value.contactSameAsRegistered}
          />
          {err('contactAddress') && <div className="form-field__msg form-field__msg--error">{err('contactAddress')}</div>}
        </div>
        <div className="is-full section-subhead">
          <span className="form-field__label">聯絡人</span>
        </div>
        <FormField label="聯絡人姓名" required message={err('contactName')} state={state('contactName')}>
          {(p) => <input {...p} className="input" value={value.contactName} onChange={(e) => set('contactName', e.target.value)} />}
        </FormField>
        <FormField label="聯絡電話">{(p) => <input {...p} className="input" type="tel" value={value.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />}</FormField>
        <FormField label="聯絡人信箱" required message={err('contactEmail')} state={state('contactEmail')}>
          {(p) => <input {...p} className="input" type="email" value={value.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />}
        </FormField>
        <div />
      </FormSection>

      <FormSection title="其他資訊">
        <FormField label="備註" className="is-full" help={`${value.note.length} / 2000`}>
          {(p) => <textarea {...p} className="textarea" maxLength={2000} value={value.note} onChange={(e) => set('note', e.target.value)} />}
        </FormField>
      </FormSection>

      <FormSection title="負責業務" description="一列一位業務，只列有設定的；一個客戶可以有多位業務。建立後也可以在客戶詳情修改。">
        <div className="is-full">
          <SalesAssignmentEditor value={value.sales} onChange={(v) => set('sales', v)} />
        </div>
      </FormSection>

      <FormSection title="第一個組織管理員帳號" description="零壹只建立這一個帳號；其他帳號與角色由客戶自己建立，零壹也可以在「使用者」頁代為新增。">
        <label className="inline is-full">
          <input type="checkbox" checked={value.adminSameAsContact} onChange={(e) => set('adminSameAsContact', e.target.checked)} />
          與聯絡人相同
        </label>
        <FormField label="姓名" required message={err('adminName')} state={state('adminName')}>
          {(p) => <input {...p} className="input" value={admin.name} readOnly={value.adminSameAsContact} onChange={(e) => set('adminName', e.target.value)} />}
        </FormField>
        <FormField label="Email（登入帳號）" required message={err('adminEmail')} state={state('adminEmail')}>
          {(p) => <input {...p} className="input" type="email" value={admin.email} readOnly={value.adminSameAsContact} onChange={(e) => set('adminEmail', e.target.value)} />}
        </FormField>
        <Callout tone="neutral">送出新訂後系統會寄出邀請信，對方設定密碼後即可登入客戶端。</Callout>
      </FormSection>
    </div>
  );
}
