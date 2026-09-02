import { Types } from "mongoose";
import connectDB from "@/lib/db";
import RepairJob from "@/models/RepairJob";
import Customer from "@/models/Customer";
import Part from "@/models/Part";
import Invoice from "@/models/Invoice";
import { requireSession } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";

/** Figures for the landing dashboard, scoped to the signed-in user's role. */
export async function GET() {
  try {
    const session = await requireSession();
    await connectDB();

    const isTech = session.role === "technician";
    const scope = isTech ? { technician: session.sub } : {};
    const open = { status: { $nin: ["delivered", "cancelled"] } };

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      openJobs,
      awaitingApproval,
      inProgress,
      completed,
      totalCustomers,
      lowStock,
      recentJobs,
      revenueAgg,
      outstandingAgg,
      statusBreakdown,
    ] = await Promise.all([
      RepairJob.countDocuments({ ...scope, ...open }),
      RepairJob.countDocuments({ ...scope, status: "awaiting_approval" }),
      RepairJob.countDocuments({ ...scope, status: "in_progress" }),
      RepairJob.countDocuments({ ...scope, status: "completed" }),
      isTech ? 0 : Customer.countDocuments(),
      isTech ? [] : Part.find({ $expr: { $lte: ["$quantity", "$reorderLevel"] } }).sort({ quantity: 1 }).limit(8).lean(),
      RepairJob.find({ ...scope })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate("customer", "name phone")
        .populate("technician", "name")
        .lean(),
      isTech
        ? []
        : Invoice.aggregate([
            { $match: { status: { $ne: "void" }, issuedAt: { $gte: startOfMonth } } },
            { $group: { _id: null, billed: { $sum: "$total" }, collected: { $sum: "$amountPaid" } } },
          ]),
      isTech
        ? []
        : Invoice.aggregate([
            { $match: { status: { $in: ["unpaid", "partial"] } } },
            { $group: { _id: null, outstanding: { $sum: { $subtract: ["$total", "$amountPaid"] } } } },
          ]),
      RepairJob.aggregate([
        // $match does not cast strings, unlike a normal query - build the id explicitly.
        ...(isTech ? [{ $match: { technician: new Types.ObjectId(session.sub) } }] : []),
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    return ok({
      role: session.role,
      stats: {
        openJobs,
        awaitingApproval,
        inProgress,
        completed,
        totalCustomers,
        lowStockCount: Array.isArray(lowStock) ? lowStock.length : 0,
        billedThisMonth: revenueAgg[0]?.billed ?? 0,
        collectedThisMonth: revenueAgg[0]?.collected ?? 0,
        outstanding: outstandingAgg[0]?.outstanding ?? 0,
      },
      statusBreakdown,
      lowStock,
      recentJobs,
    });
  } catch (err) {
    return handleError(err);
  }
}
