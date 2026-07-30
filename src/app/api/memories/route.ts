import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEmbedding } from "@/lib/embeddings";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memories = await db.memory.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, content: true, createdAt: true, sourceConvId: true },
  });

  return NextResponse.json({ memories });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { content } = await req.json();
  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  try {
    const embedding = await getEmbedding(content.trim());
    const memory = await db.memory.create({
      data: {
        userId: session.user.id,
        content: content.trim(),
        embedding: JSON.stringify(embedding),
      },
    });
    return NextResponse.json({ memory });
  } catch (err) {
    console.error("Failed to create memory:", err);
    return NextResponse.json({ error: "Failed to save memory" }, { status: 500 });
  }
}