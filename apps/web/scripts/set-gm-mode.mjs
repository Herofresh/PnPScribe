import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

function printUsage() {
  process.stderr.write(
    [
      "Usage:",
      "  npm run gm:enable -- <email>",
      "  npm run gm:disable -- <email>",
    ].join("\n") + "\n",
  );
}

const [, , modeArg, emailArg] = process.argv;
const mode = modeArg === "enable" || modeArg === "disable" ? modeArg : null;
const email = typeof emailArg === "string" ? emailArg.trim().toLowerCase() : "";

if (mode == null || email === "") {
  printUsage();
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;

if (typeof connectionString !== "string" || connectionString.trim() === "") {
  process.stderr.write("Missing DATABASE_URL in environment.\n");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

try {
  const updated = await prisma.user.update({
    where: { email },
    data: {
      gmEnabled: mode === "enable",
    },
    select: {
      id: true,
      email: true,
      gmEnabled: true,
    },
  });

  process.stdout.write(`${JSON.stringify(updated, null, 2)}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Failed to update GM mode for ${email}: ${message}\n`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
