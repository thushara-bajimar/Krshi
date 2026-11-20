import "server-only";
import { prisma } from "@/lib/db";
import { openMeteo } from "./open-meteo";
import type { WeatherProvider, WeatherReport } from "./types";

const TTL_MS = 30 * 60 * 1000;
const provider: WeatherProvider = openMeteo;

// District headquarters used when a farm has no map location (approximate town coordinates).
export const DISTRICT_CENTROIDS: Record<string, { lat: number; lon: number; label: string }> = {
  "Dakshina Kannada": { lat: 12.8698, lon: 74.843, label: "Mangaluru" },
  Udupi: { lat: 13.3409, lon: 74.7421, label: "Udupi" },
  "Uttara Kannada": { lat: 14.8136, lon: 74.1295, label: "Karwar" },
  Kodagu: { lat: 12.4244, lon: 75.7382, label: "Madikeri" },
  Shivamogga: { lat: 13.9299, lon: 75.5681, label: "Shivamogga" },
  Chikkamagaluru: { lat: 13.3161, lon: 75.772, label: "Chikkamagaluru" },
  Hassan: { lat: 13.0072, lon: 76.0962, label: "Hassan" },
};

export function resolveLocation(farm: { latitude?: unknown; longitude?: unknown; district?: string | null; name?: string } | null, userDistrict?: string | null) {
  if (farm?.latitude != null && farm?.longitude != null) {
    return { lat: Number(farm.latitude), lon: Number(farm.longitude), label: farm.name ?? "Farm location", precise: true };
  }
  const d = DISTRICT_CENTROIDS[farm?.district ?? userDistrict ?? ""] ?? DISTRICT_CENTROIDS["Dakshina Kannada"];
  return { lat: d.lat, lon: d.lon, label: `${d.label} (district centre)`, precise: false };
}

// Refreshes in flight, so many page views do not trigger duplicate provider calls.
const refreshing = new Map<string, Promise<WeatherReport | null>>();

async function refresh(key: string, lat: number, lon: number, label: string): Promise<WeatherReport | null> {
  const data = await provider.fetch(lat, lon);
  const fetchedAt = new Date();
  await prisma.weatherCache.upsert({ where: { key }, update: { payload: data as object, fetchedAt }, create: { key, provider: provider.id, payload: data as object, fetchedAt } });
  return { ...data, locationLabel: label, fetchedAt: fetchedAt.toISOString(), stale: false };
}

/**
 * Stale-while-revalidate: a fresh cache entry (< 30 min) is returned as LIVE. An older entry is returned
 * immediately, labelled as cached with its fetch time, while a background refresh updates it — so pages never
 * wait on a slow network. Only when nothing is cached does the request wait for the provider.
 */
export async function getWeather(lat: number, lon: number, label: string): Promise<WeatherReport | null> {
  const key = `${provider.id}:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = await prisma.weatherCache.findUnique({ where: { key } });
  const fromCache = (stale: boolean) =>
    ({ ...(cached!.payload as object), locationLabel: label, fetchedAt: cached!.fetchedAt.toISOString(), stale }) as WeatherReport;
  if (cached && Date.now() - cached.fetchedAt.getTime() < TTL_MS) return fromCache(false);

  let job = refreshing.get(key);
  if (!job) {
    job = refresh(key, lat, lon, label)
      .catch((e) => {
        console.warn("[weather] provider failed:", (e as Error).message);
        return null;
      })
      .finally(() => refreshing.delete(key));
    refreshing.set(key, job);
  }
  if (cached) return fromCache(true); // don't make the farmer wait; the refresh continues in the background
  return job;
}

export const weatherProviderInfo = { name: provider.name, url: provider.url, terms: provider.terms };

export const OFFICIAL_ADVISORY_LINKS = [
  { name: "IMD — district-wise weather warnings", url: "https://mausam.imd.gov.in/", note: "Official warnings from the India Meteorological Department." },
  { name: "IMD Agromet Advisory Services", url: "https://www.imdagrimet.gov.in/", note: "District Agromet advisories issued with agricultural universities." },
  { name: "KSNDMC (Karnataka State Natural Disaster Monitoring Centre)", url: "https://www.ksndmc.org/", note: "Karnataka rainfall monitoring and alerts." },
];
