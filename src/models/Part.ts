import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const PartSchema = new Schema(
  {
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: "General" },
    quantity: { type: Number, required: true, default: 0, min: 0 },
    reorderLevel: { type: Number, required: true, default: 5, min: 0 },
    unitCost: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, required: true, default: 0, min: 0 },
    supplier: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

/** True when stock has fallen to or below the reorder level - drives low-stock alerts. */
PartSchema.virtual("lowStock").get(function () {
  return this.quantity <= this.reorderLevel;
});

PartSchema.set("toJSON", { virtuals: true });
PartSchema.set("toObject", { virtuals: true });

export type PartDoc = InferSchemaType<typeof PartSchema> & { _id: string };

export const Part = (models.Part as Model<PartDoc>) || model<PartDoc>("Part", PartSchema);
export default Part;
