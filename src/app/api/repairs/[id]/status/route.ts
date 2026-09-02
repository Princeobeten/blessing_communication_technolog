import { z } from "zod";
import connectDB from "@/lib/db";
import RepairJob from "@/models/RepairJob";
import { JOB_STATUSES, ALLOWED_TRANSITIONS, type JobStatus } from "@/lib/constants";
import Customer from "@/models/Customer";
import { requireSession, HttpError } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { notifyStatusChange } from "@/lib/notify";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  status: z.enum(JOB_STATUSES),
  note: z.string().optional(),
});

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    await connectDB();
    const { id } = await params;
    const { status, note } = schema.parse(await req.json());

    const job = await RepairJob.findById(id);
    if (!job) throw new HttpError(404, "Repair job not found.");

    if (session.role === "technician" && String(job.technician ?? "") !== session.sub) {
      throw new HttpError(403, "This job is assigned to another technician.");
    }

    const current = job.status as JobStatus;
    if (current === status) throw new HttpError(400, `The job is already ${status.replace("_", " ")}.`);
    if (!ALLOWED_TRANSITIONS[current].includes(status)) {
      throw new HttpError(400, `A job cannot move from "${current}" to "${status}".`);
    }
    if (status === "in_progress" && current === "awaiting_approval" && !job.estimate?.approved) {
      throw new HttpError(400, "The customer must approve the quote before work can begin.");
    }

    job.status = status;
    if (status === "completed") job.completedAt = new Date();
    if (status === "delivered") job.deliveredAt = new Date();
    job.timeline.push({
      status,
      note: note ?? "",
      by: session.sub as never,
      byName: session.name,
      at: new Date(),
    });
    await job.save();

    // Objective 3: the customer is told automatically on every stage change.
    const customer = await Customer.findById(job.customer).lean();
    await notifyStatusChange(job, customer, status, note);

    return ok({ job });
  } catch (err) {
    return handleError(err);
  }
}
