// WMO weather interpretation codes (as used by Open-Meteo)
export const WMO: Record<number, { en: string; kn: string; icon: "sun" | "cloud-sun" | "cloud" | "fog" | "drizzle" | "rain" | "storm" }> = {
  0: { en: "Clear sky", kn: "ಸ್ವಚ್ಛ ಆಕಾಶ", icon: "sun" },
  1: { en: "Mainly clear", kn: "ಬಹುತೇಕ ಸ್ವಚ್ಛ", icon: "cloud-sun" },
  2: { en: "Partly cloudy", kn: "ಭಾಗಶಃ ಮೋಡ", icon: "cloud-sun" },
  3: { en: "Overcast", kn: "ಮೋಡ ಕವಿದ", icon: "cloud" },
  45: { en: "Fog", kn: "ಮಂಜು", icon: "fog" },
  48: { en: "Rime fog", kn: "ಮಂಜು", icon: "fog" },
  51: { en: "Light drizzle", kn: "ಹನಿ ಮಳೆ", icon: "drizzle" },
  53: { en: "Drizzle", kn: "ಹನಿ ಮಳೆ", icon: "drizzle" },
  55: { en: "Dense drizzle", kn: "ಹನಿ ಮಳೆ", icon: "drizzle" },
  61: { en: "Light rain", kn: "ಸಾಧಾರಣ ಮಳೆ", icon: "rain" },
  63: { en: "Rain", kn: "ಮಳೆ", icon: "rain" },
  65: { en: "Heavy rain", kn: "ಭಾರೀ ಮಳೆ", icon: "rain" },
  80: { en: "Rain showers", kn: "ತುಂತುರು ಮಳೆ", icon: "rain" },
  81: { en: "Rain showers", kn: "ತುಂತುರು ಮಳೆ", icon: "rain" },
  82: { en: "Violent showers", kn: "ಭಾರೀ ಮಳೆ", icon: "rain" },
  95: { en: "Thunderstorm", kn: "ಗುಡುಗು ಸಹಿತ ಮಳೆ", icon: "storm" },
  96: { en: "Thunderstorm with hail", kn: "ಆಲಿಕಲ್ಲು ಮಳೆ", icon: "storm" },
  99: { en: "Thunderstorm with hail", kn: "ಆಲಿಕಲ್ಲು ಮಳೆ", icon: "storm" },
};
export const describeWeather = (code: number, lang: "en" | "kn" = "en") => WMO[code]?.[lang] ?? (lang === "kn" ? "ಮಾಹಿತಿ ಇಲ್ಲ" : "Unknown");
