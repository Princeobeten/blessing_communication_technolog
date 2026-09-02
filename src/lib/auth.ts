import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "./session";

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function comparePassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/** Reads and verifies the session cookie inside a route handler / server component. */
export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Throws 401 when signed out; use at the top of every protected route handler. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "You must be signed in.");
  return session;
}

/** Throws 403 when the signed-in user is not an administrator. */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "admin") throw new HttpError(403, "Administrator access required.");
  return session;
}
