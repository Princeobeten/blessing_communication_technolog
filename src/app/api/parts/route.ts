import { z } from "zod";
import connectDB from "@/lib/db";
import Part from "@/models/Part";
import StockMovement from "@/models/StockMovement";
import { requireSession, requireAdmin } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";

const createSchema = z.object({
  sku: z.string().min(2, "SKU is required"),
  name: z.string().min(2, "Part name is required"),
  category: z.string().optional(),
  quantity: z.number().int().min(0).default(0),
  reorderLevel: z.number().int().min(0).default(5),
  unitCost: z.number().min(0).default(0),
  sellingPrice: z.number().min(0),
  supplier: z.string().optional(),
  location: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    await requireSession();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const lowOnly = searchParams.get("low") === "true";

    const filter: Record<string, unknown> = q
      ? { $or: [{ name: { $regex: q, $options: "i" } }, { sku: { $regex: q, $options: "i" } }] }
      : {};
    // Compare two fields against each other - needs $expr.
    if (lowOnly) filter.$expr = { $lte: ["$quantity", "$reorderLevel"] };

    const parts = await Part.find(filter).sort({ name: 1 }).lean();
    return ok({
      parts: parts.map((p) => ({ ...p, lowStock: p.quantity <= p.reorderLevel })),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    await connectDB();
    const data = createSchema.parse(await req.json());

    const part = await Part.create(data);
    if (part.quantity > 0) {
      await StockMovement.create({
        part: part._id,
        partName: part.name,
        type: "in",
        quantity: part.quantity,
        balanceAfter: part.quantity,
        reason: "Opening stock",
        by: session.sub,
        byName: session.name,
      });
    }
    return ok({ part }, 201);
  } catch (err) {
    return handleError(err);
  }
}
