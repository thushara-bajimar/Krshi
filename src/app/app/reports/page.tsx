import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { REPORT_TYPES } from "@/server/reports";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { NoFarm } from "@/components/app/no-farm";
import { ReportBuilder } from "@/features/reports/builder";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const ctx = await pageContext();
  if (!ctx.farm) return <NoFarm />;
  const [plots, crops] = await Promise.all([prisma.plot.findMany({ where: { farmId: ctx.farm.id }, orderBy: { name: "asc" } }), prisma.crop.findMany({ orderBy: { name: "asc" } })]);
  return (
    <>
      <PageHeader title="Reports" subtitle="Monthly, seasonal and yearly reports for a farm, plot or crop — built from your records." />
      <Card><CardBody><ReportBuilder types={REPORT_TYPES} farms={ctx.farms.map((f) => ({ id: f.id, name: f.name }))} plots={plots.map((p) => ({ id: p.id, name: p.name }))} crops={crops.map((c) => ({ id: c.id, name: c.name }))} defaultFarm={ctx.farm.id} finance={ctx.can("finance:read")} /></CardBody></Card>
    </>
  );
}
