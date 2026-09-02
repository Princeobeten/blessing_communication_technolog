import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/http";

export async function GET() {
  const session = await getSession();
  if (!session) return fail("Not signed in.", 401);
  return ok({ user: { id: session.sub, name: session.name, email: session.email, role: session.role } });
}
