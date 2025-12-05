// prisma.config.ts
import { defineConfig } from "@prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Studio cannot load .env automatically, so this must NOT throw.
const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/skillify?schema=public";

// Postgres connection pool for runtime adapter
const pool = new pg.Pool({
  connectionString: url,
});

export default defineConfig({
  datasource: {
    url, // Studio reads this value, or it's overridden by --url
  },

  // Prisma runtime adapter (typing not yet exposed)
  // @ts-expect-error
  adapter: new PrismaPg(pool),

  migrations: {
    seed: "npx tsx ./prisma/seed.ts",
  },
});