import express from "express";
import { timingSafeEqual } from "node:crypto";
import { initializeSchema, closeDb } from "./db.js";
import routes from "./routes.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);
const PROXY_AUTH_HEADER = "x-garden-proxy-auth";
const GATEWAY_IDENTITY_HEADER = (
  process.env.GARDEN_AUTH_IDENTITY_HEADER || "x-garden-user"
)
  .trim()
  .toLowerCase();
const PROXY_AUTH_TOKEN = process.env.GARDEN_PROXY_AUTH_TOKEN?.trim();
const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const CORS_ALLOWED_ORIGINS = new Set(configuredOrigins);

if (!PROXY_AUTH_TOKEN) {
  console.error(
    "[AUTH] Missing GARDEN_PROXY_AUTH_TOKEN. Refusing to start in fail-closed mode.",
  );
  process.exit(1);
}

function safeTokenEqual(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function isAllowedOrigin(req: express.Request, origin: string): boolean {
  try {
    const originUrl = new URL(origin);
    const forwardedHost = req.get("x-forwarded-host");
    const requestHost = (forwardedHost || req.get("host") || "").toLowerCase();

    if (requestHost && originUrl.host.toLowerCase() === requestHost) {
      return true;
    }
  } catch {
    return false;
  }

  return CORS_ALLOWED_ORIGINS.has(origin);
}

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function (data: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const logColor =
      statusCode >= 500
        ? "\x1b[31m"
        : statusCode >= 400
          ? "\x1b[33m"
          : "\x1b[32m";
    const resetColor = "\x1b[0m";
    console.log(
      `${logColor}[${statusCode}]${resetColor} ${req.method} ${req.path} (${duration}ms)`,
    );
    return originalSend.call(this, data);
  };

  next();
});

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// CORS headers (same-origin by default; optional allowlist via env)
app.use((req, res, next) => {
  const origin = req.get("origin");

  if (origin) {
    if (!isAllowedOrigin(req, origin)) {
      res.status(403).json({ error: "CORS origin denied" });
      return;
    }

    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
  }

  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Require proxy auth token for all API requests.
app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) {
    next();
    return;
  }

  if (req.method === "OPTIONS") {
    next();
    return;
  }

  const providedToken = req.get(PROXY_AUTH_HEADER);
  if (!providedToken || !safeTokenEqual(providedToken, PROXY_AUTH_TOKEN)) {
    res
      .status(401)
      .json({ error: "Unauthorized", reason: "invalid_proxy_auth" });
    return;
  }

  const authenticatedUser = req.get(GATEWAY_IDENTITY_HEADER)?.trim();
  if (!authenticatedUser) {
    res
      .status(401)
      .json({ error: "Unauthorized", reason: "missing_gateway_identity" });
    return;
  }

  next();
});

// Initialize database schema
console.log("[DB] Initializing database schema...");
initializeSchema();
console.log("[DB] ✓ Database schema initialized");

// Health check
app.get("/health", (req, res) => {
  console.log("[HEALTH] Health check request");
  res.json({ status: "ok" });
});

// API routes
app.use("/api", routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  },
);

// Start server
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `\n🌱 Garden Planner backend listening on http://0.0.0.0:${PORT}\n`,
  );
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    closeDb();
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => {
    closeDb();
    process.exit(0);
  });
});
