/**
 * Shared domain constants.
 *
 * These live outside the model files so client components can import them
 * without dragging Mongoose into the browser bundle. The schemas import from
 * here, which keeps a single source of truth for every enum.
 */

export const ROLES = ["admin", "technician"] as const;
export type Role = (typeof ROLES)[number];

export const JOB_STATUSES = [
  "pending",            // device received, awaiting diagnosis
  "diagnosing",         // technician inspecting
  "awaiting_approval",  // quote sent to customer
  "in_progress",        // repair underway
  "awaiting_parts",     // blocked on spare parts
  "completed",          // repaired, ready for pickup
  "delivered",          // handed back to customer
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const PRIORITIES = ["low", "normal", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const INVOICE_STATUSES = ["unpaid", "partial", "paid", "void"] as const;
export const PAYMENT_METHODS = ["cash", "transfer", "pos", "card"] as const;
export const MOVEMENT_TYPES = ["in", "out", "adjustment"] as const;
export const NOTIFICATION_CHANNELS = ["email", "sms", "in-app"] as const;
export const NOTIFICATION_STATUSES = ["queued", "sent", "failed"] as const;

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  diagnosing: "Diagnosing",
  awaiting_approval: "Awaiting approval",
  in_progress: "In progress",
  awaiting_parts: "Awaiting parts",
  completed: "Completed",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const JOB_STATUS_OPTIONS = JOB_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value] ?? value,
}));

export const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Urgent" },
];

export const DEVICE_TYPES = [
  "Laptop",
  "Desktop",
  "All-in-One",
  "Printer",
  "Monitor",
  "Server",
  "Tablet",
  "Phone",
  "Other",
];

/**
 * Legal next stages for each status - the same map the API enforces, used by the
 * UI so a technician is only offered transitions the server will accept.
 */
export const ALLOWED_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  pending: ["diagnosing", "cancelled"],
  diagnosing: ["awaiting_approval", "in_progress", "awaiting_parts", "cancelled"],
  awaiting_approval: ["in_progress", "cancelled"],
  in_progress: ["awaiting_parts", "completed", "cancelled"],
  awaiting_parts: ["in_progress", "cancelled"],
  completed: ["delivered", "in_progress"],
  delivered: [],
  cancelled: [],
};
