import { pendingItems, type PendingId } from '../pendingItems';

/**
 * 灰色「待確認」標籤。
 * - 傳 id：對應 handoff「待確認事項」的編號，滑過可看到完整問題與負責人
 * - 不傳 id：文件中其他寫明「待確認／再討論」的項目，用 hint 說明
 * hint 會直接顯示，因為手機上沒有滑過提示。
 */
export function PendingTag({ id, hint }: { id?: PendingId; hint?: string }) {
  const item = id ? pendingItems[id] : undefined;
  const text = item ? `待確認 #${id}：${item.question}（${item.owner}）` : `待確認：${hint ?? ''}`;
  return (
    <span className="pending-tag" title={text} aria-label={text}>
      <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 1.6" />
      </svg>
      待確認{id ? ` #${id}` : ''}
      {hint && <span className="pending-tag__hint">· {hint}</span>}
    </span>
  );
}
