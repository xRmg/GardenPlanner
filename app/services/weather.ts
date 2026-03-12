/**
 * app/services/weather.ts
 *
 * Open-Meteo weather client with a 3-hour Dexie cache.
 *
 * Fetches current conditions + 7-day forecast + 2 days of past data for
 * the suggestion rules engine. Cache key is derived from lat/lng rounded
 * to 2 decimal places to avoid chatty invalidation from GPS noise.
 */

import { getGardenPlannerDB } from "../data/dexieRepository";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Current conditions from Open-Meteo */
export interface CurrentWeather {
  tempC: number;
  relativeHumidityPct: number;
  precipMm: number;
  weatherCode: number;
  isDay: boolean;
}

/** One day's worth of data (past or forecast) */
export interface DailyWeather {
  date: string;             // YYYY-MM-DD
  tempMaxC: number;
  tempMinC: number;
  precipSumMm: number;
  rainSumMm: number;
  precipProbabilityMax: number; // 0–100
  et0Fao: number;              // evapotranspiration mm
  weatherCode: number;
}

/** Hourly data for short-term decisions */
export interface HourlyWeather {
  time: string;             // ISO datetime
  tempC: number;
  relativeHumidityPct: number;
  precipMm: number;
  precipProbability: number; // 0–100
  et0Fao: number;
  vpd: number;               // vapour pressure deficit kPa
  soilMoisture: number;      // m³/m³
}

/** The complete weather payload returned to consumers */
export interface WeatherData {
  fetchedAt: string;          // ISO datetime
  lat: number;
  lng: number;
  current: CurrentWeather;
  daily: DailyWeather[];      // past 2 days + today + next 6 days (9 total)
  hourly: HourlyWeather[];    // next 48 hours
}

// ---------------------------------------------------------------------------
// Cache TTL
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

// ---------------------------------------------------------------------------
// Open-Meteo fetch
// ---------------------------------------------------------------------------

/** Build the Open-Meteo forecast URL for the given coordinates. */
function buildUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,is_day",
    hourly: "temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,et0_fao_evapotranspiration,vapour_pressure_deficit,soil_moisture_0_to_1cm",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,precipitation_probability_max,et0_fao_evapotranspiration,weather_code",
    forecast_days: "7",
    forecast_hours: "48",
    past_days: "2",
    timezone: "auto",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

/** Parse the raw Open-Meteo JSON into a typed WeatherData object. */
function parseOpenMeteoResponse(json: Record<string, unknown>, lat: number, lng: number): WeatherData {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const cur = json.current as any;
  const daily = json.daily as any;
  const hourly = json.hourly as any;

  const current: CurrentWeather = {
    tempC: cur.temperature_2m ?? 0,
    relativeHumidityPct: cur.relative_humidity_2m ?? 0,
    precipMm: cur.precipitation ?? 0,
    weatherCode: cur.weather_code ?? 0,
    isDay: cur.is_day === 1,
  };

  const dailyDates: string[] = daily.time ?? [];
  const dailyData: DailyWeather[] = dailyDates.map((date: string, i: number) => ({
    date,
    tempMaxC: daily.temperature_2m_max?.[i] ?? 0,
    tempMinC: daily.temperature_2m_min?.[i] ?? 0,
    precipSumMm: daily.precipitation_sum?.[i] ?? 0,
    rainSumMm: daily.rain_sum?.[i] ?? 0,
    precipProbabilityMax: daily.precipitation_probability_max?.[i] ?? 0,
    et0Fao: daily.et0_fao_evapotranspiration?.[i] ?? 0,
    weatherCode: daily.weather_code?.[i] ?? 0,
  }));

  const hourlyTimes: string[] = hourly.time ?? [];
  const hourlyData: HourlyWeather[] = hourlyTimes.map((time: string, i: number) => ({
    time,
    tempC: hourly.temperature_2m?.[i] ?? 0,
    relativeHumidityPct: hourly.relative_humidity_2m?.[i] ?? 0,
    precipMm: hourly.precipitation?.[i] ?? 0,
    precipProbability: hourly.precipitation_probability?.[i] ?? 0,
    et0Fao: hourly.et0_fao_evapotranspiration?.[i] ?? 0,
    vpd: hourly.vapour_pressure_deficit?.[i] ?? 0,
    soilMoisture: hourly.soil_moisture_0_to_1cm?.[i] ?? 0,
  }));

  return {
    fetchedAt: new Date().toISOString(),
    lat,
    lng,
    current,
    daily: dailyData,
    hourly: hourlyData,
  };
}

/** Fetch fresh weather data from Open-Meteo for the given coordinates. */
async function fetchWeather(lat: number, lng: number, signal?: AbortSignal): Promise<WeatherData> {
  const url = buildUrl(lat, lng);
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Open-Meteo forecast API error: ${res.status}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  return parseOpenMeteoResponse(json, lat, lng);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns weather data for the given coordinates, using a 3-hour Dexie
 * cache. Falls back to stale data if the network request fails.
 * Throws only when there is neither fresh nor stale cached data.
 */
export async function getWeather(lat: number, lng: number, signal?: AbortSignal): Promise<WeatherData> {
  const cacheKey = `${lat.toFixed(2)}|${lng.toFixed(2)}`;
  const db = getGardenPlannerDB();
  const now = Date.now();

  // Check cache
  const cached = await db.weatherCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data as WeatherData;
  }

  // Fetch fresh data
  try {
    const data = await fetchWeather(lat, lng, signal);
    await db.weatherCache.put({ id: cacheKey, data, fetchedAt: now });
    return data;
  } catch (err) {
    // Return stale data rather than failing hard
    if (cached) {
      console.warn("[weather] Using stale weather cache due to fetch error:", err);
      return cached.data as WeatherData;
    }
    throw err;
  }
}

/**
 * Invalidate the weather cache for a given location.
 * Call this when the user changes their location.
 */
export async function invalidateWeatherCache(lat: number, lng: number): Promise<void> {
  const cacheKey = `${lat.toFixed(2)}|${lng.toFixed(2)}`;
  const db = getGardenPlannerDB();
  await db.weatherCache.delete(cacheKey);
}
