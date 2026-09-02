import connectDB from "@/lib/db";
import RepairJob from "@/models/RepairJob";
import Invoice from "@/models/Invoice";
import { ok, handleError } from "@/lib/http";
import { HttpError } from "@/lib/auth";

type Params = { params: Promise<{ ticket: string }> };

/**
 * PUBLIC endpoint - no session required.
 * Returns only what a customer needs to follow their repair; contact details,
 * internal notes, cost breakdown by part and staff names are deliberately omitted.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    await connectDB();
    const { ticket } = await params;

    const job = await RepairJob.findOne({ ticket: ticket.trim().toUpperCase() })
      .populate("customer", "name")
      .populate("technician", "name")
      .lean();

    if (!job) throw new HttpError(404, "No repair found with that tracking number.");

    const invoice = await Invoice.findOne({ job: job._id }).lean();

    return ok({
      job: {
        ticket: job.ticket,
        customerName: (job.customer as { name?: string } | null)?.name ?? "",
        device: {
          type: job.device?.type ?? "",
          brand: job.device?.brand ?? "",
          model: job.device?.model ?? "",
        },
        reportedIssue: job.reportedIssue,
        status: job.status,
        priority: job.priority,
        technicianName: (job.technician as { name?: string } | null)?.name ?? "Not yet assigned",
        receivedAt: job.receivedAt,
        expectedCompletionAt: job.expectedCompletionAt,
        completedAt: job.completedAt,
        deliveredAt: job.deliveredAt,
        estimate: job.estimate?.quotedAt
          ? { total: job.estimate.total, approved: job.estimate.approved, quotedAt: job.estimate.quotedAt }
          : null,
        timeline: (job.timeline ?? []).map((t) => ({ status: t.status, note: t.note, at: t.at })),
      },
      invoice: invoice
        ? {
            invoiceNumber: invoice.invoiceNumber,
            total: invoice.total,
            amountPaid: invoice.amountPaid,
            balance: Math.max(0, invoice.total - invoice.amountPaid),
            status: invoice.status,
          }
        : null,
    });
  } catch (err) {
    return handleError(err);
  }
}
