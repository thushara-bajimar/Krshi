import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { serialize } from "@/lib/serialize";
import { PageHeader } from "@/components/ui/misc";
import { DosageCalculator } from "@/features/calculator/calculator";

export const metadata: Metadata = { title: "Input calculator" };

export default async function CalculatorPage() {
  const ctx = await pageContext();
  const products = await prisma.inputProduct.findMany({ where: { userId: ctx.user.id }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="Fertilizer & spray calculator" subtitle="Scale a verified dose to your plot: product quantity, water, stock check and cost. Works offline." />
      <DosageCalculator products={serialize(products)} />
    </>
  );
}
