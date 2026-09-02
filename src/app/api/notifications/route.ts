import connectDB from "@/lib/db";
import Notification from "@/models/Notification";
import { requireSession } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";

export async function GET(req: Request) {
  try {
    await requireSession();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 100), 200);
    const status = searchParams.get("status");

    const filter = status && status !== "all" ? { status } : {};
    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean();

    return ok({ notifications });
  } catch (err) {
    return handleError(err);
  }
}
