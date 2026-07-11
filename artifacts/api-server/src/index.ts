import app from "./app";
import { logger } from "./lib/logger";
import { startCreditCron } from "./services/vton/creditCron";
import { seedDefaultPackages } from "./services/creditService";

// ── Global crash guards ───────────────────────────────────────────────────────
// These prevent the process from silently dying on unhandled async errors.
// Log first so we have a record, then exit so the process manager can restart.
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection — shutting down");
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — shutting down");
  process.exit(1);
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Seed credit packages (no-op if rows already exist) and start hourly balance cron.
  void seedDefaultPackages().catch(e => logger.error({ e }, "Failed to seed credit packages"));
  startCreditCron();
});
