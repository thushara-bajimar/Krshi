import { authed } from "@/lib/http";
import { getFarmContext } from "@/lib/authz";
import { badRequest, unauthorized } from "@/lib/errors";
import { loadReport, parseReportParams, reportCsv } from "@/server/reports";

export const GET = authed(async (req) => {
  const ctx = await getFarmContext();
  if (!ctx) throw unauthorized();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  if (!ctx.farm && !sp.farm) throw badRequest("No farm selected");
  const p = parseReportParams(sp, ctx.farm!.id);
  const r = await loadReport(ctx.user.id, p);
  const { name, csv } = reportCsv(r, p.type === "farm" ? (sp.section as never) ?? "activity" : p.type);
  const fname = `krishi-${name}-${r.range.from.toISOString().slice(0, 10)}_${r.range.to.toISOString().slice(0, 10)}.csv`;
  // BOM so Excel opens Kannada / ₹ text correctly
  return new Response("\uFEFF" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${fname}"` } });
});
