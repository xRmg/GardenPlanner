import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "./db.js";
import {
  APP_MODE,
  SESSION_COOKIE_NAME,
  buildPasswordHash,
  getSessionCookieOptions,
  getSessionTokenFromRequest,
  hashOpaqueToken,
  issueOneTimeToken,
  issueSession,
  isTokenPreviewEnabled,
  normalizeEmail,
  revokeAllSessionsForUser,
  revokeSessionByToken,
  toPublicUser,
  verifyPassword,
  type RequestContext,
  type WorkspaceRole,
} from "./auth.js";

const router = Router();
const DEFAULT_MODEL = "google/gemini-2.0-flash";

type PreferredAiMode = "none" | "own-key" | "managed";

type StoredAiProvider = { type: "none" } | { type: "byok"; key: string };

interface FrontendSettingsDto {
  location: string;
  growthZone: string;
  aiProvider: { type: "none" } | { type: "server" };
  aiModel: string;
  locale: string;
  lat?: number;
  lng?: number;
  aiLastValidatedAt?: string;
  aiValidationError?: string;
  profileId: string;
  workspaceId?: string;
  workspaceName?: string;
  preferredAiMode: PreferredAiMode;
  onboardingCompletedAt?: string;
}

interface SettingsUpdate {
  location?: string;
  growthZone?: string;
  aiProvider?: StoredAiProvider;
  aiModel?: string;
  locale?: string;
  lat?: number | null;
  lng?: number | null;
  aiLastValidatedAt?: string | null;
  aiValidationError?: string | null;
  profileId?: string;
  workspaceId?: string | null;
  preferredAiMode?: PreferredAiMode;
  onboardingCompletedAt?: string | null;
}

interface AuthUserRow {
  id: string;
  email: string;
  email_normalized: string;
  password_hash: string;
  email_verified_at: string | null;
  locale: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkspaceMembershipRow {
  id: string;
  name: string;
  role: WorkspaceRole;
  created_at: string;
  updated_at: string;
}

const StoredAiProviderSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("byok"), key: z.string().min(1) }),
]);

const PreferredAiModeSchema = z.enum(["none", "own-key", "managed"]);

const SettingsPatchRequestSchema = z
  .object({
    growthZone: z.string().max(20).optional(),
    aiModel: z.string().max(200).optional(),
    locale: z.string().max(20).optional(),
    preferredAiMode: PreferredAiModeSchema.optional(),
  })
  .strict();

const AiKeyRequestSchema = z.object({
  key: z.string().min(1).max(500),
});

const ResolveLocationRequestSchema = z.object({
  query: z.string().min(1).max(200),
});

const AuthSignUpRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(200),
  locale: z.string().max(20).optional(),
});

const AuthSignInRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

const VerifyEmailRequestSchema = z.object({
  token: z.string().min(1).max(300),
});

const RecoveryRequestSchema = z.object({
  email: z.string().email(),
});

const RecoveryConfirmRequestSchema = z.object({
  token: z.string().min(1).max(300),
  password: z.string().min(10).max(200),
});

const OnboardingRequestSchema = z.object({
  workspaceName: z.string().min(1).max(120),
  locationQuery: z.string().min(1).max(200),
  preferredAiMode: PreferredAiModeSchema,
});

const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(32_000),
});

const AiChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(50),
  model: z.string().max(200).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(32_768).optional(),
});

interface GardenData {
  areas: Array<{
    id: string;
    name: string;
    tagline?: string;
    backgroundColor?: string;
    profileId: string;
    planters: Array<{
      id: string;
      name: string;
      rows: number;
      cols: number;
      backgroundColor?: string;
      tagline?: string;
      virtualSections: unknown[];
      squares?: unknown[][];
    }>;
  }>;
  plants: unknown[];
  seedlings: unknown[];
  events: unknown[];
}

function getRequestContext(res: Response): RequestContext {
  return res.locals.gardenContext as RequestContext;
}

function setNoStoreHeaders(res: Response): void {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
}

function parseStoredAiProvider(raw: string | null | undefined): StoredAiProvider {
  try {
    const parsed = StoredAiProviderSchema.safeParse(
      JSON.parse(raw || '{"type":"none"}'),
    );
    return parsed.success ? parsed.data : { type: "none" };
  } catch {
    return { type: "none" };
  }
}

function formatSettingsForLog(settings: FrontendSettingsDto): string {
  const location = settings.location || "-";
  const aiConfigured = settings.aiProvider.type === "server" ? "yes" : "no";
  const workspace = settings.workspaceName ?? settings.workspaceId ?? "-";
  return `location="${location}" zone=${settings.growthZone} model=${settings.aiModel} ai=${aiConfigured} workspace=${workspace}`;
}

function assertHostedMode(res: Response): boolean {
  if (APP_MODE !== "hosted") {
    res.status(404).json({ error: "Hosted auth is disabled in local mode." });
    return false;
  }
  return true;
}

function getSettingsRowId(context: RequestContext): string {
  return context.appMode === "hosted" ? context.userId : "default";
}

function slugifyWorkspaceName(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "garden";
}

function ensureUniqueWorkspaceSlug(baseName: string): string {
  const db = getDb();
  const baseSlug = slugifyWorkspaceName(baseName);
  let candidate = baseSlug;
  let suffix = 1;

  while (
    db.prepare("SELECT 1 FROM workspaces WHERE slug = ?").get(candidate)
  ) {
    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }

  return candidate;
}

function readWorkspaceForUser(userId: string): WorkspaceMembershipRow | null {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT w.id, w.name, wm.role, w.created_at, w.updated_at
        FROM workspace_memberships wm
        JOIN workspaces w ON w.id = wm.workspace_id
        WHERE wm.user_id = ?
        ORDER BY CASE wm.role WHEN 'owner' THEN 0 ELSE 1 END, w.created_at ASC
        LIMIT 1
      `,
    )
    .get(userId) as WorkspaceMembershipRow | undefined;

  return row ?? null;
}

function toWorkspaceSummary(
  workspace: WorkspaceMembershipRow | null,
): RequestContext["workspace"] {
  if (!workspace) return null;
  return {
    id: workspace.id,
    name: workspace.name,
    role: workspace.role,
    createdAt: workspace.created_at,
    updatedAt: workspace.updated_at,
  };
}

function ensureSettingsRow(
  context: RequestContext,
  localeFallback?: string,
): Record<string, unknown> {
  const db = getDb();
  const settingsId = getSettingsRowId(context);
  const existing = db
    .prepare("SELECT * FROM settings WHERE id = ?")
    .get(settingsId) as Record<string, unknown> | undefined;

  if (existing) {
    return existing;
  }

  db.prepare(
    `
      INSERT INTO settings (
        id,
        profileId,
        userId,
        workspaceId,
        locale,
        preferredAiMode
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
  ).run(
    settingsId,
    context.profileId,
    context.userId,
    context.workspaceId,
    localeFallback || context.user?.locale || "en",
    "own-key",
  );

  return (
    db.prepare("SELECT * FROM settings WHERE id = ?").get(settingsId) as Record<
      string,
      unknown
    >
  );
}

function sanitizeSettingsRow(
  row: Record<string, unknown>,
  workspaceName?: string,
): FrontendSettingsDto {
  const rawAiProvider = parseStoredAiProvider(
    typeof row.aiProvider === "string" ? row.aiProvider : undefined,
  );
  const preferredAiMode =
    row.preferredAiMode === "none" ||
    row.preferredAiMode === "own-key" ||
    row.preferredAiMode === "managed"
      ? (row.preferredAiMode as PreferredAiMode)
      : "own-key";

  return {
    location: typeof row.location === "string" ? row.location : "",
    growthZone: typeof row.growthZone === "string" ? row.growthZone : "Cfb",
    aiProvider:
      rawAiProvider.type === "byok" ? { type: "server" } : { type: "none" },
    aiModel: typeof row.aiModel === "string" ? row.aiModel : DEFAULT_MODEL,
    locale: typeof row.locale === "string" ? row.locale : "en",
    lat: typeof row.lat === "number" ? row.lat : undefined,
    lng: typeof row.lng === "number" ? row.lng : undefined,
    aiLastValidatedAt:
      typeof row.aiLastValidatedAt === "string"
        ? row.aiLastValidatedAt
        : undefined,
    aiValidationError:
      typeof row.aiValidationError === "string"
        ? row.aiValidationError
        : undefined,
    profileId: typeof row.profileId === "string" ? row.profileId : "default",
    workspaceId:
      typeof row.workspaceId === "string" && row.workspaceId.length > 0
        ? row.workspaceId
        : undefined,
    workspaceName,
    preferredAiMode,
    onboardingCompletedAt:
      typeof row.onboardingCompletedAt === "string"
        ? row.onboardingCompletedAt
        : undefined,
  };
}

function readFrontendSettings(context: RequestContext): FrontendSettingsDto {
  const row = ensureSettingsRow(context);
  const workspaceName = context.workspace?.name ?? undefined;
  return sanitizeSettingsRow(row, workspaceName);
}

function applySettingsUpdate(
  context: RequestContext,
  patch: SettingsUpdate,
): FrontendSettingsDto {
  const db = getDb();
  const current = ensureSettingsRow(context);
  const settingsId = getSettingsRowId(context);
  const nextPreferredAiMode = patch.preferredAiMode ??
    (current.preferredAiMode === "none" ||
    current.preferredAiMode === "own-key" ||
    current.preferredAiMode === "managed"
      ? (current.preferredAiMode as PreferredAiMode)
      : "own-key");

  const currentAiProvider =
    typeof current.aiProvider === "string"
      ? current.aiProvider
      : '{"type":"none"}';

  const nextAiProvider =
    patch.aiProvider !== undefined
      ? JSON.stringify(patch.aiProvider)
      : nextPreferredAiMode === "own-key"
        ? currentAiProvider
        : JSON.stringify({ type: "none" });

  const nextAiLastValidatedAt =
    patch.aiLastValidatedAt !== undefined
      ? patch.aiLastValidatedAt
      : nextPreferredAiMode === "own-key"
        ? typeof current.aiLastValidatedAt === "string"
          ? current.aiLastValidatedAt
          : null
        : null;

  const nextAiValidationError =
    patch.aiValidationError !== undefined
      ? patch.aiValidationError
      : nextPreferredAiMode === "own-key"
        ? typeof current.aiValidationError === "string"
          ? current.aiValidationError
          : null
        : null;

  db.prepare(
    `
      UPDATE settings
      SET location = ?,
          growthZone = ?,
          aiProvider = ?,
          aiModel = ?,
          locale = ?,
          lat = ?,
          lng = ?,
          aiLastValidatedAt = ?,
          aiValidationError = ?,
          profileId = ?,
          userId = ?,
          workspaceId = ?,
          preferredAiMode = ?,
          onboardingCompletedAt = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(
    patch.location !== undefined
      ? patch.location
      : typeof current.location === "string"
        ? current.location
        : "",
    patch.growthZone !== undefined
      ? patch.growthZone
      : typeof current.growthZone === "string"
        ? current.growthZone
        : "Cfb",
    nextAiProvider,
    patch.aiModel !== undefined
      ? patch.aiModel
      : typeof current.aiModel === "string"
        ? current.aiModel
        : DEFAULT_MODEL,
    patch.locale !== undefined
      ? patch.locale
      : typeof current.locale === "string"
        ? current.locale
        : "en",
    patch.lat !== undefined
      ? patch.lat
      : typeof current.lat === "number"
        ? current.lat
        : null,
    patch.lng !== undefined
      ? patch.lng
      : typeof current.lng === "number"
        ? current.lng
        : null,
    nextAiLastValidatedAt,
    nextAiValidationError,
    patch.profileId !== undefined
      ? patch.profileId
      : typeof current.profileId === "string"
        ? current.profileId
        : context.profileId,
    context.userId,
    patch.workspaceId !== undefined
      ? patch.workspaceId
      : typeof current.workspaceId === "string"
        ? current.workspaceId
        : context.workspaceId,
    nextPreferredAiMode,
    patch.onboardingCompletedAt !== undefined
      ? patch.onboardingCompletedAt
      : typeof current.onboardingCompletedAt === "string"
        ? current.onboardingCompletedAt
        : null,
    settingsId,
  );

  const updated = db
    .prepare("SELECT * FROM settings WHERE id = ?")
    .get(settingsId) as Record<string, unknown>;
  return sanitizeSettingsRow(updated, context.workspace?.name ?? undefined);
}

function buildAuthSessionPayload(context: RequestContext): {
  mode: "hosted";
  user: ReturnType<typeof toPublicUser>;
  workspace: RequestContext["workspace"];
  onboarding: { completed: boolean };
} {
  const frontendSettings = readFrontendSettings(context);
  return {
    mode: "hosted",
    user: context.user!,
    workspace: context.workspace,
    onboarding: {
      completed:
        Boolean(frontendSettings.onboardingCompletedAt) &&
        Boolean(context.workspaceId),
    },
  };
}

function requireAuthenticatedContext(context: RequestContext, res: Response): boolean {
  if (!context.isAuthenticated) {
    res.status(401).json({ error: "Authentication required." });
    return false;
  }
  return true;
}

function requireVerifiedHostedContext(
  context: RequestContext,
  res: Response,
): boolean {
  if (!requireAuthenticatedContext(context, res)) return false;
  if (context.appMode === "hosted" && !context.user?.isEmailVerified) {
    res.status(403).json({ error: "Verify your email before continuing." });
    return false;
  }
  return true;
}

function classifyKoppen(T: number[], P: number[], lat: number): string {
  const Tann = T.reduce((a, b) => a + b, 0) / 12;
  const Pann = P.reduce((a, b) => a + b, 0);
  const Tmax = Math.max(...T);
  const Tmin = Math.min(...T);

  const isNH = lat >= 0;
  const summerIdx = isNH ? [3, 4, 5, 6, 7, 8] : [9, 10, 11, 0, 1, 2];
  const winterIdx = isNH ? [9, 10, 11, 0, 1, 2] : [3, 4, 5, 6, 7, 8];
  const Psummer = summerIdx.reduce((s, m) => s + P[m], 0);
  const Pwinter = winterIdx.reduce((s, m) => s + P[m], 0);

  let Pth: number;
  if (Pann > 0 && Psummer / Pann >= 0.7) Pth = 20 * (Tann + 14);
  else if (Pann > 0 && Pwinter / Pann >= 0.7) Pth = 20 * Tann;
  else Pth = 20 * (Tann + 7);

  if (Tmax <= 10) return Tmax <= 0 ? "EF" : "ET";
  if (Pann < 2 * Pth) {
    const sub = Tann >= 18 ? "h" : "k";
    return Pann < Pth ? `BW${sub}` : `BS${sub}`;
  }
  if (Tmin >= 18) {
    const Pdry = Math.min(...P);
    if (Pdry >= 60) return "Af";
    if (Pdry >= 100 - Pann / 25) return "Am";
    return "Aw";
  }

  const prefix = Tmin <= -3 ? "D" : "C";
  const Psdry = Math.min(...summerIdx.map((m) => P[m]));
  const Pwdry = Math.min(...winterIdx.map((m) => P[m]));
  const Pswet = Math.max(...summerIdx.map((m) => P[m]));
  const Pwwet = Math.max(...winterIdx.map((m) => P[m]));
  let dry: string;
  if (Psdry < 40 && Psdry < Pwwet / 3) dry = "s";
  else if (Pwdry < Pswet / 10) dry = "w";
  else dry = "f";

  const monthsOver10 = T.filter((t) => t >= 10).length;
  let sub: string;
  if (Tmax >= 22) sub = "a";
  else if (monthsOver10 >= 4) sub = "b";
  else if (prefix === "D" && Tmin < -38) sub = "d";
  else sub = "c";

  return `${prefix}${dry}${sub}`;
}

async function fetchKoppenZone(lat: number, lon: number): Promise<string> {
  const endYear = new Date().getFullYear() - 1;
  const startYear = endYear - 9;
  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lat}&longitude=${lon}` +
    `&start_date=${startYear}-01-01&end_date=${endYear}-12-31` +
    `&daily=temperature_2m_mean,precipitation_sum&timezone=auto`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Meteo archive ${response.status}`);
  const json = (await response.json()) as {
    daily: {
      time: string[];
      temperature_2m_mean: Array<number | null>;
      precipitation_sum: Array<number | null>;
    };
  };

  const { time, temperature_2m_mean, precipitation_sum } = json.daily;
  const ymTemp: Record<string, number[]> = {};
  const ymPrecip: Record<string, number[]> = {};

  for (let index = 0; index < time.length; index += 1) {
    const key = time[index].slice(0, 7);
    const temperature = temperature_2m_mean[index];
    const precipitation = precipitation_sum[index];
    if (temperature !== null) (ymTemp[key] ??= []).push(temperature);
    if (precipitation !== null) (ymPrecip[key] ??= []).push(precipitation);
  }

  const monthTemp: number[][] = Array.from({ length: 12 }, () => []);
  const monthPrecip: number[][] = Array.from({ length: 12 }, () => []);

  for (const [key, values] of Object.entries(ymTemp)) {
    const monthIndex = parseInt(key.slice(5), 10) - 1;
    monthTemp[monthIndex].push(
      values.reduce((sum, value) => sum + value, 0) / values.length,
    );
  }

  for (const [key, values] of Object.entries(ymPrecip)) {
    const monthIndex = parseInt(key.slice(5), 10) - 1;
    monthPrecip[monthIndex].push(values.reduce((sum, value) => sum + value, 0));
  }

  const T = monthTemp.map((values) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
  );
  const P = monthPrecip.map((values) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
  );

  if (T.every((value) => value === 0) && P.every((value) => value === 0)) {
    throw new Error("No climate data returned");
  }

  return classifyKoppen(T, P, lat);
}

async function geocodeLocation(query: string): Promise<{
  displayName: string;
  latitude: number;
  longitude: number;
}> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Meteo Geocoding ${response.status}`);
  const json = (await response.json()) as {
    results?: Array<{
      latitude: number;
      longitude: number;
      name: string;
      admin1?: string;
      country?: string;
    }>;
  };

  if (!Array.isArray(json.results) || json.results.length === 0) {
    throw new Error(
      "Location not found. Try a different city name or add a country (e.g. 'Paris, France').",
    );
  }

  const { latitude, longitude, name, admin1, country } = json.results[0];
  return {
    displayName: [name, admin1, country].filter(Boolean).join(", "),
    latitude,
    longitude,
  };
}

async function validateOpenRouterKey(key: string): Promise<void> {
  const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (response.status === 401) {
    throw new Error("Invalid API key — check your key at openrouter.ai.");
  }
  if (!response.ok) {
    throw new Error(`OpenRouter returned status ${response.status}. Try again later.`);
  }
}

function parseAndValidate<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
  res: Response,
  label: string,
): T | null {
  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    res.status(400).json({ error: `Invalid ${label}: ${issues}` });
    return null;
  }
  return parseResult.data;
}

router.post("/auth/sign-up", (req: Request, res: Response) => {
  if (!assertHostedMode(res)) return;
  const payload = parseAndValidate(AuthSignUpRequestSchema, req.body, res, "sign-up payload");
  if (!payload) return;

  const db = getDb();
  const normalizedEmail = normalizeEmail(payload.email);
  const existing = db
    .prepare("SELECT * FROM users WHERE email_normalized = ?")
    .get(normalizedEmail) as AuthUserRow | undefined;

  if (existing) {
    res.status(409).json({ error: "An account already exists for that email." });
    return;
  }

  const userId = randomUUID();
  db.prepare(
    `
      INSERT INTO users (
        id,
        email,
        email_normalized,
        password_hash,
        locale,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
  ).run(userId, payload.email.trim(), normalizedEmail, buildPasswordHash(payload.password), payload.locale ?? "en");

  db.prepare(
    `
      INSERT INTO settings (
        id,
        profileId,
        userId,
        workspaceId,
        locale,
        preferredAiMode
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
  ).run(userId, userId, userId, null, payload.locale ?? "en", "own-key");

  const delivery = issueOneTimeToken(db, userId, "verification");

  res.status(201).json({
    requiresEmailVerification: true,
    delivery: isTokenPreviewEnabled()
      ? {
          channel: "preview",
          token: delivery.token,
          expiresAt: delivery.expiresAt,
        }
      : undefined,
  });
});

router.post("/auth/verify-email", (req: Request, res: Response) => {
  if (!assertHostedMode(res)) return;
  const payload = parseAndValidate(VerifyEmailRequestSchema, req.body, res, "verification payload");
  if (!payload) return;

  const db = getDb();
  const tokenHash = hashOpaqueToken(payload.token);
  const match = db
    .prepare(
      `
        SELECT u.*
        FROM auth_verification_tokens vt
        JOIN users u ON u.id = vt.user_id
        WHERE vt.token_hash = ?
          AND vt.consumed_at IS NULL
          AND datetime(vt.expires_at) > datetime('now')
        LIMIT 1
      `,
    )
    .get(tokenHash) as AuthUserRow | undefined;

  if (!match) {
    res.status(400).json({ error: "That verification token is invalid or expired." });
    return;
  }

  db.prepare(
    `
      UPDATE users
      SET email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(match.id);
  db.prepare(
    `
      UPDATE auth_verification_tokens
      SET consumed_at = CURRENT_TIMESTAMP
      WHERE token_hash = ?
    `,
  ).run(tokenHash);

  const session = issueSession(db, match.id);
  res.cookie(
    SESSION_COOKIE_NAME,
    session.token,
    getSessionCookieOptions(new Date(session.expiresAt)),
  );
  const context = getRequestContext(res);
  const workspace = readWorkspaceForUser(match.id);
  const hostedContext: RequestContext = {
    ...context,
    appMode: "hosted",
    isAuthenticated: true,
    userId: match.id,
    profileId: match.id,
    workspaceId: workspace?.id ?? null,
    workspaceRole: workspace?.role ?? null,
    user: toPublicUser({
      userId: match.id,
      email: match.email,
      locale: match.locale,
      emailVerifiedAt: new Date().toISOString(),
      createdAt: match.created_at,
      updatedAt: new Date().toISOString(),
    }),
    workspace: toWorkspaceSummary(workspace),
  };

  res.json({ success: true, session: buildAuthSessionPayload(hostedContext) });
});

router.post("/auth/sign-in", (req: Request, res: Response) => {
  if (!assertHostedMode(res)) return;
  const payload = parseAndValidate(AuthSignInRequestSchema, req.body, res, "sign-in payload");
  if (!payload) return;

  const db = getDb();
  const normalizedEmail = normalizeEmail(payload.email);
  const user = db
    .prepare("SELECT * FROM users WHERE email_normalized = ?")
    .get(normalizedEmail) as AuthUserRow | undefined;

  if (!user || !verifyPassword(payload.password, user.password_hash)) {
    res.status(401).json({ error: "Incorrect email or password." });
    return;
  }

  if (!user.email_verified_at) {
    const delivery = issueOneTimeToken(db, user.id, "verification");
    res.status(403).json({
      error: "Verify your email before signing in.",
      requiresEmailVerification: true,
      delivery: isTokenPreviewEnabled()
        ? {
            channel: "preview",
            token: delivery.token,
            expiresAt: delivery.expiresAt,
          }
        : undefined,
    });
    return;
  }

  const session = issueSession(db, user.id);
  res.cookie(SESSION_COOKIE_NAME, session.token, getSessionCookieOptions(new Date(session.expiresAt)));

  const workspace = readWorkspaceForUser(user.id);
  const context: RequestContext = {
    appMode: "hosted",
    isAuthenticated: true,
    userId: user.id,
    profileId: user.id,
    workspaceId: workspace?.id ?? null,
    workspaceRole: workspace?.role ?? null,
    user: toPublicUser({
      userId: user.id,
      email: user.email,
      locale: user.locale,
      emailVerifiedAt: user.email_verified_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }),
    workspace: workspace
      ? {
          id: workspace.id,
          name: workspace.name,
          role: workspace.role,
          createdAt: workspace.created_at,
          updatedAt: workspace.updated_at,
        }
      : null,
  };

  res.json({ success: true, session: buildAuthSessionPayload(context) });
});

router.post("/auth/sign-out", (req: Request, res: Response) => {
  const db = getDb();
  const rawToken = getSessionTokenFromRequest(req);
  revokeSessionByToken(db, rawToken);
  res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions(new Date(0)));
  res.json({ success: true });
});

router.post("/auth/recovery/request", (req: Request, res: Response) => {
  if (!assertHostedMode(res)) return;
  const payload = parseAndValidate(RecoveryRequestSchema, req.body, res, "recovery payload");
  if (!payload) return;

  const db = getDb();
  const normalizedEmail = normalizeEmail(payload.email);
  const user = db
    .prepare("SELECT * FROM users WHERE email_normalized = ?")
    .get(normalizedEmail) as AuthUserRow | undefined;

  if (!user) {
    res.json({ success: true });
    return;
  }

  const delivery = issueOneTimeToken(db, user.id, "recovery");
  res.json({
    success: true,
    delivery: isTokenPreviewEnabled()
      ? {
          channel: "preview",
          token: delivery.token,
          expiresAt: delivery.expiresAt,
        }
      : undefined,
  });
});

router.post("/auth/recovery/confirm", (req: Request, res: Response) => {
  if (!assertHostedMode(res)) return;
  const payload = parseAndValidate(RecoveryConfirmRequestSchema, req.body, res, "recovery confirmation payload");
  if (!payload) return;

  const db = getDb();
  const tokenHash = hashOpaqueToken(payload.token);
  const user = db
    .prepare(
      `
        SELECT u.*
        FROM auth_recovery_tokens rt
        JOIN users u ON u.id = rt.user_id
        WHERE rt.token_hash = ?
          AND rt.consumed_at IS NULL
          AND datetime(rt.expires_at) > datetime('now')
        LIMIT 1
      `,
    )
    .get(tokenHash) as AuthUserRow | undefined;

  if (!user) {
    res.status(400).json({ error: "That recovery token is invalid or expired." });
    return;
  }

  db.prepare(
    `
      UPDATE users
      SET password_hash = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(buildPasswordHash(payload.password), user.id);
  db.prepare(
    `
      UPDATE auth_recovery_tokens
      SET consumed_at = CURRENT_TIMESTAMP
      WHERE token_hash = ?
    `,
  ).run(tokenHash);
  revokeAllSessionsForUser(db, user.id);

  if (!user.email_verified_at) {
    const delivery = issueOneTimeToken(db, user.id, "verification");
    res.status(403).json({
      error: "Verify your email before signing in.",
      requiresEmailVerification: true,
      delivery: isTokenPreviewEnabled()
        ? {
            channel: "preview",
            token: delivery.token,
            expiresAt: delivery.expiresAt,
          }
        : undefined,
    });
    return;
  }

  const session = issueSession(db, user.id);
  res.cookie(SESSION_COOKIE_NAME, session.token, getSessionCookieOptions(new Date(session.expiresAt)));
  res.json({ success: true });
});

router.get("/auth/me", (req: Request, res: Response) => {
  if (!assertHostedMode(res)) return;
  const context = getRequestContext(res);
  if (!requireVerifiedHostedContext(context, res)) return;

  ensureSettingsRow(context, context.user?.locale);
  const workspace = context.workspace ?? toWorkspaceSummary(readWorkspaceForUser(context.userId));
  res.json(buildAuthSessionPayload({
    ...context,
    workspace,
  }));
});

router.post("/onboarding/complete", async (req: Request, res: Response) => {
  if (!assertHostedMode(res)) return;
  const context = getRequestContext(res);
  if (!requireVerifiedHostedContext(context, res)) return;
  const payload = parseAndValidate(OnboardingRequestSchema, req.body, res, "onboarding payload");
  if (!payload) return;

  try {
    const { displayName, latitude, longitude } = await geocodeLocation(payload.locationQuery);
    let growthZone = "Cfb";
    try {
      growthZone = await fetchKoppenZone(latitude, longitude);
    } catch {
      // Keep a valid location even if climate lookup fails.
    }

    const db = getDb();
    const existingWorkspace = readWorkspaceForUser(context.userId);
    let workspaceId = existingWorkspace?.id ?? null;

    if (!workspaceId) {
      workspaceId = randomUUID();
      const slug = ensureUniqueWorkspaceSlug(payload.workspaceName);
      db.prepare(
        `
          INSERT INTO workspaces (id, owner_user_id, name, slug)
          VALUES (?, ?, ?, ?)
        `,
      ).run(workspaceId, context.userId, payload.workspaceName.trim(), slug);
      db.prepare(
        `
          INSERT INTO workspace_memberships (workspace_id, user_id, role)
          VALUES (?, ?, 'owner')
        `,
      ).run(workspaceId, context.userId);
    } else {
      db.prepare(
        `
          UPDATE workspaces
          SET name = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
      ).run(payload.workspaceName.trim(), workspaceId);
    }

    const settings = applySettingsUpdate(
      {
        ...context,
        workspaceId,
        workspaceRole: "owner",
        workspace: {
          id: workspaceId,
          name: payload.workspaceName.trim(),
          role: "owner",
          createdAt: existingWorkspace?.created_at ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      {
        location: displayName,
        lat: latitude,
        lng: longitude,
        growthZone,
        workspaceId,
        preferredAiMode: payload.preferredAiMode,
        onboardingCompletedAt: new Date().toISOString(),
        aiProvider:
          payload.preferredAiMode === "own-key"
            ? undefined
            : { type: "none" },
        aiLastValidatedAt: payload.preferredAiMode === "own-key" ? undefined : null,
        aiValidationError: payload.preferredAiMode === "own-key" ? undefined : null,
      },
    );

    res.json({
      success: true,
      workspaceId,
      settings,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to complete onboarding.";
    res.status(400).json({ error: message });
  }
});

router.get("/settings", (req: Request, res: Response) => {
  setNoStoreHeaders(res);
  const context = getRequestContext(res);
  if (!requireVerifiedHostedContext(context, res)) return;

  try {
    const settings = readFrontendSettings({
      ...context,
      workspace: context.workspace ?? toWorkspaceSummary(readWorkspaceForUser(context.userId)),
    });
    console.log(`[API:GET /settings] ${formatSettingsForLog(settings)}`);
    res.json(settings);
  } catch (error) {
    console.error("[API:GET /settings] Error fetching settings:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.patch("/settings", (req: Request, res: Response) => {
  const context = getRequestContext(res);
  if (!requireVerifiedHostedContext(context, res)) return;
  const payload = parseAndValidate(SettingsPatchRequestSchema, req.body, res, "settings patch");
  if (!payload) return;

  try {
    const settings = applySettingsUpdate(context, payload);
    console.log(`[API:PATCH /settings] ${formatSettingsForLog(settings)}`);
    res.json(settings);
  } catch (error) {
    console.error("[API:PATCH /settings] Error saving settings:", error);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

router.post("/settings/ai-key", async (req: Request, res: Response) => {
  const context = getRequestContext(res);
  if (!requireVerifiedHostedContext(context, res)) return;
  const payload = parseAndValidate(AiKeyRequestSchema, req.body, res, "AI key payload");
  if (!payload) return;

  try {
    await validateOpenRouterKey(payload.key);
    const settings = applySettingsUpdate(context, {
      aiProvider: { type: "byok", key: payload.key },
      aiLastValidatedAt: new Date().toISOString(),
      aiValidationError: null,
      preferredAiMode: "own-key",
    });
    console.log(`[API:POST /settings/ai-key] ${formatSettingsForLog(settings)}`);
    res.json(settings);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to validate API key.";
    res.status(400).json({ error: message });
  }
});

router.delete("/settings/ai-key", (req: Request, res: Response) => {
  const context = getRequestContext(res);
  if (!requireVerifiedHostedContext(context, res)) return;

  try {
    const settings = applySettingsUpdate(context, {
      aiProvider: { type: "none" },
      aiLastValidatedAt: null,
      aiValidationError: null,
    });
    console.log(`[API:DELETE /settings/ai-key] ${formatSettingsForLog(settings)}`);
    res.json(settings);
  } catch (error) {
    console.error("[API:DELETE /settings/ai-key] Error clearing key:", error);
    res.status(500).json({ error: "Failed to clear AI key" });
  }
});

router.post("/settings/location/resolve", async (req: Request, res: Response) => {
  const context = getRequestContext(res);
  if (!requireVerifiedHostedContext(context, res)) return;
  const payload = parseAndValidate(ResolveLocationRequestSchema, req.body, res, "location payload");
  if (!payload) return;

  try {
    const { displayName, latitude, longitude } = await geocodeLocation(payload.query);
    let growthZone = "Cfb";
    try {
      growthZone = await fetchKoppenZone(latitude, longitude);
    } catch {
      // keep resolved location even if the climate lookup fails
    }

    const settings = applySettingsUpdate(context, {
      location: displayName,
      lat: latitude,
      lng: longitude,
      growthZone,
    });
    console.log(
      `[API:POST /settings/location/resolve] query="${payload.query}" ${formatSettingsForLog(settings)}`,
    );
    res.json(settings);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify location.";
    res.status(400).json({ error: message });
  }
});

router.get("/garden", (req: Request, res: Response) => {
  setNoStoreHeaders(res);
  const context = getRequestContext(res);
  if (!requireVerifiedHostedContext(context, res)) return;

  if (!context.workspaceId) {
    res.json({ areas: [], plants: [], seedlings: [], events: [] } satisfies GardenData);
    return;
  }

  try {
    const db = getDb();
    const plants = db
      .prepare("SELECT * FROM plants WHERE workspaceId = ? ORDER BY created_at")
      .all(context.workspaceId)
      .map((row: any) => ({
        id: row.id,
        name: row.name,
        color: row.color,
        icon: row.icon,
        latinName: row.latinName || undefined,
        description: row.description || undefined,
        variety: row.variety || undefined,
        daysToHarvest: row.daysToHarvest || undefined,
        isSeed: row.isSeed === 1,
        amount: row.amount === -1 ? undefined : row.amount || 0,
        spacingCm: row.spacingCm || undefined,
        frostHardy: row.frostHardy === 1,
        frostSensitive:
          row.frostSensitive === null || row.frostSensitive === undefined
            ? undefined
            : row.frostSensitive === 1,
        watering: row.watering || undefined,
        growingTips: row.growingTips || undefined,
        localizedContent: JSON.parse(row.localizedContent || "{}"),
        companions: JSON.parse(row.companions || "[]"),
        antagonists: JSON.parse(row.antagonists || "[]"),
        sowIndoorMonths: JSON.parse(row.sowIndoorMonths || "[]"),
        sowDirectMonths: JSON.parse(row.sowDirectMonths || "[]"),
        harvestMonths: JSON.parse(row.harvestMonths || "[]"),
        sunRequirement: row.sunRequirement || undefined,
        source: row.source || "bundled",
      }));

    const areas = db
      .prepare("SELECT * FROM areas WHERE workspaceId = ? ORDER BY created_at")
      .all(context.workspaceId)
      .map((areaRow: any) => {
        const planters = db
          .prepare("SELECT * FROM planters WHERE areaId = ? ORDER BY created_at")
          .all(areaRow.id)
          .map((planterRow: any) => ({
            id: planterRow.id,
            name: planterRow.name,
            rows: planterRow.rows,
            cols: planterRow.cols,
            backgroundColor: planterRow.backgroundColor || undefined,
            tagline: planterRow.tagline || undefined,
            virtualSections: JSON.parse(planterRow.virtualSections || "[]"),
            squares: planterRow.squares ? JSON.parse(planterRow.squares) : undefined,
          }));

        return {
          id: areaRow.id,
          name: areaRow.name,
          tagline: areaRow.tagline || undefined,
          backgroundColor: areaRow.backgroundColor || undefined,
          profileId: areaRow.profileId || "default",
          planters,
        };
      });

    const seedlings = db
      .prepare("SELECT * FROM seedlings WHERE workspaceId = ? ORDER BY created_at")
      .all(context.workspaceId)
      .map((row: any) => ({
        id: row.id,
        plant: JSON.parse(row.plant),
        plantedDate: row.plantedDate,
        seedCount: row.seedCount,
        location: row.location,
        method: row.method || undefined,
        status: row.status,
      }));

    const events = db
      .prepare("SELECT * FROM events WHERE workspaceId = ? ORDER BY date DESC")
      .all(context.workspaceId)
      .map((row: any) => ({
        id: row.id,
        type: row.type,
        plant: row.plant ? JSON.parse(row.plant) : undefined,
        date: row.date,
        gardenId: row.gardenId || undefined,
        note: row.note || undefined,
        profileId: row.profileId || "default",
      }));

    const gardenData: GardenData = { areas, plants, seedlings, events };
    res.json(gardenData);
  } catch (error) {
    console.error("[API:GET /garden] Error fetching garden data:", error);
    res.status(500).json({ error: "Failed to fetch garden data" });
  }
});

router.post("/garden/sync", (req: Request, res: Response) => {
  const context = getRequestContext(res);
  if (!requireVerifiedHostedContext(context, res)) return;

  if (!context.workspaceId) {
    res.status(409).json({ error: "Finish onboarding before syncing garden data." });
    return;
  }

  try {
    const db = getDb();
    const { areas, plants, seedlings, events } = req.body as {
      areas?: Array<any>;
      plants?: Array<any>;
      seedlings?: Array<any>;
      events?: Array<any>;
    };

    const transaction = db.transaction(() => {
      db.prepare(
        `
          DELETE FROM planters
          WHERE areaId IN (SELECT id FROM areas WHERE workspaceId = ?)
        `,
      ).run(context.workspaceId);
      db.prepare("DELETE FROM areas WHERE workspaceId = ?").run(context.workspaceId);
      db.prepare("DELETE FROM plants WHERE workspaceId = ?").run(context.workspaceId);
      db.prepare("DELETE FROM seedlings WHERE workspaceId = ?").run(context.workspaceId);
      db.prepare("DELETE FROM events WHERE workspaceId = ?").run(context.workspaceId);

      if (Array.isArray(plants)) {
        const insertPlant = db.prepare(`
          INSERT INTO plants (
            id, name, color, icon, latinName, description, variety,
            daysToHarvest, isSeed, amount, spacingCm, frostHardy,
            frostSensitive, watering, growingTips, localizedContent,
            companions, antagonists, sowIndoorMonths, sowDirectMonths,
            harvestMonths, sunRequirement, source, workspaceId, userId
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const plant of plants) {
          insertPlant.run(
            plant.id,
            plant.name,
            plant.color,
            plant.icon,
            plant.latinName ?? null,
            plant.description || null,
            plant.variety || null,
            plant.daysToHarvest ?? null,
            plant.isSeed ? 1 : 0,
            plant.amount === undefined ? -1 : plant.amount,
            plant.spacingCm ?? null,
            plant.frostHardy ? 1 : 0,
            plant.frostSensitive === undefined ? null : plant.frostSensitive ? 1 : 0,
            plant.watering ?? null,
            plant.growingTips ?? null,
            JSON.stringify(plant.localizedContent || {}),
            JSON.stringify(plant.companions || []),
            JSON.stringify(plant.antagonists || []),
            JSON.stringify(plant.sowIndoorMonths || []),
            JSON.stringify(plant.sowDirectMonths || []),
            JSON.stringify(plant.harvestMonths || []),
            plant.sunRequirement ?? null,
            plant.source ?? "custom",
            context.workspaceId,
            context.userId,
          );
        }
      }

      if (Array.isArray(areas)) {
        const insertArea = db.prepare(`
          INSERT INTO areas (id, name, tagline, backgroundColor, profileId, workspaceId, userId)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const insertPlanter = db.prepare(`
          INSERT INTO planters (
            id, areaId, name, rows, cols, backgroundColor, tagline, virtualSections, squares
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const area of areas) {
          insertArea.run(
            area.id,
            area.name,
            area.tagline || null,
            area.backgroundColor || null,
            context.profileId,
            context.workspaceId,
            context.userId,
          );

          if (Array.isArray(area.planters)) {
            for (const planter of area.planters) {
              insertPlanter.run(
                planter.id,
                area.id,
                planter.name,
                planter.rows,
                planter.cols,
                planter.backgroundColor || null,
                planter.tagline || null,
                JSON.stringify(planter.virtualSections || []),
                planter.squares ? JSON.stringify(planter.squares) : null,
              );
            }
          }
        }
      }

      if (Array.isArray(seedlings)) {
        const insertSeedling = db.prepare(`
          INSERT INTO seedlings (id, plant, plantedDate, seedCount, location, method, status, workspaceId, userId)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const seedling of seedlings) {
          insertSeedling.run(
            seedling.id,
            JSON.stringify(seedling.plant),
            seedling.plantedDate,
            seedling.seedCount,
            seedling.location,
            seedling.method || null,
            seedling.status,
            context.workspaceId,
            context.userId,
          );
        }
      }

      if (Array.isArray(events)) {
        const insertEvent = db.prepare(`
          INSERT INTO events (id, type, plant, date, gardenId, note, profileId, workspaceId, userId)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const event of events) {
          insertEvent.run(
            event.id,
            event.type,
            event.plant ? JSON.stringify(event.plant) : null,
            event.date,
            event.gardenId || null,
            event.note || null,
            context.profileId,
            context.workspaceId,
            context.userId,
          );
        }
      }
    });

    transaction();
    res.json({ success: true, message: "Garden data synced successfully" });
  } catch (error) {
    console.error("[API:POST /garden/sync] Error syncing garden data:", error);
    res.status(500).json({ error: "Failed to sync garden data" });
  }
});

router.post("/ai/chat", async (req: Request, res: Response) => {
  const context = getRequestContext(res);
  if (!requireVerifiedHostedContext(context, res)) return;
  const payload = parseAndValidate(AiChatRequestSchema, req.body, res, "AI request");
  if (!payload) return;

  try {
    const settingsId = getSettingsRowId(context);
    const settingsRow = getDb()
      .prepare("SELECT aiProvider, aiModel FROM settings WHERE id = ?")
      .get(settingsId) as { aiProvider: string; aiModel: string } | undefined;

    if (!settingsRow) {
      res.status(400).json({ error: "No AI settings found for this account." });
      return;
    }

    const aiProvider = parseStoredAiProvider(settingsRow.aiProvider);
    if (aiProvider.type !== "byok") {
      res.status(400).json({ error: "No OpenRouter API key is configured." });
      return;
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiProvider.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: payload.model ?? settingsRow.aiModel ?? DEFAULT_MODEL,
        messages: payload.messages,
        temperature: payload.temperature ?? 0.3,
        max_tokens: payload.maxTokens ?? 1024,
        response_format: { type: "json_object" },
      }),
    });

    const body = await response.text();
    if (!response.ok) {
      res.status(response.status).type("application/json").send(body);
      return;
    }

    res.type("application/json").send(body);
  } catch (error) {
    console.error("[API:POST /ai/chat] Proxy failure:", error);
    res.status(500).json({ error: "AI proxy request failed." });
  }
});

export default router;
