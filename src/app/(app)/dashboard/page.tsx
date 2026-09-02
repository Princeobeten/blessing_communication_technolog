"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wrench, Clock, Users, AlertTriangle, Plus, TrendingUp } from "lucide-react";
import {
  Card,
  CardHeader,
  PageHeader,
  StatCard,
  StatusBadge,
  Spinner,
  Alert,
  Button,
  Table,
  Th,
  Td,
  EmptyState,
  Badge,
} from "@/components/ui";
import { getJSON } from "@/lib/client";
import { formatMoney, relativeTime } from "@/lib/utils";

type Dashboard = {
  role: string;
  stats: {
    openJobs: number;
    awaitingApproval: number;
    inProgress: number;
    completed: number;
    totalCustomers: number;
    lowStockCount: number;
    billedThisMonth: number;
    collectedThisMonth: number;
    outstanding: number;
  };
  lowStock: { _id: string; name: string; sku: string; quantity: number; reorderLevel: number }[];
  recentJobs: {
    _id: string;
    ticket: string;
    status: string;
    device: { brand: string; type: string };
    customer: { name: string } | null;
    technician: { name: string } | null;
    createdAt: string;
  }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getJSON<Dashboard>("/api/dashboard")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;

  const isAdmin = data.role === "admin";
  const { stats } = data;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={isAdmin ? "Workshop overview" : "Your assigned workload"}
        action={
          <Link href="/repairs/new">
            <Button>
              <Plus className="h-4 w-4" />
              New repair intake
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open repair jobs"
          value={stats.openJobs}
          hint={`${stats.inProgress} in progress`}
          icon={<Wrench className="h-5 w-5" />}
        />
        <StatCard
          label="Awaiting approval"
          value={stats.awaitingApproval}
          hint="Quotes sent to customers"
          tone="amber"
          icon={<Clock className="h-5 w-5" />}
        />
        {isAdmin ? (
          <StatCard
            label="Customers"
            value={stats.totalCustomers}
            hint="Registered on the system"
            tone="emerald"
            icon={<Users className="h-5 w-5" />}
          />
        ) : (
          <StatCard
            label="Ready for pickup"
            value={stats.completed}
            hint="Completed, not yet delivered"
            tone="emerald"
            icon={<Users className="h-5 w-5" />}
          />
        )}
        <StatCard
          label={isAdmin ? "Low stock parts" : "Completed"}
          value={isAdmin ? stats.lowStockCount : stats.completed}
          hint={isAdmin ? "At or below reorder level" : "Awaiting delivery"}
          tone={isAdmin && stats.lowStockCount > 0 ? "rose" : "brand"}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      {isAdmin && (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Billed this month"
            value={formatMoney(stats.billedThisMonth)}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard label="Collected this month" value={formatMoney(stats.collectedThisMonth)} tone="emerald" />
          <StatCard label="Outstanding balance" value={formatMoney(stats.outstanding)} tone="amber" />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent repair jobs"
            action={
              <Link href="/repairs" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                View all
              </Link>
            }
          />
          {data.recentJobs.length === 0 ? (
            <EmptyState
              title="No repair jobs yet"
              description="Log a device at intake to create the first work order."
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
                  <Th>Device</Th>
                  <Th>Status</Th>
                  <Th>Logged</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentJobs.map((job) => (
                  <tr key={job._id} className="hover:bg-slate-50">
                    <Td>
                      <Link href={`/repairs/${job._id}`} className="font-medium text-brand-600 hover:text-brand-700">
                        {job.ticket}
                      </Link>
                    </Td>
                    <Td>{job.customer?.name ?? "-"}</Td>
                    <Td className="text-slate-600">
                      {job.device.brand} {job.device.type}
                    </Td>
                    <Td>
                      <StatusBadge status={job.status} />
                    </Td>
                    <Td className="whitespace-nowrap text-slate-500">{relativeTime(job.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader
              title="Low stock alerts"
              subtitle="Reorder before repairs stall"
              action={
                <Link href="/inventory" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                  Inventory
                </Link>
              }
            />
            {data.lowStock.length === 0 ? (
              <EmptyState title="Stock levels are healthy" description="No part is at its reorder level." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.lowStock.map((part) => (
                  <li key={part._id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{part.name}</p>
                      <p className="text-xs text-slate-500">{part.sku}</p>
                    </div>
                    <Badge tone={part.quantity === 0 ? "red" : "amber"}>
                      {part.quantity} left / min {part.reorderLevel}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
