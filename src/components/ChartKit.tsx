"use client";

import type { ReactNode } from "react";
import { formatMoney } from "@/lib/utils";

/**
 * Chart tokens.
 * Slots 1-3 of the validated categorical palette (blue / orange / aqua). Assigned
 * in fixed order and never cycled; text always wears an ink token, never a series
 * colour, so identity never rests on colour alone.
 */
export const VIZ = {
  series1: "#2a78d6",
  series2: "#eb6834",
  series3: "#1baf7a",
  grid: "#e6e8ec",
  axis: "#94a3b8",
  ink: "#0f172a",
  inkMuted: "#64748b",
  surface: "#ffffff",
};

export const AXIS_PROPS = {
  tick: { fill: VIZ.inkMuted, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: VIZ.grid },
} as const;

/** Shared tooltip shell so every chart on the page reads the same way. */
export function ChartTooltip({
  active,
  payload,
  label,
  money,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  money?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-slate-200">
      <p className="mb-1 font-medium text-slate-900">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          {entry.name}:{" "}
          <span className="font-medium text-slate-900">
            {money ? formatMoney(entry.value) : entry.value.toLocaleString()}
          </span>
        </p>
      ))}
    </div>
  );
}

/** Legend rendered as text + swatch, so series identity is never colour-only. */
export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mb-4 flex flex-wrap gap-4">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function ChartFrame({
  title,
  subtitle,
  legend,
  children,
}: {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-4">{legend}</div>
      {children}
    </div>
  );
}

/** Short month label: "2026-03" -> "Mar 26". */
export function monthLabel(key: string) {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}
