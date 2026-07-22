import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { MODEL_REGISTRY } from "@/lib/providers/registry";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      modelAccess: { select: { modelId: true } },
    },
  });

  return NextResponse.json({
    users: users.map((u: (typeof users)[number]) => ({
      ...u,
      modelAccess: u.modelAccess.map((m: { modelId: string }) => m.modelId),
    })),
    availableModels: MODEL_REGISTRY.map((m) => ({ id: m.id, label: m.label })),
  });
}

const createUserSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["BASIC", "PREMIUM", "ADMIN"]).default("BASIC"),
  modelIds: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { name, email, password, role, modelIds } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await db.user.create({
    data: {
      name,
      email,
      password: hashed,
      role,
      modelAccess: { create: modelIds.map((modelId) => ({ modelId })) },
    },
  });

  return NextResponse.json({ id: user.id, email: user.email });
}
