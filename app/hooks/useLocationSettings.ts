/**
 * app/hooks/useLocationSettings.ts
 *
 * Manages location input, geocoding verification, and automatic
 * Köppen–Geiger climate zone derivation via the Open-Meteo APIs.
 *
 * Syncs the input draft whenever settings.location is updated externally
 * (e.g., after the initial DB load) using a one-time initialization guard.
 */

import { useState, useEffect, useRef } from "react";
import type { Settings } from "../data/schema";

/** Classify a location into a Köppen–Geiger zone from 30-year monthly normals. */
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

/**
 * Fetch 10 years of daily climate data from the Open-Meteo archive API,
 * compute monthly normals, and return the Köppen–Geiger zone code.
 * Throws on failure — caller should catch and use a fallback.
 */
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
  const json: {
    daily: {
      time: string[];
      temperature_2m_mean: (number | null)[];
      precipitation_sum: (number | null)[];
    };
  } = await res.json();
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
    const m = parseInt(key.slice(5), 10) - 1;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    monthTemp[m].push(mean);
  }
  for (const [key, vals] of Object.entries(ymPrecip)) {
    const m = parseInt(key.slice(5), 10) - 1;
    const total = vals.reduce((a, b) => a + b, 0);
    monthPrecip[m].push(total);
  }
  const T = monthTemp.map((v) =>
    v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0,
  );
  const P = monthPrecip.map((v) =>
    v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0,
  );

  if (T.every((v) => v === 0) && P.every((v) => v === 0))
    throw new Error("No climate data returned");

  return classifyKoppen(T, P, lat);
}

export interface LocationSettingsState {
  locationDraft: string;
  setLocationDraft: React.Dispatch<React.SetStateAction<string>>;
  locationStatus: "idle" | "checking" | "valid" | "invalid";
  setLocationStatus: React.Dispatch<
    React.SetStateAction<"idle" | "checking" | "valid" | "invalid">
  >;
  locationError: string;
  setLocationError: React.Dispatch<React.SetStateAction<string>>;
  handleVerifyLocation: () => Promise<void>;
}

export function useLocationSettings(
  settings: Settings,
  setSettings: React.Dispatch<React.SetStateAction<Settings>>,
): LocationSettingsState {
  const [locationDraft, setLocationDraft] = useState(settings.location);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >(settings.lat != null ? "valid" : "idle");
  const [locationError, setLocationError] = useState("");

  // Sync draft once when settings are first loaded from the database.
  // A ref guards against re-syncing on subsequent settings changes caused
  // by the user (e.g., after a successful verification).
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current && settings.location) {
      setLocationDraft(settings.location);
      setLocationStatus(settings.lat != null ? "valid" : "idle");
      hasInitialized.current = true;
    }
  }, [settings.location, settings.lat]);

  const handleVerifyLocation = async () => {
    const q = locationDraft.trim();
    if (!q) return;
    setLocationStatus("checking");
    setLocationError("");
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Open-Meteo Geocoding ${res.status}`);
      const json: {
        results?: Array<{
          latitude: number;
          longitude: number;
          name: string;
          admin1?: string;
          country?: string;
        }>;
      } = await res.json();
      const results = json.results;
      if (!Array.isArray(results) || results.length === 0) {
        setLocationStatus("invalid");
        setLocationError(
          "Location not found. Try a different city name or add a country (e.g. 'Paris, France').",
        );
        return;
      }
      const { latitude, longitude, name, admin1, country } = results[0];
      const displayName = [name, admin1, country].filter(Boolean).join(", ");

      let growthZone = "Cfb";
      try {
        growthZone = await fetchKoppenZone(latitude, longitude);
      } catch {
        // Non-fatal: location is still valid, user can correct zone manually
      }
      setLocationDraft(displayName);
      setSettings((prev) => ({
        ...prev,
        location: displayName,
        lat: latitude,
        lng: longitude,
        growthZone,
      }));
      setLocationStatus("valid");
    } catch (e) {
      setLocationStatus("invalid");
      setLocationError(
        e instanceof Error ? e.message : "Failed to verify location.",
      );
    }
  };

  return {
    locationDraft,
    setLocationDraft,
    locationStatus,
    setLocationStatus,
    locationError,
    setLocationError,
    handleVerifyLocation,
  };
}
