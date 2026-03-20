import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type Database from "better-sqlite3";
import type { Request } from "express";

export type AppMode = "local" | "hosted";
export type WorkspaceRole = "owner" | "editor" | "viewer";

export interface AuthUserProfile {
  authSubjectId: string;
  email: string;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  locale?: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
}

export interface RequestContext {
  appMode: AppMode;
  isAuthenticated: boolean;
  userId: string;
  profileId: string;
  workspaceId: string | null;
  workspaceRole: WorkspaceRole | null;
  user: AuthUserProfile | null;
  workspace: WorkspaceSummary | null;
}

interface SessionLookupRow {
  userId: string;
  email: string;
  locale: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  workspaceId: string | null;
  workspaceName: string | null;
  workspaceCreatedAt: string | null;
  workspaceUpdatedAt: string | null;
  role: WorkspaceRole | null;
}

const resolvedMode = (process.env.GARDEN_APP_MODE || "local").trim().toLowerCase();
export const APP_MODE: AppMode = resolvedMode === "hosted" ? "hosted" : "local";
export const SESSION_COOKIE_NAME = (
  process.env.GARDEN_SESSION_COOKIE_NAME || "gp_session"
)
  .trim();
const SESSION_TTL_DAYS = parseInt(process.env.GARDEN_SESSION_TTL_DAYS || "30", 10);
const VERIFICATION_TTL_HOURS = parseInt(
  process.env.GARDEN_VERIFICATION_TTL_HOURS || "24",
  10,
);
const RECOVERY_TTL_MINUTES = parseInt(
  process.env.GARDEN_RECOVERY_TTL_MINUTES || "30",
  10,
);
const TOKEN_PREVIEW_MODE = (process.env.GARDEN_AUTH_TOKEN_PREVIEW || "auto")
  .trim()
  .toLowerCase();

export const LOCAL_USER_ID = "local-user";
export const LOCAL_PROFILE_ID = "default";
export const LOCAL_WORKSPACE_ID = "local-default";

const KEY_LENGTH = 64;

type TokenKind = "verification" | "recovery";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isTokenPreviewEnabled(): boolean {
  if (TOKEN_PREVIEW_MODE === "always") return true;
  if (TOKEN_PREVIEW_MODE === "never") return false;
  return process.env.NODE_ENV !== "production";
}

export function buildPasswordHash(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, salt, digest] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !digest) {
    return false;
  }

  const expected = Buffer.from(digest, "base64url");
  const actual = scryptSync(password, salt, KEY_LENGTH);

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function parseCookieHeader(
  header: string | undefined,
): Record<string, string> {
  if (!header) return {};

  return header.split(";").reduce<Record<string, string>>((cookies, part) => {
    const [rawKey, ...rawValueParts] = part.split("=");
    const key = rawKey?.trim();
    if (!key) return cookies;
    cookies[key] = decodeURIComponent(rawValueParts.join("=").trim());
    return cookies;
  }, {});
}

export function getSessionTokenFromRequest(req: Request): string | null {
  const cookies = parseCookieHeader(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  return token ? token.trim() : null;
}

export function getSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

export function getDefaultLocalRequestContext(): RequestContext {
  return {
    appMode: "local",
    isAuthenticated: true,
    userId: LOCAL_USER_ID,
    profileId: LOCAL_PROFILE_ID,
    workspaceId: LOCAL_WORKSPACE_ID,
    workspaceRole: "owner",
    user: null,
    workspace: null,
  };
}

export function toPublicUser(row: {
  userId: string;
  email: string;
  locale: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}): AuthUserProfile {
  return {
    authSubjectId: row.userId,
    email: row.email,
    isEmailVerified: Boolean(row.emailVerifiedAt),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    locale: row.locale ?? undefined,
  };
}

function buildExpiryDateFromNow(ms: number): Date {
  return new Date(Date.now() + ms);
}

function buildTokenExpiry(kind: TokenKind): Date {
  if (kind === "verification") {
    return buildExpiryDateFromNow(VERIFICATION_TTL_HOURS * 60 * 60 * 1000);
  }
  return buildExpiryDateFromNow(RECOVERY_TTL_MINUTES * 60 * 1000);
}

export function issueSession(
  db: Database.Database,
  userId: string,
): {
  token: string;
  expiresAt: string;
} {
  const token = generateOpaqueToken();
  const expiresAt = buildExpiryDateFromNow(
    SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  db.prepare(
    `
      INSERT INTO auth_sessions (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `,
  ).run(randomUUID(), userId, hashOpaqueToken(token), expiresAt.toISOString());

  return { token, expiresAt: expiresAt.toISOString() };
}

export function revokeSessionByToken(
  db: Database.Database,
  rawToken: string | null,
): void {
  if (!rawToken) return;

  db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(
    hashOpaqueToken(rawToken),
  );
}

export function revokeAllSessionsForUser(
  db: Database.Database,
  userId: string,
): void {
  db.prepare("DELETE FROM auth_sessions WHERE user_id = ?").run(userId);
}

export function issueOneTimeToken(
  db: Database.Database,
  userId: string,
  kind: TokenKind,
): { token: string; expiresAt: string } {
  const table =
    kind === "verification"
      ? "auth_verification_tokens"
      : "auth_recovery_tokens";
  const expiresAt = buildTokenExpiry(kind);
  const token = generateOpaqueToken();

  db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
  db.prepare(
    `
      INSERT INTO ${table} (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `,
  ).run(randomUUID(), userId, hashOpaqueToken(token), expiresAt.toISOString());

  return { token, expiresAt: expiresAt.toISOString() };
}

export function resolveHostedRequestContext(
  db: Database.Database,
  req: Request,
): RequestContext | null {
  const rawToken = getSessionTokenFromRequest(req);
  if (!rawToken) {
    return null;
  }

  const tokenHash = hashOpaqueToken(rawToken);
  const row = db
    .prepare(
      `
        SELECT
          u.id AS userId,
          u.email,
          u.locale,
          u.email_verified_at AS emailVerifiedAt,
          u.created_at AS createdAt,
          u.updated_at AS updatedAt,
          w.id AS workspaceId,
          w.name AS workspaceName,
          w.created_at AS workspaceCreatedAt,
          w.updated_at AS workspaceUpdatedAt,
          wm.role
        FROM auth_sessions s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN workspace_memberships wm ON wm.user_id = u.id
        LEFT JOIN workspaces w ON w.id = wm.workspace_id
        WHERE s.token_hash = ?
          AND datetime(s.expires_at) > datetime('now')
        ORDER BY CASE wm.role WHEN 'owner' THEN 0 ELSE 1 END, w.created_at ASC
        LIMIT 1
      `,
    )
    .get(tokenHash) as SessionLookupRow | undefined;

  if (!row) {
    revokeSessionByToken(db, rawToken);
    return null;
  }

  db.prepare(
    `
      UPDATE auth_sessions
      SET last_seen_at = CURRENT_TIMESTAMP
      WHERE token_hash = ?
    `,
  ).run(tokenHash);

  const user = toPublicUser(row);
  const workspace = row.workspaceId
    ? {
        id: row.workspaceId,
        name: row.workspaceName ?? "Garden",
        role: row.role ?? "owner",
        createdAt: row.workspaceCreatedAt ?? row.createdAt,
        updatedAt: row.workspaceUpdatedAt ?? row.updatedAt,
      }
    : null;

  return {
    appMode: "hosted",
    isAuthenticated: true,
    userId: row.userId,
    profileId: row.userId,
    workspaceId: row.workspaceId,
    workspaceRole: row.role ?? null,
    user,
    workspace,
  };
}
