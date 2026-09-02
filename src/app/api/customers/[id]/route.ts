import { z } from "zod";
import connectDB from "@/lib/db";
import Customer from "@/models/Customer";
import RepairJob from "@/models/RepairJob";
import { requireSession, requireAdmin, HttpError } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(7).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  address: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(_req: Request, { params }: Params) {
  try {
    await requireSession();
    await connectDB();
    const { id } = await params;

    const customer = await Customer.findById(id).lean();
    if (!customer) throw new HttpError(404, "Customer not found.");

    const jobs = await RepairJob.find({ customer: id })
      .sort({ createdAt: -1 })
      .populate("technician", "name")
      .lean();

    return ok({ customer, jobs });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    await requireSession();
    await connectDB();
    const { id } = await params;
    const data = updateSchema.parse(await req.json());

    const customer = await Customer.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!customer) throw new HttpError(404, "Customer not found.");
    return ok({ customer });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireAdmin();
    await connectDB();
    const { id } = await params;

    // Refuse to orphan repair history.
    const jobCount = await RepairJob.countDocuments({ customer: id });
    if (jobCount > 0) {
      throw new HttpError(409, `This customer has ${jobCount} repair job(s) and cannot be deleted.`);
    }

    const deleted = await Customer.findByIdAndDelete(id);
    if (!deleted) throw new HttpError(404, "Customer not found.");
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
