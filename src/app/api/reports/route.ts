import connectDB from "@/lib/db";
import RepairJob from "@/models/RepairJob";
import Invoice from "@/models/Invoice";
import Part from "@/models/Part";
import { requireAdmin } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";

/**
 * Objective 5 - management reporting.
 * Everything is computed by MongoDB aggregation so the figures stay correct as
 * the dataset grows rather than being assembled in application memory.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(Number(searchParams.get("days") ?? 90), 7), 365);
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [monthlyRepairs, revenueByMonth, technicianPerformance, deviceMix, statusMix, topParts, turnaround] =
      await Promise.all([
        // Repair volume per month
        RepairJob.aggregate([
          { $match: { receivedAt: { $gte: from } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$receivedAt" } }, jobs: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]),

        // Billed vs collected per month
        Invoice.aggregate([
          { $match: { issuedAt: { $gte: from }, status: { $ne: "void" } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m", date: "$issuedAt" } },
              billed: { $sum: "$total" },
              collected: { $sum: "$amountPaid" },
              invoices: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),

        // Technician performance: completed volume and average turnaround
        RepairJob.aggregate([
          { $match: { technician: { $ne: null }, receivedAt: { $gte: from } } },
          {
            $group: {
              _id: "$technician",
              assigned: { $sum: 1 },
              completed: {
                $sum: { $cond: [{ $in: ["$status", ["completed", "delivered"]] }, 1, 0] },
              },
              avgHours: {
                $avg: {
                  $cond: [
                    { $ifNull: ["$completedAt", false] },
                    { $divide: [{ $subtract: ["$completedAt", "$receivedAt"] }, 1000 * 60 * 60] },
                    null,
                  ],
                },
              },
            },
          },
          { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
          { $unwind: "$user" },
          {
            $project: {
              _id: 0,
              name: "$user.name",
              specialization: "$user.specialization",
              assigned: 1,
              completed: 1,
              avgHours: { $round: [{ $ifNull: ["$avgHours", 0] }, 1] },
            },
          },
          { $sort: { completed: -1 } },
        ]),

        // Which device types come in most often
        RepairJob.aggregate([
          { $match: { receivedAt: { $gte: from } } },
          { $group: { _id: "$device.type", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 8 },
        ]),

        RepairJob.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),

        // Fastest-moving spare parts by quantity consumed
        RepairJob.aggregate([
          { $match: { receivedAt: { $gte: from } } },
          { $unwind: "$partsUsed" },
          {
            $group: {
              _id: "$partsUsed.name",
              quantity: { $sum: "$partsUsed.quantity" },
              value: { $sum: { $multiply: ["$partsUsed.quantity", "$partsUsed.unitPrice"] } },
            },
          },
          { $sort: { quantity: -1 } },
          { $limit: 8 },
        ]),

        // Average time from intake to completion, in hours
        RepairJob.aggregate([
          { $match: { completedAt: { $ne: null }, receivedAt: { $gte: from } } },
          {
            $group: {
              _id: null,
              avgHours: {
                $avg: { $divide: [{ $subtract: ["$completedAt", "$receivedAt"] }, 1000 * 60 * 60] },
              },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    const inventoryValue = await Part.aggregate([
      {
        $group: {
          _id: null,
          costValue: { $sum: { $multiply: ["$quantity", "$unitCost"] } },
          retailValue: { $sum: { $multiply: ["$quantity", "$sellingPrice"] } },
          items: { $sum: 1 },
          units: { $sum: "$quantity" },
        },
      },
    ]);

    return ok({
      periodDays: days,
      monthlyRepairs,
      revenueByMonth,
      technicianPerformance,
      deviceMix,
      statusMix,
      topParts,
      averageTurnaroundHours: Math.round((turnaround[0]?.avgHours ?? 0) * 10) / 10,
      completedInPeriod: turnaround[0]?.count ?? 0,
      inventory: inventoryValue[0] ?? { costValue: 0, retailValue: 0, items: 0, units: 0 },
    });
  } catch (err) {
    return handleError(err);
  }
}
