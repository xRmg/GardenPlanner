# Feature 8: Calendar View

> Detailed feature documentation — source: codebase analysis, 2026-03-15

---

## Overview

The Calendar View provides a temporal perspective of the garden that the spatial grid view cannot. It overlays garden events, care suggestions, and harvest forecasts onto a monthly calendar, giving users a clear picture of their garden's rhythm — what happened, what's due, and when to expect harvests.

---

## Components

| Component | File | Role |
|-----------|------|------|
| Calendar View | `app/components/CalendarView.tsx` | Monthly calendar rendering |
| Calendar Model | `app/components/calendar/calendarModel.ts` | Data transformation for calendar display |

---

## Sub-Features

### 8.1 Monthly Calendar Grid
- 7-column week layout (locale-aware day names)
- Day cells with date number
- Previous/Next month navigation arrows
- Current month displayed at load

### 8.2 Event Display on Calendar
- Events shown as colored chips on their corresponding day cells
- Color-coded by event type (matching EventsBar icon colors)
- Event count badges when multiple events on same day
- Clickable chips for event details

### 8.3 Suggestion Display on Calendar
- Suggestions with due dates shown on their target day
- Color-coded by priority: high (red), medium (orange), low (blue)
- Source mode badge: AI+Weather, Rules+Weather, Rules, Static
- Plant icon + name on suggestion chips
- Suggestion count badges per day

### 8.4 Harvest Forecasting
- Harvest window indicators on calendar based on planted date + daysToHarvest:
  - **Ready** (green): Plant is ready to harvest now
  - **Upcoming** (lime): X days until harvest window
  - **Overdue** (amber): Past ideal harvest date
  - **Seasonal**: Harvest month match
- Countdown indicators showing days until harvest

### 8.5 Sowing Windows
- Month-level indicators showing:
  - Indoor sow window matches
  - Direct sow window matches
- Based on plant's `sowIndoorMonths` and `sowDirectMonths` arrays

### 8.6 Locale-Aware Formatting
- Month and day names formatted via `Intl.DateTimeFormat` (follows current locale)
- Date formatting respects locale conventions
- Calendar start day adapts to locale (Monday vs. Sunday start)

---

## Data Flow
- Events sourced from `useGardenEvents` (Dexie events table)
- Suggestions sourced from `useSuggestions` (runtime-generated)
- Harvest forecasts computed from placed plant instances + `daysToHarvest`
- Calendar model transforms raw data into per-day display objects
