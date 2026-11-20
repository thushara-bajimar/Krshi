import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Sun } from "lucide-react";
import { WMO } from "@/integrations/weather/codes";

const ICONS = { sun: Sun, "cloud-sun": CloudSun, cloud: Cloud, fog: CloudFog, drizzle: CloudDrizzle, rain: CloudRain, storm: CloudLightning };
export function WeatherIcon({ code, className = "h-6 w-6" }: { code: number; className?: string }) {
  const I = ICONS[WMO[code]?.icon ?? "cloud"];
  return <I className={className} aria-hidden />;
}
