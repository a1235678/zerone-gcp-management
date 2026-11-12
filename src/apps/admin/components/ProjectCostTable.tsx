import { useState } from 'react';
import type { ProjectCost } from '@data/types';
import { Icon } from '@shared/components/Icon';
import { formatUsd } from '@shared/format';

/**
 * GCP 費用依「專案」彙總，點專案往下展開看各服務的明細（2026/11/11 與 Ray 的會議）。
 * 管理端不需要細分到專案層級的權限，所有專案都看得到。
 */
export function ProjectCostTable({ projects, caption, defaultOpen }: { projects: ProjectCost[]; caption: string; defaultOpen?: string }) {
  const [open, setOpen] = useState<Set<string>>(new Set(defaultOpen ? [defaultOpen] : []));
  const total = projects.reduce((s, p) => s + p.costCents, 0);
  const toggle = (p: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  const allOpen = projects.length > 0 && projects.every((p) => open.has(p.project));

  return (
    <div className="table-scroll" tabIndex={0} aria-label={`${caption}（可左右捲動）`}>
      <table className="table project-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th>
              <button type="button" className="link-button" onClick={() => setOpen(allOpen ? new Set() : new Set(projects.map((p) => p.project)))}>
                {allOpen ? '全部收合' : '全部展開'}
              </button>
              <span style={{ marginLeft: 'var(--space-3)' }}>專案／服務</span>
            </th>
            <th className="align-right">費用（USD）</th>
            <th className="align-right">佔比</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const isOpen = open.has(p.project);
            return [
              <tr key={p.project} className="project-table__project">
                <td>
                  <button type="button" className="project-table__toggle" aria-expanded={isOpen} onClick={() => toggle(p.project)}>
                    <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={14} />
                    <span className="mono">{p.project}</span>
                    <span className="table__secondary">{p.services.length} 項服務</span>
                  </button>
                </td>
                <td className="align-right">
                  <strong className="tnum">{formatUsd(p.costCents).slice(1)}</strong>
                </td>
                <td className="align-right">
                  <span className="tnum muted">{total ? ((p.costCents / total) * 100).toFixed(1) : '0.0'}%</span>
                </td>
              </tr>,
              ...(isOpen
                ? p.services.map((s) => (
                    <tr key={`${p.project}-${s.service}`} className="project-table__service">
                      <td>{s.service}</td>
                      <td className="align-right">
                        <span className="tnum">{formatUsd(s.costCents).slice(1)}</span>
                      </td>
                      <td className="align-right">
                        <span className="tnum muted">{p.costCents ? ((s.costCents / p.costCents) * 100).toFixed(1) : '0.0'}%</span>
                      </td>
                    </tr>
                  ))
                : []),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
