import { z } from "zod";
import connectDB from "@/lib/db";
import Customer from "@/models/Customer";
import RepairJob from "@/models/RepairJob";
import { requireSession } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";

const createSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(7, "Enter a valid phone number"),
  email: z.string().email("Enter a valid email address").or(z.literal("")).optional(),
  address: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    await requireSession();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const limit = Math.min(Number(searchParams.get("limit") ?? 100), 200);

    const filter = q
      ? {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { phone: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
          ],
        }
      : {};

    const customers = await Customer.find(filter).sort({ createdAt: -1 }).limit(limit).lean();

    // Attach a repair count so the list is useful at a glance.
    const counts = await RepairJob.aggregate([
      { $match: { customer: { $in: customers.map((c) => c._id) } } },
      { $group: { _id: "$customer", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

    return ok({
      customers: customers.map((c) => ({ ...c, jobCount: countMap.get(String(c._id)) ?? 0 })),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    await connectDB();
    const data = createSchema.parse(await req.json());
    const customer = await Customer.create({ ...data, createdBy: session.sub });
    return ok({ customer }, 201);
  } catch (err) {
    return handleError(err);
  }
}
