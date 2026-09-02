import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const CustomerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    address: { type: String, trim: true, default: "" },
    company: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

CustomerSchema.index({ name: "text", phone: "text", email: "text" });

export type CustomerDoc = InferSchemaType<typeof CustomerSchema> & { _id: string };

export const Customer = (models.Customer as Model<CustomerDoc>) || model<CustomerDoc>("Customer", CustomerSchema);
export default Customer;
