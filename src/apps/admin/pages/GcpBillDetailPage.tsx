import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  BILL_PAYMENT_DAYS,
  TODAY,
  billAmountTwd,
  getGcpBill,
  groupByProject,
  issueBills,
  issueBlocker,
  markBillPaid,
  resendBill,
  updateBill,
} from "@data/api";
import { Card } from "@shared/components/Card";
import { EmptyState } from "@shared/components/DataTable";
import { DescriptionList } from "@shared/components/DescriptionList";
import { Callout, FormField } from "@shared/components/Form";
import { Icon } from "@shared/components/Icon";
import { Modal } from "@shared/components/Modal";
import { PageHeader } from "@shared/components/PageHeader";
import { PendingTag } from "@shared/components/PendingTag";
import { StatusFlow } from "@shared/components/StatusFlow";
import { useToast } from "@shared/components/Toast";
import { formatDate, formatDateTime, formatUsd } from "@shared/format";
import { useAsync } from "@shared/hooks/useAsync";
import { ProjectCostTable } from "../components/ProjectCostTable";
import { usePermission } from "../auth";
import { BillStatusTag, ReconcileStateTag } from "../tags";

const usd = (cents: number) => formatUsd(cents).slice(1);
const signedUsd = (cents: number) =>
  `${cents > 0 ? "+" : "−"}${usd(Math.abs(cents))}`;
const twd = (n: number) => n.toLocaleString("en-US");


export function GcpBillDetailPage() {
  const { id = "" } = useParams();
  const { can } = usePermission();
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  const bill = useAsync(() => getGcpBill(id), [id, version]);
  const [dialog, setDialog] = useState<null | "edit" | "issue" | "paid">(null);
  const [markup, setMarkup] = useState("");
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState(TODAY);
  const [busy, setBusy] = useState(false);

  const b = bill.data;
  if (bill.loading && !b) return <p className="muted">載入中…</p>;
  if (!b)
    return (
      <Card>
        <EmptyState title="找不到這張帳單" description="帳單編號可能有誤。" />
        <p style={{ textAlign: "center" }}>
          <Link to="/products/gcp/billing">回 GCP 帳單</Link>
        </p>
      </Card>
    );

  const canWrite = can("billing", "write");
  const monthLabel = `${b.month.slice(0, 4)} 年 ${Number(b.month.slice(5))} 月`;
  const blocker = issueBlocker(b);
  const markupCents = Math.round((b.costCents * b.markupPct) / 100);
  const stepIndex = { pending: 1, billed: 3, overdue: 3, paid: 4 }[
    b.displayStatus
  ];
  const editMarkup = Number(markup);
  const previewTwd =
    markup !== "" && Number.isFinite(editMarkup)
      ? billAmountTwd(b.costCents, editMarkup, b.rate)
      : undefined;

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast(done);
      setDialog(null);
      reload();
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setBusy(false);
    }
  };

  const lastDay = new Date(
    Date.UTC(Number(b.month.slice(0, 4)), Number(b.month.slice(5, 7)), 0),
  ).getUTCDate();

  return (
    <>
      <Link to={`/products/gcp/billing?month=${b.month}`} className="back-link">
        <Icon name="chevronLeft" size={14} />
        GCP 帳單
      </Link>
      <PageHeader
        title={b.id}
        titleAddon={<BillStatusTag value={b.displayStatus} />}
        description={`${b.customerName} · ${b.dealerName} · ${monthLabel}`}
        actions={
          canWrite ? (
            <>
              {b.status === "pending" && (
                <>
                  <button
                    className="btn"
                    onClick={() => {
                      setMarkup(String(b.markupPct));
                      setNote(b.note ?? "");
                      setDialog("edit");
                    }}
                  >
                    調整加成或備註
                  </button>
                  <button
                    className="btn btn--primary"
                    disabled={Boolean(blocker)}
                    title={blocker}
                    onClick={() => setDialog("issue")}
                  >
                    確認並出帳
                  </button>
                </>
              )}
              {b.status === "billed" && (
                <>
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => resendBill(b.id),
                        `已重新寄送帳單給 ${b.contactEmail}`,
                      )
                    }
                  >
                    重新寄送帳單
                  </button>
                  <button
                    className="btn btn--primary"
                    onClick={() => {
                      setPaidAt(TODAY);
                      setNote("");
                      setDialog("paid");
                    }}
                  >
                    標記已收款
                  </button>
                </>
              )}
            </>
          ) : undefined
        }
      />

      <div className="stack">
        {b.status === "pending" && blocker && (
          <Callout tone="warning" title="還不能出帳">
            {blocker}。{" "}
            <Link to={`/products/gcp/billing?month=${b.month}&tab=reconcile`}>
              前往成本對帳
            </Link>
          </Callout>
        )}
        {b.displayStatus === "overdue" && (
          <Callout tone="danger" title="已超過付款期限">
            付款期限是 {formatDate(b.dueDate!)}
            ，客戶尚未付款。可以重新寄送帳單提醒客戶，收到款項後標記已收款。
          </Callout>
        )}

        <Card title="狀態">
          <StatusFlow
            steps={["計算完成", "待確認", "已出帳", "已收款"]}
            currentIndex={stepIndex}
            failedAt={b.displayStatus === "overdue" ? 3 : undefined}
            failedLabel="逾期未收"
          />
        </Card>

        <div className="split">
          <Card
            bodyless
            title="費用明細"
            actions={
              <PendingTag hint="資料來源預計為 GCP Billing 匯出（Terry）" />
            }
          >
            <ProjectCostTable caption="GCP 費用明細（依專案）" projects={groupByProject(b.lines)} />
            <dl className="amount-summary">
              <dt>Google 費用小計（Billing 匯出）</dt>
              <dd>{usd(b.exportCents)} USD</dd>
              {b.adjustmentCents !== 0 && (
                <>
                  <dt>對帳調整（採用 Google 金額）</dt>
                  <dd>{signedUsd(b.adjustmentCents)} USD</dd>
                </>
              )}
              <dt>
                加成 {b.markupPct}% <PendingTag id={10} />
              </dt>
              <dd>{usd(markupCents)} USD</dd>
              <dt>加成後合計</dt>
              <dd>{usd(b.costCents + markupCents)} USD</dd>
              <dt>
                匯率（1 USD） <PendingTag id={11} />
              </dt>
              <dd>{b.rate.toFixed(2)} TWD</dd>
              <dt className="is-total">應收金額</dt>
              <dd className="is-total">{twd(b.amountTwd)} TWD</dd>
            </dl>
          </Card>

          <div className="stack">
            <Card title="帳單資訊">
              <DescriptionList
                columns={1}
                items={[
                  {
                    label: "客戶",
                    value: can("customers") ? (
                      <Link to={`/customers/${b.customerId}`}>
                        {b.customerName}
                      </Link>
                    ) : (
                      b.customerName
                    ),
                  },
                  {
                    label: "帳單期間",
                    value: (
                      <span className="mono">
                        {b.month.replace("-", "/")}/01 –{" "}
                        {b.month.replace("-", "/")}/{lastDay}
                      </span>
                    ),
                  },
                  { label: "專案數", value: `${b.projects} 個` },
                  {
                    label: "和 Google 帳單比對",
                    value: (
                      <span className="inline">
                        <ReconcileStateTag value={b.reconcile} />
                        {b.googleCents !== undefined &&
                          b.googleCents !== b.exportCents && (
                            <span className="muted tnum">
                              Google {usd(b.googleCents)} USD
                            </span>
                          )}
                      </span>
                    ),
                  },
                  {
                    label: "出帳日",
                    value: b.issuedAt ? (
                      <span className="mono">{formatDate(b.issuedAt)}</span>
                    ) : (
                      ""
                    ),
                  },
                  {
                    label: "付款期限",
                    value: b.dueDate ? (
                      <span
                        className={`mono ${b.displayStatus === "overdue" ? "text-danger" : ""}`}
                      >
                        {formatDate(b.dueDate)}
                      </span>
                    ) : (
                      <span className="inline">
                        出帳後 {BILL_PAYMENT_DAYS} 天 <PendingTag id={12} />
                      </span>
                    ),
                  },
                  {
                    label: "收款日",
                    value: b.paidAt ? (
                      <span className="mono">{formatDate(b.paidAt)}</span>
                    ) : (
                      ""
                    ),
                  },
                  { label: "帳務聯絡人", value: b.contactName },
                  {
                    label: "寄送 Email",
                    value: <span className="mono">{b.contactEmail}</span>,
                  },
                  { label: "備註", value: b.note ?? "" },
                ]}
              />
              <p
                className="muted"
                style={{
                  margin: "var(--space-3) 0 0",
                  fontSize: "var(--text-sm)",
                }}
              >
                不開立發票，出帳後寄送帳單 PDF。
              </p>
            </Card>
            <Card title="處理歷程">
              <ol className="timeline">
                {b.history.map((e, i) => (
                  <li key={i} className="timeline__item">
                    <div className="timeline__head">
                      <span className="timeline__action">{e.text}</span>
                    </div>
                    <div className="timeline__meta">
                      <span className="mono">{formatDateTime(e.at)}</span> ·{" "}
                      {e.actor}
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      </div>

      <Modal
        open={dialog === "edit"}
        onClose={() => setDialog(null)}
        width={480}
        title="調整加成或備註"
        footer={
          <>
            <button className="btn" onClick={() => setDialog(null)}>
              取消
            </button>
            <button
              className="btn btn--primary"
              disabled={busy || markup === ""}
              onClick={() =>
                run(
                  () => updateBill(b.id, { markupPct: editMarkup, note }),
                  "帳單已更新",
                )
              }
            >
              儲存
            </button>
          </>
        }
      >
        <div className="stack">
          <FormField
            label="加成（%）"
            required
            help={
              previewTwd !== undefined
                ? `調整後應收 ${twd(previewTwd)} TWD（目前 ${twd(b.amountTwd)} TWD）`
                : "填 0 到 100 之間的數字"
            }
          >
            {(p) => (
              <input
                {...p}
                className="input"
                type="number"
                min={0}
                max={100}
                step={0.5}
                inputMode="decimal"
                value={markup}
                onChange={(e) => setMarkup(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="備註" help="會顯示在帳單資訊，不會寄給客戶。">
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
      </Modal>

      <Modal
        open={dialog === "issue"}
        onClose={() => setDialog(null)}
        width={460}
        title="確認並出帳"
        footer={
          <>
            <button className="btn" onClick={() => setDialog(null)}>
              取消
            </button>
            <button
              className="btn btn--primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await issueBills([b.id]);
                  if (r.skipped.length) throw new Error(r.skipped[0].reason);
                }, `已出帳，帳單已寄給 ${b.contactEmail}`)
              }
            >
              出帳
            </button>
          </>
        }
      >
        <p>
          {b.customerName} {monthLabel}帳單，應收{" "}
          <strong className="tnum">{twd(b.amountTwd)} TWD</strong>。
        </p>
        <p className="muted">
          出帳後會寄給 {b.contactEmail}，付款期限為出帳後 {BILL_PAYMENT_DAYS}{" "}
          天，之後不能再修改加成。
        </p>
      </Modal>

      <Modal
        open={dialog === "paid"}
        onClose={() => setDialog(null)}
        width={460}
        title="標記已收款"
        footer={
          <>
            <button className="btn" onClick={() => setDialog(null)}>
              取消
            </button>
            <button
              className="btn btn--primary"
              disabled={busy || !paidAt}
              onClick={() =>
                run(() => markBillPaid(b.id, { paidAt, note }), "已標記收款")
              }
            >
              確認收款
            </button>
          </>
        }
      >
        <div className="stack">
          <p>
            應收 <strong className="tnum">{twd(b.amountTwd)} TWD</strong>
          </p>
          <FormField label="收款日期" required>
            {(p) => (
              <input
                {...p}
                className="input"
                type="date"
                min={b.issuedAt}
                max={TODAY}
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="備註" help="例如匯款帳號末五碼。">
            {(p) => (
              <input
                {...p}
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </FormField>
        </div>
      </Modal>
    </>
  );
}
