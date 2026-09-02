import { z } from "zod";
import connectDB from "@/lib/db";
import RepairJob, { JOB_STATUSES, PRIORITIES } from "@/models/RepairJob";
import Customer from "@/models/Customer";
import { requireSession, HttpError } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { nextTicketNumber } from "@/lib/counters";
import { notifyStatusChange } from "@/lib/notify";

/**
 * Device intake. The customer is either an existing record (customerId) or a new
 * one captured on the same form (customer) - "Register Customer" and "Record
 * Device Details" from the Repair Intake module happen in one transaction-like step.
 */
const intakeSchema = z
  .object({
    customerId: z.string().optional(),
    customer: z
      .object({
        name: z.string().min(2, "Customer name is required"),
        phone: z.string().min(7, "Customer phone is required"),
        email: z.string().email().or(z.literal("")).optional(),
        address: z.string().optional(),
      })
      .optional(),
    device: z.object({
      type: z.string().min(1, "Device type is required"),
      brand: z.string().min(1, "Brand is required"),
      model: z.string().optional(),
      serialNumber: z.string().optional(),
      accessories: z.array(z.string()).optional(),
      condition: z.string().optional(),
    }),
    reportedIssue: z.string().min(5, "Describe the reported fault"),
    priority: z.enum(PRIORITIES).optional(),
    technician: z.string().nullish(),
    expectedCompletionAt: z.string().datetime().or(z.literal("")).nullish(),
  })
  .refine((v) => v.customerId || v.customer, {
    message: "Select an existing customer or enter new customer details",
    path: ["customerId"],
  });

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const technician = searchParams.get("technician");
    const q = searchParams.get("q")?.trim();
    const mine = searchParams.get("mine") === "true";

    const filter: Record<string, unknown> = {};
    if (status && status !== "all") filter.status = status;
    if (technician) filter.technician = technician;
    // Technicians only ever see their own workload.
    if (mine || session.role === "technician") filter.technician = session.sub;

    if (q) {
      const customers = await Customer.find({
        $or: [{ name: { $regex: q, $options: "i" } }, { phone: { $regex: q, $options: "i" } }],
      })
        .select("_id")
        .lean();
      filter.$or = [
        { ticket: { $regex: q, $options: "i" } },
        { "device.brand": { $regex: q, $options: "i" } },
        { "device.serialNumber": { $regex: q, $options: "i" } },
        { customer: { $in: customers.map((c) => c._id) } },
      ];
    }

    const jobs = await RepairJob.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("customer", "name phone email")
      .populate("technician", "name")
      .lean();

    // Virtuals are not evaluated by .lean(), so derive the parts total here.
    const withTotals = jobs.map((job) => ({
      ...job,
      partsTotal: (job.partsUsed ?? []).reduce((sum, p) => sum + p.quantity * p.unitPrice, 0),
    }));

    return ok({ jobs: withTotals });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    await connectDB();
    const data = intakeSchema.parse(await req.json());

    let customerId = data.customerId;
    if (!customerId && data.customer) {
      // Reuse an existing record when the phone number already exists.
      const existing = await Customer.findOne({ phone: data.customer.phone });
      customerId = existing
        ? String(existing._id)
        : String((await Customer.create({ ...data.customer, createdBy: session.sub }))._id);
    }

    const customer = await Customer.findById(customerId).lean();
    if (!customer) throw new HttpError(404, "Customer not found.");

    const ticket = await nextTicketNumber();
    const job = await RepairJob.create({
      ticket,
      customer: customerId,
      device: { ...data.device, accessories: data.device.accessories ?? [] },
      reportedIssue: data.reportedIssue,
      priority: data.priority ?? "normal",
      technician: data.technician || null,
      expectedCompletionAt: data.expectedCompletionAt ? new Date(data.expectedCompletionAt) : null,
      status: JOB_STATUSES[0],
      receivedAt: new Date(),
      createdBy: session.sub,
      timeline: [
        {
          status: "pending",
          note: "Device received at the workshop.",
          by: session.sub,
          byName: session.name,
          at: new Date(),
        },
      ],
    });

    await notifyStatusChange(job, customer, "pending");

    return ok({ job }, 201);
  } catch (err) {
    return handleError(err);
  }
}
