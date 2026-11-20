"use client";
import type { SubmitResult } from "@/offline/mutate";
import { FormDialog, type FieldDef, type Values } from "@/components/forms/record-form";
import { useAppData } from "@/components/app/app-data";
import { Notice } from "@/components/ui/misc";
import * as S from "@/lib/validation/schemas";
import { EXPENSE_LABEL, HARVEST_UNITS, WAGE_LABEL, WAGE_UNIT, WORK_LABEL } from "@/lib/constants";
import { laborTotal } from "@/lib/calc/labor";
import { saleAmounts } from "@/lib/calc/finance";
import { money } from "@/lib/format";
import { opts, toValues, today } from "./form-utils";

type Trigger = (open: () => void) => React.ReactNode;
type Rec = Record<string, unknown> & { id: string; version?: number };
const PAY_METHODS = opts({ cash: "Cash", upi: "UPI", bank: "Bank transfer", cheque: "Cheque", credit: "On credit" });

export function ExpenseFormDialog({ trigger, record, defaults, onDone }: { trigger: Trigger; record?: Rec; defaults?: Values; onDone?: (r: SubmitResult) => void }) {
  const app = useAppData();
  const fields: FieldDef[] = [
    { type: "number", name: "amount", label: "Amount (₹)" },
    { type: "select", name: "category", label: "Category", options: opts(EXPENSE_LABEL) },
    { type: "date", name: "date", label: "Date" },
    { type: "select", name: "paymentMethod", label: "Paid by", options: PAY_METHODS, optional: true },
    { type: "plot", name: "plotId", label: "Plot", optional: true },
    { type: "crop", name: "cropId", label: "Crop", optional: true },
    { type: "text", name: "description", label: "Description", optional: true, span: 2, placeholder: "e.g. 10 bags organic manure" },
    { type: "text", name: "vendor", label: "Shop / vendor", optional: true, span: 2 },
  ];
  return (
    <FormDialog
      trigger={trigger}
      onDone={onDone}
      title={record ? "Edit expense" : "Add expense"}
      entity="expense"
      schema={S.expenseSchema}
      fields={fields}
      recordId={record?.id}
      baseVersion={record?.version}
      initial={record ? toValues(record, ["date"]) : { farmId: app.farm?.id, date: today(), category: "OTHER", paymentMethod: "cash", ...defaults }}
      describe={(v) => `Expense ${money(Number(v.amount) || 0)} — ${EXPENSE_LABEL[String(v.category)] ?? ""}`}
      preview={(v) =>
        v.category === "LABOR" ? (
          <Notice tone="info">Wages entered under <b>Labour</b> are already counted in finance totals. Use this only for labour costs not recorded there.</Notice>
        ) : null
      }
    />
  );
}

export function IncomeFormDialog({ trigger, record, harvests = [] }: { trigger: Trigger; record?: Rec; harvests?: { id: string; label: string; unit: string; cropId: string; remaining: number }[] }) {
  const app = useAppData();
  const fields = (v: Values): FieldDef[] => [
    { type: "select", name: "source", label: "Type", options: opts({ SALE: "Crop sale", OTHER: "Other income" }) },
    { type: "date", name: "date", label: "Date" },
    ...(v.source === "SALE"
      ? ([
          ...(harvests.length ? [{ type: "select", name: "harvestId", label: "From harvest", optional: true, options: harvests.map((h) => ({ value: h.id, label: `${h.label} — ${h.remaining} ${h.unit} unsold` })), hint: "Links the sale so remaining stock is tracked" }] : []),
          { type: "crop", name: "cropId", label: "Crop" },
          { type: "plot", name: "plotId", label: "Plot", optional: true },
          { type: "number", name: "quantity", label: "Quantity sold" },
          { type: "select", name: "unit", label: "Unit", options: HARVEST_UNITS.map((u) => ({ value: u, label: u })) },
          { type: "number", name: "pricePerUnit", label: "Price per unit (₹)" },
          { type: "number", name: "grossAmount", label: "Or total amount (₹)", optional: true, hint: "Leave empty to use quantity × price" },
          { type: "number", name: "transportCost", label: "Transport cost (₹)", optional: true },
          { type: "number", name: "otherDeductions", label: "Commission / other deductions (₹)", optional: true },
          { type: "text", name: "buyer", label: "Buyer", optional: true, placeholder: "e.g. CAMPCO, local trader" },
          { type: "text", name: "market", label: "Market", optional: true },
        ] as FieldDef[])
      : ([
          { type: "text", name: "description", label: "Description", span: 2, placeholder: "e.g. Subsidy received, equipment rented out" },
          { type: "number", name: "grossAmount", label: "Amount (₹)" },
        ] as FieldDef[])),
    { type: "number", name: "amountReceived", label: "Amount received so far (₹)", optional: true, hint: "Leave empty if fully received" },
    { type: "textarea", name: "notes", label: "Notes", optional: true },
  ];
  const calc = (v: Values) => {
    try {
      const n = (x: unknown) => (x === "" || x == null ? undefined : Number(x));
      return saleAmounts({ quantity: n(v.quantity), pricePerUnit: n(v.pricePerUnit), grossAmount: n(v.grossAmount), transportCost: n(v.transportCost), otherDeductions: n(v.otherDeductions) });
    } catch {
      return null;
    }
  };
  return (
    <FormDialog
      trigger={trigger}
      title={record ? "Edit sale / income" : "Record sale"}
      wide
      entity="income"
      schema={S.incomeSchema}
      fields={fields}
      recordId={record?.id}
      baseVersion={record?.version}
      initial={record ? toValues(record, ["date"]) : { farmId: app.farm?.id, date: today(), source: "SALE", unit: "kg" }}
      onChange={(k, val, all) => {
        if (k === "harvestId" && val) {
          const h = harvests.find((x) => x.id === val);
          if (h) return { ...all, unit: h.unit, cropId: h.cropId };
        }
        if (k === "plotId" && val) {
          const p = app.plots.find((x) => x.id === val);
          if (p?.cropId && !all.cropId) return { ...all, cropId: p.cropId };
        }
      }}
      describe={(v) => `Sale ${v.quantity ?? ""} ${v.unit ?? ""}`}
      preview={(v) => {
        const c = calc(v);
        if (!c) return null;
        return (
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-leaf-50 p-3 text-sm">
            <div><p className="text-muted">Gross</p><p className="font-semibold tabular">{money(c.grossAmount)}</p></div>
            <div><p className="text-muted">Net after deductions</p><p className="font-semibold tabular text-leaf-800">{money(c.netAmount)}</p></div>
          </div>
        );
      }}
    />
  );
}

export function LaborFormDialog({ trigger, record, defaults, onDone }: { trigger: Trigger; record?: Rec; defaults?: Values; onDone?: (r: SubmitResult) => void }) {
  const app = useAppData();
  const editing = !!record;
  const fields = (v: Values): FieldDef[] => [
    { type: "date", name: "date", label: "Work date" },
    { type: "select", name: "taskCategory", label: "Work", options: opts(WORK_LABEL) },
    ...(editing
      ? ([{ type: "number", name: "workerCount", label: "Number of workers", step: "1" }] as FieldDef[])
      : ([
          { type: "workers", name: "workerIds", label: "Workers", optional: true, hint: "Tap to select. One work record is created per worker so you can track each person's payments." },
          { type: "number", name: "workerCount", label: "Or number of workers", step: "1", showIf: (x) => !((x.workerIds as string[])?.length), hint: "For unnamed / group labour" },
          { type: "text", name: "workerLabel", label: "Group name", optional: true, showIf: (x) => !((x.workerIds as string[])?.length), placeholder: "e.g. Climbers from Puttur" },
        ] as FieldDef[])),
    { type: "select", name: "wageType", label: "Wage type", options: opts(WAGE_LABEL) },
    { type: "number", name: "rate", label: `Rate per worker ${v.wageType === "HOURLY" ? "per hour" : v.wageType === "TASK" ? "per task" : v.wageType === "HALF_DAY" ? "per half-day" : "per day"} (₹)` },
    { type: "number", name: "units", label: `Number of ${WAGE_UNIT[String(v.wageType)] ?? "units"} worked`, hint: "Per worker" },
    { type: "number", name: "additionalCost", label: "Extra costs (₹)", optional: true, hint: "Food, transport etc. for the whole group" },
    { type: "plot", name: "plotId", label: "Plot", optional: true },
    { type: "select", name: "workStatus", label: "Status", options: opts({ COMPLETED: "Work done", PLANNED: "Planned" }) },
    { type: "number", name: "totalOverride", label: "Adjust total (₹)", optional: true, hint: "Only if the actual amount differs from the calculation", showIf: () => editing || !((v.workerIds as string[])?.length > 1) },
    ...(!editing ? ([{ type: "number", name: "amountPaid", label: "Amount paid now (₹)", optional: true, hint: (v.workerIds as string[])?.length > 1 ? "Enter the full total if everyone was paid, or leave empty" : undefined }] as FieldDef[]) : []),
    { type: "text", name: "description", label: "Details", optional: true, span: 2 },
  ];
  const preview = (v: Values) => {
    const ids = (v.workerIds as string[]) ?? [];
    const count = ids.length || Number(v.workerCount) || 0;
    const units = Number(v.units) || 0;
    const rate = Number(v.rate) || 0;
    const extra = Number(v.additionalCost) || 0;
    if (!count || !units) return null;
    let total = 0;
    try {
      total = laborTotal({ workerCount: count, units, rate, additionalCost: extra });
    } catch {
      return null;
    }
    const override = v.totalOverride !== "" && v.totalOverride != null ? Number(v.totalOverride) : null;
    return (
      <div className="rounded-lg bg-leaf-50 p-3 text-sm">
        <p className="text-muted">
          {count} worker{count > 1 ? "s" : ""} × {units} {WAGE_UNIT[String(v.wageType)]} × {money(rate)}{extra ? ` + ${money(extra)} extra` : ""}
        </p>
        <p className="mt-1 text-lg font-semibold tabular text-leaf-900">
          {money(override ?? total)}
          {override != null && override !== total && <span className="ml-2 text-sm font-normal text-muted line-through">{money(total)}</span>}
        </p>
      </div>
    );
  };
  return (
    <FormDialog
      trigger={trigger}
      onDone={onDone}
      title={record ? "Edit work record" : "Add labour"}
      wide
      entity="labor"
      schema={editing ? S.laborUpdateSchema : S.laborSchema}
      fields={fields}
      recordId={record?.id}
      baseVersion={record?.version}
      initial={
        record
          ? toValues(record, ["date"])
          : { farmId: app.farm?.id, date: today(), taskCategory: "spraying", wageType: "DAILY", units: "1", workerCount: "1", workerIds: [], workStatus: "COMPLETED", ...defaults }
      }
      onChange={(k, val, all) => {
        // pre-fill the rate from the first selected worker's default wage
        if (k === "workerIds" && Array.isArray(val) && val.length && !all.rate) {
          const w = app.workers.find((x) => x.id === val[0]);
          if (w?.defaultWage) return { ...all, rate: String(w.defaultWage), wageType: w.wageType };
        }
      }}
      describe={(v) => `Labour ${WORK_LABEL[String(v.taskCategory)] ?? ""} on ${v.date}`}
      preview={preview}
    />
  );
}

export function PaymentFormDialog({ trigger, laborRecordId, pending, who }: { trigger: Trigger; laborRecordId: string; pending: number; who: string }) {
  const fields: FieldDef[] = [
    { type: "number", name: "amount", label: "Amount paid (₹)", hint: `Pending: ${money(pending)}` },
    { type: "date", name: "date", label: "Payment date" },
    { type: "select", name: "method", label: "Paid by", options: PAY_METHODS, optional: true },
    { type: "text", name: "notes", label: "Notes", optional: true },
  ];
  return (
    <FormDialog
      trigger={trigger}
      title={`Record payment — ${who}`}
      entity="laborPayment"
      schema={S.laborPaymentSchema}
      fields={fields}
      initial={{ laborRecordId, amount: String(pending), date: today(), method: "cash" }}
      describe={(v) => `Wage payment ${money(Number(v.amount) || 0)} to ${who}`}
    />
  );
}

export function WorkerFormDialog({ trigger, record }: { trigger: Trigger; record?: Rec }) {
  const app = useAppData();
  const fields: FieldDef[] = [
    { type: "text", name: "name", label: "Name" },
    { type: "text", name: "phone", label: "Phone", optional: true },
    { type: "select", name: "category", label: "Main work", options: opts(WORK_LABEL) },
    { type: "select", name: "wageType", label: "Usual wage type", options: opts(WAGE_LABEL) },
    { type: "number", name: "defaultWage", label: "Usual wage (₹)", optional: true },
    { type: "select", name: "active", label: "Status", options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] },
    { type: "textarea", name: "notes", label: "Notes", optional: true },
  ];
  return (
    <FormDialog
      trigger={trigger}
      title={record ? "Edit worker" : "Add worker"}
      entity="worker"
      schema={S.workerSchema}
      fields={fields}
      recordId={record?.id}
      initial={record ? { ...toValues(record), active: String(record.active) } : { farmId: app.farm?.id, category: "spraying", wageType: "DAILY", active: "true" }}
      transform={(v) => ({ ...v, active: v.active !== "false" })}
      describe={(v) => `Worker ${v.name ?? ""}`}
    />
  );
}
