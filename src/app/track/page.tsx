"use client";

import { useState } from "react";
import Link from "next/link";
import { Cpu, Search, CheckCircle2, Circle } from "lucide-react";
import { Button, Input, Alert, Card, StatusBadge, Spinner } from "@/components/ui";
import { getJSON } from "@/lib/client";
import { formatDateTime, formatMoney, STATUS_LABELS } from "@/lib/utils";

type TrackResult = {
  job: {
    ticket: string;
    customerName: string;
    device: { type: string; brand: string; model?: string };
    reportedIssue: string;
    status: string;
    technicianName: string;
    receivedAt: string;
    expectedCompletionAt: string | null;
    completedAt: string | null;
    estimate: { total: number; approved: boolean } | null;
    timeline: { status: string; note: string; at: string }[];
  };
  invoice: { invoiceNumber: string; total: number; balance: number; status: string } | null;
};

/** Public repair-status lookup - the customer needs only their tracking number. */
export default function TrackPage() {
  const [ticket, setTicket] = useState("");
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await getJSON<TrackResult>(`/api/track/${encodeURIComponent(ticket.trim())}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">
              <Cpu className="h-5 w-5" />
            </span>
            <span className="font-semibold text-slate-900">CRMS</span>
          </div>
          <Link href="/login" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Staff sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Track your repair</h1>
        <p className="mt-2 text-slate-600">
          Enter the tracking number printed on your intake receipt, for example <code>TRK-2026-0001</code>.
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Input
            value={ticket}
            onChange={(e) => setTicket(e.target.value.toUpperCase())}
            placeholder="TRK-2026-0001"
            className="sm:flex-1"
            aria-label="Tracking number"
          />
          <Button type="submit" loading={loading}>
            <Search className="h-4 w-4" />
            Check status
          </Button>
        </form>

        {error && (
          <div className="mt-6">
            <Alert>{error}</Alert>
          </div>
        )}

        {loading && <Spinner label="Looking up your repair" />}

        {result && (
          <div className="mt-8 space-y-6">
            <Card className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">Tracking number</p>
                  <p className="text-xl font-semibold text-slate-900">{result.job.ticket}</p>
                </div>
                <StatusBadge status={result.job.status} />
              </div>

              <dl className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-slate-500">Customer</dt>
                  <dd className="font-medium text-slate-900">{result.job.customerName}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Device</dt>
                  <dd className="font-medium text-slate-900">
                    {result.job.device.brand} {result.job.device.model} ({result.job.device.type})
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Reported fault</dt>
                  <dd className="text-slate-900">{result.job.reportedIssue}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Technician</dt>
                  <dd className="text-slate-900">{result.job.technicianName}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Received</dt>
                  <dd className="text-slate-900">{formatDateTime(result.job.receivedAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Expected completion</dt>
                  <dd className="text-slate-900">
                    {result.job.expectedCompletionAt ? formatDateTime(result.job.expectedCompletionAt) : "To be advised"}
                  </dd>
                </div>
              </dl>

              {result.job.estimate && (
                <div className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-sm">
                  <span className="text-slate-600">Repair quote: </span>
                  <span className="font-semibold text-slate-900">{formatMoney(result.job.estimate.total)}</span>
                  <span className="ml-2 text-slate-500">
                    {result.job.estimate.approved ? "(approved)" : "(awaiting your approval)"}
                  </span>
                </div>
              )}

              {result.invoice && (
                <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm">
                  <span className="text-slate-600">Invoice {result.invoice.invoiceNumber}: </span>
                  <span className="font-semibold text-slate-900">{formatMoney(result.invoice.total)}</span>
                  <span className="ml-2 text-slate-500">
                    {result.invoice.balance > 0
                      ? `- balance ${formatMoney(result.invoice.balance)}`
                      : "- fully paid"}
                  </span>
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="mb-5 text-base font-semibold text-slate-900">Repair progress</h2>
              <ol className="space-y-5">
                {result.job.timeline.map((entry, i) => {
                  const isLatest = i === result.job.timeline.length - 1;
                  return (
                    <li key={i} className="flex gap-3">
                      {isLatest ? (
                        <Circle className="mt-0.5 h-5 w-5 shrink-0 fill-brand-100 text-brand-600" />
                      ) : (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {STATUS_LABELS[entry.status] ?? entry.status}
                        </p>
                        {entry.note && <p className="text-sm text-slate-600">{entry.note}</p>}
                        <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(entry.at)}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
