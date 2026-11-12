import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  getBillMonths,
  getDealers,
  getGcpBills,
  getReconciliation,
  issueBills,
  issueBlocker,
  resolveReconcile,
  uploadGoogleInvoice,
} from "@data/api";
import {
  billStatusLabel,
  reconcileHowLabel,
  reconcileReasons,
} from "@data/labels";
import type {
  BillDisplayStatus,
  GcpBillListItem,
  ReconcileHow,
  ReconcileRow,
} from "@data/types";
import { Card } from "@shared/components/Card";
import {
  DataTable,
  EmptyState,
  type Column,
} from "@shared/components/DataTable";
import {
  FilterBar,
  SearchField,
  SelectField,
} from "@shared/components/FilterBar";
import { Callout, FormField } from "@shared/components/Form";
import { Icon } from "@shared/components/Icon";
import { Modal } from "@shared/components/Modal";
import { PageHeader } from "@shared/components/PageHeader";
import { PendingTag } from "@shared/components/PendingTag";
import { Stat, StatGrid } from "@shared/components/Stat";
import { Tabs } from "@shared/components/Tabs";
import { useToast } from "@shared/components/Toast";
import { downloadCsv } from "@shared/csv";
import { formatDate, formatDateTime, formatUsd } from "@shared/format";
import { useAsync } from "@shared/hooks/useAsync";
import { usePermission } from "../auth";
import { BillStatusTag, ReconcileStateTag } from "../tags";

type Tab = "bills" | "reconcile";
const statusOrder: BillDisplayStatus[] = [
  "pending",
  "billed",
  "overdue",
  "paid",
];
const twd = (n: number) => n.toLocaleString("en-US");
/** 美金（美分）帶正負號，差異欄用 */
const signedUsd = (cents: number) =>
  cents === 0
    ? "0.00"
    : `${cents > 0 ? "+" : "−"}${formatUsd(Math.abs(cents)).slice(1)}`;

export function GcpBillingPage() {
  const [params, setParams] = useSearchParams();
  const months = useAsync(getBillMonths);
  const month = params.get("month") ?? months.data?.[0]?.month ?? "";
  const tab = (params.get("tab") ?? "bills") as Tab;
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const recon = useAsync(
    () => (month ? getReconciliation(month) : Promise.resolve(undefined)),
    [month, version],
  );
  const mismatchCount =
    recon.data?.rows.filter((r) => r.state === "mismatch").length ?? 0;
  const monthInfo = months.data?.find((m) => m.month === month);
  const lastDay = month
    ? new Date(
        Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
      ).getUTCDate()
    : 0;

  return (
    <>
      <PageHeader
        title="GCP 帳單"
        titleAddon={<PendingTag hint="第一階段不納入，保留供討論" />}
        description={
          monthInfo ? (
            <>
              依 Google 費用加成後計算每個客戶的應收金額。帳單期間{" "}
              <span className="mono">{month.replace("-", "/")}/01</span> 至{" "}
              <span className="mono">
                {month.replace("-", "/")}/{lastDay}
              </span>
              ，不開立發票。
            </>
          ) : (
            "依 Google 費用加成後計算每個客戶的應收金額，不開立發票。"
          )
        }
        actions={
          <label className="inline-field">
            <span>帳單月份</span>
            <select
              className="select"
              value={month}
              onChange={(e) => setParam("month", e.target.value)}
            >
              {(months.data ?? []).map((m) => (
                <option key={m.month} value={m.month}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <div className="page-tabs">
        <Tabs<Tab>
          label="帳單分頁"
          value={tab}
          onChange={(v) => setParam("tab", v === "bills" ? "" : v)}
          tabs={[
            { value: "bills", label: "月結帳單" },
            {
              value: "reconcile",
              label: "成本對帳",
              count: mismatchCount || undefined,
            },
          ]}
        />
      </div>

      {month &&
        monthInfo &&
        (tab === "bills" ? (
          <BillsTab
            month={month}
            rate={monthInfo.rate}
            version={version}
            reload={reload}
            mismatchCount={mismatchCount}
          />
        ) : (
          <ReconcileTab month={month} version={version} reload={reload} />
        ))}
    </>
  );
}

// ───────────── 月結帳單 ─────────────

function BillsTab({
  month,
  rate,
  version,
  reload,
  mismatchCount,
}: {
  month: string;
  rate: number;
  version: number;
  reload: () => void;
  mismatchCount: number;
}) {
  const { can } = usePermission();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const keyword = params.get("q") ?? "";
  const dealerId = params.get("dealer") ?? "";
  const status = (params.get("status") ?? "") as BillDisplayStatus | "";
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const resetFilters = () => {
    const next = new URLSearchParams(params);
    ["q", "dealer", "status"].forEach((k) => next.delete(k));
    setParams(next, { replace: true });
  };

  const dealers = useAsync(getDealers);
  const all = useAsync(() => getGcpBills({ month }), [month, version]);
  const result = useAsync(
    () => getGcpBills({ month, keyword, dealerId, status }),
    [month, keyword, dealerId, status, version],
  );
  const rows = result.data ?? [];
  const hasFilter = Boolean(keyword || dealerId || status);
  const [issueOpen, setIssueOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const allRows = all.data ?? [];
  const sum = (f: (b: GcpBillListItem) => boolean) =>
    allRows.filter(f).reduce((s, b) => s + b.amountTwd, 0);
  const count = (s: BillDisplayStatus) =>
    allRows.filter((b) => b.displayStatus === s).length;
  const pending = allRows.filter((b) => b.status === "pending");
  const ready = pending.filter((b) => !issueBlocker(b));
  const blocked = pending.filter((b) => issueBlocker(b));

  const columns: Column<GcpBillListItem>[] = [
    {
      key: "id",
      header: "帳單編號",
      render: (b) => (
        <Link
          to={`/products/gcp/billing/${b.id}`}
          className="mono table__primary"
        >
          {b.id}
        </Link>
      ),
    },
    {
      key: "customer",
      header: "客戶",
      render: (b) => (
        <div>
          <div>{b.customerName}</div>
          <div className="table__secondary">{b.dealerName}</div>
        </div>
      ),
    },
    {
      key: "projects",
      header: "專案數",
      align: "right",
      render: (b) => <span className="tnum">{b.projects}</span>,
    },
    {
      key: "cost",
      header: "Google 費用（USD）",
      align: "right",
      render: (b) => (
        <span className="tnum">{formatUsd(b.costCents).slice(1)}</span>
      ),
    },
    {
      key: "markup",
      header: "加成",
      align: "right",
      render: (b) => <span className="tnum">{b.markupPct}%</span>,
    },
    {
      key: "amount",
      header: "應收（TWD）",
      align: "right",
      render: (b) => <strong className="tnum">{twd(b.amountTwd)}</strong>,
    },
    {
      key: "status",
      header: "狀態",
      render: (b) => (
        <div>
          <BillStatusTag value={b.displayStatus} />
          {b.status === "pending" && b.reconcile === "mismatch" && (
            <div className="table__secondary text-warning">
              對帳有差異，待處理
            </div>
          )}
        </div>
      ),
    },
    {
      key: "due",
      header: "付款期限",
      render: (b) =>
        b.dueDate ? (
          <span
            className={`mono ${b.displayStatus === "overdue" ? "text-danger" : ""}`}
          >
            {formatDate(b.dueDate)}
          </span>
        ) : (
          <span className="muted">出帳後 30 天</span>
        ),
    },
  ];

  const exportCsv = () => {
    const ok = downloadCsv(
      `gcp-bills-${month}.csv`,
      [
        "帳單編號",
        "客戶",
        "經銷商",
        "專案數",
        "Google 費用（USD）",
        "加成（%）",
        "匯率",
        "應收（TWD）",
        "狀態",
        "出帳日",
        "付款期限",
        "收款日",
      ],
      rows.map((b) => [
        b.id,
        b.customerName,
        b.dealerName,
        b.projects,
        (b.costCents / 100).toFixed(2),
        b.markupPct,
        b.rate,
        b.amountTwd,
        billStatusLabel[b.displayStatus],
        b.issuedAt ?? "",
        b.dueDate ?? "",
        b.paidAt ?? "",
      ]),
    );
    toast(
      ok
        ? `已匯出 ${rows.length} 筆帳單`
        : "瀏覽器擋下了下載，請改用新分頁開啟網站再試一次",
      ok ? "success" : "danger",
    );
  };

  const issueAll = async () => {
    setBusy(true);
    try {
      const r = await issueBills(ready.map((b) => b.id));
      toast(`已出帳 ${r.issued.length} 筆，帳單已寄給各客戶的帳務聯絡人`);
      setIssueOpen(false);
      reload();
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="stack page-stack">
        <StatGrid>
          <Stat
            label="Google 費用（成本）"
            value={formatUsd(
              allRows.reduce((s, b) => s + b.costCents, 0),
            ).slice(1)}
            unit="USD"
            sub={`${allRows.length} 個客戶`}
          />
          <Stat
            label="應收合計"
            value={twd(sum(() => true))}
            unit="TWD"
            sub={
              <>
                匯率 1 USD = {rate.toFixed(2)} TWD <PendingTag id={11} />
              </>
            }
          />
          <Stat
            label="已收款"
            value={twd(sum((b) => b.displayStatus === "paid"))}
            unit="TWD"
            sub={`${count("paid")} 筆`}
          />
          <Stat
            label="未收款"
            value={twd(
              sum(
                (b) =>
                  b.displayStatus === "billed" || b.displayStatus === "overdue",
              ),
            )}
            unit="TWD"
            tone={count("overdue") ? "danger" : undefined}
            sub={
              count("overdue") ? (
                <span className="text-danger">
                  其中逾期 {count("overdue")} 筆
                </span>
              ) : (
                `${count("billed")} 筆已出帳`
              )
            }
          />
        </StatGrid>

        {mismatchCount > 0 && (
          <Callout
            tone="warning"
            title={`${mismatchCount} 個客戶的成本和 Google 帳單不一致`}
          >
            這些帳單要先到「成本對帳」處理差異，才能出帳。{" "}
            <button
              type="button"
              className="link-button"
              onClick={() => setParam("tab", "reconcile")}
            >
              前往成本對帳
            </button>
          </Callout>
        )}

        <div className="status-strip" role="group" aria-label="依狀態快速篩選">
          {statusOrder.map((s) => (
            <button
              key={s}
              type="button"
              className={`status-strip__item ${status === s ? "is-active" : ""}`}
              aria-pressed={status === s}
              onClick={() => setParam("status", status === s ? "" : s)}
            >
              <BillStatusTag value={s} />
              <span className="status-strip__count tnum">{count(s)}</span>
            </button>
          ))}
        </div>

        <Card
          bodyless
          title="客戶帳單"
          actions={
            <div className="inline">
              <button
                type="button"
                className="btn btn--sm"
                onClick={exportCsv}
                disabled={!rows.length}
              >
                <Icon name="download" size={14} />
                匯出 CSV
              </button>
              {can("billing", "write") && (
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={!pending.length}
                  onClick={() => setIssueOpen(true)}
                >
                  確認並出帳（{ready.length} 筆）
                </button>
              )}
            </div>
          }
        >
          <FilterBar onReset={hasFilter ? resetFilters : undefined}>
            <SearchField
              label="關鍵字"
              value={keyword}
              onChange={(v) => setParam("q", v)}
              placeholder="客戶名稱或帳單編號"
            />
            <SelectField
              label="經銷商"
              value={dealerId}
              onChange={(v) => setParam("dealer", v)}
              options={(dealers.data ?? []).map((d) => ({
                value: d.id,
                label: d.name,
              }))}
            />
            <SelectField
              label="帳單狀態"
              value={status}
              onChange={(v) => setParam("status", v)}
              options={statusOrder.map((s) => ({
                value: s,
                label: billStatusLabel[s],
              }))}
            />
          </FilterBar>
          <div className="result-meta">
            <span>
              {hasFilter
                ? `符合條件 ${rows.length} 筆`
                : `共 ${rows.length} 筆`}
            </span>
            <span className="inline">
              <PendingTag id={10} />
              <PendingTag id={12} />
            </span>
          </div>
          <DataTable
            caption="GCP 客戶帳單"
            columns={columns}
            rows={rows}
            rowKey={(b) => b.id}
            loading={result.loading && !result.data}
            onRowClick={(b) => navigate(`/products/gcp/billing/${b.id}`)}
            empty={<EmptyState title="沒有符合條件的帳單" />}
          />
          {rows.length > 0 && (
            <div className="table-total">
              <span>合計 {rows.length} 個客戶</span>
              <span className="tnum">
                Google 費用{" "}
                {formatUsd(rows.reduce((s, b) => s + b.costCents, 0)).slice(1)}{" "}
                USD · 應收 {twd(rows.reduce((s, b) => s + b.amountTwd, 0))} TWD
              </span>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        title="確認並出帳"
        footer={
          <>
            <button className="btn" onClick={() => setIssueOpen(false)}>
              取消
            </button>
            <button
              className="btn btn--primary"
              disabled={busy || !ready.length}
              onClick={issueAll}
            >
              出帳 {ready.length} 筆
            </button>
          </>
        }
      >
        {ready.length > 0 ? (
          <>
            <p>
              以下帳單會寄給各客戶的帳務聯絡人，付款期限為出帳後 30
              天。出帳後就不能再修改加成。
            </p>
            <ul className="bill-list">
              {ready.map((b) => (
                <li key={b.id}>
                  <span className="mono">{b.id}</span> {b.customerName}：
                  <strong className="tnum">{twd(b.amountTwd)} TWD</strong>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>目前沒有可以出帳的帳單。</p>
        )}
        {blocked.length > 0 && (
          <Callout tone="warning" title={`另有 ${blocked.length} 筆還不能出帳`}>
            <ul className="bill-list">
              {blocked.map((b) => (
                <li key={b.id}>
                  <span className="mono">{b.id}</span> {b.customerName}：
                  {issueBlocker(b)}
                </li>
              ))}
            </ul>
          </Callout>
        )}
      </Modal>
    </>
  );
}

// ───────────── 成本對帳 ─────────────

function ReconcileTab({
  month,
  version,
  reload,
}: {
  month: string;
  version: number;
  reload: () => void;
}) {
  const { can } = usePermission();
  const toast = useToast();
  const recon = useAsync(() => getReconciliation(month), [month, version]);
  const bills = useAsync(() => getGcpBills({ month }), [month, version]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [target, setTarget] = useState<ReconcileRow | null>(null);
  const [how, setHow] = useState<ReconcileHow>("adoptGoogle");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const r = recon.data;
  if (!r) return <p className="muted">載入中…</p>;
  const canWrite = can("billing", "write");
  const billStatus = (id: string) =>
    bills.data?.find((b) => b.id === id)?.status;
  const ours = r.rows.reduce((s, x) => s + x.oursCents, 0);
  const google = r.rows.reduce((s, x) => s + (x.googleCents ?? 0), 0);
  const mismatches = r.rows.filter((x) => x.state === "mismatch");

  const openResolve = (row: ReconcileRow) => {
    setTarget(row);
    setHow("adoptGoogle");
    setReason("");
    setNote("");
  };
  const submitResolve = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await resolveReconcile(month, target.customerId, { how, reason, note });
      toast(
        `${target.customerName} 的差異已處理${how === "adoptGoogle" ? "，帳單改用 Google 金額計算" : ""}`,
      );
      setTarget(null);
      reload();
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setBusy(false);
    }
  };
  const submitUpload = async () => {
    setBusy(true);
    try {
      await uploadGoogleInvoice(month, fileName);
      toast("已上傳 Google 帳單，並重新比對");
      setUploadOpen(false);
      setFileName("");
      reload();
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<ReconcileRow>[] = [
    {
      key: "customer",
      header: "客戶",
      render: (x) => (
        <div>
          <div>{x.customerName}</div>
          <Link
            to={`/products/gcp/billing/${x.billId}`}
            className="table__secondary mono"
          >
            {x.billId}
          </Link>
        </div>
      ),
    },
    {
      key: "google",
      header: "Google 帳單（USD）",
      align: "right",
      render: (x) => (
        <span className="tnum">
          {x.googleCents === undefined
            ? "—"
            : formatUsd(x.googleCents).slice(1)}
        </span>
      ),
    },
    {
      key: "ours",
      header: "我方計算（USD）",
      align: "right",
      render: (x) => (
        <span className="tnum">{formatUsd(x.oursCents).slice(1)}</span>
      ),
    },
    {
      key: "diff",
      header: "差異",
      align: "right",
      render: (x) => (
        <span className={`tnum ${x.diffCents !== 0 ? "text-warning" : ""}`}>
          {signedUsd(x.diffCents)}
        </span>
      ),
    },
    {
      key: "state",
      header: "對帳結果",
      render: (x) => <ReconcileStateTag value={x.state} />,
    },
    {
      key: "note",
      header: "處理說明",
      minWidth: 220,
      render: (x) =>
        x.resolution ? (
          <div className="wrap-cell">
            <div>
              {reconcileHowLabel[x.resolution.how]}・{x.resolution.reason}
            </div>
            <div className="table__secondary">
              {x.resolution.note}（{x.resolution.by}，
              <span className="mono">{formatDateTime(x.resolution.at)}</span>）
            </div>
          </div>
        ) : x.state === "mismatch" ? (
          canWrite && billStatus(x.billId) === "pending" ? (
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => openResolve(x)}
            >
              處理差異
            </button>
          ) : (
            <span className="muted">待後勤處理</span>
          )
        ) : (
          <span className="muted">—</span>
        ),
    },
  ];

  return (
    <>
      <div className="stack page-stack">
        <Card>
          <div className="invoice-bar">
            <div>
              <div className="invoice-bar__title">
                Google 帳單 <PendingTag id={13} />
              </div>
              {r.invoice ? (
                <div className="muted">
                  <span className="mono">{r.invoice.fileName}</span> ·{" "}
                  {r.invoice.uploadedBy} 於{" "}
                  <span className="mono">
                    {formatDateTime(r.invoice.uploadedAt)}
                  </span>{" "}
                  上傳
                </div>
              ) : (
                <div className="muted">這個月份還沒上傳 Google 帳單。</div>
              )}
            </div>
            {canWrite && (
              <button
                type="button"
                className="btn"
                onClick={() => setUploadOpen(true)}
              >
                <Icon name="upload" size={16} />
                {r.invoice ? "重新上傳" : "上傳 Google 帳單"}
              </button>
            )}
          </div>
          <p
            className="muted"
            style={{ margin: "var(--space-3) 0 0", fontSize: "var(--text-sm)" }}
          >
            把我們從 Billing 匯出算出的成本，和 Google
            寄來的帳單逐一比對。有差異的客戶要先處理，才能出帳。
          </p>
        </Card>

        <StatGrid>
          <Stat
            label="Google 帳單金額"
            value={formatUsd(google).slice(1)}
            unit="USD"
          />
          <Stat
            label="我方計算（Billing 匯出）"
            value={formatUsd(ours).slice(1)}
            unit="USD"
          />
          <Stat
            label="差異"
            value={signedUsd(google - ours)}
            unit="USD"
            tone={mismatches.length ? "warning" : undefined}
            sub={
              mismatches.length
                ? `${mismatches.length} 個客戶有差異，請先處理`
                : "所有客戶都已對平或處理完成"
            }
          />
        </StatGrid>

        <Card bodyless title="依客戶比對" actions={<PendingTag id={14} />}>
          <DataTable
            caption="Google 帳單與我方計算比對"
            columns={columns}
            rows={r.rows}
            rowKey={(x) => x.customerId}
          />
          <div className="table-total">
            <span>合計 {r.rows.length} 個客戶</span>
            <span className="tnum">
              Google {formatUsd(google).slice(1)} · 我方{" "}
              {formatUsd(ours).slice(1)} · 差異 {signedUsd(google - ours)} USD
            </span>
          </div>
        </Card>
      </div>

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title="處理對帳差異"
        footer={
          <>
            <button className="btn" onClick={() => setTarget(null)}>
              取消
            </button>
            <button
              className="btn btn--primary"
              disabled={busy || !reason || !note.trim()}
              onClick={submitResolve}
            >
              確認處理
            </button>
          </>
        }
      >
        {target && (
          <div className="stack">
            <p>
              {target.customerName}：Google 帳單{" "}
              <strong className="tnum">
                {formatUsd(target.googleCents ?? 0).slice(1)}
              </strong>{" "}
              USD，我方計算{" "}
              <strong className="tnum">
                {formatUsd(target.oursCents).slice(1)}
              </strong>{" "}
              USD，差{" "}
              <strong className="tnum">{signedUsd(target.diffCents)}</strong>{" "}
              USD。
            </p>
            <fieldset className="plain-fieldset">
              <legend className="form-field__label">處理方式</legend>
              {(["adoptGoogle", "keepOurs"] as ReconcileHow[]).map((h) => (
                <label key={h} className="radio-row">
                  <input
                    type="radio"
                    name="how"
                    checked={how === h}
                    onChange={() => setHow(h)}
                  />
                  <span>
                    <strong>{reconcileHowLabel[h]}</strong>
                    <span className="muted">
                      {h === "adoptGoogle"
                        ? "：帳單成本改成 Google 的金額，客戶的應收跟著重算。"
                        : "：帳單照我方計算出帳，差額由零壹自行吸收或下個月再調整。"}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <FormField label="差異原因" required>
              {(p) => (
                <select
                  {...p}
                  className="select"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="">請選擇</option>
                  {reconcileReasons.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField
              label="說明"
              required
              help="例如：Google 套用 12.40 USD 折抵額度，匯出資料未反映。"
            >
              {(p) => (
                <textarea
                  {...p}
                  className="textarea"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              )}
            </FormField>
          </div>
        )}
      </Modal>

      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        width={480}
        title="上傳 Google 帳單"
        footer={
          <>
            <button className="btn" onClick={() => setUploadOpen(false)}>
              取消
            </button>
            <button
              className="btn btn--primary"
              disabled={busy || !fileName}
              onClick={submitUpload}
            >
              上傳並比對
            </button>
          </>
        }
      >
        <div className="stack">
          <p className="muted">
            Prototype 不會讀取檔案內容，只示意流程：上傳後系統依 Google
            帳務帳戶逐一和我方計算比對。
          </p>
          <FormField label="Google 帳單檔案" required help="支援 PDF 或 CSV">
            {(p) => (
              <input
                {...p}
                className="input"
                type="file"
                accept=".pdf,.csv"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
              />
            )}
          </FormField>
          {r.invoice && (
            <Callout tone="neutral">
              重新上傳會取代目前的檔案，已處理的差異會保留。
            </Callout>
          )}
        </div>
      </Modal>
    </>
  );
}
