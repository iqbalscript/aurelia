/**
 * Create a new user account from the CLI (since self-registration is disabled).
 *
 * Usage:
 *   npx tsx prisma/create-user.ts <name> <email> <password> [role] [modelId...]
 *
 * Examples:
 *   npx tsx prisma/create-user.ts "Budi" budi@example.com secret123
 *   npx tsx prisma/create-user.ts "Budi" budi@example.com secret123 BASIC gemini-2.5-flash-lite
 *   npx tsx prisma/create-user.ts "Admin" admin@example.com secret123 ADMIN
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const [name, email, password, roleArg, ...modelIds] = process.argv.slice(2);

  if (!name || !email || !password) {
    console.error(
      "Usage: npx tsx prisma/create-user.ts <name> <email> <password> [BASIC|PREMIUM|ADMIN] [modelId...]"
    );
    process.exit(1);
  }

  const role = (roleArg ?? "BASIC").toUpperCase();
  if (!["BASIC", "PREMIUM", "ADMIN"].includes(role)) {
    console.error(`Invalid role "${roleArg}". Use BASIC, PREMIUM, or ADMIN.`);
    process.exit(1);
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`A user with email ${email} already exists.`);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await db.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: role as "BASIC" | "PREMIUM" | "ADMIN",
      modelAccess: { create: modelIds.map((modelId) => ({ modelId })) },
    },
  });

  console.log(`✔ Created ${role} user ${user.email}`);
  if (modelIds.length > 0) console.log(`  Model access: ${modelIds.join(", ")}`);
  if (role === "ADMIN") console.log(`  (ADMIN role bypasses the model allowlist entirely)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
