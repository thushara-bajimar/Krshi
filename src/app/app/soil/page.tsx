import Link from "next/link";
import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { serialize } from "@/lib/serialize";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { NoFarm } from "@/components/app/no-farm";
import { SimpleLine } from "@/components/charts";
import { Attachments } from "@/components/forms/attachments";
import { DeleteRecordButton } from "@/components/forms/delete-button";
import { AddSoilButton, EditSoilButton } from "@/features/soil/actions";
import { date, number } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Soil health" };
const PARAMS = [
  { key: "ph", label: "pH", unit: "", info: "How acidic or alkaline the soil is. Affects how well plants can take up nutrients." },
  { key: "ec", label: "EC", unit: "dS/m", info: "Electrical conductivity — an indicator of soluble salts." },
  { key: "organicCarbon", label: "Organic carbon", unit: "%", info: "An indicator of soil organic matter, which supports soil structure, water holding and microbial life." },
  { key: "nitrogen", label: "Available N", unit: "kg/ha", info: "Nitrogen available to plants." },
  { key: "phosphorus", label: "Available P", unit: "kg/ha", info: "Phosphorus available to plants." },
  { key: "potassium", label: "Available K", unit: "kg/ha", info: "Potassium available to plants." },
] as const;

export default async function SoilPage({ searchParams }: { searchParams: Promise<{ plot?: string }> }) {
  const ctx = await pageContext();
  if (!ctx.farm) return <NoFarm />;
  const { plot } = await searchParams;
  const [tests, plots] = await Promise.all([
    prisma.soilTest.findMany({ where: { farmId: ctx.farm.id, ...(plot ? { plotId: plot } : {}) }, include: { plot: true, attachments: true }, orderBy: { testDate: "desc" } }),
    prisma.plot.findMany({ where: { farmId: ctx.farm.id, soilTests: { some: {} } }, orderBy: { name: "asc" } }),
  ]);
  const editable = ctx.can("write");
  const trendPlot = plot ?? plots.find((p) => tests.filter((t) => t.plotId === p.id).length > 1)?.id;
  const trend = tests.filter((t) => t.plotId === trendPlot).reverse().map((t) => ({ label: date(t.testDate, { month: "short", year: "2-digit" }), ph: t.ph == null ? null : Number(t.ph), organicCarbon: t.organicCarbon == null ? null : Number(t.organicCarbon), nitrogen: t.nitrogen == null ? null : Number(t.nitrogen), phosphorus: t.phosphorus == null ? null : Number(t.phosphorus), potassium: t.potassium == null ? null : Number(t.potassium) }));

  return (
    <>
      <PageHeader title="Soil health" subtitle="Your soil test results by plot, with the original report attached." actions={editable ? <AddSoilButton /> : undefined} />
      {plots.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href="/app/soil" className={cn("rounded-full border px-3 py-1 text-sm", !plot ? "border-leaf-700 bg-leaf-800 text-white" : "border-line bg-white")}>All plots</Link>
          {plots.map((p) => <Link key={p.id} href={`/app/soil?plot=${p.id}`} className={cn("rounded-full border px-3 py-1 text-sm", plot === p.id ? "border-leaf-700 bg-leaf-800 text-white" : "border-line bg-white")}>{p.name}</Link>)}
        </div>
      )}
      {tests.length === 0 ? (
        <Card><EmptyState icon={<FlaskConical className="h-6 w-6" />} title="No soil tests recorded" body="Get your soil tested through the Raitha Samparka Kendra / Soil Health Card programme, then enter the values exactly as printed and attach a photo of the report." action={editable ? <AddSoilButton /> : undefined} /></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            {trend.length > 1 && (
              <Card>
                <CardHeader title={`Changes over time — ${plots.find((p) => p.id === trendPlot)?.name}`} subtitle={`${trend.length} tests`} />
                <CardBody className="grid gap-4 sm:grid-cols-2">
                  {(["ph", "organicCarbon", "nitrogen", "potassium"] as const).map((k) => trend.some((t) => t[k] != null) && (
                    <div key={k}><p className="text-xs font-medium text-muted">{PARAMS.find((p) => p.key === k)!.label} {PARAMS.find((p) => p.key === k)!.unit && `(${PARAMS.find((p) => p.key === k)!.unit})`}</p><SimpleLine data={trend} dataKey={k} name={PARAMS.find((p) => p.key === k)!.label} /></div>
                  ))}
                </CardBody>
              </Card>
            )}
            {tests.map((t) => {
              const micro = (t.micronutrients ?? {}) as Record<string, number>;
              return (
                <Card key={t.id}>
                  <CardHeader title={`${t.plot?.name ?? "Farm"} · ${date(t.testDate)}`} subtitle={[t.laboratory, t.sampleId && `Sample ${t.sampleId}`, t.soilType].filter(Boolean).join(" · ")}
                    action={editable ? <div className="flex"><EditSoilButton record={serialize(t)} /><DeleteRecordButton iconOnly entity="soilTest" id={t.id} label="this soil test" /></div> : undefined} />
                  <CardBody>
                    <dl className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                      {PARAMS.map((p) => {
                        const val = t[p.key as keyof typeof t];
                        return <div key={p.key} className="rounded-lg bg-sand/50 p-2"><dt className="text-[11px] text-muted">{p.label}</dt><dd className="font-semibold tabular">{val == null ? "—" : number(Number(val))}<span className="ml-0.5 text-[11px] font-normal text-muted">{val == null ? "" : p.unit}</span></dd></div>;
                      })}
                    </dl>
                    {Object.keys(micro).length > 0 && <p className="mt-3 text-sm text-muted">Micronutrients (ppm): {Object.entries(micro).map(([k, v]) => `${k} ${v}`).join(" · ")}</p>}
                    {t.notes && <p className="mt-3 whitespace-pre-line text-sm">{t.notes}</p>}
                    <div className="mt-4 border-t border-line pt-4"><p className="mb-2 text-sm font-medium">Report</p><Attachments target="soilTest" targetId={t.id} items={t.attachments} editable={editable} /></div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader title="Understanding the numbers" />
              <CardBody className="space-y-3 text-sm">
                {PARAMS.map((p) => <p key={p.key}><b>{p.label}</b> <span className="text-muted">— {p.info}</span></p>)}
                <p className="border-t border-line pt-3 text-xs text-muted">KRSHI does not rate your results or calculate fertilizer doses from them. Ratings (low / medium / high) and crop-wise recommendations are printed on your Soil Health Card or lab report and depend on the testing method — follow those, or ask your RSK / KVK.</p>
                <a href="https://soilhealth.dac.gov.in/" target="_blank" rel="noopener noreferrer" className="block text-sm font-medium text-leaf-700 hover:underline">Soil Health Card portal ↗</a>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
