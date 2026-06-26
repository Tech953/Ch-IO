import app from "./app";
import { logger } from "./lib/logger";
import { startEngramEngine, stopEngramEngine } from "./services/engram-engine";

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

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startEngramEngine();
});

function shutdown(signal: string): void {
  logger.info({ signal }, "Shutting down");
  stopEngramEngine();
  server.close(() => process.exit(0));
  // Force-exit if connections do not drain promptly.
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
