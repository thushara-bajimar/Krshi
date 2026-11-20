import type { DailyForecast } from "./types";

// IMD 24-hour rainfall categories (India Meteorological Department terminology):
// heavy 64.5–115.5 mm, very heavy 115.6–204.4 mm, extremely heavy ≥ 204.5 mm.
export function rainCategory(mm: number): "none" | "light" | "moderate" | "heavy" | "very_heavy" | "extremely_heavy" {
  if (mm >= 204.5) return "extremely_heavy";
  if (mm >= 115.6) return "very_heavy";
  if (mm >= 64.5) return "heavy";
  if (mm >= 15.6) return "moderate";
  if (mm >= 2.5) return "light";
  return "none";
}

export interface WeatherAlert {
  level: "warning" | "info";
  date: string;
  title: string;
  detail: string;
}

export function forecastAlerts(daily: DailyForecast[]): WeatherAlert[] {
  const out: WeatherAlert[] = [];
  for (const d of daily) {
    const cat = rainCategory(d.precipitationMm);
    if (cat === "heavy" || cat === "very_heavy" || cat === "extremely_heavy") {
      out.push({
        level: "warning",
        date: d.date,
        title: `${cat.replace("_", " ").replace(/^./, (c) => c.toUpperCase())} rain forecast`,
        detail: `${d.precipitationMm.toFixed(1)} mm forecast (IMD category: ${cat.replace("_", " ")}). Check drainage and secure harvested produce. Follow official IMD/KSNDMC warnings.`,
      });
    }
    if (d.windMaxKmh >= 40) {
      out.push({ level: "warning", date: d.date, title: "Strong winds forecast", detail: `Gusts up to ${Math.round(d.windMaxKmh)} km/h forecast. Avoid climbing palms and spraying in strong wind.` });
    }
  }
  return out;
}

/**
 * Context for a planned spraying/fertilizer task — NOT a recommendation. It only reports what the forecast says
 * around the task date so the farmer can decide, together with the product label's guidance on rain-fastness.
 */
export function taskWeatherContext(taskDate: string, daily: DailyForecast[]): { risk: "rain" | "dry" | "unknown"; note: string } {
  const idx = daily.findIndex((d) => d.date === taskDate);
  if (idx === -1) return { risk: "unknown", note: "Forecast not available for this date yet (7-day window)." };
  const day = daily[idx];
  const next = daily[idx + 1];
  const wet = (d?: DailyForecast) => !!d && (d.precipitationMm >= 2.5 || (d.precipitationProbability ?? 0) >= 60);
  if (wet(day) || wet(next)) {
    const parts = [day, next].filter(Boolean).map((d) => `${d!.date}: ${d!.precipitationMm.toFixed(1)} mm${d!.precipitationProbability != null ? `, ${d!.precipitationProbability}% chance` : ""}`);
    return { risk: "rain", note: `Rain is forecast on or after this date (${parts.join("; ")}). Check the product label for rain-free time needed after application.` };
  }
  return { risk: "dry", note: `Little rain forecast (${day.precipitationMm.toFixed(1)} mm${day.precipitationProbability != null ? `, ${day.precipitationProbability}% chance` : ""}).` };
}
