import Notification from "@/models/Notification";
import type { JobStatus } from "@/models/RepairJob";

// ---------------------------------------------------------------------------
// Delivery driver abstraction
// ---------------------------------------------------------------------------

export type DeliveryDriver = (message: {
  channel: string;
  to: string;
  subject: string;
  body: string;       // plain-text fallback
  html?: string;      // rich HTML email (optional)
}) => Promise<void>;

/**
 * Falls back to console logging when Resend is not configured.
 * Useful in development or when RESEND_API_KEY is absent.
 */
const consoleDriver: DeliveryDriver = async ({ channel, to, subject, body }) => {
  console.log(`[notify:${channel}] -> ${to || "(no address)"} | ${subject}\n${body}`);
};

/**
 * Resend delivery driver.
 * Instantiated lazily so the Resend SDK is only imported server-side and only
 * when the env var is present, keeping the browser bundle clean.
 */
const buildResendDriver = (): DeliveryDriver => {
  const apiKey = process.env.RESEND_API_KEY!;
  const from =
    process.env.RESEND_FROM_EMAIL ?? "CRMS Notifications <noreply@blessingict.com>";

  return async ({ to, subject, body, html }) => {
    // Lazy import — Resend is a server-only package
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      from,
      to,
      subject,
      text: body,
      ...(html ? { html } : {}),
    });

    if (error) throw new Error(error.message);
  };
};

/** Active driver — Resend when configured, console otherwise. */
const driver: DeliveryDriver =
  process.env.RESEND_API_KEY ? buildResendDriver() : consoleDriver;

// ---------------------------------------------------------------------------
// HTML email templates
// ---------------------------------------------------------------------------

/** Wraps content in a clean, branded email shell. */
function emailLayout(preheader: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blessing Communication Technology</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <!-- preheader text (hidden, shows in inbox preview) -->
  <span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1d4ed8;border-radius:8px 8px 0 0;padding:24px 32px;">
              <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">
                Blessing Communication Technology
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#6b7280;font-size:12px;">
                This is an automated message from Blessing Communication Technology.<br/>
                If you did not expect this email, please ignore it.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** A single info row inside a details table. */
function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 12px;font-size:13px;color:#6b7280;white-space:nowrap;vertical-align:top;">${label}</td>
    <td style="padding:8px 12px;font-size:13px;color:#111827;font-weight:500;">${value}</td>
  </tr>`;
}

/** A coloured status pill. */
function statusPill(label: string): string {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:9999px;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:600;letter-spacing:0.3px;">${label}</span>`;
}

// ---------------------------------------------------------------------------
// Per-event HTML builders
// ---------------------------------------------------------------------------

/**
 * Status-change email shown to the customer at each repair stage.
 */
function buildStatusChangeHtml(
  customerName: string,
  ticket: string,
  statusLabel: string,
  bodyText: string,
  note?: string
): string {
  const noteSection = note
    ? `<div style="margin:20px 0;padding:12px 16px;background:#fefce8;border-left:3px solid #eab308;border-radius:4px;">
        <p style="margin:0;font-size:13px;color:#713f12;"><strong>Technician note:</strong> ${note}</p>
       </div>`
    : "";

  return emailLayout(bodyText, `
    <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#111827;">Hello ${customerName},</p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Here is an update on your repair.</p>

    <div style="margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Status</p>
      ${statusPill(statusLabel)}
    </div>

    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">${bodyText}</p>

    ${noteSection}

    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:28px;">
      <tbody>
        ${infoRow("Tracking number", ticket)}
      </tbody>
    </table>

    <div style="text-align:center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/track"
         style="display:inline-block;padding:12px 28px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
        Track Your Repair
      </a>
    </div>
  `);
}

/**
 * Invoice-issued email.
 */
function buildInvoiceHtml(
  customerName: string,
  ticket: string,
  invoiceNumber: string,
  total: string
): string {
  const preheader = `Invoice ${invoiceNumber} for ${total} is ready.`;
  return emailLayout(preheader, `
    <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#111827;">Hello ${customerName},</p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Your repair is complete and an invoice has been issued.</p>

    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:28px;">
      <tbody>
        ${infoRow("Invoice number", invoiceNumber)}
        ${infoRow("Job ticket", ticket)}
        ${infoRow("Total due", `<strong style="font-size:15px;color:#111827;">${total}</strong>`)}
        ${infoRow("Payment", "Payable on collection")}
      </tbody>
    </table>

    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
      Please bring this reference when collecting your device. Payment can be made by cash, transfer, or POS.
    </p>

    <div style="text-align:center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/track"
         style="display:inline-block;padding:12px 28px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
        View Repair Status
      </a>
    </div>
  `);
}

/**
 * Payment-received email (partial or full).
 */
function buildPaymentHtml(
  customerName: string,
  invoiceNumber: string,
  amountPaid: string,
  balance: string,
  isFullyPaid: boolean
): string {
  const preheader = isFullyPaid
    ? `Payment confirmed — invoice ${invoiceNumber} is fully settled.`
    : `Payment of ${amountPaid} received — ${balance} outstanding on ${invoiceNumber}.`;

  const balanceSection = isFullyPaid
    ? `<div style="margin-bottom:24px;padding:14px 16px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:4px;">
        <p style="margin:0;font-size:14px;color:#15803d;font-weight:600;">✓ Invoice fully settled — thank you!</p>
       </div>`
    : `<p style="margin:0 0 24px;font-size:14px;color:#374151;">Outstanding balance: <strong>${balance}</strong></p>`;

  return emailLayout(preheader, `
    <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#111827;">Hello ${customerName},</p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">We have received your payment. Here are the details.</p>

    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:24px;">
      <tbody>
        ${infoRow("Invoice", invoiceNumber)}
        ${infoRow("Amount received", `<strong style="color:#111827;">${amountPaid}</strong>`)}
        ${infoRow("Status", isFullyPaid ? statusPill("Paid") : statusPill("Partial"))}
      </tbody>
    </table>

    ${balanceSection}
  `);
}

// ---------------------------------------------------------------------------
// Status label map (human-readable for the email)
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<JobStatus, string> = {
  pending: "Received",
  diagnosing: "Diagnosing",
  awaiting_approval: "Awaiting Your Approval",
  in_progress: "Repair In Progress",
  awaiting_parts: "Awaiting Parts",
  completed: "Repair Complete",
  delivered: "Device Collected",
  cancelled: "Cancelled",
};

/** Customer-facing body text for each repair stage. */
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

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

type NotifyInput = {
  event: string;
  customer: { _id?: unknown; name?: string; email?: string; phone?: string } | null;
  job?: { _id?: unknown; ticket?: string } | null;
  subject: string;
  message: string;          // plain-text body
  html?: string;            // optional HTML override
  channel?: "email" | "sms" | "in-app";
};

/**
 * Persists the notification record, then attempts delivery.
 * A delivery failure is stored on the document but never propagates — it
 * never breaks the request that triggered it.
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
    await driver({ channel, to, subject: input.subject, body: input.message, html: input.html });
    record.status = "sent";
    record.sentAt = new Date();
  } catch (err) {
    record.status = "failed";
    record.error = err instanceof Error ? err.message : String(err);
    console.error("[notify] delivery failed:", record.error);
  }
  await record.save();
  return record;
}

// ---------------------------------------------------------------------------
// Convenience helpers called by API routes
// ---------------------------------------------------------------------------

/** Sent whenever a repair job moves to a new status. */
export async function notifyStatusChange(
  job: { _id?: unknown; ticket?: string },
  customer: { _id?: unknown; name?: string; email?: string; phone?: string } | null,
  status: JobStatus,
  note?: string
) {
  const template = STATUS_MESSAGES[status];
  const name = customer?.name ?? "customer";
  const ticket = job.ticket ?? "";

  // Plain-text fallback
  const lines = [
    `Hello ${name},`,
    "",
    template.body,
    note ? `\nTechnician note: ${note}` : "",
    "",
    `Tracking number: ${ticket}`,
    "Track your repair any time at /track using the number above.",
  ].filter(Boolean);

  const html = buildStatusChangeHtml(name, ticket, STATUS_LABELS[status], template.body, note);

  return sendNotification({
    event: "job.status_changed",
    customer,
    job,
    subject: `[${ticket}] ${template.subject}`,
    message: lines.join("\n"),
    html,
  });
}

/** Sent when an invoice is generated for a completed repair. */
export async function notifyInvoiceIssued(
  job: { _id?: unknown; ticket?: string },
  customer: { _id?: unknown; name?: string; email?: string; phone?: string } | null,
  invoiceNumber: string,
  total: string
) {
  const name = customer?.name ?? "customer";
  const ticket = job.ticket ?? "";

  const message = [
    `Hello ${name},`,
    "",
    `Your repair is complete. Invoice ${invoiceNumber} totalling ${total} has been issued and is payable on collection.`,
    "",
    `Tracking number: ${ticket}`,
  ].join("\n");

  const html = buildInvoiceHtml(name, ticket, invoiceNumber, total);

  return sendNotification({
    event: "invoice.issued",
    customer,
    job,
    subject: `[${ticket}] Invoice ${invoiceNumber} - ${total}`,
    message,
    html,
  });
}

/** Sent when a payment (partial or full) is recorded against an invoice. */
export async function notifyPaymentReceived(
  job: { _id?: unknown; ticket?: string },
  customer: { _id?: unknown; name?: string; email?: string; phone?: string } | null,
  invoiceNumber: string,
  amountPaid: string,
  balance: string,
  isFullyPaid: boolean
) {
  const name = customer?.name ?? "customer";

  const message = [
    `We have received ${amountPaid} towards invoice ${invoiceNumber}.`,
    isFullyPaid
      ? "The invoice is now fully settled. Thank you."
      : `Outstanding balance: ${balance}.`,
  ].join(" ");

  const html = buildPaymentHtml(name, invoiceNumber, amountPaid, balance, isFullyPaid);

  return sendNotification({
    event: "payment.received",
    customer,
    job,
    subject: `[${invoiceNumber}] Payment received - ${amountPaid}`,
    message,
    html,
  });
}
