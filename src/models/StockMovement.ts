import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { MOVEMENT_TYPES } from "@/lib/constants";

export { MOVEMENT_TYPES };

/** Audit trail for every change to spare-part stock levels. */
const StockMovementSchema = new Schema(
  {
    part: { type: Schema.Types.ObjectId, ref: "Part", required: true, index: true },
    partName: { type: String, default: "" },
    type: { type: String, enum: MOVEMENT_TYPES, required: true },
    quantity: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reason: { type: String, default: "" },
    job: { type: Schema.Types.ObjectId, ref: "RepairJob", default: null },
    by: { type: Schema.Types.ObjectId, ref: "User" },
    byName: { type: String, default: "" },
  },
  { timestamps: true }
);

export type StockMovementDoc = InferSchemaType<typeof StockMovementSchema> & { _id: string };

export const StockMovement =
  (models.StockMovement as Model<StockMovementDoc>) ||
  model<StockMovementDoc>("StockMovement", StockMovementSchema);
export default StockMovement;
