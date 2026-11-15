import { createApp } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./db.js";

const server = createApp().listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${config.PORT} is already in use. Another copy of the API may be running: stop it, or set PORT in server/.env.`
    );
  } else {
    console.error("The server could not start:", error);
  }
  process.exit(1);
});

// Say clearly at startup whether the database can be reached. The API keeps
// running either way, and answers 503 until the database comes back.
prisma
  .$queryRaw`SELECT 1`
  .then(() => console.log("Database connected"))
  .catch(() =>
    console.error(
      "Database is NOT reachable. Check that PostgreSQL is running and that DATABASE_URL in server/.env is correct. The API will answer 503 until it is."
    )
  );

// A forgotten promise should be loud in the log, not silently kill the process.
process.on("unhandledRejection", (reason) => console.error("Unhandled rejection:", reason));

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
