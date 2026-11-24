import { useState } from 'react';
import { fetchOffersFromGoogle, offerUnavailableReason, setGoogleDownForPrototype, toOfferSnapshot } from '@data/api';
import { billingCycleLabel, offerPlanTypeLabel } from '@data/labels';
import type { GwsOffer, OfferSnapshot, OperationType } from '@data/types';
import { Icon } from '@shared/components/Icon';
import { StatusTag } from '@shared/components/StatusTag';
import { formatDate, formatDateTime, formatUsd } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';

const planTone = { annual: 'success', flexible: 'warning', trial: 'neutral' } as const;

/** 方案標籤：年約（綠）、彈性（橘）、試用（灰），文字一定會顯示 */
export function OfferPlanTag({ offer }: { offer: Pick<GwsOffer, 'planType'> }) {
  return <StatusTag tone={planTone[offer.planType]}>{offerPlanTypeLabel[offer.planType]}</StatusTag>;
}

/**
 * 選 Google 方案（Offer）。方案清單不存在系統裡：選好版本後，依這個客戶即時向 Google 查（2026/11/24）。
 * 選到的方案會存成快照（SKU ID、Offer ID、方案內容），交給上層放進訂單。
 * 人數不在授權數範圍、已過供應期限、試用但不是新訂的方案不能選，並寫出原因。
 */
export function OfferPicker({
  customerId,
  version,
  seats,
  type,
  value,
  onChange,
  error,
}: {
  /** 新客戶還沒有客戶編號時不帶 */
  customerId?: string;
  version: string;
  seats: number | undefined;
  type: OperationType;
  value: OfferSnapshot | undefined;
  onChange: (offer: OfferSnapshot | undefined) => void;
  error?: string;
}) {
  const [refresh, setRefresh] = useState(0);
  const lookup = useAsync(() => (version ? fetchOffersFromGoogle(customerId, version) : Promise.resolve(undefined)), [customerId, version, refresh]);
  const data = lookup.data;
  const reload = () => {
    setGoogleDownForPrototype(false);
    setRefresh((n) => n + 1);
  };

  return (
    <fieldset className="plain-fieldset offer-picker" aria-invalid={Boolean(error)}>
      <legend className="form-field__label">
        方案 <span className="form-field__req">必填</span>
      </legend>
      {version && (
        <div className="offer-picker__meta">
          <span className="muted">
            依這個客戶即時從 Google 取得
            {data && !lookup.loading && (
              <>
                {' '}
                · <span className="mono">{formatDateTime(data.fetchedAt)}</span> · SKU <span className="mono">{data.skuId}</span>
              </>
            )}
          </span>
          <button type="button" className="btn btn--sm btn--ghost" onClick={reload} disabled={lookup.loading}>
            <Icon name="reset" size={14} />
            重新整理
          </button>
        </div>
      )}
      {!version ? (
        <p className="muted offer-picker__empty">先選擇版本，再選方案。</p>
      ) : lookup.loading ? (
        <p className="muted offer-picker__empty" role="status">
          正在向 Google 查詢可訂閱的方案…
        </p>
      ) : lookup.error ? (
        <div className="callout callout--warning" role="alert">
          <div className="callout__title">查不到方案</div>
          <div>
            {lookup.error.message}
            <div style={{ marginTop: 'var(--space-2)' }}>
              <button type="button" className="btn btn--sm" onClick={reload}>
                重新整理
              </button>
            </div>
          </div>
        </div>
      ) : !data || data.offers.length === 0 ? (
        <p className="muted offer-picker__empty">這個版本目前沒有可販售的方案。</p>
      ) : (
        <div className="offer-picker__list" role="radiogroup" aria-label={`${version} 的方案`}>
          {data.offers.map((o) => {
            const reason = offerUnavailableReason(o, seats, type);
            const checked = value?.offerId === o.offerId;
            return (
              <label key={o.offerId} className={`offer-option ${checked ? 'is-selected' : ''} ${reason ? 'is-disabled' : ''}`}>
                <input type="radio" name={`offer-${type}`} checked={checked} disabled={Boolean(reason)} onChange={() => onChange(toOfferSnapshot(data, o))} />
                <span className="offer-option__plan">
                  <OfferPlanTag offer={o} />
                  {o.availableUntil && <span className="muted">供應至 {formatDate(o.availableUntil)}</span>}
                </span>
                <span className="offer-option__seats tnum">
                  {o.minSeats}–{o.maxSeats} 授權
                </span>
                <span className="offer-option__billing">{o.billing ? billingCycleLabel[o.billing] : '—'}</span>
                <span className="offer-option__price tnum">
                  <strong>{formatUsd(o.priceCents)}</strong>
                  <span className="muted"> / 授權</span>
                </span>
                <span className="offer-option__id mono muted">{o.offerId}</span>
                {reason && <span className="offer-option__reason">{reason}</span>}
              </label>
            );
          })}
        </div>
      )}
      {error && !lookup.loading && <div className="form-field__msg form-field__msg--error">{error}</div>}
      {value && !error && (
        <div className="form-field__help">
          已選：{offerPlanTypeLabel[value.planType]}
          {value.billing ? `・${billingCycleLabel[value.billing]}` : ''}（Offer {value.offerId}）。送出時會把 SKU 與方案內容存成快照。
        </div>
      )}
      {version && !lookup.loading && !lookup.error && (
        <button
          type="button"
          className="link-button offer-picker__simulate"
          onClick={() => {
            setGoogleDownForPrototype(true);
            setRefresh((n) => n + 1);
          }}
        >
          Prototype：模擬 Google 沒回應
        </button>
      )}
    </fieldset>
  );
}
