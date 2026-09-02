"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, Plus } from "lucide-react";
import { Alert, Badge, Button, Card, Field, Input, Modal, Select, Spinner, Table, Td, Th } from "@/components/ui";
import { getJSON, postJSON } from "@/lib/client";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/constants";

type Invoice = {
  _id: string; invoiceNumber: string; ticket: string; status: string;
  items: { description: string; quantity: number; unitPrice: number; amount: number }[];
  subtotal: number; taxRate: number; tax: number; discount: number; total: number; amountPaid: number; balance: number;
  payments: { amount: number; method: string; reference: string; at: string; byName: string }[];
  issuedAt: string;
  customer: { name: string; phone: string; email: string; address: string } | null;
};

type Job = { _id: string; device: { brand: string; model: string; type: string; serialNumber: string }; diagnosis: string; workDone: string; technician: { name: string } | null };

const TONES: Record<string, string> = { paid: "green", partial: "amber", unpaid: "red", void: "slate" };

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [payment, setPayment] = useState({ amount: "", method: "cash", reference: "" });
  const [saving, setSaving] = useState(false);
  const [payError, setPayError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await getJSON<{ invoice: Invoice; job: Job }>(`/api/invoices/${id}`);
      setInvoice(data.invoice);
      setJob(data.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the invoice.");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setPayError("");
    try {
      await postJSON(`/api/invoices/${id}/payments`, {
        amount: Number(payment.amount),
        method: payment.method,
        reference: payment.reference,
      });
      setPayOpen(false);
      setPayment({ amount: "", method: "cash", reference: "" });
      await load();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Could not record the payment.");
    } finally {
      setSaving(false);
    }
  }

  if (error) return <Alert>{error}</Alert>;
  if (!invoice) return <Spinner />;

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/invoices" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back to invoices
        </Link>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          {invoice.balance > 0 && invoice.status !== "void" && (
            <Button onClick={() => { setPayError(""); setPayment({ ...payment, amount: String(invoice.balance) }); setPayOpen(true); }}>
              <Plus className="h-4 w-4" /> Record payment
            </Button>
          )}
        </div>
      </div>

      <Card className="print-area p-8">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Invoice</h1>
            <p className="mt-1 text-sm text-slate-500">{invoice.invoiceNumber}</p>
            <p className="mt-4 text-sm font-semibold text-slate-900">Computer Repair Management System</p>
            <p className="text-sm text-slate-500">Workshop billing document</p>
          </div>
          <div className="text-right text-sm">
            <Badge tone={TONES[invoice.status]}>{invoice.status}</Badge>
            <p className="mt-3 text-slate-500">Issued</p>
            <p className="font-medium text-slate-900">{formatDate(invoice.issuedAt)}</p>
            <p className="mt-2 text-slate-500">Repair ticket</p>
            <p className="font-medium text-slate-900">{invoice.ticket}</p>
          </div>
        </div>

        <div className="grid gap-6 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Billed to</p>
            <p className="mt-2 font-medium text-slate-900">{invoice.customer?.name}</p>
            <p className="text-sm text-slate-600">{invoice.customer?.phone}</p>
            <p className="text-sm text-slate-600">{invoice.customer?.email}</p>
            <p className="text-sm text-slate-600">{invoice.customer?.address}</p>
          </div>
          {job && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Device serviced</p>
              <p className="mt-2 font-medium text-slate-900">{job.device.brand} {job.device.model}</p>
              <p className="text-sm text-slate-600">{job.device.type}{job.device.serialNumber && ` · S/N ${job.device.serialNumber}`}</p>
              {job.technician && <p className="text-sm text-slate-600">Technician: {job.technician.name}</p>}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-lg ring-1 ring-slate-200">
          <Table>
            <thead className="bg-slate-50">
              <tr><Th>Description</Th><Th>Qty</Th><Th>Unit price</Th><Th className="text-right">Amount</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.items.map((item, i) => (
                <tr key={i}>
                  <Td className="text-slate-900">{item.description}</Td>
                  <Td>{item.quantity}</Td>
                  <Td>{formatMoney(item.unitPrice)}</Td>
                  <Td className="text-right font-medium text-slate-900">{formatMoney(item.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        <div className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600">Subtotal</dt><dd className="text-slate-900">{formatMoney(invoice.subtotal)}</dd></div>
            {invoice.discount > 0 && <div className="flex justify-between"><dt className="text-slate-600">Discount</dt><dd className="text-slate-900">-{formatMoney(invoice.discount)}</dd></div>}
            {invoice.taxRate > 0 && <div className="flex justify-between"><dt className="text-slate-600">Tax ({invoice.taxRate}%)</dt><dd className="text-slate-900">{formatMoney(invoice.tax)}</dd></div>}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatMoney(invoice.total)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Paid</dt><dd className="text-emerald-600">{formatMoney(invoice.amountPaid)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Balance due</dt><dd className={invoice.balance > 0 ? "text-rose-600" : "text-emerald-600"}>{formatMoney(invoice.balance)}</dd></div>
          </dl>
        </div>

        {invoice.payments.length > 0 && (
          <div className="mt-8 border-t border-slate-200 pt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Payment history</p>
            <ul className="space-y-2 text-sm">
              {invoice.payments.map((p, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2">
                  <span className="text-slate-600">
                    {formatDateTime(p.at)} · {p.method}{p.reference && ` · ${p.reference}`}{p.byName && ` · received by ${p.byName}`}
                  </span>
                  <span className="font-medium text-slate-900">{formatMoney(p.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record a payment">
        <form onSubmit={recordPayment} className="space-y-4">
          {payError && <Alert>{payError}</Alert>}
          <p className="text-sm text-slate-600">Outstanding balance: <strong>{formatMoney(invoice.balance)}</strong></p>
          <Field label="Amount" required>
            <Input type="number" min="0" step="100" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} required />
          </Field>
          <Field label="Method">
            <Select value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Reference" hint="Transfer reference or POS terminal slip">
            <Input value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Record payment</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
