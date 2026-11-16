import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";
import { config } from "./config.js";
import { dbUrl } from "./dbUrl.js";

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl(config.DATABASE_URL) }) });
