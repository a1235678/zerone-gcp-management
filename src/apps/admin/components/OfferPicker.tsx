import { findOffer, getGwsSkus, offerUnavailableReason } from '@data/api';
import { billingCycleLabel, offerPlanTypeLabel } from '@data/labels';
import type { GwsOffer, OperationType } from '@data/types';
import { StatusTag } from '@shared/components/StatusTag';
import { formatDate, formatUsd } from '@shared/format';
import { useAsync } from '@shared/hooks/useAsync';

const planTone = { annual: 'success', flexible: 'warning', trial: 'neutral' } as const;

/** 方案標籤：年約（綠）、彈性（橘）、試用（灰），文字一定會顯示 */
export function OfferPlanTag({ offer }: { offer: GwsOffer }) {
  return <StatusTag tone={planTone[offer.planType]}>{offerPlanTypeLabel[offer.planType]}</StatusTag>;
}

/**
 * 選 Google 方案（Offer）：選好版本後，列出這個版本在 Google 上可訂閱的方案。
 * 人數不在授權數範圍、已過供應期限、試用但不是新訂的方案不能選，並寫出原因。
 */
export function OfferPicker({
  version,
  seats,
  type,
  value,
  onChange,
  error,
}: {
  version: string;
  seats: number | undefined;
  type: OperationType;
  value: string;
  onChange: (offerId: string) => void;
  error?: string;
}) {
  const skus = useAsync(getGwsSkus);
  const sku = skus.data?.find((s) => s.version === version);
  const selected = findOffer(value)?.offer;

  return (
    <fieldset className="plain-fieldset offer-picker" aria-invalid={Boolean(error)}>
      <legend className="form-field__label">
        方案 <span className="form-field__req">必填</span>
      </legend>
      {!version ? (
        <p className="muted offer-picker__empty">先選擇版本，再選方案。</p>
      ) : !skus.data ? (
        <p className="muted offer-picker__empty">載入中…</p>
      ) : !sku || sku.offers.length === 0 ? (
        <p className="muted offer-picker__empty">這個版本目前沒有可販售的方案。</p>
      ) : (
        <div className="offer-picker__list" role="radiogroup" aria-label={`${version} 的方案`}>
          {sku.offers.map((o) => {
            const reason = offerUnavailableReason(o, seats, type);
            return (
              <label key={o.offerId} className={`offer-option ${value === o.offerId ? 'is-selected' : ''} ${reason ? 'is-disabled' : ''}`}>
                <input type="radio" name={`offer-${type}`} checked={value === o.offerId} disabled={Boolean(reason)} onChange={() => onChange(o.offerId)} />
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
      {error && <div className="form-field__msg form-field__msg--error">{error}</div>}
      {selected && !error && (
        <div className="form-field__help">
          已選：{offerPlanTypeLabel[selected.planType]}
          {selected.billing ? `・${billingCycleLabel[selected.billing]}` : ''}（{selected.offerId}）
        </div>
      )}
    </fieldset>
  );
}
