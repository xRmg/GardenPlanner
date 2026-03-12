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
  try {
    const db = getDb();

    // Fetch all plants
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
        amount: row.amount === -1 ? undefined : (row.amount || 0),
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

    // Fetch all areas with planters
    const areas = db
      .prepare("SELECT * FROM areas ORDER BY created_at")
      .all()
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

    // Fetch all seedlings
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

    // Fetch all events
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

    // Fetch settings
    const settingsRow = db
      .prepare("SELECT * FROM settings WHERE id = 'default'")
      .get() as any;
    const settings = {
      location: settingsRow.location,
      growthZone: settingsRow.growthZone,
      aiProvider: JSON.parse(settingsRow.aiProvider),
      aiModel: settingsRow.aiModel,
      locale: settingsRow.locale,
      lat: settingsRow.lat || undefined,
      lng: settingsRow.lng || undefined,
      profileId: settingsRow.profileId || "default",
    };

    const gardenData: GardenData = {
      areas,
      plants,
      seedlings,
      events,
      settings,
    };

    res.json(gardenData);
  } catch (error) {
    console.error("Error fetching garden data:", error);
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
      `[API] POST /api/garden/sync: areas=${Array.isArray(areas) ? areas.length : 0}, ` +
      `plants=${Array.isArray(plants) ? plants.length : 0}, ` +
      `seedlings=${Array.isArray(seedlings) ? seedlings.length : 0}, ` +
      `events=${Array.isArray(events) ? events.length : 0}`
    );

    // Start transaction
    const transaction = db.transaction(() => {
      // Sync plants
      if (plants && Array.isArray(plants)) {
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
          JSON.stringify(settings.aiProvider || { type: "none" }),
          settings.aiModel || "google/gemini-2.0-flash",
          settings.locale || "en",
          settings.lat || null,
          settings.lng || null,
          settings.profileId || "default",
        );
      }
    });

    // Execute transaction
    transaction();

    console.log("[API] ✓ Garden data synced successfully");
    // Return updated state
    res.json({ success: true, message: "Garden data synced successfully" });
  } catch (error) {
    console.error("Error syncing garden data:", error);
    res.status(500).json({ error: "Failed to sync garden data" });
  }
});

export default router;
