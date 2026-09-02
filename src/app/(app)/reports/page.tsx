"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Clock, Package, Wrench, Wallet } from "lucide-react";
import {
  Alert, Card, CardHeader, EmptyState, PageHeader, Select, Spinner, StatCard, Table, Td, Th,
} from "@/components/ui";
import { AXIS_PROPS, ChartFrame, ChartLegend, ChartTooltip, VIZ, monthLabel } from "@/components/ChartKit";
import { getJSON } from "@/lib/client";
import { formatMoney, STATUS_LABELS } from "@/lib/utils";

type Report = {
  periodDays: number;
  monthlyRepairs: { _id: string; jobs: number }[];
  revenueByMonth: { _id: string; billed: number; collected: number; invoices: number }[];
  technicianPerformance: { name: string; specialization: string; assigned: number; completed: number; avgHours: number }[];
  deviceMix: { _id: string; count: number }[];
  statusMix: { _id: string; count: number }[];
  topParts: { _id: string; quantity: number; value: number }[];
  averageTurnaroundHours: number;
  completedInPeriod: number;
  inventory: { costValue: number; retailValue: number; items: number; units: number };
};

export default function ReportsPage() {
  const [days, setDays] = useState("90");
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setData(null);
    try {
      setData(await getJSON<Report>(`/api/reports?days=${days}`));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reports.");
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner label="Building reports" />;

  const volume = data.monthlyRepairs.map((m) => ({ month: monthLabel(m._id), jobs: m.jobs }));
  const revenue = data.revenueByMonth.map((m) => ({
    month: monthLabel(m._id),
    Billed: Math.round(m.billed),
    Collected: Math.round(m.collected),
  }));
  const devices = data.deviceMix.map((d) => ({ type: d._id || "Unspecified", count: d.count }));
  const technicians = data.technicianPerformance;

  const collectionRate = (() => {
    const billed = data.revenueByMonth.reduce((s, m) => s + m.billed, 0);
    const collected = data.revenueByMonth.reduce((s, m) => s + m.collected, 0);
    return billed > 0 ? Math.round((collected / billed) * 100) : 0;
  })();

  return (
    <>
      <PageHeader
        title="Reports &amp; analytics"
        subtitle="Repair trends, technician performance and financial summary"
        action={
          <Select value={days} onChange={(e) => setDays(e.target.value)} className="w-44">
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 6 months</option>
            <option value="365">Last 12 months</option>
          </Select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Average turnaround"
          value={data.averageTurnaroundHours < 48 ? `${data.averageTurnaroundHours} hrs` : `${Math.round(data.averageTurnaroundHours / 24)} days`}
          hint="Intake to completion"
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard label="Repairs completed" value={data.completedInPeriod} hint="Within the selected period" tone="emerald" icon={<Wrench className="h-5 w-5" />} />
        <StatCard label="Collection rate" value={`${collectionRate}%`} hint="Collected against billed" tone="amber" icon={<Wallet className="h-5 w-5" />} />
        <StatCard label="Inventory value" value={formatMoney(data.inventory.costValue)} hint={`${data.inventory.units} units · ${data.inventory.items} lines`} icon={<Package className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartFrame title="Repair volume by month" subtitle="Jobs logged at intake">
          {volume.length === 0 ? (
            <EmptyState title="No repair data in this period" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={volume} margin={{ top: 16, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke={VIZ.grid} vertical={false} />
                <XAxis dataKey="month" {...AXIS_PROPS} />
                <YAxis allowDecimals={false} {...AXIS_PROPS} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} content={<ChartTooltip />} />
                <Bar dataKey="jobs" name="Repair jobs" fill={VIZ.series1} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                  <LabelList dataKey="jobs" position="top" fill={VIZ.inkMuted} fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>

        <ChartFrame
          title="Billed against collected"
          subtitle="Invoice value raised versus cash received"
          legend={<ChartLegend items={[{ label: "Billed", color: VIZ.series1 }, { label: "Collected", color: VIZ.series2 }]} />}
        >
          {revenue.length === 0 ? (
            <EmptyState title="No invoices in this period" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenue} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barGap={2}>
                <CartesianGrid stroke={VIZ.grid} vertical={false} />
                <XAxis dataKey="month" {...AXIS_PROPS} />
                <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} content={<ChartTooltip money />} />
                <Bar dataKey="Billed" fill={VIZ.series1} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                <Bar dataKey="Collected" fill={VIZ.series2} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>

        <ChartFrame title="Devices received" subtitle="Which equipment the workshop sees most">
          {devices.length === 0 ? (
            <EmptyState title="No devices logged in this period" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, devices.length * 38)}>
              <BarChart data={devices} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 8 }}>
                <CartesianGrid stroke={VIZ.grid} horizontal={false} />
                <XAxis type="number" allowDecimals={false} {...AXIS_PROPS} />
                <YAxis type="category" dataKey="type" width={92} {...AXIS_PROPS} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} content={<ChartTooltip />} />
                <Bar dataKey="count" name="Devices" fill={VIZ.series1} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
                  <LabelList dataKey="count" position="right" fill={VIZ.inkMuted} fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>

        <ChartFrame title="Jobs by status" subtitle="Where the current workload sits">
          {data.statusMix.length === 0 ? (
            <EmptyState title="No repair jobs yet" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, data.statusMix.length * 38)}>
              <BarChart
                data={data.statusMix.map((s) => ({ status: STATUS_LABELS[s._id] ?? s._id, count: s.count, key: s._id }))}
                layout="vertical"
                margin={{ top: 0, right: 32, bottom: 0, left: 8 }}
              >
                <CartesianGrid stroke={VIZ.grid} horizontal={false} />
                <XAxis type="number" allowDecimals={false} {...AXIS_PROPS} />
                <YAxis type="category" dataKey="status" width={120} {...AXIS_PROPS} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} content={<ChartTooltip />} />
                <Bar dataKey="count" name="Jobs" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
                  {data.statusMix.map((s) => (
                    // Closed states are recessive so the live workload reads first.
                    <Cell key={s._id} fill={["delivered", "cancelled"].includes(s._id) ? "#cbd5e1" : VIZ.series1} />
                  ))}
                  <LabelList dataKey="count" position="right" fill={VIZ.inkMuted} fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Technician performance" subtitle="Jobs handled and average turnaround" />
          {technicians.length === 0 ? (
            <EmptyState title="No assigned jobs in this period" />
          ) : (
            <Table>
              <thead>
                <tr><Th>Technician</Th><Th>Assigned</Th><Th>Completed</Th><Th>Completion</Th><Th className="whitespace-nowrap">Avg hrs</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {technicians.map((t) => {
                  const rate = t.assigned ? Math.round((t.completed / t.assigned) * 100) : 0;
                  return (
                    <tr key={t.name}>
                      <Td>
                        <p className="whitespace-nowrap font-medium text-slate-900">{t.name}</p>
                        {t.specialization && <p className="text-xs text-slate-500">{t.specialization}</p>}
                      </Td>
                      <Td>{t.assigned}</Td>
                      <Td>{t.completed}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full" style={{ width: `${rate}%`, background: VIZ.series1 }} />
                          </div>
                          <span className="text-xs text-slate-600">{rate}%</span>
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap text-slate-600">{t.avgHours || "-"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Fastest-moving spare parts" subtitle="By quantity consumed on repairs" />
          {data.topParts.length === 0 ? (
            <EmptyState title="No parts consumed in this period" />
          ) : (
            <Table>
              <thead>
                <tr><Th>Part</Th><Th>Units used</Th><Th className="text-right">Value</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.topParts.map((p) => (
                  <tr key={p._id}>
                    <Td className="font-medium text-slate-900">{p._id}</Td>
                    <Td>{p.quantity}</Td>
                    <Td className="text-right">{formatMoney(p.value)}</Td>
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
