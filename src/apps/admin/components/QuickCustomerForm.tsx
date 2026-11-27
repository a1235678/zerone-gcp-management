import { useState } from 'react';
import { addressComplete, emptyAddress, getDealers, lookupTaxId } from '@data/api';
import type { Address, CustomerKind, NewCustomerInput } from '@data/types';
import { FormField, FormSection } from '@shared/components/Form';
import { Icon } from '@shared/components/Icon';
import { PendingTag } from '@shared/components/PendingTag';
import { useAsync } from '@shared/hooks/useAsync';
import { AddressFields, TagInput } from './CustomerFields';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 客戶主檔的欄位。「客戶管理 › 新增客戶／轉入客戶」和「GWS 新訂」的新客戶共用這一份，欄位只要改這裡。
 * 客戶分公司、個人：個人不用統編、沒有簡稱和登記地址（2026/11/24）。
 * 建立客戶主檔時不建立帳號；帳號在客戶詳情「使用者帳號」邀請（2026/11/24）。
 */
export interface CustomerFormValue {
  kind: CustomerKind;
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
}
/** 舊名稱，GWS 新訂頁沿用 */
export type QuickCustomer = CustomerFormValue;

export const emptyQuickCustomer = (): CustomerFormValue => ({
  kind: 'company',
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
});

const isIndividual = (v: CustomerFormValue) => v.kind === 'individual';
const contactAddressOf = (v: CustomerFormValue) => (!isIndividual(v) && v.contactSameAsRegistered ? v.registeredAddress : v.contactAddress);

export function quickCustomerErrors(v: CustomerFormValue): Record<string, string> {
  const e: Record<string, string> = {};
  const individual = isIndividual(v);
  if (!v.name.trim()) e.name = individual ? '請輸入姓名' : '請輸入公司全名';
  if (!individual && !/^\d{8}$/.test(v.taxId)) e.taxId = '統一編號為 8 位數字';
  if (!v.dealerId) e.dealerId = '請選擇經銷商';
  if (!addressComplete(contactAddressOf(v))) e.contactAddress = '請填寫完整的聯絡地址（縣市、鄉鎮區、街道）';
  if (!individual && !v.contactName.trim()) e.contactName = '請輸入聯絡人';
  if (!EMAIL.test(v.contactEmail.trim())) e.contactEmail = individual ? 'Email 格式不正確' : '聯絡人信箱格式不正確';
  return e;
}

export function toNewCustomerInput(v: CustomerFormValue): NewCustomerInput {
  const individual = isIndividual(v);
  return {
    kind: v.kind,
    name: v.name.trim(),
    taxId: individual ? '' : v.taxId.trim(),
    dealerId: v.dealerId,
    // 個人客戶的聯絡人就是本人
    contactName: (individual ? v.name : v.contactName).trim(),
    contactEmail: v.contactEmail.trim(),
    contactPhone: v.contactPhone.trim(),
    note: v.note.trim(),
    shortNames: individual ? [] : v.shortNames,
    registeredAddress: individual ? contactAddressOf(v) : v.registeredAddress,
    contactAddress: contactAddressOf(v),
    contactSameAsRegistered: individual || v.contactSameAsRegistered,
  };
}

/** 客戶資料表單。children 會放在「基本資訊」之後（例如轉入客戶的主網域、GWS 新訂的網域） */
export function QuickCustomerForm({
  value,
  onChange,
  showErrors,
  dealerLabel = '經銷商',
  domainNote = '網域在下一步「訂閱內容」填寫，訂閱成功後會自動寫回客戶主檔。',
  children,
}: {
  value: CustomerFormValue;
  onChange: (v: CustomerFormValue) => void;
  showErrors: boolean;
  dealerLabel?: string;
  domainNote?: string;
  children?: React.ReactNode;
}) {
  const dealers = useAsync(getDealers);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<{ text: string; tone: 'success' | 'error' }>();
  const errors = quickCustomerErrors(value);
  const err = (k: string) => (showErrors ? errors[k] : undefined);
  const state = (k: string) => (err(k) ? ('error' as const) : undefined);
  const set = <K extends keyof CustomerFormValue>(k: K, v: CustomerFormValue[K]) => onChange({ ...value, [k]: v });
  const individual = isIndividual(value);
  const partnerId = dealers.data?.find((d) => d.id === value.dealerId)?.partnerId;

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
        <div className="is-full">
          <span className="form-field__label" id="customer-kind-label">
            客戶類型 <span className="form-field__req">必填</span>
          </span>
          <div className="segmented" role="group" aria-labelledby="customer-kind-label" style={{ marginTop: 'var(--space-2)' }}>
            <button type="button" aria-pressed={!individual} onClick={() => set('kind', 'company')}>
              公司
            </button>
            <button type="button" aria-pressed={individual} onClick={() => set('kind', 'individual')}>
              個人
            </button>
          </div>
          <p className="muted" style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-sm)' }}>
            {individual ? '個人客戶不用填統一編號。' : '公司客戶要填統一編號，可以查詢帶入公司全名與登記地址。'}
          </p>
        </div>
        {individual ? (
          <>
            <FormField label="姓名" required message={err('name')} state={state('name')}>
              {(p) => <input {...p} className="input" value={value.name} onChange={(e) => set('name', e.target.value)} />}
            </FormField>
            <div />
          </>
        ) : (
          <>
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
          </>
        )}
        <FormField
          label={dealerLabel}
          required
          message={err('dealerId')}
          state={state('dealerId')}
          help="這個網域（第一個合約）的經銷商。同一個客戶其他網域或 GCP 向別家買，建立後在客戶詳情另外指定。"
        >
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
        <FormField label="經銷商 ID" help="Google Channel Partner ID，選擇經銷商後自動帶出。">
          {(p) => <input {...p} className="input mono" readOnly value={value.dealerId ? partnerId || '—（直銷，沒有）' : ''} placeholder="—" />}
        </FormField>
        {domainNote && (
          <p className="muted is-full" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
            {domainNote}
          </p>
        )}
      </FormSection>

      {children}

      {!individual && (
        <FormSection title="登記地址（公司法定登記地）">
          <div className="is-full">
            <AddressFields label="登記地址" value={value.registeredAddress} onChange={(a) => set('registeredAddress', a)} />
          </div>
        </FormSection>
      )}

      <FormSection title="聯絡資訊">
        <div className="is-full section-subhead">
          <span className="form-field__label">
            {individual ? '地址' : '聯絡地址'} <span className="form-field__req">必填</span>
          </span>
          {!individual && (
            <label className="inline checkbox-row">
              <input type="checkbox" checked={value.contactSameAsRegistered} onChange={(e) => set('contactSameAsRegistered', e.target.checked)} />
              同登記地址
            </label>
          )}
        </div>
        <div className="is-full">
          <AddressFields
            label="聯絡地址"
            value={contactAddressOf(value)}
            onChange={(a) => set('contactAddress', a)}
            disabled={!individual && value.contactSameAsRegistered}
          />
          {err('contactAddress') && <div className="form-field__msg form-field__msg--error">{err('contactAddress')}</div>}
        </div>
        {individual ? (
          <>
            <FormField label="電話">{(p) => <input {...p} className="input" type="tel" value={value.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />}</FormField>
            <FormField label="Email" required message={err('contactEmail')} state={state('contactEmail')}>
              {(p) => <input {...p} className="input" type="email" value={value.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />}
            </FormField>
          </>
        ) : (
          <>
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
          </>
        )}
      </FormSection>

      <FormSection title="其他資訊">
        <FormField label="備註" className="is-full" help={`${value.note.length} / 2000`}>
          {(p) => <textarea {...p} className="textarea" maxLength={2000} value={value.note} onChange={(e) => set('note', e.target.value)} />}
        </FormField>
      </FormSection>


    </div>
  );
}
