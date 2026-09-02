"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Alert, Badge, Card, EmptyState, Input, PageHeader, Select, Spinner, Table, Td, Th } from "@/components/ui";
import { getJSON } from "@/lib/client";
import { formatDate, formatMoney } from "@/lib/utils";

type Invoice = {
  _id: string; invoiceNumber: string; ticket: string; total: number; amountPaid: number; balance: number;
  status: string; issuedAt: string; customer: { name: string } | null;
};

const TONES: Record<string, string> = { paid: "green", partial: "amber", unpaid: "red", void: "slate" };

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      setInvoices((await getJSON<{ invoices: Invoice[] }>(`/api/invoices?${params}`)).invoices);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load invoices.");
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    const timer = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  const totals = invoices.reduce(
    (acc, i) => ({ billed: acc.billed + i.total, outstanding: acc.outstanding + i.balance }),
    { billed: 0, outstanding: 0 }
  );

  return (
    <>
      <PageHeader title="Invoices" subtitle="Billing for completed repairs" />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice or ticket number" className="pl-9" />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
            <option value="all">All statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Part paid</option>
            <option value="paid">Paid</option>
          </Select>
        </div>

        <div className="flex flex-wrap gap-6 border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm">
          <span className="text-slate-600">Billed: <strong className="text-slate-900">{formatMoney(totals.billed)}</strong></span>
          <span className="text-slate-600">Outstanding: <strong className="text-slate-900">{formatMoney(totals.outstanding)}</strong></span>
        </div>

        {error && <div className="p-4"><Alert>{error}</Alert></div>}

        {loading ? (
          <Spinner />
        ) : invoices.length === 0 ? (
          <EmptyState title="No invoices" description="Invoices are generated from a completed repair job." />
        ) : (
          <Table>
            <thead>
              <tr><Th>Invoice</Th><Th>Customer</Th><Th>Ticket</Th><Th>Total</Th><Th>Balance</Th><Th>Status</Th><Th>Issued</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv._id} className="hover:bg-slate-50">
                  <Td><Link href={`/invoices/${inv._id}`} className="font-medium text-brand-600 hover:text-brand-700">{inv.invoiceNumber}</Link></Td>
                  <Td>{inv.customer?.name ?? "-"}</Td>
                  <Td className="text-slate-600">{inv.ticket}</Td>
                  <Td className="font-medium text-slate-900">{formatMoney(inv.total)}</Td>
                  <Td className={inv.balance > 0 ? "text-rose-600" : "text-slate-500"}>{formatMoney(inv.balance)}</Td>
                  <Td><Badge tone={TONES[inv.status]}>{inv.status}</Badge></Td>
                  <Td className="whitespace-nowrap text-slate-500">{formatDate(inv.issuedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
