/**
 * Helper script to grant model access to a user, or promote them to ADMIN.
 *
 * Usage:
 *   npx tsx prisma/grant-access.ts <email> all        -> grant every model
 *   npx tsx prisma/grant-access.ts <email> gemini-3.1-flash-lite openrouter-free
 *   npx tsx prisma/grant-access.ts <email> admin       -> set role to ADMIN (bypasses allowlist)
 */
import { PrismaClient } from "@prisma/client";
import { MODEL_REGISTRY } from "../src/lib/providers/registry";

const db = new PrismaClient();

async function main() {
  const [email, ...args] = process.argv.slice(2);
  if (!email || args.length === 0) {
    console.error(
      "Usage: npx tsx prisma/grant-access.ts <email> <all|admin|modelId...>"
    );
    process.exit(1);
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }

  if (args[0] === "admin") {
    await db.user.update({ where: { email }, data: { role: "ADMIN" } });
    console.log(`✔ ${email} is now ADMIN (access to all models).`);
    return;
  }

  const modelIds =
    args[0] === "all" ? MODEL_REGISTRY.map((m) => m.id) : args;

  for (const modelId of modelIds) {
    await db.modelAccess.upsert({
      where: { userId_modelId: { userId: user.id, modelId } },
      update: {},
      create: { userId: user.id, modelId },
    });
  }

  console.log(`✔ Granted [${modelIds.join(", ")}] to ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
