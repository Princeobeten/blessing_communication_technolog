"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import {
  Button,
  Card,
  Input,
  Select,
  PageHeader,
  StatusBadge,
  Spinner,
  Alert,
  Table,
  Th,
  Td,
  EmptyState,
  Badge,
} from "@/components/ui";
import { getJSON } from "@/lib/client";
import { formatDate, JOBS_PLACEHOLDER } from "@/lib/utils";
import { JOB_STATUS_OPTIONS } from "@/lib/constants";

type Job = {
  _id: string;
  ticket: string;
  status: string;
  priority: string;
  device: { brand: string; model?: string; type: string };
  reportedIssue: string;
  customer: { _id: string; name: string; phone: string } | null;
  technician: { _id: string; name: string } | null;
  receivedAt: string;
};

export default function RepairsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      const data = await getJSON<{ jobs: Job[] }>(`/api/repairs?${params}`);
      setJobs(data.jobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load repair jobs.");
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  // Debounce the search so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  return (
    <>
      <PageHeader
        title="Repair jobs"
        subtitle="Every work order from intake to delivery"
        action={
          <Link href="/repairs/new">
            <Button>
              <Plus className="h-4 w-4" />
              New repair intake
            </Button>
          </Link>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ticket, customer, brand or serial number"
              className="pl-9"
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-52">
            <option value="all">All statuses</option>
            {JOB_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>

        {error && (
          <div className="p-4">
            <Alert>{error}</Alert>
          </div>
        )}

        {loading ? (
          <Spinner />
        ) : jobs.length === 0 ? (
          <EmptyState
            title="No repair jobs found"
            description={q || status !== "all" ? "Try a different search or filter." : JOBS_PLACEHOLDER}
            action={
              <Link href="/repairs/new">
                <Button size="sm">New repair intake</Button>
              </Link>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Ticket</Th>
                <Th>Customer</Th>
                <Th>Device / fault</Th>
                <Th>Technician</Th>
                <Th>Status</Th>
                <Th>Received</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <tr key={job._id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/repairs/${job._id}`} className="font-medium text-brand-600 hover:text-brand-700">
                      {job.ticket}
                    </Link>
                    {job.priority === "high" && (
                      <span className="ml-2">
                        <Badge tone="red">Urgent</Badge>
                      </span>
                    )}
                  </Td>
                  <Td>
                    <p className="font-medium text-slate-900">{job.customer?.name ?? "-"}</p>
                    <p className="text-xs text-slate-500">{job.customer?.phone}</p>
                  </Td>
                  <Td>
                    <p className="text-slate-900">
                      {job.device.brand} {job.device.model} <span className="text-slate-500">({job.device.type})</span>
                    </p>
                    <p className="max-w-xs truncate text-xs text-slate-500">{job.reportedIssue}</p>
                  </Td>
                  <Td className="text-slate-600">{job.technician?.name ?? <span className="text-slate-400">Unassigned</span>}</Td>
                  <Td>
                    <StatusBadge status={job.status} />
                  </Td>
                  <Td className="whitespace-nowrap text-slate-500">{formatDate(job.receivedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
