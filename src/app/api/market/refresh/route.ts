import { authed, json } from "@/lib/http";
import { maybeRefreshMarketPrices } from "@/integrations/market/service";

export const POST = authed(async () => json(await maybeRefreshMarketPrices(true)), { limit: 3, windowMs: 10 * 60 * 1000 });
