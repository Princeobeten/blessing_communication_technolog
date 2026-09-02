import { z } from "zod";
import connectDB from "@/lib/db";
import RepairJob from "@/models/RepairJob";
import Part from "@/models/Part";
import StockMovement from "@/models/StockMovement";
import { requireSession, HttpError } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

const addSchema = z.object({
  partId: z.string().min(1, "Select a spare part"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

const removeSchema = z.object({ partId: z.string().min(1) });

async function loadJobForUser(id: string, session: { sub: string; role: string }) {
  const job = await RepairJob.findById(id);
  if (!job) throw new HttpError(404, "Repair job not found.");
  if (session.role === "technician" && String(job.technician ?? "") !== session.sub) {
    throw new HttpError(403, "This job is assigned to another technician.");
  }
  if (job.status === "delivered" || job.status === "cancelled") {
    throw new HttpError(400, "This job is closed; parts can no longer be changed.");
  }
  return job;
}

/** Consume a spare part on a repair job and draw it down from stock. */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    await connectDB();
    const { id } = await params;
    const { partId, quantity } = addSchema.parse(await req.json());

    const job = await loadJobForUser(id, session);

    // Conditional update: the decrement only applies if enough stock is still on
    // hand, so two technicians claiming the last part cannot both succeed.
    const part = await Part.findOneAndUpdate(
      { _id: partId, quantity: { $gte: quantity } },
      { $inc: { quantity: -quantity } },
      { new: true }
    );
    if (!part) {
      const exists = await Part.findById(partId).lean();
      throw new HttpError(
        exists ? 409 : 404,
        exists ? `Only ${exists.quantity} of "${exists.name}" left in stock.` : "Spare part not found."
      );
    }

    const existingLine = job.partsUsed.find((p) => String(p.part) === String(part._id));
    if (existingLine) {
      existingLine.quantity += quantity;
    } else {
      job.partsUsed.push({
        part: part._id as never,
        name: part.name,
        quantity,
        unitPrice: part.sellingPrice,
        addedAt: new Date(),
      });
    }
    await job.save();

    await StockMovement.create({
      part: part._id,
      partName: part.name,
      type: "out",
      quantity,
      balanceAfter: part.quantity,
      reason: `Used on repair ${job.ticket}`,
      job: job._id,
      by: session.sub,
      byName: session.name,
    });

    return ok({ job, part, lowStock: part.quantity <= part.reorderLevel });
  } catch (err) {
    return handleError(err);
  }
}

/** Remove a part line from the job and return the units to stock. */
export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    await connectDB();
    const { id } = await params;
    const { partId } = removeSchema.parse(await req.json());

    const job = await loadJobForUser(id, session);

    const line = job.partsUsed.find((p) => String(p.part) === partId);
    if (!line) throw new HttpError(404, "That part is not on this job.");

    const returned = line.quantity;
    job.partsUsed = job.partsUsed.filter((p) => String(p.part) !== partId) as never;
    await job.save();

    const part = await Part.findByIdAndUpdate(partId, { $inc: { quantity: returned } }, { new: true });
    if (part) {
      await StockMovement.create({
        part: part._id,
        partName: part.name,
        type: "in",
        quantity: returned,
        balanceAfter: part.quantity,
        reason: `Returned from repair ${job.ticket}`,
        job: job._id,
        by: session.sub,
        byName: session.name,
      });
    }

    return ok({ job });
  } catch (err) {
    return handleError(err);
  }
}
