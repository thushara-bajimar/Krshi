// Rule-based natural-language parser for the KRSHI assistant. Works without any AI provider.
// It only *extracts* fields; records are never saved without the farmer confirming a pre-filled form,
// and answers to questions are always computed from the database, never generated.

export type Period = "today" | "yesterday" | "week" | "month" | "last_month" | "year";

export interface ParseContext {
  today: string; // YYYY-MM-DD (India)
  plots: { id: string; name: string; cropKey: string | null }[];
  workers: { id: string; name: string }[];
  crops: { id: string; key: string; name: string; nameKn: string | null }[];
}

export type Parsed =
  | { intent: "record_activity"; activity: { type: string; date: string; plotId?: string; cropId?: string; productName?: string; quantity?: number; quantityUnit?: string; cost?: number; description: string } }
  | { intent: "record_expense"; expense: { amount?: number; category: string; date: string; description: string; plotId?: string } }
  | { intent: "record_labor"; labor: { workerCount: number; workerIds: string[]; rate?: number; units: number; wageType: string; taskCategory: string; date: string; plotId?: string; amountPaid?: number } }
  | { intent: "record_task"; task: { title: string; date: string; category: string; plotId?: string } }
  | { intent: "query_spend"; period: Period }
  | { intent: "query_labor"; period: Period }
  | { intent: "query_income"; period: Period }
  | { intent: "query_activities"; period: Period; plotId?: string; cropKey?: string }
  | { intent: "query_price"; cropKey: string }
  | { intent: "query_tasks" }
  | { intent: "query_weather" }
  | { intent: "query_scheme"; keyword: string }
  | { intent: "unknown" };

const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, a: 1, an: 1,
  // Kannada
  "ಒಂದು": 1, "ಒಬ್ಬ": 1, "ಎರಡು": 2, "ಇಬ್ಬರು": 2, "ಮೂರು": 3, "ಮೂವರು": 3, "ನಾಲ್ಕು": 4, "ನಾಲ್ವರು": 4, "ಐದು": 5, "ಐವರು": 5, "ಆರು": 6, "ಏಳು": 7, "ಎಂಟು": 8, "ಒಂಬತ್ತು": 9, "ಹತ್ತು": 10,
};
const SCALE: Record<string, number> = { hundred: 100, thousand: 1000, lakh: 100000, "ನೂರು": 100, "ಸಾವಿರ": 1000 };

/** Normalise number words ("three", "nine hundred", "ಮೂರು") and Kannada digits to Arabic digits. */
export function normaliseNumbers(text: string): string {
  let t = text.replace(/[೦-೯]/g, (d) => String("೦೧೨೩೪೫೬೭೮೯".indexOf(d))).replace(/(\d),(\d{2,3})/g, "$1$2");
  t = t.replace(/(\d+(?:\.\d+)?)\s*(k)\b/gi, (_, n) => String(Number(n) * 1000));
  const tokens = t.split(/(\s+)/);
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const w = tokens[i].toLowerCase();
    const base = NUM_WORDS[w] ?? (/^\d+(\.\d+)?$/.test(w) ? Number(w) : null);
    if (base != null && !(w === "a" || w === "an") ) {
      let value = base;
      let j = i + 2;
      while (j < tokens.length && SCALE[tokens[j].toLowerCase()]) {
        value *= SCALE[tokens[j].toLowerCase()];
        j += 2;
      }
      out.push(String(value));
      i = j - 1;
      continue;
    }
    if ((w === "a" || w === "an") && SCALE[tokens[i + 2]?.toLowerCase() ?? ""]) {
      out.push(String(SCALE[tokens[i + 2].toLowerCase()]));
      i += 3;
      continue;
    }
    out.push(tokens[i]);
    i++;
  }
  return out.join("");
}

function shiftDate(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function extractDate(t: string, today: string): string {
  if (/\b(yesterday)\b|ನಿನ್ನೆ/.test(t)) return shiftDate(today, -1);
  if (/day before yesterday|ಮೊನ್ನೆ/.test(t)) return shiftDate(today, -2);
  if (/\btomorrow\b|ನಾಳೆ/.test(t)) return shiftDate(today, 1);
  const ago = /(\d+)\s*days?\s*ago/.exec(t);
  if (ago) return shiftDate(today, -Number(ago[1]));
  const inDays = /in\s*(\d+)\s*days?/.exec(t);
  if (inDays) return shiftDate(today, Number(inDays[1]));
  if (/next week/.test(t)) return shiftDate(today, 7);
  const dm = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/.exec(t); // dd/mm(/yyyy) — Indian order
  if (dm) {
    const y = dm[3] ? (dm[3].length === 2 ? 2000 + Number(dm[3]) : Number(dm[3])) : Number(today.slice(0, 4));
    const iso = `${y}-${String(dm[2]).padStart(2, "0")}-${String(dm[1]).padStart(2, "0")}`;
    if (!Number.isNaN(new Date(iso).getTime())) return iso;
  }
  return today;
}

export function extractPeriod(t: string): Period {
  if (/last month|previous month|ಕಳೆದ ತಿಂಗಳು/.test(t)) return "last_month";
  if (/this year|year|ವರ್ಷ/.test(t)) return "year";
  if (/this week|week|ವಾರ/.test(t)) return "week";
  if (/yesterday|ನಿನ್ನೆ/.test(t)) return "yesterday";
  if (/\btoday\b|ಇಂದು|ಇವತ್ತು/.test(t)) return "today";
  return "month";
}

const CROP_WORDS: Record<string, RegExp> = {
  arecanut: /areca|arecanut|supari|betel ?nut|ಅಡಿಕೆ/,
  coconut: /coconut|copra|ತೆಂಗು|ತೆಂಗಿನ/,
  paddy: /paddy|rice|ಭತ್ತ/,
  pepper: /pepper|ಮೆಣಸು/,
  cashew: /cashew|ಗೇರು/,
  banana: /banana|ಬಾಳೆ/,
  cocoa: /cocoa|ಕೊಕ್ಕೊ/,
  rubber: /rubber|ರಬ್ಬರ್/,
  vegetables: /vegetable|brinjal|cucumber|ತರಕಾರಿ/,
};
export function extractCrop(t: string): string | undefined {
  return Object.entries(CROP_WORDS).find(([, r]) => r.test(t))?.[0];
}

export function matchPlot(t: string, ctx: ParseContext): string | undefined {
  // 1. plot name mentioned verbatim
  const byName = [...ctx.plots].sort((a, b) => b.name.length - a.name.length).find((p) => t.includes(p.name.toLowerCase()));
  if (byName) return byName.id;
  // 2. "plot 2" / "block b"
  const num = /(?:plot|block|ತಾಕು)\s*(\w+)/.exec(t);
  if (num) {
    const k = num[1].toLowerCase();
    const hit = ctx.plots.find((p) => new RegExp(`(plot|block)\\s*${k}\\b`, "i").test(p.name) || p.name.toLowerCase().endsWith(` ${k}`));
    if (hit) return hit.id;
    if (/^\d+$/.test(k) && ctx.plots[Number(k) - 1]) return ctx.plots[Number(k) - 1].id;
  }
  // 3. "my arecanut plot" — only when exactly one plot grows that crop
  const crop = extractCrop(t);
  if (crop) {
    const candidates = ctx.plots.filter((p) => p.cropKey === crop);
    if (candidates.length === 1) return candidates[0].id;
  }
  return undefined;
}

const ACTIVITY_WORDS: [RegExp, string][] = [
  [/fungicide|bordeaux|copper|ಬೋರ್ಡೋ|ಶಿಲೀಂಧ್ರ/, "FUNGICIDE"],
  [/herbicide|weedicide|ಕಳೆನಾಶಕ/, "HERBICIDE"],
  [/pesticide|insecticide|ಕೀಟನಾಶಕ/, "PESTICIDE"],
  [/fertili[sz]er|manure|urea|compost|ಗೊಬ್ಬರ/, "FERTILIZER"],
  [/irrigat|water(ed)?\b|ನೀರು/, "IRRIGATION"],
  [/prun|ಸವರ/, "PRUNING"],
  [/weed|clean|ಕಳೆ|ಸ್ವಚ್ಛ/, "CLEANING"],
  [/plant(ed|ing)|transplant|sow|ನಾಟಿ|ಬಿತ್ತ/, "PLANTING"],
  [/harvest|pluck|ಕೊಯ್ಲು/, "HARVESTING"],
  [/spray|ಸಿಂಪಡ|ಔಷಧಿ/, "PESTICIDE"],
];

const EXPENSE_WORDS: [RegExp, string][] = [
  [/transport|lorry|vehicle|auto|ಸಾಗಣೆ|ಬಾಡಿಗೆ ವಾಹನ/, "TRANSPORT"],
  [/diesel|petrol|fuel|ಡೀಸೆಲ್|ಪೆಟ್ರೋಲ್/, "FUEL"],
  [/electric|current bill|power bill|ವಿದ್ಯುತ್|ಕರೆಂಟ್/, "ELECTRICITY"],
  [/fertili[sz]er|manure|urea|ಗೊಬ್ಬರ/, "FERTILIZER"],
  [/pesticide|fungicide|copper|chemical|ಔಷಧಿ|ಕೀಟನಾಶಕ/, "PESTICIDE"],
  [/seed|seedling|sapling|ಬೀಜ|ಸಸಿ/, "SEEDS"],
  [/repair|service|maintenance|ದುರಸ್ತಿ/, "MAINTENANCE"],
  [/rent|hire|ಬಾಡಿಗೆ/, "RENTAL"],
  [/pipe|drip|sprinkler|pump/, "IRRIGATION"],
  [/machine|tractor|tiller/, "MACHINERY"],
  [/tool|equipment|sprayer|ladder/, "EQUIPMENT"],
];

const WORK_WORDS: [RegExp, string][] = [
  [/climb|ಮರ ಹತ್ತ/, "climbing"], [/spray|ಸಿಂಪಡ|ಔಷಧಿ/, "spraying"], [/harvest|pluck|ಕೊಯ್ಲು/, "harvesting"], [/prun/, "pruning"],
  [/weed|ಕಳೆ/, "weeding"], [/clean|ಸ್ವಚ್ಛ/, "cleaning"], [/plant|transplant|ನಾಟಿ/, "planting"], [/irrigat|water/, "irrigation"],
  [/transport|load/, "transport"], [/fertili[sz]er|manure|ಗೊಬ್ಬರ/, "fertilizer"],
];

const TASK_WORDS: [RegExp, string][] = [
  [/spray/, "spraying"], [/fertili[sz]er|manure/, "fertilizer"], [/irrigat|water/, "irrigation"], [/harvest|pluck/, "harvesting"],
  [/prun/, "pruning"], [/clean|weed/, "cleaning"], [/plant/, "planting"], [/service|repair|maintenance/, "maintenance"],
];

const first = <T,>(t: string, list: [RegExp, T][], fallback: T) => list.find(([r]) => r.test(t))?.[1] ?? fallback;

/** Amount in rupees: "500 rupees", "rs 500", "₹500", "for 500". */
function extractAmount(t: string): number | undefined {
  const m = /(?:₹|rs\.?|inr|rupees?)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|rupees?|ರೂಪಾಯಿ|ರೂ)/.exec(t);
  if (m) return Number(m[1] ?? m[2]);
  const f = /\b(?:for|of|cost|paid|spent)\s+(\d+(?:\.\d+)?)/.exec(t);
  return f ? Number(f[1]) : undefined;
}

export function parseCommand(input: string, ctx: ParseContext): Parsed {
  const raw = input.trim();
  const t = normaliseNumbers(raw.toLowerCase());
  const date = extractDate(t, ctx.today);
  const question = /\?|^(how|what|show|which|when|list|tell|did|is|are)\b|ಎಷ್ಟು|ಯಾವ|ತೋರಿಸು|ಏನು/.test(t);

  // ---- questions
  if (question || /\b(show|list)\b/.test(t)) {
    if (/price|rate|market|ದರ|ಬೆಲೆ|ಮಾರುಕಟ್ಟೆ/.test(t)) return { intent: "query_price", cropKey: extractCrop(t) ?? "arecanut" };
    if (/weather|rain|forecast|ಮಳೆ|ಹವಾಮಾನ/.test(t)) return { intent: "query_weather" };
    if (/scheme|subsidy|yojana|ಯೋಜನೆ|ಸಬ್ಸಿಡಿ/.test(t)) return { intent: "query_scheme", keyword: (/(?:scheme|subsidy)\s+(?:for|on)\s+(\w+)/.exec(t)?.[1]) ?? extractCrop(t) ?? "" };
    if (/upcoming|planned|task|to do|todo|schedule|ಮುಂದಿನ|ಕೆಲಸಗಳು/.test(t)) return { intent: "query_tasks" };
    if (/labou?r|wage|worker|ಕೂಲಿ|ಕಾರ್ಮಿಕ/.test(t)) return { intent: "query_labor", period: extractPeriod(t) };
    if (/income|earn|sale|sold|ಆದಾಯ|ಮಾರಾಟ/.test(t)) return { intent: "query_income", period: extractPeriod(t) };
    if (/spen[dt]|expense|cost|money|ಖರ್ಚು/.test(t)) return { intent: "query_spend", period: extractPeriod(t) };
    if (/appl(y|ied)|spray|did i|activit|done|ಹಾಕಿ|ಮಾಡಿ/.test(t)) return { intent: "query_activities", period: extractPeriod(t), plotId: matchPlot(t, ctx), cropKey: extractCrop(t) };
  }

  // ---- labour: "paid three workers 900 rupees each", "3 workers 1 day 800"
  const workerCountM = /(\d+)\s*(?:workers?|labou?rers?|people|persons?|men|women|coolies?|ಕಾರ್ಮಿಕ|ಜನ|ಆಳು)/.exec(t);
  const named = ctx.workers.filter((w) => t.includes(w.name.toLowerCase()));
  if (workerCountM || named.length || /\b(wage|labou?r|coolie)\b|ಕೂಲಿ/.test(t)) {
    const each = /(\d+(?:\.\d+)?)\s*(?:rupees?|rs\.?|₹|ರೂ\S*)?\s*(?:each|per (?:head|person|worker|day)|ಪ್ರತಿ)|(?:each|per (?:head|person|worker))\s*(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)/.exec(t);
    const days = /(\d+(?:\.\d+)?)\s*(?:days?|ದಿನ)/.exec(t);
    const hours = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|ಗಂಟೆ)/.exec(t);
    const half = /half[- ]?day|ಅರ್ಧ ದಿನ/.test(t);
    const count = named.length || (workerCountM ? Number(workerCountM[1]) : 1);
    let rate = each ? Number(each[1] ?? each[2]) : undefined;
    const total = extractAmount(t);
    if (rate == null && total != null) rate = /\btotal\b|altogether|ಒಟ್ಟು/.test(t) && count > 0 ? Math.round((total / count) * 100) / 100 : total;
    return {
      intent: "record_labor",
      labor: {
        workerCount: count, workerIds: named.map((w) => w.id), rate,
        units: hours ? Number(hours[1]) : days ? Number(days[1]) : 1,
        wageType: hours ? "HOURLY" : half ? "HALF_DAY" : "DAILY",
        taskCategory: first(t, WORK_WORDS, "other"), date, plotId: matchPlot(t, ctx),
        amountPaid: /\bpaid\b|ಕೊಟ್ಟೆ|ಪಾವತಿ/.test(t) && rate != null ? Math.round(rate * count * (hours ? Number(hours[1]) : days ? Number(days[1]) : 1) * 100) / 100 : undefined,
      },
    };
  }

  // ---- tasks: "remind me to spray block a on friday", "plan harvest tomorrow"
  if (/remind|plan|schedule|need to|have to|ನೆನಪಿಸು|ಯೋಜಿಸು/.test(t)) {
    const title = raw.replace(/^(please\s+)?(remind me to|plan( to)?|schedule|i need to|i have to)\s*/i, "").replace(/\s+(tomorrow|today|next week|in \d+ days?)\s*$/i, "");
    return { intent: "record_task", task: { title: title.charAt(0).toUpperCase() + title.slice(1), date: date === ctx.today && /tomorrow|ನಾಳೆ/.test(t) ? date : date, category: first(t, TASK_WORDS, "other"), plotId: matchPlot(t, ctx) } };
  }

  // ---- expenses: "add an expense of 500 rupees for transport", "spent 1200 on diesel"
  if (/expense|spent|spend|bought|purchase|paid|bill|ಖರ್ಚು|ಖರೀದಿ/.test(t) && !/sprayed|applied|ಹಾಕಿದೆ/.test(t)) {
    const what = /(?:for|on)\s+([a-zಀ-೿ ]+?)(?:\s+(?:today|yesterday|for|on|in)\b|$)/.exec(t);
    return { intent: "record_expense", expense: { amount: extractAmount(t), category: first(t, EXPENSE_WORDS, "OTHER"), date, description: what?.[1]?.trim() ?? raw, plotId: matchPlot(t, ctx) } };
  }

  // ---- activities: "I sprayed fertilizer in my arecanut plot today", "applied 20 bags manure to block a"
  const actType = ACTIVITY_WORDS.find(([r]) => r.test(t))?.[1];
  if (actType) {
    const qty = /(\d+(?:\.\d+)?)\s*(kg|kgs|kilo|g|grams?|l|litres?|liters?|ml|bags?|packets?|quintal)\b/.exec(t);
    const unitMap: Record<string, string> = { kgs: "kg", kilo: "kg", gram: "g", grams: "g", litre: "l", litres: "l", liter: "l", liters: "l", bags: "bag", packets: "packet" };
    const prod = /(?:of|with|applied|sprayed|used)\s+(?:\d+(?:\.\d+)?\s*\w+\s+(?:of\s+)?)?([a-z][a-z0-9:\- ]{2,40}?)(?:\s+(?:in|on|to|at|for|today|yesterday)\b|$)/.exec(t);
    const productName = prod && !/^(my|the|plot|block|it)\b/.test(prod[1]) ? prod[1].trim() : undefined;
    const plotId = matchPlot(t, ctx);
    const crop = extractCrop(t);
    return {
      intent: "record_activity",
      activity: {
        type: actType, date, plotId,
        cropId: !plotId && crop ? ctx.crops.find((c) => c.key === crop)?.id : undefined,
        productName: productName && productName.length < 41 ? productName.replace(/\b\w/g, (c) => c.toUpperCase()) : undefined,
        quantity: qty ? Number(qty[1]) : undefined, quantityUnit: qty ? unitMap[qty[2]] ?? qty[2] : undefined,
        cost: extractAmount(t), description: raw,
      },
    };
  }
  return { intent: "unknown" };
}
