import { z } from "zod";
import connectDB from "@/lib/db";
import Invoice, { PAYMENT_METHODS } from "@/models/Invoice";
import Customer from "@/models/Customer";
import { requireSession, HttpError } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { sendNotification } from "@/lib/notify";
import { formatMoney } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  amount: z.number().positive("Enter an amount greater than zero"),
  method: z.enum(PAYMENT_METHODS).default("cash"),
  reference: z.string().optional(),
});

/** Records a payment (full or part) and recalculates the invoice status. */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    await connectDB();
    const { id } = await params;
    const { amount, method, reference } = schema.parse(await req.json());

    const invoice = await Invoice.findById(id);
    if (!invoice) throw new HttpError(404, "Invoice not found.");
    if (invoice.status === "paid") throw new HttpError(400, "This invoice is already fully paid.");
    if (invoice.status === "void") throw new HttpError(400, "This invoice has been voided.");

    const balance = invoice.total - invoice.amountPaid;
    if (amount > balance + 0.001) {
      throw new HttpError(400, `That is more than the outstanding balance of ${formatMoney(balance)}.`);
    }

    invoice.payments.push({ amount, method, reference: reference ?? "", at: new Date(), byName: session.name });
    invoice.amountPaid += amount;
    invoice.status = invoice.amountPaid >= invoice.total - 0.001 ? "paid" : "partial";
    await invoice.save();

    const customer = await Customer.findById(invoice.customer).lean();
    await sendNotification({
      event: "payment.received",
      customer,
      job: { _id: invoice.job, ticket: invoice.ticket },
      subject: `[${invoice.invoiceNumber}] Payment received - ${formatMoney(amount)}`,
      message: `We have received ${formatMoney(amount)} towards invoice ${invoice.invoiceNumber}. ${
        invoice.status === "paid"
          ? "The invoice is now fully settled. Thank you."
          : `Outstanding balance: ${formatMoney(invoice.total - invoice.amountPaid)}.`
      }`,
    });

    return ok({ invoice: { ...invoice.toObject(), balance: invoice.total - invoice.amountPaid } });
  } catch (err) {
    return handleError(err);
  }
}
