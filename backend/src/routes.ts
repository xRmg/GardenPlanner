import { Router, Request, Response } from "express";
import { z } from "zod";
import { getDb } from "./db.js";

const router = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

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

const SettingsPatchRequestSchema = z
  .object({
    growthZone: z.string().optional(),
    aiModel: z.string().max(200).optional(),
    locale: z.string().max(20).optional(),
  })
  .strict();

const AiKeyRequestSchema = z.object({
  key: z.string().min(1).max(500),
});

const ResolveLocationRequestSchema = z.object({
  query: z.string().min(1).max(200),
});

const StoredAiProviderSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("byok"), key: z.string().min(1) }),
]);

type StoredAiProvider = z.infer<typeof StoredAiProviderSchema>;

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
}

function formatSettingsForLog(settings: FrontendSettingsDto): string {
  const location = settings.location || "-";
  const aiConfigured = settings.aiProvider.type === "server" ? "yes" : "no";
  const validatedAt = settings.aiLastValidatedAt ?? "-";
  return `location="${location}" zone=${settings.growthZone} model=${settings.aiModel} ai=${aiConfigured} validatedAt=${validatedAt}`;
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
}

const DEFAULT_MODEL = "google/gemini-2.0-flash";

function setNoStoreHeaders(res: Response): void {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
}

function parseStoredAiProvider(
  raw: string | null | undefined,
): StoredAiProvider {
  try {
    const parsed = StoredAiProviderSchema.safeParse(
      JSON.parse(raw || '{"type":"none"}'),
    );
    return parsed.success ? parsed.data : { type: "none" };
  } catch {
    return { type: "none" };
  }
}

function getSettingsRow(db: ReturnType<typeof getDb>): Record<string, unknown> {
  const row = db
    .prepare("SELECT * FROM settings WHERE id = 'default'")
    .get() as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error("Settings row not found in database");
  }
  return row;
}

function sanitizeSettingsRow(
  row: Record<string, unknown>,
): FrontendSettingsDto {
  const rawAiProvider = parseStoredAiProvider(
    typeof row.aiProvider === "string" ? row.aiProvider : undefined,
  );
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
  };
}

function readFrontendSettings(
  db: ReturnType<typeof getDb>,
): FrontendSettingsDto {
  return sanitizeSettingsRow(getSettingsRow(db));
}

function applySettingsUpdate(
  db: ReturnType<typeof getDb>,
  patch: SettingsUpdate,
): FrontendSettingsDto {
  const current = getSettingsRow(db);
  const nextAiProvider =
    patch.aiProvider !== undefined
      ? JSON.stringify(patch.aiProvider)
      : typeof current.aiProvider === "string"
        ? current.aiProvider
        : '{"type":"none"}';

  db.prepare(
    `
    UPDATE settings
    SET location = ?, growthZone = ?, aiProvider = ?, aiModel = ?,
        locale = ?, lat = ?, lng = ?, aiLastValidatedAt = ?,
        aiValidationError = ?, profileId = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 'default'
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
    patch.aiLastValidatedAt !== undefined
      ? patch.aiLastValidatedAt
      : typeof current.aiLastValidatedAt === "string"
        ? current.aiLastValidatedAt
        : null,
    patch.aiValidationError !== undefined
      ? patch.aiValidationError
      : typeof current.aiValidationError === "string"
        ? current.aiValidationError
        : null,
    patch.profileId !== undefined
      ? patch.profileId
      : typeof current.profileId === "string"
        ? current.profileId
        : "default",
  );

  return readFrontendSettings(db);
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
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo archive ${res.status}`);
  const json = (await res.json()) as {
    daily: {
      time: string[];
      temperature_2m_mean: Array<number | null>;
      precipitation_sum: Array<number | null>;
    };
  };
  const { time, temperature_2m_mean, precipitation_sum } = json.daily;

  const ymTemp: Record<string, number[]> = {};
  const ymPrecip: Record<string, number[]> = {};
  for (let i = 0; i < time.length; i++) {
    const key = time[i].slice(0, 7);
    const t = temperature_2m_mean[i];
    const p = precipitation_sum[i];
    if (t !== null) (ymTemp[key] ??= []).push(t);
    if (p !== null) (ymPrecip[key] ??= []).push(p);
  }

  const monthTemp: number[][] = Array.from({ length: 12 }, () => []);
  const monthPrecip: number[][] = Array.from({ length: 12 }, () => []);
  for (const [key, vals] of Object.entries(ymTemp)) {
    const monthIndex = parseInt(key.slice(5), 10) - 1;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    monthTemp[monthIndex].push(mean);
  }
  for (const [key, vals] of Object.entries(ymPrecip)) {
    const monthIndex = parseInt(key.slice(5), 10) - 1;
    const total = vals.reduce((a, b) => a + b, 0);
    monthPrecip[monthIndex].push(total);
  }

  const T = monthTemp.map((values) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
  );
  const P = monthPrecip.map((values) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
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
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo Geocoding ${res.status}`);
  const json = (await res.json()) as {
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
  const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (res.status === 401) {
    throw new Error("Invalid API key — check your key at openrouter.ai.");
  }
  if (!res.ok) {
    throw new Error(
      `OpenRouter returned status ${res.status}. Try again later.`,
    );
  }
}

/**
 * API route types matching frontend expectations
 */
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

router.get("/settings", (req: Request, res: Response) => {
  setNoStoreHeaders(res);
  try {
    const db = getDb();
    const settings = readFrontendSettings(db);
    console.log(`[API:GET /settings] ${formatSettingsForLog(settings)}`);
    res.json(settings);
  } catch (error) {
    console.error("[API:GET /settings] Error fetching settings:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.patch("/settings", (req: Request, res: Response) => {
  const parseResult = SettingsPatchRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    res.status(400).json({ error: `Invalid settings patch: ${issues}` });
    return;
  }

  try {
    const db = getDb();
    const settings = applySettingsUpdate(db, parseResult.data);
    console.log(`[API:PATCH /settings] ${formatSettingsForLog(settings)}`);
    res.json(settings);
  } catch (error) {
    console.error("[API:PATCH /settings] Error saving settings:", error);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

router.post("/settings/ai-key", async (req: Request, res: Response) => {
  const parseResult = AiKeyRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    res.status(400).json({ error: `Invalid AI key payload: ${issues}` });
    return;
  }

  try {
    await validateOpenRouterKey(parseResult.data.key);
    const db = getDb();
    const settings = applySettingsUpdate(db, {
      aiProvider: { type: "byok", key: parseResult.data.key },
      aiLastValidatedAt: new Date().toISOString(),
      aiValidationError: null,
    });
    console.log(
      `[API:POST /settings/ai-key] ${formatSettingsForLog(settings)}`,
    );
    res.json(settings);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to validate API key.";
    console.error("[API:POST /settings/ai-key] Error validating key:", message);
    res.status(400).json({ error: message });
  }
});

router.delete("/settings/ai-key", (req: Request, res: Response) => {
  try {
    const db = getDb();
    const settings = applySettingsUpdate(db, {
      aiProvider: { type: "none" },
      aiLastValidatedAt: null,
      aiValidationError: null,
    });
    console.log(
      `[API:DELETE /settings/ai-key] ${formatSettingsForLog(settings)}`,
    );
    res.json(settings);
  } catch (error) {
    console.error("[API:DELETE /settings/ai-key] Error clearing key:", error);
    res.status(500).json({ error: "Failed to clear AI key" });
  }
});

router.post(
  "/settings/location/resolve",
  async (req: Request, res: Response) => {
    const parseResult = ResolveLocationRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      res.status(400).json({ error: `Invalid location payload: ${issues}` });
      return;
    }

    try {
      const { displayName, latitude, longitude } = await geocodeLocation(
        parseResult.data.query,
      );
      let growthZone = "Cfb";
      try {
        growthZone = await fetchKoppenZone(latitude, longitude);
      } catch {
        // Non-fatal fallback: keep a valid location even if climate derivation fails.
      }

      const db = getDb();
      const settings = applySettingsUpdate(db, {
        location: displayName,
        lat: latitude,
        lng: longitude,
        growthZone,
      });
      console.log(
        `[API:POST /settings/location/resolve] query="${parseResult.data.query}" ${formatSettingsForLog(settings)}`,
      );
      res.json(settings);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to verify location.";
      console.error(
        "[API:POST /settings/location/resolve] Error resolving location:",
        message,
      );
      res.status(400).json({ error: message });
    }
  },
);

/**
 * GET /api/garden
 * Returns the complete garden state (areas, planters, plants, events, seedlings).
 */
router.get("/garden", (req: Request, res: Response) => {
  console.log("[API:GET /garden] Fetching complete garden state...");
  setNoStoreHeaders(res);
  try {
    const db = getDb();

    // Fetch all plants
    console.log("[DB] Querying plants...");
    const plants = db
      .prepare("SELECT * FROM plants")
      .all()
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
        companions: JSON.parse(row.companions || "[]"),
        antagonists: JSON.parse(row.antagonists || "[]"),
        sowIndoorMonths: JSON.parse(row.sowIndoorMonths || "[]"),
        sowDirectMonths: JSON.parse(row.sowDirectMonths || "[]"),
        harvestMonths: JSON.parse(row.harvestMonths || "[]"),
        sunRequirement: row.sunRequirement || undefined,
        source: row.source || "bundled",
      }));
    console.log(`[DB] ✓ Loaded ${plants.length} plants`);

    // Fetch all areas with planters
    console.log("[DB] Querying areas...");
    const areas = db
      .prepare("SELECT * FROM areas ORDER BY created_at")
      .all()
      .map((areaRow: any) => {
        const planters = db
          .prepare(
            "SELECT * FROM planters WHERE areaId = ? ORDER BY created_at",
          )
          .all(areaRow.id)
          .map((planterRow: any) => ({
            id: planterRow.id,
            name: planterRow.name,
            rows: planterRow.rows,
            cols: planterRow.cols,
            backgroundColor: planterRow.backgroundColor || undefined,
            tagline: planterRow.tagline || undefined,
            virtualSections: JSON.parse(planterRow.virtualSections || "[]"),
            squares: planterRow.squares
              ? JSON.parse(planterRow.squares)
              : undefined,
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
    console.log(`[DB] ✓ Loaded ${areas.length} areas`);

    // Fetch all seedlings
    console.log("[DB] Querying seedlings...");
    const seedlings = db
      .prepare("SELECT * FROM seedlings ORDER BY created_at")
      .all()
      .map((row: any) => ({
        id: row.id,
        plant: JSON.parse(row.plant),
        plantedDate: row.plantedDate,
        seedCount: row.seedCount,
        location: row.location,
        method: row.method || undefined,
        status: row.status,
      }));
    console.log(`[DB] ✓ Loaded ${seedlings.length} seedlings`);

    // Fetch all events
    console.log("[DB] Querying events...");
    const events = db
      .prepare("SELECT * FROM events ORDER BY date DESC")
      .all()
      .map((row: any) => ({
        id: row.id,
        type: row.type,
        plant: row.plant ? JSON.parse(row.plant) : undefined,
        date: row.date,
        gardenId: row.gardenId || undefined,
        note: row.note || undefined,
        profileId: row.profileId || "default",
      }));
    console.log(`[DB] ✓ Loaded ${events.length} events`);

    const gardenData: GardenData = {
      areas,
      plants,
      seedlings,
      events,
    };

    console.log(
      `[API:GET /garden] ✓ Returning garden state: ${areas.length} areas, ${plants.length} plants, ${seedlings.length} seedlings, ${events.length} events`,
    );
    res.json(gardenData);
  } catch (error) {
    console.error("[API:GET /garden] Error fetching garden data:", error);
    res.status(500).json({ error: "Failed to fetch garden data" });
  }
});

/**
 * POST /api/garden/sync
 * Receives updated garden state and syncs it to the database.
 * Strategy: Full replace (not incremental merge) for simplicity.
 */
router.post("/garden/sync", (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { areas, plants, seedlings, events } = req.body;

    console.log(
      `[API:POST /garden/sync] Syncing garden data: areas=${Array.isArray(areas) ? areas.length : 0}, ` +
        `plants=${Array.isArray(plants) ? plants.length : 0}, ` +
        `seedlings=${Array.isArray(seedlings) ? seedlings.length : 0}, ` +
        `events=${Array.isArray(events) ? events.length : 0}`,
    );

    // Start transaction
    console.log("[DB] Starting transaction...");
    const transaction = db.transaction(() => {
      // Sync plants
      if (plants && Array.isArray(plants)) {
        console.log(`[DB] Syncing ${plants.length} plants...`);
        // Clear existing plants (keep bundled ones from initial load)
        // Actually, just upsert all — simplest approach
        db.prepare("DELETE FROM plants").run();

        const insertPlant = db.prepare(`
          INSERT INTO plants (
            id, name, color, icon, latinName, description, variety,
            daysToHarvest, isSeed, amount, spacingCm, frostHardy,
            frostSensitive, watering, growingTips, companions, antagonists,
            sowIndoorMonths, sowDirectMonths, harvestMonths, sunRequirement, source
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            plant.frostSensitive === undefined
              ? null
              : plant.frostSensitive
                ? 1
                : 0,
            plant.watering ?? null,
            plant.growingTips ?? null,
            JSON.stringify(plant.companions || []),
            JSON.stringify(plant.antagonists || []),
            JSON.stringify(plant.sowIndoorMonths || []),
            JSON.stringify(plant.sowDirectMonths || []),
            JSON.stringify(plant.harvestMonths || []),
            plant.sunRequirement ?? null,
            plant.source ?? "custom",
          );
        }
      }

      // Sync areas & planters
      if (areas && Array.isArray(areas)) {
        db.prepare("DELETE FROM planters").run();
        db.prepare("DELETE FROM areas").run();

        const insertArea = db.prepare(`
          INSERT INTO areas (id, name, tagline, backgroundColor, profileId)
          VALUES (?, ?, ?, ?, ?)
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
            area.profileId || "default",
          );

          if (area.planters && Array.isArray(area.planters)) {
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

      // Sync seedlings
      if (seedlings && Array.isArray(seedlings)) {
        db.prepare("DELETE FROM seedlings").run();

        const insertSeedling = db.prepare(`
          INSERT INTO seedlings (id, plant, plantedDate, seedCount, location, method, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
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
          );
        }
      }

      // Sync events
      if (events && Array.isArray(events)) {
        db.prepare("DELETE FROM events").run();

        const insertEvent = db.prepare(`
          INSERT INTO events (id, type, plant, date, gardenId, note, profileId)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const event of events) {
          insertEvent.run(
            event.id,
            event.type,
            event.plant ? JSON.stringify(event.plant) : null,
            event.date,
            event.gardenId || null,
            event.note || null,
            event.profileId || "default",
          );
        }
      }
    });

    // Execute transaction
    console.log("[DB] Executing transaction...");
    transaction();
    console.log("[DB] ✓ Transaction completed successfully");

    console.log("[API:POST /garden/sync] ✓ Garden data synced successfully");
    // Return updated state
    res.json({ success: true, message: "Garden data synced successfully" });
  } catch (error) {
    console.error("[API:POST /garden/sync] Error syncing garden data:", error);
    res.status(500).json({ error: "Failed to sync garden data" });
  }
});

/**
 * POST /api/ai/chat
 *
 * Proxy for OpenRouter chat completions.
 * - Reads the API key from the server-side settings DB (never exposed to the browser).
 * - Accepts { messages, model?, temperature?, maxTokens? } from the client.
 * - Forwards the request to OpenRouter and returns the response unchanged.
 * - Logs the full request and response to the terminal for debugging.
 */
router.post("/ai/chat", async (req: Request, res: Response) => {
  console.log(
    "\n[AI Proxy] ══════════════════════════════════════════════════",
  );
  console.log(`[AI Proxy] Incoming request at ${new Date().toISOString()}`);

  try {
    // ── Validate request body ─────────────────────────────────────────────
    const parseResult = AiChatRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      console.error(`[AI Proxy] ✗ Invalid request body: ${issues}`);
      res.status(400).json({ error: `Invalid request: ${issues}` });
      return;
    }
    const {
      messages,
      model,
      temperature = 0.3,
      maxTokens = 1024,
    } = parseResult.data;

    const db = getDb();

    // Read API key and model from settings DB — key never leaves the server
    const settingsRow = db
      .prepare("SELECT aiProvider, aiModel FROM settings WHERE id = 'default'")
      .get() as { aiProvider: string; aiModel: string } | undefined;

    if (!settingsRow) {
      console.error("[AI Proxy] ✗ No settings row found in DB");
      res.status(500).json({ error: "Settings not found in database" });
      return;
    }

    const aiProvider = JSON.parse(
      settingsRow.aiProvider || '{"type":"none"}',
    ) as { type: "none" } | { type: "byok"; key: string };

    console.log(`[AI Proxy] AI provider type: ${aiProvider.type}`);

    // The DB always stores keys with type "byok". Any other type means AI
    // has not been configured — return a 400 so the frontend can inform the user.
    const apiKey = aiProvider.type === "byok" ? aiProvider.key : null;
    if (!apiKey) {
      console.error(
        "[AI Proxy] ✗ No OpenRouter API key stored in backend settings DB",
      );
      res.status(400).json({
        error:
          "AI not configured. Set the OpenRouter API key in the backend settings.",
      });
      return;
    }

    const dbModel = settingsRow.aiModel || "google/gemini-2.0-flash";

    const resolvedModel = model || dbModel;

    // ── Log full request ──────────────────────────────────────────────────
    console.log(
      "[AI Proxy] ─── REQUEST ──────────────────────────────────────",
    );
    console.log(`[AI Proxy] Model:       ${resolvedModel}`);
    console.log(`[AI Proxy] Temperature: ${temperature}`);
    console.log(`[AI Proxy] Max tokens:  ${maxTokens}`);
    console.log(`[AI Proxy] Messages (${messages?.length ?? 0} total):`);
    if (Array.isArray(messages)) {
      messages.forEach((m, i) => {
        console.log(`  [${i}] role=${m.role} | ${m.content.length} chars`);
        console.log(`  ┌─────────────────────────────────────────────────`);
        m.content.split("\n").forEach((line) => console.log(`  │ ${line}`));
        console.log(`  └─────────────────────────────────────────────────`);
      });
    }

    const requestBody = {
      model: resolvedModel,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    };

    console.log("[AI Proxy] ─── Sending to OpenRouter ───────────────────────");

    // ── Forward to OpenRouter ─────────────────────────────────────────────
    const orResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost",
          "X-Title": "Garden Planner",
        },
        body: JSON.stringify(requestBody),
      },
    );

    console.log(`[AI Proxy] OpenRouter HTTP status: ${orResponse.status}`);

    const orJson = (await orResponse.json()) as {
      id?: string;
      choices?: Array<{
        message?: {
          content?: string;
          reasoning_content?: string;
          [key: string]: unknown;
        };
        finish_reason?: string;
        native_finish_reason?: string;
      }>;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
      error?: unknown;
      [key: string]: unknown;
    };

    // ── Log full response ─────────────────────────────────────────────────
    console.log(
      "[AI Proxy] ─── RESPONSE ─────────────────────────────────────",
    );
    if (orJson.usage) {
      console.log(
        `[AI Proxy] Tokens: prompt=${orJson.usage.prompt_tokens}, ` +
          `completion=${orJson.usage.completion_tokens}, total=${orJson.usage.total_tokens}`,
      );
    }
    if (orJson.choices) {
      orJson.choices.forEach((choice, i) => {
        const content = choice.message?.content ?? "";
        const reasoning = choice.message?.reasoning_content ?? "";
        console.log(`[AI Proxy] Choice[${i}]:`);
        console.log(`  finish_reason:        ${choice.finish_reason}`);
        console.log(`  native_finish_reason: ${choice.native_finish_reason}`);
        console.log(`  content length:       ${content.length} chars`);
        if (content) {
          console.log(`  content preview:`);
          console.log(`  ┌─────────────────────────────────────────────────`);
          content
            .substring(0, 1000)
            .split("\n")
            .forEach((line) => console.log(`  │ ${line}`));
          if (content.length > 1000)
            console.log(`  │ ... (${content.length - 1000} more chars)`);
          console.log(`  └─────────────────────────────────────────────────`);
        }
        if (reasoning) {
          console.log(`  reasoning_content length: ${reasoning.length} chars`);
          console.log(`  reasoning preview:`);
          reasoning
            .substring(0, 500)
            .split("\n")
            .forEach((line) => console.log(`  │ ${line}`));
        }
        // Log unexpected keys on the message object
        const knownKeys = new Set(["content", "role", "reasoning_content"]);
        const extraKeys = Object.keys(choice.message ?? {}).filter(
          (k) => !knownKeys.has(k),
        );
        if (extraKeys.length > 0) {
          console.log(`  unexpected message keys: ${extraKeys.join(", ")}`);
          extraKeys.forEach((k) =>
            console.log(
              `    ${k}:`,
              JSON.stringify((choice.message as Record<string, unknown>)[k]),
            ),
          );
        }
      });
    }
    if (!orResponse.ok) {
      console.error(
        "[AI Proxy] ✗ OpenRouter error:",
        JSON.stringify(orJson.error ?? orJson),
      );
    }
    console.log(
      "[AI Proxy] ══════════════════════════════════════════════════\n",
    );

    res.status(orResponse.status).json(orJson);
  } catch (error) {
    console.error("[AI Proxy] ✗ Unexpected error:", error);
    console.log(
      "[AI Proxy] ══════════════════════════════════════════════════\n",
    );
    res.status(500).json({ error: "AI proxy error", details: String(error) });
  }
});

export default router;
