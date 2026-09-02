import { z } from "zod";
import connectDB from "@/lib/db";
import RepairJob from "@/models/RepairJob";
import Customer from "@/models/Customer";
import { requireSession, HttpError } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { sendNotification, notifyStatusChange } from "@/lib/notify";
import { formatMoney } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

const quoteSchema = z.object({
  labourCost: z.number().min(0),
  partsCost: z.number().min(0),
  notes: z.string().optional(),
});

const approveSchema = z.object({
  approvedBy: z.string().min(2, "Record who approved the quote"),
});

/** Diagnosis & Estimation: prepare a quote and send it to the customer. */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    await connectDB();
    const { id } = await params;
    const data = quoteSchema.parse(await req.json());

    const job = await RepairJob.findById(id);
    if (!job) throw new HttpError(404, "Repair job not found.");
    if (session.role === "technician" && String(job.technician ?? "") !== session.sub) {
      throw new HttpError(403, "This job is assigned to another technician.");
    }
    if (job.status === "delivered" || job.status === "cancelled") {
      throw new HttpError(400, "This job is closed and cannot be re-quoted.");
    }

    const total = data.labourCost + data.partsCost;
    job.estimate = {
      labourCost: data.labourCost,
      partsCost: data.partsCost,
      total,
      notes: data.notes ?? "",
      quotedAt: new Date(),
      approved: false,
      approvedAt: null,
      approvedBy: "",
    };
    job.labourCost = data.labourCost;

    if (job.status === "pending" || job.status === "diagnosing") {
      job.status = "awaiting_approval";
      job.timeline.push({
        status: "awaiting_approval",
        note: `Quote of ${formatMoney(total)} prepared.`,
        by: session.sub as never,
        byName: session.name,
        at: new Date(),
      });
    }
    await job.save();

    const customer = await Customer.findById(job.customer).lean();
    await notifyStatusChange(job, customer, "awaiting_approval", `Quoted total: ${formatMoney(total)}`);

    return ok({ job });
  } catch (err) {
    return handleError(err);
  }
}

/** Approve Quote: records the customer's go-ahead and unblocks the repair. */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    await connectDB();
    const { id } = await params;
    const { approvedBy } = approveSchema.parse(await req.json());

    const job = await RepairJob.findById(id);
    if (!job) throw new HttpError(404, "Repair job not found.");
    if (!job.estimate?.quotedAt) throw new HttpError(400, "Prepare a quote before approving it.");
    if (job.estimate.approved) throw new HttpError(400, "This quote has already been approved.");

    job.estimate.approved = true;
    job.estimate.approvedAt = new Date();
    job.estimate.approvedBy = approvedBy;

    if (job.status === "awaiting_approval") {
      job.status = "in_progress";
      job.timeline.push({
        status: "in_progress",
        note: `Quote approved by ${approvedBy}.`,
        by: session.sub as never,
        byName: session.name,
        at: new Date(),
      });
    }
    await job.save();

    const customer = await Customer.findById(job.customer).lean();
    await sendNotification({
      event: "quote.approved",
      customer,
      job,
      subject: `[${job.ticket}] Quote approved - repair starting`,
      message: `Thank you ${customer?.name ?? ""}. Your quote of ${formatMoney(
        job.estimate.total
      )} was approved and work on your device has started.`,
    });

    return ok({ job });
  } catch (err) {
    return handleError(err);
  }
}
