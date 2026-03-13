import { Router, Request, Response } from "express";
import { getDb } from "./db.js";

const router = Router();

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
  settings: unknown;
}

/**
 * GET /api/garden
 * Returns the complete garden state (all areas, planters, plants, events, seedlings, settings)
 */
router.get("/garden", (req: Request, res: Response) => {
  console.log("[API:GET /garden] Fetching complete garden state...");
  // Prevent proxies from caching API responses
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
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
        description: row.description || undefined,
        variety: row.variety || undefined,
        daysToHarvest: row.daysToHarvest || undefined,
        isSeed: row.isSeed === 1,
        amount: row.amount === -1 ? undefined : row.amount || 0,
        spacingCm: row.spacingCm || undefined,
        frostHardy: row.frostHardy === 1,
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

    // Fetch settings
    console.log("[DB] Querying settings...");
    const settingsRow = db
      .prepare("SELECT * FROM settings WHERE id = 'default'")
      .get() as any;
    // Mask the API key — never return it to the browser.
    // The frontend treats { type: 'server' } as "key stored server-side".
    const rawAiProvider = JSON.parse(settingsRow.aiProvider || '{"type":"none"}');
    const maskedAiProvider =
      rawAiProvider.type === 'byok'
        ? { type: 'server' }
        : rawAiProvider;
    const settings = {
      location: settingsRow.location,
      growthZone: settingsRow.growthZone,
      aiProvider: maskedAiProvider,
      aiModel: settingsRow.aiModel,
      locale: settingsRow.locale,
      lat: settingsRow.lat || undefined,
      lng: settingsRow.lng || undefined,
      profileId: settingsRow.profileId || "default",
    };
    console.log(`[DB] ✓ Loaded settings: location="${settings.location}", aiProvider=${rawAiProvider.type}, model=${settings.aiModel}`);

    const gardenData: GardenData = {
      areas,
      plants,
      seedlings,
      events,
      settings,
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
    const { areas, plants, seedlings, events, settings } = req.body;

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
            id, name, color, icon, description, variety, daysToHarvest,
            isSeed, amount, spacingCm, frostHardy, companions, antagonists,
            sowIndoorMonths, sowDirectMonths, harvestMonths, sunRequirement, source
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const plant of plants) {
          insertPlant.run(
            plant.id,
            plant.name,
            plant.color,
            plant.icon,
            plant.description || null,
            plant.variety || null,
            plant.daysToHarvest || null,
            plant.isSeed ? 1 : 0,
            plant.amount === undefined ? -1 : plant.amount,
            plant.spacingCm || null,
            plant.frostHardy ? 1 : 0,
            JSON.stringify(plant.companions || []),
            JSON.stringify(plant.antagonists || []),
            JSON.stringify(plant.sowIndoorMonths || []),
            JSON.stringify(plant.sowDirectMonths || []),
            JSON.stringify(plant.harvestMonths || []),
            plant.sunRequirement || null,
            plant.source || "custom",
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

      // Sync settings
      if (settings) {
        // If the frontend sent a 'server' aiProvider it means the key is
        // stored server-side (masked round-trip) — preserve the existing key.
        let aiProviderToStore = settings.aiProvider || { type: "none" };
        if (aiProviderToStore.type === 'server' || (aiProviderToStore.type === 'byok' && !aiProviderToStore.key)) {
          const existingRow = db
            .prepare("SELECT aiProvider FROM settings WHERE id = 'default'")
            .get() as any;
          if (existingRow) {
            const existing = JSON.parse(existingRow.aiProvider || '{"type":"none"}');
            if (existing.type === 'byok' && existing.key) {
              aiProviderToStore = existing;
              console.log("[DB] Preserved existing API key (masked round-trip)");
            }
          }
        }

        console.log(`[DB] Syncing settings: location="${settings.location || ""}", aiProvider=${aiProviderToStore.type}, model=${settings.aiModel || "default"}`);

        const updateSettings = db.prepare(`
          UPDATE settings
          SET location = ?, growthZone = ?, aiProvider = ?, aiModel = ?,
              locale = ?, lat = ?, lng = ?, profileId = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = 'default'
        `);

        updateSettings.run(
          settings.location || "",
          settings.growthZone || "Cfb",
          JSON.stringify(aiProviderToStore),
          settings.aiModel || "google/gemini-2.0-flash",
          settings.locale || "en",
          settings.lat || null,
          settings.lng || null,
          settings.profileId || "default",
        );
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
    ) as
      | { type: "none" }
      | { type: "server" }
      | { type: "byok"; key: string }
      | { type: "proxy"; proxyUrl: string; token?: string };

    console.log(`[AI Proxy] AI provider type: ${aiProvider.type}`);

    // Accept both "byok" (legacy stored key) and "server" (new default) as long as a key exists in the DB
    const apiKey = aiProvider.type === "byok" ? aiProvider.key : null;
    if (!apiKey) {
      console.error(
        "[AI Proxy] ✗ No OpenRouter API key stored in backend settings DB",
      );
      res
        .status(400)
        .json({
          error:
            "AI not configured. Set the OpenRouter API key in the backend settings.",
        });
      return;
    }

    const dbModel = settingsRow.aiModel || "google/gemini-2.0-flash";
    const {
      messages,
      model,
      temperature = 0.3,
      maxTokens = 1024,
    } = req.body as {
      messages: Array<{ role: string; content: string }>;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    };

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
