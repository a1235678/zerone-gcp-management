import { useState } from 'react';
import type { Address } from '@data/types';
import { COUNTRIES, TW_DISTRICTS, postalOf } from '@data/mock/twAddress';
import { FormField } from '@shared/components/Form';
import { Icon } from '@shared/components/Icon';

/** 地址：國家／地區、縣市、鄉鎮區、郵遞區號（台灣依鄉鎮區自動帶出）、街道地址 */
export function AddressFields({ label, value, onChange, disabled }: { label: string; value: Address; onChange: (a: Address) => void; disabled?: boolean }) {
  const tw = value.country === '台灣';
  const districts = TW_DISTRICTS[value.city] ?? [];
  return (
    <div className="address-fields" role="group" aria-label={label}>
      <FormField label="國家／地區">
        {(p) => (
          <select {...p} className="select" disabled={disabled} value={value.country} onChange={(e) => onChange({ country: e.target.value, city: '', district: '', postalCode: '', street: value.street })}>
            {COUNTRIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
      </FormField>
      <FormField label="縣市">
        {(p) =>
          tw ? (
            <select {...p} className="select" disabled={disabled} value={value.city} onChange={(e) => onChange({ ...value, city: e.target.value, district: '', postalCode: '' })}>
              <option value="">請選擇</option>
              {Object.keys(TW_DISTRICTS).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          ) : (
            <input {...p} className="input" disabled={disabled} value={value.city} onChange={(e) => onChange({ ...value, city: e.target.value })} />
          )
        }
      </FormField>
      <FormField label="鄉鎮區">
        {(p) =>
          tw ? (
            <select
              {...p}
              className="select"
              disabled={disabled || !value.city}
              value={value.district}
              onChange={(e) => onChange({ ...value, district: e.target.value, postalCode: postalOf(value.city, e.target.value) })}
            >
              <option value="">{value.city ? '請選擇' : '先選縣市'}</option>
              {districts.map(([d]) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          ) : (
            <input {...p} className="input" disabled={disabled} value={value.district} onChange={(e) => onChange({ ...value, district: e.target.value })} />
          )
        }
      </FormField>
      <FormField label="郵遞區號">
        {(p) => (
          <input
            {...p}
            className="input mono"
            readOnly={tw}
            disabled={disabled}
            value={value.postalCode}
            placeholder={tw ? '自動帶出' : ''}
            onChange={(e) => onChange({ ...value, postalCode: e.target.value })}
          />
        )}
      </FormField>
      <FormField label="街道地址" className="address-fields__street">
        {(p) => <input {...p} className="input" disabled={disabled} value={value.street} onChange={(e) => onChange({ ...value, street: e.target.value })} />}
      </FormField>
    </div>
  );
}

/** 可以輸入多個值的欄位（按 Enter 加入），用在公司簡稱 */
export function TagInput({ id, values, onChange, placeholder }: { id?: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState('');
  const add = () => {
    const t = text.trim();
    if (t && !values.includes(t)) onChange([...values, t]);
    setText('');
  };
  return (
    <div className="tag-input">
      {values.map((v) => (
        <span key={v} className="tag-input__chip">
          {v}
          <button type="button" aria-label={`移除 ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
            <Icon name="close" size={12} />
          </button>
        </span>
      ))}
      <input
        id={id}
        className="tag-input__input"
        value={text}
        placeholder={values.length ? '' : placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
          if (e.key === 'Backspace' && !text && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={add}
      />
    </div>
  );
}
