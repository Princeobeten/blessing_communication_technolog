import { z } from "zod";
import connectDB from "@/lib/db";
import RepairJob, { PRIORITIES } from "@/models/RepairJob";
import Invoice from "@/models/Invoice";
import { requireSession, requireAdmin, HttpError } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  diagnosis: z.string().optional(),
  workDone: z.string().optional(),
  priority: z.enum(PRIORITIES).optional(),
  technician: z.string().nullable().optional(),
  labourCost: z.number().min(0).optional(),
  expectedCompletionAt: z.string().datetime().nullable().or(z.literal("")).optional(),
  reportedIssue: z.string().min(5).optional(),
});

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    await connectDB();
    const { id } = await params;

    const job = await RepairJob.findById(id)
      .populate("customer")
      .populate("technician", "name email specialization")
      .lean();
    if (!job) throw new HttpError(404, "Repair job not found.");

    if (session.role === "technician" && String(job.technician?._id ?? job.technician ?? "") !== session.sub) {
      throw new HttpError(403, "This job is assigned to another technician.");
    }

    const invoice = await Invoice.findOne({ job: id }).lean();

    return ok({
      job: {
        ...job,
        partsTotal: (job.partsUsed ?? []).reduce((sum, p) => sum + p.quantity * p.unitPrice, 0),
      },
      invoice,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    await connectDB();
    const { id } = await params;
    const data = updateSchema.parse(await req.json());

    const job = await RepairJob.findById(id);
    if (!job) throw new HttpError(404, "Repair job not found.");

    if (session.role === "technician") {
      if (String(job.technician ?? "") !== session.sub) {
        throw new HttpError(403, "This job is assigned to another technician.");
      }
      // Reassignment is an administrator action.
      if (data.technician !== undefined) throw new HttpError(403, "Only an administrator can reassign a job.");
    }

    if (data.diagnosis !== undefined) job.diagnosis = data.diagnosis;
    if (data.workDone !== undefined) job.workDone = data.workDone;
    if (data.priority !== undefined) job.priority = data.priority;
    if (data.labourCost !== undefined) job.labourCost = data.labourCost;
    if (data.reportedIssue !== undefined) job.reportedIssue = data.reportedIssue;
    if (data.technician !== undefined) job.technician = data.technician as never;
    if (data.expectedCompletionAt !== undefined) {
      job.expectedCompletionAt = data.expectedCompletionAt ? new Date(data.expectedCompletionAt) : null;
    }

    await job.save();
    return ok({ job });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireAdmin();
    await connectDB();
    const { id } = await params;

    if (await Invoice.exists({ job: id })) {
      throw new HttpError(409, "This job has an invoice and cannot be deleted.");
    }
    const deleted = await RepairJob.findByIdAndDelete(id);
    if (!deleted) throw new HttpError(404, "Repair job not found.");
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
