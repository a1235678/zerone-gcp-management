import { transferCodesFor } from '@data/api';
import { Callout } from '@shared/components/Form';
import { PendingTag } from '@shared/components/PendingTag';

/**
 * 客戶在 Google 申請轉移時要填的兩個代碼（2026/11/11 與 Ray 的會議）：
 * 代理商代碼是零壹；經銷商代碼是客戶透過哪個經銷商購買。不需要轉移碼。
 */
export function TransferCodes({ dealerId }: { dealerId?: string }) {
  const codes = dealerId ? transferCodesFor(dealerId) : undefined;
  return (
    <Callout tone="info" title={<span className="inline">請客戶申請轉移時填寫這兩個代碼 <PendingTag hint="代碼格式待確認" /></span>}>
      <dl className="code-pair">
        <div>
          <dt>代理商代碼（零壹）</dt>
          <dd className="mono">{codes?.agentCode ?? '—'}</dd>
        </div>
        <div>
          <dt>經銷商代碼{codes?.dealerName ? `（${codes.dealerName}）` : ''}</dt>
          <dd className="mono">{codes?.dealerCode || <span className="muted">請先選擇經銷商</span>}</dd>
        </div>
      </dl>
      不需要轉移碼。客戶在 Google 送出申請後，後勤到 Google 後台接受移轉，再回系統標記完成。
    </Callout>
  );
}
