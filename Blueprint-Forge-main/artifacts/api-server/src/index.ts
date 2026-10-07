import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from workspace root when running locally
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // From dist/ → api-server/ → artifacts/ → workspace root
  const candidates = [
    resolve(__dirname, "../../../.env"),   // from dist/
    resolve(__dirname, "../../../../.env"), // fallback
    resolve(process.cwd(), ".env"),         // from cwd
  ];
  for (const envPath of candidates) {
    try {
      const envFile = readFileSync(envPath, "utf-8");
      for (const line of envFile.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (key && !(key in process.env)) {
          process.env[key] = val;
        }
      }
      break; // loaded successfully
    } catch {
      // try next candidate
    }
  }
} catch {
  // .env not found — rely on environment variables already set
}

import app from "./app";
import { logger } from "./lib/logger";

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
});
