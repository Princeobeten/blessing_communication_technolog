import { z } from "zod";
import connectDB from "@/lib/db";
import Part from "@/models/Part";
import StockMovement from "@/models/StockMovement";
import { requireSession, requireAdmin, HttpError } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  category: z.string().optional(),
  reorderLevel: z.number().int().min(0).optional(),
  unitCost: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  supplier: z.string().optional(),
  location: z.string().optional(),
  // Stock is never set directly - it is adjusted by a signed delta so that every
  // change leaves a movement record behind.
  adjustBy: z.number().int().optional(),
  reason: z.string().optional(),
});

export async function GET(_req: Request, { params }: Params) {
  try {
    await requireSession();
    await connectDB();
    const { id } = await params;

    const part = await Part.findById(id).lean();
    if (!part) throw new HttpError(404, "Spare part not found.");

    const movements = await StockMovement.find({ part: id }).sort({ createdAt: -1 }).limit(50).lean();
    return ok({ part: { ...part, lowStock: part.quantity <= part.reorderLevel }, movements });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    await connectDB();
    const { id } = await params;
    const { adjustBy, reason, ...fields } = updateSchema.parse(await req.json());

    const part = await Part.findById(id);
    if (!part) throw new HttpError(404, "Spare part not found.");

    Object.assign(part, fields);

    if (adjustBy) {
      const next = part.quantity + adjustBy;
      if (next < 0) throw new HttpError(400, `Stock cannot go below zero (currently ${part.quantity}).`);
      part.quantity = next;
    }
    await part.save();

    if (adjustBy) {
      await StockMovement.create({
        part: part._id,
        partName: part.name,
        type: adjustBy > 0 ? "in" : "adjustment",
        quantity: Math.abs(adjustBy),
        balanceAfter: part.quantity,
        reason: reason || (adjustBy > 0 ? "Stock received" : "Stock adjustment"),
        by: session.sub,
        byName: session.name,
      });
    }

    return ok({ part: { ...part.toObject(), lowStock: part.quantity <= part.reorderLevel } });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireAdmin();
    await connectDB();
    const { id } = await params;
    const deleted = await Part.findByIdAndDelete(id);
    if (!deleted) throw new HttpError(404, "Spare part not found.");
    await StockMovement.deleteMany({ part: id });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
