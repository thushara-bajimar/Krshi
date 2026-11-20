import type { WeatherProvider } from "./types";

// Open-Meteo: free, no API key. Free tier is for non-commercial use (< 10 000 calls/day);
// commercial deployments need an Open-Meteo API subscription — see https://open-meteo.com/en/terms
export const openMeteo: WeatherProvider = {
  id: "open-meteo",
  name: "Open-Meteo",
  url: "https://open-meteo.com/",
  terms: "https://open-meteo.com/en/terms",
  async fetch(lat, lon) {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      current: "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
      forecast_days: "7",
      timezone: "Asia/Kolkata",
    }).toString();
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
    const j = await res.json();
    if (!j.current || !j.daily?.time) throw new Error("Unexpected response from Open-Meteo");
    return {
      provider: "Open-Meteo",
      providerUrl: "https://open-meteo.com/",
      latitude: j.latitude,
      longitude: j.longitude,
      current: {
        time: j.current.time,
        temperature: j.current.temperature_2m,
        humidity: j.current.relative_humidity_2m,
        precipitationMm: j.current.precipitation,
        weatherCode: j.current.weather_code,
        windKmh: j.current.wind_speed_10m,
        windDirection: j.current.wind_direction_10m,
      },
      daily: (j.daily.time as string[]).map((date, i) => ({
        date,
        weatherCode: j.daily.weather_code[i],
        tempMax: j.daily.temperature_2m_max[i],
        tempMin: j.daily.temperature_2m_min[i],
        precipitationMm: j.daily.precipitation_sum[i] ?? 0,
        precipitationProbability: j.daily.precipitation_probability_max?.[i] ?? null,
        windMaxKmh: j.daily.wind_speed_10m_max[i],
      })),
    };
  },
};
