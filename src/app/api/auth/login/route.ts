import { NextResponse } from "next/server";
import { z } from "zod";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { comparePassword } from "@/lib/auth";
import { signSession, SESSION_COOKIE, cookieOptions } from "@/lib/session";
import { fail, handleError } from "@/lib/http";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: Request) {
  try {
    const { email, password } = schema.parse(await req.json());
    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
    // Same message for unknown email and wrong password - do not leak which accounts exist.
    if (!user || !(await comparePassword(password, user.passwordHash))) {
      return fail("Invalid email or password.", 401);
    }
    if (!user.active) return fail("This account has been deactivated.", 403);

    const token = await signSession({
      sub: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role as "admin" | "technician",
    });

    const res = NextResponse.json({
      user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
    });
    res.cookies.set(SESSION_COOKIE, token, cookieOptions);
    return res;
  } catch (err) {
    return handleError(err);
  }
}
