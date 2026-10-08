#!/usr/bin/env node
/**
 * Start the backend for local development.
 *
 * The backend is fail-closed: it refuses to start without a proxy auth token
 * and rejects API calls lacking a gateway identity. In production nginx injects
 * both; in development the Vite proxy does (see vite.config.ts). This script
 * supplies the matching dev token and binds the backend to loopback so the
 * well-known token is never reachable from the network.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEV_PROXY_AUTH_TOKEN } from "./dev-auth.mjs";

const backendDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "backend",
);

const child = spawn(process.execPath, ["dist/server.js"], {
  cwd: backendDir,
  stdio: "inherit",
  env: {
    ...process.env,
    GARDEN_PROXY_AUTH_TOKEN:
      process.env.GARDEN_PROXY_AUTH_TOKEN || DEV_PROXY_AUTH_TOKEN,
    GARDEN_BIND_HOST: process.env.GARDEN_BIND_HOST || "127.0.0.1",
  },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 0));
