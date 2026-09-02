import Notification from "@/models/Notification";
import type { JobStatus } from "@/models/RepairJob";

/**
 * Delivery driver abstraction.
 *
 * The prototype uses `consoleDriver`, which records the message and logs it to
 * the server console. Swapping in a real SMTP/SMS provider means implementing
 * this one function - nothing else in the system changes.
 */
export type DeliveryDriver = (message: {
  channel: string;
  to: string;
  subject: string;
  body: string;
}) => Promise<void>;

const consoleDriver: DeliveryDriver = async ({ channel, to, subject, body }) => {
  console.log(`[notify:${channel}] -> ${to || "(no address)"} | ${subject}\n${body}`);
};

const driver: DeliveryDriver = consoleDriver;

/** Customer-facing wording for each stage of the repair. */
const STATUS_MESSAGES: Record<JobStatus, { subject: string; body: string }> = {
  pending: {
    subject: "We have received your device",
    body: "Your device has been logged at our workshop and is queued for diagnosis.",
  },
  diagnosing: {
    subject: "Diagnosis in progress",
    body: "A technician is currently inspecting your device to identify the fault.",
  },
  awaiting_approval: {
    subject: "Repair quote ready for your approval",
    body: "We have completed the diagnosis and prepared a repair quote. Please approve it so work can begin.",
  },
  in_progress: {
    subject: "Repair has started",
    body: "Your quote was approved and the repair is now underway.",
  },
  awaiting_parts: {
    subject: "Waiting on a spare part",
    body: "Your repair is paused while we source a required spare part. We will resume as soon as it arrives.",
  },
  completed: {
    subject: "Your device is ready for pickup",
    body: "The repair is complete. Your device is ready for collection at our workshop.",
  },
  delivered: {
    subject: "Device collected - thank you",
    body: "Your device has been handed back. Thank you for choosing us.",
  },
  cancelled: {
    subject: "Repair job cancelled",
    body: "This repair job has been cancelled. Please contact us if this is unexpected.",
  },
};

type NotifyInput = {
  event: string;
  customer: { _id?: unknown; name?: string; email?: string; phone?: string } | null;
  job?: { _id?: unknown; ticket?: string } | null;
  subject: string;
  message: string;
  channel?: "email" | "sms" | "in-app";
};

/**
 * Persists the notification, then attempts delivery. A delivery failure is
 * recorded on the document and never breaks the request that triggered it.
 */
export async function sendNotification(input: NotifyInput) {
  const channel = input.channel ?? (input.customer?.email ? "email" : "sms");
  const to = channel === "email" ? input.customer?.email ?? "" : input.customer?.phone ?? "";

  const record = await Notification.create({
    event: input.event,
    channel,
    to,
    recipientName: input.customer?.name ?? "",
    customer: input.customer?._id ?? null,
    job: input.job?._id ?? null,
    ticket: input.job?.ticket ?? "",
    subject: input.subject,
    message: input.message,
    status: "queued",
  });

  try {
    await driver({ channel, to, subject: input.subject, body: input.message });
    record.status = "sent";
    record.sentAt = new Date();
  } catch (err) {
    record.status = "failed";
    record.error = err instanceof Error ? err.message : String(err);
  }
  await record.save();
  return record;
}

/** Automated status update sent to the customer whenever a job moves stage. */
export async function notifyStatusChange(
  job: { _id?: unknown; ticket?: string },
  customer: { _id?: unknown; name?: string; email?: string; phone?: string } | null,
  status: JobStatus,
  note?: string
) {
  const template = STATUS_MESSAGES[status];
  const lines = [
    `Hello ${customer?.name ?? "customer"},`,
    "",
    template.body,
    note ? `\nTechnician note: ${note}` : "",
    "",
    `Tracking number: ${job.ticket ?? ""}`,
    "Track your repair any time at /track using the number above.",
  ].filter(Boolean);

  return sendNotification({
    event: "job.status_changed",
    customer,
    job,
    subject: `[${job.ticket}] ${template.subject}`,
    message: lines.join("\n"),
  });
}
