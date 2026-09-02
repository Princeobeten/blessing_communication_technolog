import { z } from "zod";
import connectDB from "@/lib/db";
import User, { ROLES } from "@/models/User";
import RepairJob from "@/models/RepairJob";
import { requireSession, requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";

const createSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(ROLES).default("technician"),
  phone: z.string().optional(),
  specialization: z.string().optional(),
});

/** Staff directory with each technician's current open workload. */
export async function GET() {
  try {
    await requireSession();
    await connectDB();

    const users = await User.find().sort({ name: 1 }).lean();
    const load = await RepairJob.aggregate([
      { $match: { status: { $nin: ["delivered", "cancelled"] }, technician: { $ne: null } } },
      { $group: { _id: "$technician", open: { $sum: 1 } } },
    ]);
    const loadMap = new Map(load.map((l) => [String(l._id), l.open]));

    return ok({
      technicians: users.map((u) => ({ ...u, openJobs: loadMap.get(String(u._id)) ?? 0 })),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    await connectDB();
    const { password, ...data } = createSchema.parse(await req.json());

    const user = await User.create({ ...data, passwordHash: await hashPassword(password) });
    const { passwordHash: _ignored, ...safe } = user.toObject();
    return ok({ technician: safe }, 201);
  } catch (err) {
    return handleError(err);
  }
}
