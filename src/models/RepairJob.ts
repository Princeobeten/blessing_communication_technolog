import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { JOB_STATUSES, PRIORITIES } from "@/lib/constants";

/** Repair lifecycle - mirrors the Service Module in Fig 3.7. */
export { JOB_STATUSES, PRIORITIES };
export type { JobStatus } from "@/lib/constants";

const TimelineEntrySchema = new Schema(
  {
    status: { type: String, enum: JOB_STATUSES, required: true },
    note: { type: String, default: "" },
    by: { type: Schema.Types.ObjectId, ref: "User" },
    byName: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const PartUsedSchema = new Schema(
  {
    part: { type: Schema.Types.ObjectId, ref: "Part", required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const RepairJobSchema = new Schema(
  {
    ticket: { type: String, required: true, unique: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },

    // Repair Intake module
    device: {
      type: { type: String, required: true, trim: true },     // Laptop / Desktop / Printer ...
      brand: { type: String, required: true, trim: true },
      model: { type: String, trim: true, default: "" },
      serialNumber: { type: String, trim: true, default: "" },
      accessories: { type: [String], default: [] },
      condition: { type: String, trim: true, default: "" },
    },
    reportedIssue: { type: String, required: true, trim: true },

    // Service module
    diagnosis: { type: String, default: "" },
    workDone: { type: String, default: "" },
    status: { type: String, enum: JOB_STATUSES, default: "pending", index: true },
    priority: { type: String, enum: PRIORITIES, default: "normal" },
    technician: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },

    // Quote / estimation
    estimate: {
      labourCost: { type: Number, default: 0, min: 0 },
      partsCost: { type: Number, default: 0, min: 0 },
      total: { type: Number, default: 0, min: 0 },
      notes: { type: String, default: "" },
      quotedAt: { type: Date, default: null },
      approved: { type: Boolean, default: false },
      approvedAt: { type: Date, default: null },
      approvedBy: { type: String, default: "" },
    },

    partsUsed: { type: [PartUsedSchema], default: [] },
    labourCost: { type: Number, default: 0, min: 0 },

    receivedAt: { type: Date, default: Date.now },
    expectedCompletionAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },

    timeline: { type: [TimelineEntrySchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

/** Total value of spare parts consumed on this job. */
RepairJobSchema.virtual("partsTotal").get(function () {
  return (this.partsUsed ?? []).reduce((sum, p) => sum + p.quantity * p.unitPrice, 0);
});

RepairJobSchema.set("toJSON", { virtuals: true });
RepairJobSchema.set("toObject", { virtuals: true });

export type RepairJobDoc = InferSchemaType<typeof RepairJobSchema> & { _id: string };

export const RepairJob =
  (models.RepairJob as Model<RepairJobDoc>) || model<RepairJobDoc>("RepairJob", RepairJobSchema);
export default RepairJob;
