# Feature 7: Weather Integration

> Detailed feature documentation — source: codebase analysis, 2026-03-15

---

## Overview

Weather integration provides real-time meteorological data that drives agricultural intelligence in the suggestion engine. Without weather data, care suggestions are calendar-based guesses. With weather, the application delivers condition-based advice — don't water when rain is coming, protect plants when frost is forecast, hold off on fertilizing before heavy rain.

---

## Components

| Component | File | Role |
|-----------|------|------|
| Weather Service | `app/services/weather.ts` | Open-Meteo API client with Dexie cache |
| Abort Timeout | `app/lib/abortTimeout.ts` | Request timeout handling |

---

## Data Model

### WeatherData
| Field | Type | Description |
|-------|------|-------------|
| `current` | CurrentWeather | Real-time conditions |
| `daily` | DailyWeather[] | 9-day daily forecast (2 past + today + 6 future) |
| `hourly` | HourlyWeather[] | 48-hour hourly forecast |

### CurrentWeather
| Field | Type |
|-------|------|
| `tempC` | number |
| `relativeHumidityPct` | number |
| `precipMm` | number |
| `weatherCode` | number |
| `isDay` | boolean |

### DailyWeather
| Field | Type |
|-------|------|
| `tempMaxC` | number |
| `tempMinC` | number |
| `precipSumMm` | number |
| `rainSumMm` | number |
| `precipProbabilityMax` | number (0–100) |
| `et0Fao` | number (evapotranspiration mm) |
| `weatherCode` | number |

### HourlyWeather
| Field | Type |
|-------|------|
| `precipProbability` | number |
| `precipitation` | number |
| `temperature` | number |

---

## Sub-Features

### 7.1 Open-Meteo API Integration
- **Provider**: Open-Meteo (free, no API key required, ECMWF-quality data)
- **Endpoints used**:
  - Current weather: temperature, humidity, precipitation, weather code
  - Hourly forecast (48h): precipitation probability, evapotranspiration
  - Daily forecast (past 2 + today + next 6 = 9 days): max/min temp, precipitation, rain

### 7.2 Caching
- **Cache store**: Dexie `weatherCache` table (added in schema v7)
- **TTL**: 3 hours
- **Cache key**: `${lat.toFixed(2)}|${lng.toFixed(2)}` (rounded to 2 decimals to avoid GPS noise churn)
- **Stale-while-revalidate**: If a fresh fetch fails, the most recent cached data is served
- **Serialization**: Full `WeatherData` object stored as JSON

### 7.3 Suggestion Engine Integration
Weather data feeds into multiple suggestion rules:
- **Watering** (Rule 5): Water budget = 5-day rain − ET₀ evapotranspiration
- **No-Watering** (Rule 6): Rain forecast suppresses watering
- **Frost Protection** (Rule 7): 48-hour minimum temperature ≤ 2°C
- **Weeding** (Rule 1): Temperature + rainfall triggers
- **Fertilization** (Rule 4): Heavy rain forecast suppresses fertilization
- **AI context**: 7-day weather summary included in AI prompt

### 7.4 Graceful Degradation
- No location set → no weather fetch → suggestion engine falls to Tier 3 (rules only)
- Weather fetch fails → cached data served if available; else Tier 3
- Open-Meteo down → same as fetch failure

### 7.5 Location Dependency
- Weather requires `lat` and `lng` from settings (set via location verification)
- Cache key uses rounded coordinates to avoid noise from GPS drift

---

## External Dependencies
- **Open-Meteo API**: `https://api.open-meteo.com/v1/forecast`
- No authentication required
- Free tier: sufficient for personal use
- ECMWF-quality meteorological models
