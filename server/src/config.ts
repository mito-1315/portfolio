import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().default(4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  ADMIN_PASSWORD: z.string().min(8),
  ADMIN_TOKEN_SECRET: z.string().min(16),
  IP_HASH_SALT: z.string().min(8),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  console.error(`Invalid environment. Check these in server/.env: ${missing}`);
  process.exit(1);
}

export const config = parsed.data;
