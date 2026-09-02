"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, MessageSquare, Bell } from "lucide-react";
import { Alert, Badge, Card, EmptyState, PageHeader, Select, Spinner } from "@/components/ui";
import { getJSON } from "@/lib/client";
import { formatDateTime } from "@/lib/utils";

type Notification = {
  _id: string; event: string; channel: string; to: string; recipientName: string; ticket: string;
  subject: string; message: string; status: string; sentAt: string | null; createdAt: string; error: string;
};

const ICONS: Record<string, React.ElementType> = { email: Mail, sms: MessageSquare, "in-app": Bell };
const TONES: Record<string, string> = { sent: "green", queued: "amber", failed: "red" };

/**
 * Notification log - the audit trail behind Objective 3 (improved communication).
 * Each entry is a message the system generated for a customer automatically.
 */
export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await getJSON<{ notifications: Notification[] }>(`/api/notifications?status=${status}`)).notifications);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader
        title="Notification log"
        subtitle="Every automatic update sent to a customer"
        action={
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
            <option value="all">All</option>
            <option value="sent">Sent</option>
            <option value="queued">Queued</option>
            <option value="failed">Failed</option>
          </Select>
        }
      />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <Card>
        {loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState title="No notifications yet" description="Messages are generated when a repair changes status." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => {
              const Icon = ICONS[n.channel] ?? Bell;
              return (
                <li key={n._id} className="flex gap-4 p-5">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">{n.subject}</p>
                      <Badge tone={TONES[n.status]}>{n.status}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {n.channel} to {n.recipientName || "customer"} {n.to && `(${n.to})`} · {formatDateTime(n.sentAt ?? n.createdAt)}
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{n.message}</p>
                    {n.error && <p className="mt-2 text-sm text-rose-600">Delivery error: {n.error}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
