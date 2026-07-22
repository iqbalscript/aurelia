import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { MODEL_REGISTRY } from "@/lib/providers/registry";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admins see every model in the registry.
  if (session.user.role === "ADMIN") {
    return NextResponse.json({ models: MODEL_REGISTRY });
  }

  const access = await db.modelAccess.findMany({
    where: { userId: session.user.id },
    select: { modelId: true },
  });
  const allowedIds = new Set(access.map((a: { modelId: string }) => a.modelId));

  const models = MODEL_REGISTRY.filter((m) => allowedIds.has(m.id));
  return NextResponse.json({ models });
}
