import { auth } from "@/lib/auth";

/**
 * Returns the session if the current user is an ADMIN, otherwise null.
 * Every /api/admin/* route should call this first.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}
