import { Icon } from './Icon';

/** 流程步驟條：已完成、目前、未到；目前步驟若失敗以文字標示 */
export function StatusFlow({
  steps,
  currentIndex,
  failedAt,
  failedLabel = '失敗',
}: {
  steps: string[];
  currentIndex: number;
  failedAt?: number;
  failedLabel?: string;
}) {
  return (
    <ol className="flow" aria-label="處理進度">
      {steps.map((s, i) => {
        const failed = failedAt === i;
        const state = failed ? 'failed' : i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
        const stateText = { done: '已完成', current: '目前', todo: '尚未進行', failed: failedLabel }[state];
        return (
          <li key={s} className={`flow__step is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="flow__mark">
              {state === 'done' && <Icon name="check" size={13} />}
              {state === 'failed' && <Icon name="close" size={13} />}
              {(state === 'current' || state === 'todo') && i + 1}
            </span>
            <span className="flow__text">
              <span className="flow__label">{s}</span>
              <span className="flow__state">{stateText}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
