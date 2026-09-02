export { STATUS_LABELS } from "./constants";

import { twMerge } from "tailwind-merge";

/** Joins class names, letting a later class win over an earlier conflicting one. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return twMerge(classes.filter(Boolean).join(" "));
}

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});

export function formatMoney(value: number | undefined | null) {
  return naira.format(Number(value ?? 0));
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export const STATUS_TONES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700 ring-slate-200",
  diagnosing: "bg-violet-100 text-violet-700 ring-violet-200",
  awaiting_approval: "bg-amber-100 text-amber-800 ring-amber-200",
  in_progress: "bg-blue-100 text-blue-700 ring-blue-200",
  awaiting_parts: "bg-orange-100 text-orange-800 ring-orange-200",
  completed: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  delivered: "bg-teal-100 text-teal-700 ring-teal-200",
  cancelled: "bg-rose-100 text-rose-700 ring-rose-200",
};

export const JOBS_PLACEHOLDER =
  "Repair jobs appear here once a device has been logged at intake.";
