"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Receipt, CheckCircle2, Save } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  StatusBadge,
  Table,
  Td,
  Textarea,
  Th,
} from "@/components/ui";
import { getJSON, patchJSON, postJSON, api } from "@/lib/client";
import { formatDateTime, formatMoney, STATUS_LABELS } from "@/lib/utils";
import { ALLOWED_TRANSITIONS, PRIORITY_OPTIONS, type JobStatus } from "@/lib/constants";

type Job = {
  _id: string;
  ticket: string;
  status: JobStatus;
  priority: string;
  device: { type: string; brand: string; model: string; serialNumber: string; accessories: string[]; condition: string };
  reportedIssue: string;
  diagnosis: string;
  workDone: string;
  labourCost: number;
  partsTotal: number;
  partsUsed: { part: string; name: string; quantity: number; unitPrice: number }[];
  estimate: { labourCost: number; partsCost: number; total: number; notes: string; quotedAt: string | null; approved: boolean; approvedBy: string } | null;
  customer: { _id: string; name: string; phone: string; email: string; address: string } | null;
  technician: { _id: string; name: string } | null;
  receivedAt: string;
  expectedCompletionAt: string | null;
  timeline: { status: string; note: string; byName: string; at: string }[];
};

type Invoice = { _id: string; invoiceNumber: string; total: number; status: string };
type Part = { _id: string; name: string; sku: string; quantity: number; sellingPrice: number };
type Technician = { _id: string; name: string; active: boolean };

export default function RepairDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [job, setJob] = useState<Job | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const [statusModal, setStatusModal] = useState<JobStatus | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [quoteModal, setQuoteModal] = useState(false);
  const [quote, setQuote] = useState({ labourCost: "", partsCost: "", notes: "" });
  const [approveModal, setApproveModal] = useState(false);
  const [approvedBy, setApprovedBy] = useState("");
  const [partModal, setPartModal] = useState(false);
  const [partForm, setPartForm] = useState({ partId: "", quantity: "1" });
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ taxRate: "0", discount: "0" });

  const [work, setWork] = useState({ diagnosis: "", workDone: "", labourCost: "", priority: "normal", technician: "" });

  const load = useCallback(async () => {
    try {
      const data = await getJSON<{ job: Job; invoice: Invoice | null }>(`/api/repairs/${id}`);
      setJob(data.job);
      setInvoice(data.invoice);
      setWork({
        diagnosis: data.job.diagnosis ?? "",
        workDone: data.job.workDone ?? "",
        labourCost: String(data.job.labourCost ?? 0),
        priority: data.job.priority,
        technician: data.job.technician?._id ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this repair job.");
    }
  }, [id]);

  useEffect(() => {
    load();
    getJSON<{ parts: Part[] }>("/api/parts").then((d) => setParts(d.parts)).catch(() => setParts([]));
    getJSON<{ technicians: Technician[] }>("/api/technicians")
      .then((d) => setTechnicians(d.technicians.filter((t) => t.active)))
      .catch(() => setTechnicians([]));
  }, [load]);

  /** Runs an action, then refreshes the job so the UI always reflects the server. */
  async function run(fn: () => Promise<unknown>, successMessage: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await load();
      setNotice(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !job) return <Alert>{error}</Alert>;
  if (!job) return <Spinner />;

  const nextStatuses = ALLOWED_TRANSITIONS[job.status] ?? [];
  const partsTotal = job.partsUsed.reduce((s, p) => s + p.quantity * p.unitPrice, 0);
  const canInvoice = ["completed", "delivered"].includes(job.status) && !invoice;

  return (
    <>
      <Link href="/repairs" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to repair jobs
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{job.ticket}</h1>
            <StatusBadge status={job.status} />
            {job.priority === "high" && <Badge tone="red">Urgent</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {job.device.brand} {job.device.model} · received {formatDateTime(job.receivedAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {job.estimate?.quotedAt && !job.estimate.approved && (
            <Button variant="secondary" onClick={() => setApproveModal(true)}>
              <CheckCircle2 className="h-4 w-4" />
              Approve quote
            </Button>
          )}
          <Button variant="secondary" onClick={() => setQuoteModal(true)}>
            {job.estimate?.quotedAt ? "Revise quote" : "Prepare quote"}
          </Button>
          {canInvoice && (
            <Button onClick={() => setInvoiceModal(true)}>
              <Receipt className="h-4 w-4" />
              Generate invoice
            </Button>
          )}
          {invoice && (
            <Link href={`/invoices/${invoice._id}`}>
              <Button variant="secondary">
                <Receipt className="h-4 w-4" />
                {invoice.invoiceNumber}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {notice && <div className="mb-4"><Alert tone="success">{notice}</Alert></div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Status transitions */}
          <Card>
            <CardHeader title="Repair status" subtitle="Move the job to its next stage" />
            <div className="p-5">
              {nextStatuses.length === 0 ? (
                <p className="text-sm text-slate-500">This job is closed. No further status changes are possible.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {nextStatuses.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={s === "cancelled" ? "danger" : "secondary"}
                      onClick={() => {
                        setStatusNote("");
                        setStatusModal(s);
                      }}
                    >
                      Mark as {STATUS_LABELS[s]}
                    </Button>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-slate-500">
                The customer is notified automatically on every status change.
              </p>
            </div>
          </Card>

          {/* Diagnosis and work */}
          <Card>
            <CardHeader
              title="Diagnosis &amp; work record"
              action={
                <Button
                  size="sm"
                  loading={busy}
                  onClick={() =>
                    run(
                      () =>
                        patchJSON(`/api/repairs/${id}`, {
                          diagnosis: work.diagnosis,
                          workDone: work.workDone,
                          labourCost: Number(work.labourCost) || 0,
                          priority: work.priority,
                          technician: work.technician || null,
                        }),
                      "Job details saved."
                    )
                  }
                >
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              }
            />
            <div className="space-y-4 p-5">
              <Field label="Reported fault">
                <Textarea value={job.reportedIssue} readOnly className="bg-slate-50" />
              </Field>
              <Field label="Technician diagnosis">
                <Textarea
                  value={work.diagnosis}
                  onChange={(e) => setWork({ ...work, diagnosis: e.target.value })}
                  placeholder="Faulty display cable; backlight inverter tested good."
                />
              </Field>
              <Field label="Work carried out">
                <Textarea
                  value={work.workDone}
                  onChange={(e) => setWork({ ...work, workDone: e.target.value })}
                  placeholder="Replaced display cable, reseated panel connector, ran 2-hour burn-in."
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Labour charge">
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={work.labourCost}
                    onChange={(e) => setWork({ ...work, labourCost: e.target.value })}
                  />
                </Field>
                <Field label="Priority">
                  <Select value={work.priority} onChange={(e) => setWork({ ...work, priority: e.target.value })}>
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Technician">
                  <Select value={work.technician} onChange={(e) => setWork({ ...work, technician: e.target.value })}>
                    <option value="">Unassigned</option>
                    {technicians.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
          </Card>

          {/* Parts used */}
          <Card>
            <CardHeader
              title="Spare parts used"
              subtitle="Each part is drawn down from inventory automatically"
              action={
                <Button size="sm" variant="secondary" onClick={() => setPartModal(true)}>
                  <Plus className="h-4 w-4" />
                  Add part
                </Button>
              }
            />
            {job.partsUsed.length === 0 ? (
              <EmptyState title="No parts used yet" description="Add a spare part when one is fitted to this device." />
            ) : (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>Part</Th>
                      <Th>Qty</Th>
                      <Th>Unit price</Th>
                      <Th>Amount</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {job.partsUsed.map((p) => (
                      <tr key={p.part}>
                        <Td className="font-medium text-slate-900">{p.name}</Td>
                        <Td>{p.quantity}</Td>
                        <Td>{formatMoney(p.unitPrice)}</Td>
                        <Td>{formatMoney(p.quantity * p.unitPrice)}</Td>
                        <Td className="text-right">
                          <button
                            className="text-slate-400 hover:text-rose-600"
                            title="Remove and return to stock"
                            onClick={() =>
                              run(
                                () => api(`/api/repairs/${id}/parts`, { method: "DELETE", body: JSON.stringify({ partId: p.part }) }),
                                "Part removed and returned to stock."
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <div className="flex justify-between border-t border-slate-200 px-5 py-3 text-sm">
                  <span className="text-slate-600">Parts total</span>
                  <span className="font-semibold text-slate-900">{formatMoney(partsTotal)}</span>
                </div>
              </>
            )}
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader title="Job history" subtitle="Full audit trail of this repair" />
            <ol className="space-y-4 p-5">
              {[...job.timeline].reverse().map((entry, i) => (
                <li key={i} className="flex gap-3 border-l-2 border-slate-200 pl-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={entry.status} />
                      <span className="text-xs text-slate-500">{formatDateTime(entry.at)}</span>
                    </div>
                    {entry.note && <p className="mt-1 text-sm text-slate-700">{entry.note}</p>}
                    {entry.byName && <p className="text-xs text-slate-500">by {entry.byName}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Customer" />
            <div className="space-y-3 p-5 text-sm">
              <div>
                <p className="text-slate-500">Name</p>
                <Link href={`/customers/${job.customer?._id}`} className="font-medium text-brand-600 hover:text-brand-700">
                  {job.customer?.name}
                </Link>
              </div>
              <div>
                <p className="text-slate-500">Phone</p>
                <p className="text-slate-900">{job.customer?.phone}</p>
              </div>
              <div>
                <p className="text-slate-500">Email</p>
                <p className="break-all text-slate-900">{job.customer?.email || "-"}</p>
              </div>
              <div>
                <p className="text-slate-500">Address</p>
                <p className="text-slate-900">{job.customer?.address || "-"}</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Device" />
            <div className="space-y-3 p-5 text-sm">
              <div>
                <p className="text-slate-500">Type / brand</p>
                <p className="text-slate-900">
                  {job.device.type} · {job.device.brand}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Model</p>
                <p className="text-slate-900">{job.device.model || "-"}</p>
              </div>
              <div>
                <p className="text-slate-500">Serial number</p>
                <p className="text-slate-900">{job.device.serialNumber || "-"}</p>
              </div>
              <div>
                <p className="text-slate-500">Accessories</p>
                <p className="text-slate-900">{job.device.accessories.join(", ") || "None"}</p>
              </div>
              <div>
                <p className="text-slate-500">Condition on arrival</p>
                <p className="text-slate-900">{job.device.condition || "-"}</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Costing" />
            <div className="space-y-2 p-5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Labour</span>
                <span className="text-slate-900">{formatMoney(job.labourCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Parts</span>
                <span className="text-slate-900">{formatMoney(partsTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
                <span>Running total</span>
                <span>{formatMoney(job.labourCost + partsTotal)}</span>
              </div>

              {job.estimate?.quotedAt && (
                <div className="mt-4 rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Quote</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{formatMoney(job.estimate.total)}</p>
                  <p className="text-xs text-slate-500">
                    {job.estimate.approved ? `Approved by ${job.estimate.approvedBy}` : "Awaiting customer approval"}
                  </p>
                  {job.estimate.notes && <p className="mt-2 text-xs text-slate-600">{job.estimate.notes}</p>}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ---- Modals ---- */}

      <Modal open={statusModal !== null} onClose={() => setStatusModal(null)} title={`Mark as ${statusModal ? STATUS_LABELS[statusModal] : ""}`}>
        <div className="space-y-4">
          <Field label="Note for the customer" hint="Included in the automatic notification">
            <Textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Optional" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStatusModal(null)}>Cancel</Button>
            <Button
              loading={busy}
              onClick={async () => {
                const target = statusModal;
                setStatusModal(null);
                await run(
                  () => postJSON(`/api/repairs/${id}/status`, { status: target, note: statusNote }),
                  "Status updated and the customer notified."
                );
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={quoteModal} onClose={() => setQuoteModal(false)} title="Prepare repair quote">
        <div className="space-y-4">
          <Field label="Labour cost" required>
            <Input type="number" min="0" step="100" value={quote.labourCost} onChange={(e) => setQuote({ ...quote, labourCost: e.target.value })} />
          </Field>
          <Field label="Estimated parts cost" required>
            <Input type="number" min="0" step="100" value={quote.partsCost} onChange={(e) => setQuote({ ...quote, partsCost: e.target.value })} />
          </Field>
          <Field label="Notes to the customer">
            <Textarea value={quote.notes} onChange={(e) => setQuote({ ...quote, notes: e.target.value })} />
          </Field>
          <p className="text-sm text-slate-600">
            Quote total: <span className="font-semibold">{formatMoney((Number(quote.labourCost) || 0) + (Number(quote.partsCost) || 0))}</span>
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setQuoteModal(false)}>Cancel</Button>
            <Button
              loading={busy}
              onClick={async () => {
                setQuoteModal(false);
                await run(
                  () =>
                    postJSON(`/api/repairs/${id}/quote`, {
                      labourCost: Number(quote.labourCost) || 0,
                      partsCost: Number(quote.partsCost) || 0,
                      notes: quote.notes,
                    }),
                  "Quote prepared and sent to the customer."
                );
              }}
            >
              Send quote
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={approveModal} onClose={() => setApproveModal(false)} title="Record quote approval">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Confirm that the customer approved the quote of{" "}
            <span className="font-semibold">{formatMoney(job.estimate?.total ?? 0)}</span>. The repair moves to
            &quot;In progress&quot;.
          </p>
          <Field label="Approved by" required hint="Name of the customer or their representative">
            <Input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} placeholder={job.customer?.name} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setApproveModal(false)}>Cancel</Button>
            <Button
              loading={busy}
              onClick={async () => {
                setApproveModal(false);
                await run(() => patchJSON(`/api/repairs/${id}/quote`, { approvedBy }), "Quote approved; repair started.");
              }}
            >
              Confirm approval
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={partModal} onClose={() => setPartModal(false)} title="Add a spare part">
        <div className="space-y-4">
          <Field label="Spare part" required>
            <Select value={partForm.partId} onChange={(e) => setPartForm({ ...partForm, partId: e.target.value })}>
              <option value="">Select a part...</option>
              {parts.map((p) => (
                <option key={p._id} value={p._id} disabled={p.quantity === 0}>
                  {p.name} ({p.sku}) - {p.quantity} in stock - {formatMoney(p.sellingPrice)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Quantity" required>
            <Input type="number" min="1" value={partForm.quantity} onChange={(e) => setPartForm({ ...partForm, quantity: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPartModal(false)}>Cancel</Button>
            <Button
              loading={busy}
              disabled={!partForm.partId}
              onClick={async () => {
                setPartModal(false);
                await run(
                  () => postJSON(`/api/repairs/${id}/parts`, { partId: partForm.partId, quantity: Number(partForm.quantity) || 1 }),
                  "Part added and stock updated."
                );
                setPartForm({ partId: "", quantity: "1" });
                getJSON<{ parts: Part[] }>("/api/parts").then((d) => setParts(d.parts)).catch(() => {});
              }}
            >
              Add part
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={invoiceModal} onClose={() => setInvoiceModal(false)} title="Generate invoice">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            The invoice is built from the labour charge ({formatMoney(job.labourCost)}) and the parts used (
            {formatMoney(partsTotal)}).
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tax rate (%)">
              <Input type="number" min="0" max="100" step="0.5" value={invoiceForm.taxRate} onChange={(e) => setInvoiceForm({ ...invoiceForm, taxRate: e.target.value })} />
            </Field>
            <Field label="Discount">
              <Input type="number" min="0" step="100" value={invoiceForm.discount} onChange={(e) => setInvoiceForm({ ...invoiceForm, discount: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setInvoiceModal(false)}>Cancel</Button>
            <Button
              loading={busy}
              onClick={async () => {
                setInvoiceModal(false);
                await run(
                  () =>
                    postJSON(`/api/repairs/${id}/invoice`, {
                      taxRate: Number(invoiceForm.taxRate) || 0,
                      discount: Number(invoiceForm.discount) || 0,
                    }),
                  "Invoice generated and sent to the customer."
                );
              }}
            >
              Generate
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
