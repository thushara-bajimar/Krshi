import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { Paperclip } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { serialize } from "@/lib/serialize";
import { PageHeader, Badge, EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { NoAccess, NoFarm } from "@/components/app/no-farm";
import { UrlFilters } from "@/components/app/url-filters";
import { DeleteRecordButton } from "@/components/forms/delete-button";
import { AddExpenseButton, EditExpenseButton } from "@/features/finance/actions";
import { PendingQueueList } from "@/offline/pending-list";
import { EXPENSE_LABEL } from "@/lib/constants";
import { date, money } from "@/lib/format";
import { sumMoney } from "@/lib/calc/money";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pageContext();
  if (!ctx.farm) return <NoFarm />;
  if (!ctx.can("finance:read")) return <NoAccess what="expenses" />;
  const sp = await searchParams;
  const where: Prisma.ExpenseWhereInput = {
    farmId: ctx.farm.id, deletedAt: null,
    ...(sp.category ? { category: sp.category as never } : {}), ...(sp.plot ? { plotId: sp.plot } : {}),
    ...(sp.from || sp.to ? { date: { ...(sp.from ? { gte: new Date(sp.from) } : {}), ...(sp.to ? { lte: new Date(sp.to) } : {}) } } : {}),
    ...(sp.q ? { OR: [{ description: { contains: sp.q, mode: "insensitive" } }, { vendor: { contains: sp.q, mode: "insensitive" } }] } : {}),
  };
  const [rows, plots] = await Promise.all([
    prisma.expense.findMany({ where, include: { plot: true, crop: true, _count: { select: { attachments: true } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 300 }),
    prisma.plot.findMany({ where: { farmId: ctx.farm.id }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Expenses" subtitle="Money spent on the farm. Wages are kept in the Labour book." actions={ctx.can("finance:write") ? <AddExpenseButton /> : undefined} />
      <PendingQueueList entity="expense" />
      <UrlFilters
        filters={[
          { name: "q", type: "search", placeholder: "Search description or shop" },
          { name: "category", type: "select", label: "Category", options: Object.entries(EXPENSE_LABEL).map(([value, label]) => ({ value, label })) },
          { name: "plot", type: "select", label: "Plot", options: plots.map((p) => ({ value: p.id, label: p.name })) },
          { name: "from", type: "date", label: "From" },
          { name: "to", type: "date", label: "To" },
        ]}
      />
      <p className="mb-3 text-sm text-muted">{rows.length} expense{rows.length === 1 ? "" : "s"} · total <b className="tabular text-ink">{money(sumMoney(rows.map((r) => Number(r.amount))))}</b>{rows.length === 300 ? " (showing latest 300)" : ""}</p>
      {rows.length === 0 ? (
        <Card><EmptyState title="No expenses found" action={ctx.can("finance:write") ? <AddExpenseButton /> : undefined} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {rows.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <Link href={`/app/finance/expenses/${e.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.description || EXPENSE_LABEL[e.category]}{e._count.attachments > 0 && <Paperclip className="ml-1 inline h-3.5 w-3.5 text-muted" aria-label="Has receipt" />}</p>
                  <p className="truncate text-xs text-muted">{date(e.date)} · <Badge tone="brown">{EXPENSE_LABEL[e.category]}</Badge> {[e.plot?.name, e.crop?.name, e.vendor, e.paymentMethod].filter(Boolean).join(" · ")}</p>
                </Link>
                <span className="shrink-0 text-sm font-semibold tabular">{money(Number(e.amount))}</span>
                {ctx.can("finance:write") && <span className="flex shrink-0"><EditExpenseButton icon record={serialize(e)} /><DeleteRecordButton iconOnly entity="expense" id={e.id} label="this expense" /></span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
