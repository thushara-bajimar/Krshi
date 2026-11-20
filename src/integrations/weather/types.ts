export interface DailyForecast {
  date: string; // YYYY-MM-DD (local)
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationMm: number;
  precipitationProbability: number | null;
  windMaxKmh: number;
}

export interface WeatherReport {
  provider: string;
  providerUrl: string;
  latitude: number;
  longitude: number;
  locationLabel: string;
  current: { time: string; temperature: number; humidity: number; precipitationMm: number; weatherCode: number; windKmh: number; windDirection: number };
  daily: DailyForecast[];
  fetchedAt: string;
  /** true when the provider could not be reached and an older cached copy is shown */
  stale: boolean;
}

export interface WeatherProvider {
  id: string;
  name: string;
  url: string;
  terms: string;
  fetch(lat: number, lon: number): Promise<Omit<WeatherReport, "locationLabel" | "stale" | "fetchedAt">>;
}
