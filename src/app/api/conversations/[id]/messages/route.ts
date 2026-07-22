import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { content } = await req.json();

  const conversation = await db.conversation.findFirst({
    where: { id, userId: session.user.id },
    include: { _count: { select: { messages: true } } },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const message = await db.message.create({
    data: { conversationId: id, role: "user", content },
  });

  // Auto-title conversation from the first user message.
  if (conversation._count.messages === 0) {
    const title = content.slice(0, 48) + (content.length > 48 ? "…" : "");
    await db.conversation.update({ where: { id }, data: { title } });
  }

  return NextResponse.json({ message });
}
