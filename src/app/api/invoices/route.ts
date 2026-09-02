import connectDB from "@/lib/db";
import Invoice from "@/models/Invoice";
import { requireSession } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";

export async function GET(req: Request) {
  try {
    await requireSession();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const q = searchParams.get("q")?.trim();

    const filter: Record<string, unknown> = {};
    if (status && status !== "all") filter.status = status;
    if (q) {
      filter.$or = [
        { invoiceNumber: { $regex: q, $options: "i" } },
        { ticket: { $regex: q, $options: "i" } },
      ];
    }

    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("customer", "name phone")
      .lean();

    return ok({
      invoices: invoices.map((i) => ({ ...i, balance: Math.max(0, i.total - i.amountPaid) })),
    });
  } catch (err) {
    return handleError(err);
  }
}
