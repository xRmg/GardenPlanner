/**
 * app/hooks/useGardenData.ts
 *
 * Core data hook. Manages:
 * - Repository initialization and DB readiness
 * - Loading all garden data from the database on mount
 * - Persisting areas, customPlants, seedlings, and settings to the DB
 *   whenever they change (after the initial load)
 * - "Saved" flash indicator
 */

import { useState, useEffect, useRef } from "react";
import { createServerRepository } from "../data/serverRepository";
import { migrateLocalStorageToDexie } from "../data/migration";
import { BUNDLED_PLANTS } from "../data/bundledPlants";
import {
  dismissErrorToast,
  ERROR_TOAST_IDS,
  notifyErrorToast,
} from "../lib/asyncErrors";
import { parseWithDefaults, SettingsSchema } from "../data/schema";
import type {
  Settings,
  Area as SchemaArea,
  Seedling as SchemaSeedling,
  Plant as SchemaPlant,
} from "../data/schema";
import type { GardenRepository } from "../data/repository";
import type { Area, Seedling } from "../types";
import type { Plant } from "../components/PlanterGrid";
import type { GardenEvent } from "../components/EventsBar";
import { getPlantCache } from "../services/ai/plantCache";

export interface GardenDataState {
  /** Non-null when the database failed to open. Data will not persist. */
  dbError: string | null;
  /** True for 2 s after any successful save — drives the "Saved" indicator. */
  savedIndicator: boolean;
  areas: Area[];
  setAreas: React.Dispatch<React.SetStateAction<Area[]>>;
  customPlants: Plant[];
  setCustomPlants: React.Dispatch<React.SetStateAction<Plant[]>>;
  seedlings: Seedling[];
  setSeedlings: React.Dispatch<React.SetStateAction<Seedling[]>>;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  events: GardenEvent[];
  setEvents: React.Dispatch<React.SetStateAction<GardenEvent[]>>;
  /** Stable ref to the active GardenRepository instance. */
  repositoryRef: React.MutableRefObject<GardenRepository>;
  /** Ref that becomes true after the initial DB load completes. Used to
   *  guard persistence effects from firing before data has been loaded. */
  hasLoadedFromDB: React.MutableRefObject<boolean>;
  /** Flash the "Saved" toast for 2 seconds. */
  flashSaved: () => void;
}

export function useGardenData(): GardenDataState {
  const hasLoadedFromDB = useRef(false);
  const repositoryRef = useRef<GardenRepository>(createServerRepository());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Skip the first persistence cycle after data is loaded from the DB.
  // Without this, the loaded data echoes back to the server — harmless when
  // the server returns correct data, but DESTRUCTIVE if a proxy returned a
  // stale/cached response (it would overwrite good server data with stale).
  const skipInitialPersist = useRef(true);

  const [dbError, setDbError] = useState<string | null>(null);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [areas, setAreas] = useState<Area[]>([]);
  const [customPlants, setCustomPlants] = useState<Plant[]>([]);
  const [seedlings, setSeedlings] = useState<Seedling[]>([]);
  const [settings, setSettings] = useState<Settings>(() =>
    parseWithDefaults(SettingsSchema, {}),
  );
  const [events, setEvents] = useState<GardenEvent[]>([]);

  const flashSaved = () => {
    setSavedIndicator(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSavedIndicator(false), 2000);
  };

  // Initialize from server (with local Dexie fallback) on mount
  useEffect(() => {
    const repo = repositoryRef.current;
    (async () => {
      try {
        await repo.ready();
        console.info("[DB] Repository ready");
        await migrateLocalStorageToDexie(repo);
        const [
          loadedAreas,
          loadedPlants,
          loadedSeedlings,
          loadedSettings,
          loadedEvents,
        ] = await Promise.all([
          repo.getAreas(),
          repo.getCustomPlants(),
          repo.getSeedlings(),
          repo.getSettings(),
          repo.getEvents(),
        ]);

        let nextPlants = loadedPlants;
        if (loadedPlants.length === 0) {
          console.info(
            `[DB] Plant catalogue empty; seeding ${BUNDLED_PLANTS.length} bundled plants`,
          );
          await Promise.all(
            BUNDLED_PLANTS.map((plant) => repo.savePlant(plant)),
          );
          nextPlants = BUNDLED_PLANTS;
        }

        getPlantCache().seedFromPlants(nextPlants);

        console.info(
          `[DB] Loaded: ${loadedAreas.length} areas, ${nextPlants.length} plants, ${loadedSeedlings.length} seedlings, ${loadedEvents.length} events`,
        );
        setAreas(loadedAreas as unknown as Area[]);
        setCustomPlants(nextPlants as unknown as Plant[]);
        setSeedlings(loadedSeedlings as unknown as Seedling[]);
        setSettings(loadedSettings);
        setEvents(loadedEvents as unknown as GardenEvent[]);
        hasLoadedFromDB.current = true;
        dismissErrorToast(ERROR_TOAST_IDS.dbInit);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[DB] Failed to initialize database:", err);
        setDbError(msg);
        notifyErrorToast({
          id: ERROR_TOAST_IDS.dbInit,
          title: "Could not initialize garden data",
          error: err,
          fallback: "The database could not be opened.",
        });
      }
    })();
  }, []);

  // Persist areas to Dexie (skip until initial load is done to avoid race)
  useEffect(() => {
    if (!hasLoadedFromDB.current || skipInitialPersist.current) return;
    const repo = repositoryRef.current;
    console.info(`[DB] Saving ${areas.length} areas`);
    Promise.all(
      areas.map((area) => repo.saveArea(area as unknown as SchemaArea)),
    )
      .then(() => {
        dismissErrorToast(ERROR_TOAST_IDS.areasSync);
        flashSaved();
      })
      .catch((err) => {
        console.error("[DB] Failed to save area:", err);
        notifyErrorToast({
          id: ERROR_TOAST_IDS.areasSync,
          title: "Could not save garden layout",
          error: err,
          fallback: "Your area and planter changes may not be fully persisted.",
        });
      });
  }, [areas]);

  // Persist custom plants to Dexie
  useEffect(() => {
    if (!hasLoadedFromDB.current || skipInitialPersist.current) return;
    const repo = repositoryRef.current;
    if (customPlants.length > 0)
      console.info(`[DB] Saving ${customPlants.length} plants`);
    Promise.all(
      customPlants.map((plant) =>
        repo.savePlant(plant as unknown as SchemaPlant),
      ),
    )
      .then(() => {
        dismissErrorToast(ERROR_TOAST_IDS.plantsSync);
        flashSaved();
      })
      .catch((err) => {
        console.error("[DB] Failed to save plant:", err);
        notifyErrorToast({
          id: ERROR_TOAST_IDS.plantsSync,
          title: "Could not save plant catalogue",
          error: err,
          fallback: "Your plant changes may not be fully persisted.",
        });
      });
  }, [customPlants]);

  // Persist seedlings to Dexie
  useEffect(() => {
    if (!hasLoadedFromDB.current || skipInitialPersist.current) return;
    const repo = repositoryRef.current;
    Promise.all(
      seedlings.map((seedling) =>
        repo.saveSeedling(seedling as unknown as SchemaSeedling),
      ),
    )
      .then(() => {
        dismissErrorToast(ERROR_TOAST_IDS.seedlingsSync);
        flashSaved();
      })
      .catch((err) => {
        console.error("[DB] Failed to save seedling:", err);
        notifyErrorToast({
          id: ERROR_TOAST_IDS.seedlingsSync,
          title: "Could not save seedlings",
          error: err,
          fallback: "Seedling changes may not be fully persisted.",
        });
      });
  }, [seedlings]);

  // Persist settings to Dexie
  useEffect(() => {
    if (!hasLoadedFromDB.current || skipInitialPersist.current) return;
    const repo = repositoryRef.current;
    repo
      .saveSettings(settings)
      .then(() => {
        dismissErrorToast(ERROR_TOAST_IDS.settingsSync);
        flashSaved();
      })
      .catch((err) => {
        console.error("[DB] Failed to save settings:", err);
        notifyErrorToast({
          id: ERROR_TOAST_IDS.settingsSync,
          title: "Could not save settings",
          error: err,
          fallback: "Settings changes may not be fully persisted.",
        });
      });
  }, [settings]);

  // Clear the initial-persist skip flag after the echo cycle completes.
  // This effect fires AFTER the persistence effects above (source order)
  // on the same render where hasLoadedFromDB becomes true.
  useEffect(() => {
    if (hasLoadedFromDB.current && skipInitialPersist.current) {
      skipInitialPersist.current = false;
    }
  });

  return {
    dbError,
    savedIndicator,
    areas,
    setAreas,
    customPlants,
    setCustomPlants,
    seedlings,
    setSeedlings,
    settings,
    setSettings,
    events,
    setEvents,
    repositoryRef,
    hasLoadedFromDB,
    flashSaved,
  };
}
