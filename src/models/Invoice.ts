import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { INVOICE_STATUSES, PAYMENT_METHODS } from "@/lib/constants";

export { INVOICE_STATUSES, PAYMENT_METHODS };

const LineItemSchema = new Schema(
  {
    description: { type: String, required: true },
    kind: { type: String, enum: ["labour", "part"], default: "part" },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const PaymentSchema = new Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    reference: { type: String, default: "" },
    at: { type: Date, default: Date.now },
    byName: { type: String, default: "" },
  },
  { _id: false }
);

const InvoiceSchema = new Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    job: { type: Schema.Types.ObjectId, ref: "RepairJob", required: true, index: true },
    ticket: { type: String, required: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    items: { type: [LineItemSchema], default: [] },
    subtotal: { type: Number, required: true, default: 0 },
    taxRate: { type: Number, default: 0 },      // percent, e.g. 7.5
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true, default: 0 },
    amountPaid: { type: Number, default: 0 },
    status: { type: String, enum: INVOICE_STATUSES, default: "unpaid", index: true },
    payments: { type: [PaymentSchema], default: [] },
    issuedAt: { type: Date, default: Date.now },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

InvoiceSchema.virtual("balance").get(function () {
  return Math.max(0, (this.total ?? 0) - (this.amountPaid ?? 0));
});

InvoiceSchema.set("toJSON", { virtuals: true });
InvoiceSchema.set("toObject", { virtuals: true });

export type InvoiceDoc = InferSchemaType<typeof InvoiceSchema> & { _id: string };

export const Invoice = (models.Invoice as Model<InvoiceDoc>) || model<InvoiceDoc>("Invoice", InvoiceSchema);
export default Invoice;
