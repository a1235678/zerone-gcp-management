import { pendingItems, type PendingId } from '../pendingItems';

/** 灰色「待確認」標籤。滑過（或長按）可看到對應的待確認問題與負責人。 */
/** hint：簡短說明待確認的是什麼，手機上看不到滑過提示，所以直接顯示 */
export function PendingTag({ id, hint }: { id: PendingId; hint?: string }) {
  const item = pendingItems[id];
  const text = `待確認 #${id}：${item.question}（${item.owner}）`;
  return (
    <span className="pending-tag" title={text} aria-label={text}>
      <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 1.6" />
      </svg>
      待確認 #{id}
      {hint && <span className="pending-tag__hint">· {hint}</span>}
    </span>
  );
}
