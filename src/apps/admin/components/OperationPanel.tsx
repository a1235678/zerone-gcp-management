import { useState } from 'react';
import { Link } from 'react-router-dom';
import { actOnOperation, getOperation } from '@data/api';
import { executionModeLabel, operationTypeLabel } from '@data/labels';
import type { OperationAction, OperationListItem } from '@data/types';
import { Callout, FormField } from '@shared/components/Form';
import { Icon } from '@shared/components/Icon';
import { Modal } from '@shared/components/Modal';
import { useToast } from '@shared/components/Toast';
import { formatDate, formatDateTime } from '@shared/format';
import { StatusTag } from '@shared/components/StatusTag';
import { useAsync } from '@shared/hooks/useAsync';
import { OperationStatusTag } from '../tags';
import { usePermission } from '../auth';

const doneToast: Record<OperationAction, string> = {
  runSchedule: '排程已啟動，已送出 Google',
  cancelSchedule: '已取消排程',
  completeManual: '已標記人工處理完成，等下次同步確認',
  simulateSuccess: 'Google 回應完成，訂閱資料已更新',
  simulateFailure: 'Google 回應失敗',
  retry: '已重新送出 Google',
  markManual: '已改為手動處理，等下次同步確認',
  simulateSync: '同步確認完成',
};

/**
 * 一筆訂單操作的狀態與處理：
 * - 已排程：等啟用日由系統送 Google（Prototype 用按鈕模擬啟動），可以取消排程
 * - 待人工執行：後勤在 Google 後台處理後標記完成（要填備註）
 * - 已送出：等 Google 回應（Prototype 用按鈕模擬）
 * - 失敗：重新送出，或改為在 Google 手動處理（要填備註）
 * - 手動處理：等下次同步確認（Prototype 用按鈕模擬）
 */
export function OperationBody({ op, onChanged }: { op: OperationListItem; onChanged: () => void }) {
  const { can } = usePermission();
  const canOperate = can('subscriptions', 'write');
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<null | 'fail' | 'manual' | 'complete'>(null);
  const [note, setNote] = useState('');

  const run = async (action: OperationAction, n?: string) => {
    setBusy(true);
    try {
      await actOnOperation(op.id, action, n);
      toast(doneToast[action], action === 'simulateFailure' ? 'danger' : 'success');
      setMode(null);
      setNote('');
      onChanged();
    } catch (e) {
      toast((e as Error).message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 'var(--space-3)' }}>
      <div className="inline">
        <span className="mono">{op.id}</span>
        <OperationStatusTag value={op.status} />
        <StatusTag tone="neutral">{executionModeLabel[op.execution]}</StatusTag>
        <span className="muted">
          {operationTypeLabel[op.type]} · {op.summary}
        </span>
      </div>

      {op.status === 'scheduled' && (
        <Callout tone="info" title={`已排程，${formatDate(op.payload.scheduledAt ?? '')} 執行`}>
          到啟用日由系統送 Google。排程編號 <span className="mono">{op.scheduleId}</span>，也可以在「GWS 排程中心」查看或取消。
        </Callout>
      )}
      {op.status === 'pendingManual' && (
        <Callout tone="warning" title="待人工執行">
          請在 Google 後台完成後，回到這裡標記完成並寫下處理內容。
        </Callout>
      )}
      {op.status === 'cancelled' && <Callout tone="neutral">排程已取消，這筆操作不會執行。</Callout>}
      {op.status === 'failed' && (
        <Callout tone="danger" title="Google 回應失敗">
          {op.failureReason}
        </Callout>
      )}
      {op.status === 'manual' && (
        <Callout tone="warning" title="已在 Google 手動處理">
          {op.manualNote}
          <br />
          下次從 Google 同步時，系統會比對訂閱資料，對得上就自動標記完成。
        </Callout>
      )}

      {op.status === 'scheduled' && canOperate && !mode && (
        <div className="simulate" style={{ marginTop: 0 }}>
          <div className="simulate__text">
            <strong>等待啟用日。</strong>
            <span className="muted">Prototype 沒有排程器，可以用按鈕模擬排程啟動。</span>
          </div>
          <div className="inline">
            <button className="btn btn--sm btn--danger" disabled={busy} onClick={() => run('cancelSchedule')}>
              取消排程
            </button>
            <button className="btn btn--sm" disabled={busy} onClick={() => run('runSchedule')}>
              模擬排程啟動
            </button>
          </div>
        </div>
      )}
      {op.status === 'pendingManual' && canOperate && !mode && (
        <div className="inline">
          <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => setMode('complete')}>
            標記已在 Google 完成
          </button>
        </div>
      )}
      {op.status === 'submitted' && canOperate && (
        <div className="simulate" style={{ marginTop: 0 }}>
          <div className="simulate__text">
            <strong>等待 Google 回應。</strong>
            <span className="muted">Prototype 沒有連線 Google，請用按鈕模擬回應結果。</span>
          </div>
          <div className="inline">
            <button className="btn btn--sm" disabled={busy} onClick={() => setMode('fail')}>
              模擬失敗
            </button>
            <button className="btn btn--sm" disabled={busy} onClick={() => run('simulateSuccess')}>
              模擬完成
            </button>
          </div>
        </div>
      )}
      {op.status === 'manual' && canOperate && (
        <div className="simulate" style={{ marginTop: 0 }}>
          <div className="simulate__text">
            <strong>等待同步確認。</strong>
            <span className="muted">Prototype 沒有同步排程，請用按鈕模擬同步結果。</span>
          </div>
          <button className="btn btn--sm" disabled={busy} onClick={() => run('simulateSync')}>
            模擬同步完成
          </button>
        </div>
      )}
      {op.status === 'failed' && !mode && canOperate && (
        <div className="inline">
          <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => run('retry')}>
            <Icon name="reset" size={14} />
            重新送出 Google
          </button>
          <button className="btn btn--sm" disabled={busy} onClick={() => setMode('manual')}>
            改為在 Google 手動處理
          </button>
        </div>
      )}

      {mode && (
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          <FormField
            label={mode === 'fail' ? '模擬的失敗原因' : '在 Google 做了什麼'}
            required={mode !== 'fail'}
            help={mode === 'fail' ? '留白會使用「請求參數不正確」。' : '例如：已在 Google 經銷商後台設定續約並減為 12 席。'}
          >
            {(p) => <input {...p} className="input" value={note} onChange={(e) => setNote(e.target.value)} />}
          </FormField>
          <div className="inline">
            <button className="btn btn--sm" onClick={() => setMode(null)}>
              取消
            </button>
            <button
              className={`btn btn--sm ${mode === 'fail' ? 'btn--danger' : 'btn--primary'}`}
              disabled={busy || (mode !== 'fail' && !note.trim())}
              onClick={() => run(mode === 'fail' ? 'simulateFailure' : mode === 'complete' ? 'completeManual' : 'markManual', note)}
            >
              {mode === 'fail' ? '模擬失敗' : mode === 'complete' ? '確認已完成' : '確認改為手動處理'}
            </button>
          </div>
        </div>
      )}

      <ol className="timeline" style={{ marginTop: 'var(--space-2)' }}>
        {[...op.history].reverse().map((e, i) => (
          <li key={i} className={`timeline__item ${e.status === 'failed' ? 'is-failure' : e.status === 'completed' ? 'is-success' : ''}`}>
            <div className="timeline__head">
              <span className="timeline__action">{e.action}</span>
            </div>
            <div className="timeline__meta">
              <span className="mono">{formatDateTime(e.at)}</span> · {e.by}
            </div>
            {e.note && <div className="timeline__note">{e.note}</div>}
          </li>
        ))}
      </ol>
      {op.workOrderId && (
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          來源執行單：<Link to={`/work-orders/${op.workOrderId}`}>{op.workOrderId}</Link>
        </p>
      )}
    </div>
  );
}

/** 以對話框顯示一筆操作（GWS 訂閱頁、客戶詳情使用） */
export function OperationPanel({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const [version, setVersion] = useState(0);
  const op = useAsync(() => (id ? getOperation(id) : Promise.resolve(undefined)), [id, version]);
  return (
    <Modal open={Boolean(id)} onClose={onClose} title="訂單處理狀態" width={560}>
      {op.data ? (
        <OperationBody
          op={op.data}
          onChanged={() => {
            setVersion((v) => v + 1);
            onChanged();
          }}
        />
      ) : (
        <p className="muted">載入中…</p>
      )}
    </Modal>
  );
}
