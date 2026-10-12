import { z } from "zod";
import connectDB from "@/lib/db";
import RepairJob from "@/models/RepairJob";
import Customer from "@/models/Customer";
import Invoice from "@/models/Invoice";
import { requireSession, HttpError } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { nextInvoiceNumber } from "@/lib/counters";
import { notifyInvoiceIssued } from "@/lib/notify";
import { formatMoney } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  taxRate: z.number().min(0).max(100).default(0),
  discount: z.number().min(0).default(0),
});

/** Builds the invoice from work actually recorded on the job: labour + parts used. */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    await connectDB();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { taxRate, discount } = schema.parse(body);

    const job = await RepairJob.findById(id);
    if (!job) throw new HttpError(404, "Repair job not found.");

    const existing = await Invoice.findOne({ job: id }).lean();
    if (existing) throw new HttpError(409, `Invoice ${existing.invoiceNumber} already exists for this job.`);

    if (!["completed", "delivered"].includes(job.status)) {
      throw new HttpError(400, "Complete the repair before generating an invoice.");
    }

    const items = [
      ...(job.labourCost > 0
        ? [
            {
              description: "Repair labour / service charge",
              kind: "labour" as const,
              quantity: 1,
              unitPrice: job.labourCost,
              amount: job.labourCost,
            },
          ]
        : []),
      ...job.partsUsed.map((p) => ({
        description: p.name,
        kind: "part" as const,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        amount: p.quantity * p.unitPrice,
      })),
    ];

    if (items.length === 0) {
      throw new HttpError(400, "Record a labour charge or spare parts before invoicing.");
    }

    const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
    if (discount > subtotal) throw new HttpError(400, "Discount cannot exceed the subtotal.");
    const tax = ((subtotal - discount) * taxRate) / 100;
    const total = subtotal - discount + tax;

    const invoice = await Invoice.create({
      invoiceNumber: await nextInvoiceNumber(),
      job: job._id,
      ticket: job.ticket,
      customer: job.customer,
      items,
      subtotal,
      taxRate,
      tax,
      discount,
      total,
      status: "unpaid",
      issuedAt: new Date(),
      issuedBy: session.sub,
    });

    const customer = await Customer.findById(job.customer).lean();
    await notifyInvoiceIssued(job, customer, invoice.invoiceNumber, formatMoney(total));

    return ok({ invoice }, 201);
  } catch (err) {
    return handleError(err);
  }
}
