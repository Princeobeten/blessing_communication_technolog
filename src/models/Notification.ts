import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { NOTIFICATION_CHANNELS, NOTIFICATION_STATUSES } from "@/lib/constants";

export { NOTIFICATION_CHANNELS, NOTIFICATION_STATUSES };

/**
 * Every automated customer update is persisted here first, then handed to a
 * delivery driver (see src/lib/notify.ts). The prototype ships with a console
 * driver, so the record itself is the deliverable evidence of the message.
 */
const NotificationSchema = new Schema(
  {
    event: { type: String, required: true },              // e.g. job.status_changed
    channel: { type: String, enum: NOTIFICATION_CHANNELS, default: "email" },
    to: { type: String, default: "" },                    // email address or phone number
    recipientName: { type: String, default: "" },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    job: { type: Schema.Types.ObjectId, ref: "RepairJob", default: null, index: true },
    ticket: { type: String, default: "" },
    subject: { type: String, default: "" },
    message: { type: String, required: true },
    status: { type: String, enum: NOTIFICATION_STATUSES, default: "queued", index: true },
    sentAt: { type: Date, default: null },
    error: { type: String, default: "" },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type NotificationDoc = InferSchemaType<typeof NotificationSchema> & { _id: string };

export const Notification =
  (models.Notification as Model<NotificationDoc>) ||
  model<NotificationDoc>("Notification", NotificationSchema);
export default Notification;
