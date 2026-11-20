export const DISTRICTS: Record<string, string[]> = {
  "Dakshina Kannada": ["Mangaluru", "Bantwal", "Belthangady", "Puttur", "Sullia", "Moodbidri", "Kadaba", "Mulki", "Ullal"],
  Udupi: ["Udupi", "Kundapura", "Karkala", "Brahmavar", "Kapu", "Byndoor", "Hebri"],
  "Uttara Kannada": ["Karwar", "Ankola", "Kumta", "Honnavar", "Bhatkal", "Sirsi", "Siddapur", "Yellapur", "Mundgod", "Haliyal", "Joida", "Dandeli"],
  Kodagu: ["Madikeri", "Somwarpet", "Virajpet", "Kushalnagar", "Ponnampet"],
  Shivamogga: ["Shivamogga", "Sagar", "Thirthahalli", "Hosanagara", "Sorab", "Shikaripura", "Bhadravati"],
  Chikkamagaluru: ["Chikkamagaluru", "Koppa", "Sringeri", "Mudigere", "Narasimharajapura", "Tarikere", "Kadur"],
  Hassan: ["Hassan", "Sakleshpur", "Belur", "Arsikere", "Alur", "Arkalgud", "Channarayapatna", "Holenarasipura"],
};
export const DISTRICT_NAMES = Object.keys(DISTRICTS);

export const AREA_UNIT_LABEL: Record<string, string> = { ACRE: "acre", CENT: "cent", GUNTA: "gunta", HECTARE: "hectare", SQ_M: "sq m" };

export const ACTIVITY_LABEL: Record<string, string> = {
  FERTILIZER: "Fertilizer application", PESTICIDE: "Pesticide application", FUNGICIDE: "Fungicide application",
  HERBICIDE: "Herbicide application", IRRIGATION: "Irrigation", PRUNING: "Pruning", CLEANING: "Cleaning / weeding",
  PLANTING: "Planting", HARVESTING: "Harvesting", SOIL_PREPARATION: "Soil preparation", PEST_MANAGEMENT: "Pest management",
  DISEASE_MANAGEMENT: "Disease management", EQUIPMENT_USAGE: "Equipment usage", OTHER: "Other",
};
export const ACTIVITY_LABEL_KN: Record<string, string> = {
  FERTILIZER: "ಗೊಬ್ಬರ ಹಾಕುವುದು", PESTICIDE: "ಕೀಟನಾಶಕ ಸಿಂಪಡಣೆ", FUNGICIDE: "ಶಿಲೀಂಧ್ರನಾಶಕ ಸಿಂಪಡಣೆ", HERBICIDE: "ಕಳೆನಾಶಕ",
  IRRIGATION: "ನೀರಾವರಿ", PRUNING: "ಸವರುವಿಕೆ", CLEANING: "ಸ್ವಚ್ಛತೆ / ಕಳೆ ತೆಗೆಯುವುದು", PLANTING: "ನಾಟಿ", HARVESTING: "ಕೊಯ್ಲು",
  SOIL_PREPARATION: "ಮಣ್ಣು ಸಿದ್ಧತೆ", PEST_MANAGEMENT: "ಕೀಟ ನಿರ್ವಹಣೆ", DISEASE_MANAGEMENT: "ರೋಗ ನಿರ್ವಹಣೆ", EQUIPMENT_USAGE: "ಯಂತ್ರ ಬಳಕೆ", OTHER: "ಇತರೆ",
};
export const ACTIVITY_COLOR: Record<string, string> = {
  FERTILIZER: "bg-leaf-100 text-leaf-800", PESTICIDE: "bg-amber-100 text-amber-900", FUNGICIDE: "bg-amber-100 text-amber-900",
  HERBICIDE: "bg-amber-100 text-amber-900", IRRIGATION: "bg-sky-100 text-sky-900", PRUNING: "bg-earth-100 text-earth-800",
  CLEANING: "bg-earth-100 text-earth-800", PLANTING: "bg-leaf-100 text-leaf-800", HARVESTING: "bg-leaf-200 text-leaf-900",
  SOIL_PREPARATION: "bg-earth-100 text-earth-800", PEST_MANAGEMENT: "bg-amber-100 text-amber-900", DISEASE_MANAGEMENT: "bg-amber-100 text-amber-900",
  EQUIPMENT_USAGE: "bg-stone-100 text-stone-800", OTHER: "bg-stone-100 text-stone-800",
};

export const EXPENSE_LABEL: Record<string, string> = {
  FERTILIZER: "Fertilizer", PESTICIDE: "Pesticide", SEEDS: "Seeds & seedlings", LABOR: "Labour (other)", MACHINERY: "Machinery",
  EQUIPMENT: "Equipment", IRRIGATION: "Irrigation", ELECTRICITY: "Electricity", FUEL: "Fuel", TRANSPORT: "Transport",
  MAINTENANCE: "Maintenance", RENTAL: "Rental", OTHER: "Other",
};

export const WORK_LABEL: Record<string, string> = {
  spraying: "Spraying", harvesting: "Harvesting", climbing: "Climbing", pruning: "Pruning", cleaning: "Cleaning", planting: "Planting",
  irrigation: "Irrigation", transport: "Transport", weeding: "Weeding", fertilizer: "Fertilizer application", other: "Other",
};
export const WAGE_LABEL: Record<string, string> = { DAILY: "Per day", HALF_DAY: "Per half-day", HOURLY: "Per hour", TASK: "Per task / piece" };
export const WAGE_UNIT: Record<string, string> = { DAILY: "days", HALF_DAY: "half-days", HOURLY: "hours", TASK: "tasks" };

export const TASK_LABEL: Record<string, string> = {
  fertilizer: "Fertilizer", spraying: "Spraying", irrigation: "Irrigation", cleaning: "Cleaning", pruning: "Pruning", harvesting: "Harvesting",
  planting: "Planting", maintenance: "Equipment maintenance", labor: "Labour work", other: "Other",
};
export const TASK_STATUS_LABEL: Record<string, string> = { PLANNED: "Planned", IN_PROGRESS: "In progress", COMPLETED: "Completed", CANCELLED: "Cancelled" };

export const INVENTORY_LABEL: Record<string, string> = { FERTILIZER: "Fertilizer", PESTICIDE: "Pesticide", SEEDS: "Seeds", TOOLS: "Tools", EQUIPMENT: "Equipment", IRRIGATION: "Irrigation materials", OTHER: "Other supplies" };

export const ROLE_LABEL: Record<string, string> = { OWNER: "Owner", MANAGER: "Farm manager", FINANCE_VIEWER: "Finance viewer", VIEWER: "Viewer" };
export const ROLE_HELP: Record<string, string> = {
  MANAGER: "Can view and record everything, including money. Cannot share or delete the farm.",
  FINANCE_VIEWER: "Can view all records including expenses and income, but cannot change anything.",
  VIEWER: "Can view farm work (plots, diary, tasks, harvests, inventory). Cannot see money or wages.",
};

export const HARVEST_UNITS = ["kg", "quintal", "tonne", "nuts", "bunch", "nos"];
