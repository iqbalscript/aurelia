import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const profileSchema = z.object({
  preferredName: z.string().trim().max(80).nullable(),
  addressInstructions: z.string().trim().max(500).nullable(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, preferredName: true, addressInstructions: true },
  });
  return NextResponse.json({ profile });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = profileSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile details" }, { status: 400 });
  }

  const normalize = (value: string | null) => value || null;
  const profile = await db.user.update({
    where: { id: session.user.id },
    data: {
      preferredName: normalize(parsed.data.preferredName),
      addressInstructions: normalize(parsed.data.addressInstructions),
    },
    select: { name: true, email: true, preferredName: true, addressInstructions: true },
  });
  return NextResponse.json({ profile });
}
