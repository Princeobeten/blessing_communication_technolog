import connectDB from "@/lib/db";
import Invoice from "@/models/Invoice";
import RepairJob from "@/models/RepairJob";
import { requireSession, HttpError } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    await requireSession();
    await connectDB();
    const { id } = await params;

    const invoice = await Invoice.findById(id).populate("customer").lean();
    if (!invoice) throw new HttpError(404, "Invoice not found.");

    const job = await RepairJob.findById(invoice.job).populate("technician", "name").lean();

    return ok({ invoice: { ...invoice, balance: Math.max(0, invoice.total - invoice.amountPaid) }, job });
  } catch (err) {
    return handleError(err);
  }
}
