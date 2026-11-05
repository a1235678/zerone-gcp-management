import { useSearchParams } from 'react-router-dom';
import { getAuditLogs } from '@data/api';
import { logCategoryLabel, logResultLabel } from '@data/labels';
import type { LogCategory, LogResult } from '@data/types';
import { Card } from '@shared/components/Card';
import { DateRangeField, FilterBar, SearchField, SelectField } from '@shared/components/FilterBar';
import { Icon } from '@shared/components/Icon';
import { PageHeader } from '@shared/components/PageHeader';
import { Pagination, paginate } from '@shared/components/Pagination';
import { useToast } from '@shared/components/Toast';
import { downloadCsv } from '@shared/csv';
import { useAsync } from '@shared/hooks/useAsync';
import { AuditLogTable } from '../components/AuditLogTable';

const PAGE_SIZE = 20;

export function AuditLogsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const keyword = params.get('q') ?? '';
  const category = (params.get('category') ?? '') as LogCategory | '';
  const result = (params.get('result') ?? '') as LogResult | '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const page = Number(params.get('page') ?? '1');

  const setParam = (entries: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(entries)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in entries)) next.delete('page');
    setParams(next, { replace: true });
  };

  const logs = useAsync(() => getAuditLogs({ keyword, category, result, from, to }), [keyword, category, result, from, to]);
  const rows = logs.data ?? [];
  const { pageRows, pageCount, page: safePage } = paginate(rows, page, PAGE_SIZE);
  const hasFilter = Boolean(keyword || category || result || from || to);

  const exportCsv = () => {
    const ok = downloadCsv(
      `系統日誌_${new Date().toISOString().slice(0, 10)}.csv`,
      ['時間', '操作人', '角色', '類型', '對象', '動作', '結果'],
      rows.map((l) => [l.at, l.actor, l.actorRole, logCategoryLabel[l.category], l.target, l.action, logResultLabel[l.result]]),
    );
    toast(ok ? `已匯出 ${rows.length} 筆（CSV，可用 Excel 開啟）` : '瀏覽器擋下了下載，請改用一般瀏覽器開啟網站', ok ? 'success' : 'danger');
  };

  return (
    <>
      <PageHeader
        title="系統日誌"
        description="所有操作紀錄，包含客戶資料、執行單、權限、登入與同步。所有 GWS 變更都會留下紀錄。"
        actions={
          <button className="btn" onClick={exportCsv} disabled={!rows.length}>
            <Icon name="download" size={16} />
            匯出
          </button>
        }
      />
      <Card bodyless>
        <FilterBar onReset={hasFilter ? () => setParams({}, { replace: true }) : undefined}>
          <SearchField label="關鍵字" value={keyword} onChange={(v) => setParam({ q: v })} placeholder="操作人、對象或動作" />
          <SelectField label="類型" value={category} onChange={(v) => setParam({ category: v })} options={Object.entries(logCategoryLabel).map(([value, label]) => ({ value, label }))} />
          <SelectField label="結果" value={result} onChange={(v) => setParam({ result: v })} options={Object.entries(logResultLabel).map(([value, label]) => ({ value, label }))} />
          <DateRangeField label="日期" from={from} to={to} onChange={(f, t) => setParam({ from: f, to: t })} />
        </FilterBar>
        <div className="result-meta">
          <span>{hasFilter ? `符合條件 ${rows.length} 筆` : `共 ${rows.length} 筆`}</span>
          <Pagination page={safePage} pageCount={pageCount} onChange={(p) => setParam({ page: String(p) })} />
        </div>
        <AuditLogTable rows={pageRows} loading={logs.loading && !logs.data} />
      </Card>
    </>
  );
}
