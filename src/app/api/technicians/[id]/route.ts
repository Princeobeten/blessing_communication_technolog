import { z } from "zod";
import connectDB from "@/lib/db";
import User, { ROLES } from "@/models/User";
import RepairJob from "@/models/RepairJob";
import { requireAdmin, hashPassword, HttpError } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  specialization: z.string().optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    await connectDB();
    const { id } = await params;
    const { password, ...fields } = updateSchema.parse(await req.json());

    // Guard against an administrator locking themselves out of the system.
    if (id === session.sub && (fields.active === false || fields.role === "technician")) {
      throw new HttpError(400, "You cannot remove your own administrator access.");
    }

    const update: Record<string, unknown> = { ...fields };
    if (password) update.passwordHash = await hashPassword(password);

    const user = await User.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
    if (!user) throw new HttpError(404, "Staff account not found.");
    return ok({ technician: user });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    await connectDB();
    const { id } = await params;

    if (id === session.sub) throw new HttpError(400, "You cannot delete your own account.");

    const open = await RepairJob.countDocuments({ technician: id, status: { $nin: ["delivered", "cancelled"] } });
    if (open > 0) throw new HttpError(409, `Reassign this technician's ${open} open job(s) first.`);

    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) throw new HttpError(404, "Staff account not found.");
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
