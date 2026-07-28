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

  const realModels = MODEL_REGISTRY.filter(
    (m) => m.provider !== "auto" && allowedIds.has(m.id)
  );
  const autoEntry = MODEL_REGISTRY.find((m) => m.provider === "auto");

  // Only show "Auto" if the user has access to at least one real model.
  const models = autoEntry && realModels.length > 0 ? [autoEntry, ...realModels] : realModels;

  return NextResponse.json({ models });
}
