"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Alert, Card, CardHeader, EmptyState, Spinner, StatusBadge, Table, Td, Th } from "@/components/ui";
import { getJSON } from "@/lib/client";
import { formatDate } from "@/lib/utils";

type Customer = { _id: string; name: string; phone: string; email: string; address: string; company: string; notes: string; createdAt: string };
type Job = { _id: string; ticket: string; status: string; device: { brand: string; type: string; model: string }; reportedIssue: string; technician: { name: string } | null; receivedAt: string };

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<{ customer: Customer; jobs: Job[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getJSON<{ customer: Customer; jobs: Job[] }>(`/api/customers/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;

  const { customer, jobs } = data;

  return (
    <>
      <Link href="/customers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{customer.name}</h1>
        <p className="mt-1 text-sm text-slate-500">Customer since {formatDate(customer.createdAt)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Contact details" />
          <dl className="space-y-3 p-5 text-sm">
            <div><dt className="text-slate-500">Phone</dt><dd className="text-slate-900">{customer.phone}</dd></div>
            <div><dt className="text-slate-500">Email</dt><dd className="break-all text-slate-900">{customer.email || "-"}</dd></div>
            <div><dt className="text-slate-500">Company</dt><dd className="text-slate-900">{customer.company || "-"}</dd></div>
            <div><dt className="text-slate-500">Address</dt><dd className="text-slate-900">{customer.address || "-"}</dd></div>
            <div><dt className="text-slate-500">Notes</dt><dd className="text-slate-900">{customer.notes || "-"}</dd></div>
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Repair history" subtitle={`${jobs.length} job(s) on record`} />
          {jobs.length === 0 ? (
            <EmptyState title="No repairs yet" description="This customer has not brought in a device." />
          ) : (
            <Table>
              <thead>
                <tr><Th>Ticket</Th><Th>Device</Th><Th>Technician</Th><Th>Status</Th><Th>Received</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((job) => (
                  <tr key={job._id} className="hover:bg-slate-50">
                    <Td><Link href={`/repairs/${job._id}`} className="font-medium text-brand-600 hover:text-brand-700">{job.ticket}</Link></Td>
                    <Td className="text-slate-600">{job.device.brand} {job.device.model}</Td>
                    <Td className="text-slate-600">{job.technician?.name ?? "-"}</Td>
                    <Td><StatusBadge status={job.status} /></Td>
                    <Td className="whitespace-nowrap text-slate-500">{formatDate(job.receivedAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
