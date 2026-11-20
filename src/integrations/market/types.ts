export interface PriceRow {
  commodity: string;
  cropKey: string;
  variety: string;
  grade: string;
  market: string;
  district: string;
  state: string;
  priceDate: Date;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  unit: string;
}

export interface MarketPriceProvider {
  id: string;
  name: string;
  sourceUrl: string;
  live: boolean;
  isConfigured(): boolean;
  fetchLatest(opts: { state: string; districts?: string[] }): Promise<PriceRow[]>;
}

// Mapping from AGMARKNET commodity names (as published) to KRSHI crop keys.
export const COMMODITY_MAP: Array<{ match: RegExp; cropKey: string }> = [
  { match: /^arecanut|betelnut|supari/i, cropKey: "arecanut" },
  { match: /^coconut|^copra|tender coconut/i, cropKey: "coconut" },
  { match: /^paddy|^rice/i, cropKey: "paddy" },
  { match: /pepper/i, cropKey: "pepper" },
  { match: /cashew/i, cropKey: "cashew" },
  { match: /^banana/i, cropKey: "banana" },
  { match: /cocoa/i, cropKey: "cocoa" },
  { match: /rubber/i, cropKey: "rubber" },
  { match: /brinjal|tomato|cucumber|bhindi|ladies finger|bitter gourd|snake gourd|ash gourd|pumpkin|beans|chilli|green chilli|cabbage|onion|potato|amaranthus|cowpea|drumstick|ridge gourd|bottle gourd/i, cropKey: "vegetables" },
];

export const cropKeyFor = (commodity: string) => COMMODITY_MAP.find((m) => m.match.test(commodity))?.cropKey ?? null;
