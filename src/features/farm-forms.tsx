"use client";
import type { SubmitResult } from "@/offline/mutate";
import { FormDialog, type FieldDef, type Values } from "@/components/forms/record-form";
import { useAppData } from "@/components/app/app-data";
import { Notice } from "@/components/ui/misc";
import * as S from "@/lib/validation/schemas";
import { ACTIVITY_LABEL, ACTIVITY_LABEL_KN, AREA_UNIT_LABEL, HARVEST_UNITS, TASK_LABEL, TASK_STATUS_LABEL } from "@/lib/constants";
import { opts, toValues, today } from "./form-utils";

type Trigger = (open: () => void) => React.ReactNode;
type Rec = Record<string, unknown> & { id: string; version?: number };

const AREA_OPTS = opts(AREA_UNIT_LABEL);
const QTY_OPTS = S.QTY_UNITS.map((u) => ({ value: u, label: u }));
const CHEMICAL = new Set(["FERTILIZER", "PESTICIDE", "FUNGICIDE", "HERBICIDE", "PEST_MANAGEMENT", "DISEASE_MANAGEMENT"]);

export function PlotFormDialog({ trigger, record }: { trigger: Trigger; record?: Rec }) {
  const app = useAppData();
  const fields: FieldDef[] = [
    { type: "text", name: "name", label: "Plot name", placeholder: "e.g. North arecanut garden" },
    { type: "crop", name: "cropId", label: "Main crop", optional: true },
    { type: "number", name: "area", label: "Area" },
    { type: "select", name: "areaUnit", label: "Area unit", options: AREA_OPTS },
    { type: "text", name: "variety", label: "Variety", optional: true, placeholder: "e.g. Mangala, Sumangala, WCT" },
    { type: "date", name: "plantingDate", label: "Planting date", optional: true, hint: "Used to show crop age" },
    { type: "number", name: "plantCount", label: "Number of plants / palms", optional: true, step: "1" },
    { type: "text", name: "soilType", label: "Soil type", optional: true, placeholder: "e.g. Laterite, sandy loam" },
    { type: "text", name: "irrigation", label: "Irrigation", optional: true, placeholder: "e.g. Drip, sprinkler, open well" },
    { type: "select", name: "status", label: "Status", options: opts({ ACTIVE: "Active", PREPARING: "Being prepared", FALLOW: "Fallow", ARCHIVED: "Archived" }) },
    { type: "number", name: "latitude", label: "Latitude", optional: true, hint: "Optional. Use the farm map to pick a point." },
    { type: "number", name: "longitude", label: "Longitude", optional: true },
    { type: "textarea", name: "notes", label: "Notes", optional: true },
  ];
  return (
    <FormDialog
      trigger={trigger}
      title={record ? "Edit plot" : "Add plot"}
      wide
      entity="plot"
      schema={S.plotSchema}
      fields={fields}
      recordId={record?.id}
      initial={record ? toValues(record, ["plantingDate"]) : { farmId: app.farm?.id, areaUnit: app.user.areaUnit ?? "ACRE", status: "ACTIVE" }}
      describe={(v) => `Plot ${v.name ?? ""}`}
    />
  );
}

export function ActivityFormDialog({ trigger, record, defaults, onDone }: { trigger: Trigger; record?: Rec; defaults?: Values; onDone?: (r: SubmitResult) => void }) {
  const app = useAppData();
  const typeOpts = S.ACTIVITY_TYPES.map((t) => ({ value: t, label: app.user.language === "kn" ? `${ACTIVITY_LABEL_KN[t]} — ${ACTIVITY_LABEL[t]}` : ACTIVITY_LABEL[t] }));
  const fields = (v: Values): FieldDef[] => {
    const chem = CHEMICAL.has(String(v.type));
    const list: FieldDef[] = [
      { type: "select", name: "type", label: "What was done?", options: typeOpts },
      { type: "date", name: "date", label: "Date" },
      { type: "plot", name: "plotId", label: "Plot", optional: true },
      { type: "crop", name: "cropId", label: "Crop", optional: true, hint: "Leave empty to use the plot's crop" },
      { type: "textarea", name: "description", label: "Description", optional: true, placeholder: "What was done, and how" },
      { type: "section", label: "Product used", hint: "Fill in if a fertilizer, chemical or other input was applied" },
      { type: "text", name: "productName", label: "Product name", optional: true, placeholder: chem ? "As written on the label" : "" },
      { type: "text", name: "productCategory", label: "Product type", optional: true, placeholder: "e.g. Organic manure, Bordeaux mixture" },
      { type: "number", name: "quantity", label: "Quantity used", optional: true },
      { type: "select", name: "quantityUnit", label: "Unit", options: QTY_OPTS, optional: true },
      { type: "number", name: "areaCovered", label: "Area covered", optional: true },
      { type: "select", name: "areaUnit", label: "Area unit", options: AREA_OPTS, optional: true },
    ];
    if (chem || v.dilution || v.waterQuantity) {
      list.push(
        { type: "text", name: "dilution", label: "Concentration / dilution", optional: true, placeholder: "e.g. 2 ml per litre — as recommended" },
        { type: "number", name: "waterQuantity", label: "Water used (litres)", optional: true },
        { type: "text", name: "sourceReference", label: "Recommendation source", optional: true, span: 2, hint: "Where the dose came from: product label, KVK, agriculture officer, university package of practices…" },
      );
    }
    list.push(
      { type: "section", label: "Cost & labour" },
      { type: "number", name: "cost", label: "Cost (₹)", optional: true },
      { type: "text", name: "laborDetails", label: "Who did the work", optional: true, placeholder: "e.g. Ramesh + 2 workers" },
    );
    if (!record) {
      list.push({ type: "checkbox", name: "recordExpense", label: "Also add this cost to expenses", hint: app.perms.financeWrite ? "Creates a linked expense entry so finance totals stay complete." : "Your role cannot record expenses." });
      if (app.inventory.length) {
        list.push(
          { type: "inventory", name: "inventoryItemId", label: "Deduct from inventory", optional: true, emptyLabel: "— Don't deduct —" },
          { type: "number", name: "inventoryQuantity", label: `Quantity to deduct${v.inventoryItemId ? ` (${app.inventory.find((i) => i.id === v.inventoryItemId)?.unit ?? ""})` : ""}`, optional: true, showIf: (x) => !!x.inventoryItemId },
        );
      }
    }
    list.push(
      { type: "date", name: "followUpDate", label: "Next follow-up", optional: true },
      { type: "textarea", name: "notes", label: "Notes", optional: true },
    );
    return list;
  };
  return (
    <FormDialog
      trigger={trigger}
      onDone={onDone}
      title={record ? "Edit activity" : "Record farm activity"}
      wide
      entity="activity"
      schema={S.activitySchema}
      fields={fields}
      recordId={record?.id}
      baseVersion={record?.version}
      initial={record ? toValues(record, ["date", "followUpDate"]) : { farmId: app.farm?.id, date: today(), type: "FERTILIZER", recordExpense: false, ...defaults }}
      describe={(v) => `${ACTIVITY_LABEL[String(v.type)] ?? "Activity"} on ${v.date}`}
      transform={(v) => ({ ...v, recordExpense: !!v.recordExpense && app.perms.financeWrite })}
      preview={(v) =>
        v.inventoryItemId && Number(v.inventoryQuantity) > 0 ? (
          <Notice tone="info">
            {String(v.inventoryQuantity)} {app.inventory.find((i) => i.id === v.inventoryItemId)?.unit} of {app.inventory.find((i) => i.id === v.inventoryItemId)?.name} will be deducted from stock when you save. Deleting this activity later returns it to stock.
          </Notice>
        ) : null
      }
    />
  );
}

export function TaskFormDialog({ trigger, record, defaults, onDone }: { trigger: Trigger; record?: Rec & { workers?: { workerId: string }[] }; defaults?: Values; onDone?: (r: SubmitResult) => void }) {
  const app = useAppData();
  const fields: FieldDef[] = [
    { type: "text", name: "title", label: "Task", placeholder: "e.g. Spray Bordeaux mixture on arecanut", span: 2 },
    { type: "select", name: "category", label: "Type", options: opts(TASK_LABEL) },
    { type: "select", name: "status", label: "Status", options: opts(TASK_STATUS_LABEL) },
    { type: "date", name: "date", label: "Date" },
    { type: "time", name: "time", label: "Time", optional: true },
    { type: "plot", name: "plotId", label: "Plot", optional: true },
    { type: "number", name: "reminderDays", label: "Remind me (days before)", optional: true, step: "1" },
    { type: "workers", name: "workerIds", label: "Assigned workers", optional: true },
    { type: "number", name: "estimatedCost", label: "Estimated cost (₹)", optional: true },
    { type: "number", name: "actualCost", label: "Actual cost (₹)", optional: true },
    { type: "textarea", name: "description", label: "Details", optional: true },
  ];
  return (
    <FormDialog
      trigger={trigger}
      onDone={onDone}
      title={record ? "Edit task" : "Plan a task"}
      wide
      entity="task"
      schema={S.taskSchema}
      fields={fields}
      recordId={record?.id}
      baseVersion={record?.version}
      initial={
        record
          ? { ...toValues(record, ["date"]), workerIds: record.workers?.map((w) => w.workerId) ?? [] }
          : { farmId: app.farm?.id, date: today(), category: "spraying", status: "PLANNED", workerIds: [], reminderDays: "1", ...defaults }
      }
      describe={(v) => `Task: ${v.title ?? ""}`}
    />
  );
}

export function HarvestFormDialog({ trigger, record }: { trigger: Trigger; record?: Rec }) {
  const app = useAppData();
  const fields: FieldDef[] = [
    { type: "plot", name: "plotId", label: "Plot", optional: true },
    { type: "crop", name: "cropId", label: "Crop" },
    { type: "date", name: "date", label: "Harvest date" },
    { type: "number", name: "quantity", label: "Quantity harvested" },
    { type: "select", name: "unit", label: "Unit", options: HARVEST_UNITS.map((u) => ({ value: u, label: u })) },
    { type: "text", name: "grade", label: "Grade / quality", optional: true, placeholder: "e.g. Chali, Red, Copra grade" },
    { type: "text", name: "storage", label: "Stored at", optional: true, span: 2 },
    { type: "textarea", name: "notes", label: "Notes", optional: true },
  ];
  return (
    <FormDialog
      trigger={trigger}
      title={record ? "Edit harvest" : "Record harvest"}
      entity="harvest"
      schema={S.harvestSchema}
      fields={fields}
      recordId={record?.id}
      baseVersion={record?.version}
      initial={record ? toValues(record, ["date"]) : { farmId: app.farm?.id, date: today(), unit: "kg" }}
      onChange={(k, val, all) => {
        if (k === "plotId" && val) {
          const p = app.plots.find((x) => x.id === val);
          if (p?.cropId) return { ...all, cropId: p.cropId };
        }
      }}
      describe={(v) => `Harvest ${v.quantity ?? ""} ${v.unit ?? ""}`}
    />
  );
}

export function SoilTestFormDialog({ trigger, record }: { trigger: Trigger; record?: Rec }) {
  const app = useAppData();
  const fields: FieldDef[] = [
    { type: "plot", name: "plotId", label: "Plot", optional: true },
    { type: "date", name: "testDate", label: "Sample / test date" },
    { type: "text", name: "laboratory", label: "Laboratory", optional: true },
    { type: "text", name: "sampleId", label: "Sample / card number", optional: true },
    { type: "text", name: "soilType", label: "Soil type", optional: true },
    { type: "section", label: "Results — copy exactly as printed on your report" },
    { type: "number", name: "ph", label: "pH", optional: true },
    { type: "number", name: "ec", label: "EC", suffix: "dS/m", optional: true },
    { type: "number", name: "organicCarbon", label: "Organic carbon", suffix: "%", optional: true },
    { type: "number", name: "nitrogen", label: "Available nitrogen (N)", suffix: "kg/ha", optional: true },
    { type: "number", name: "phosphorus", label: "Available phosphorus (P)", suffix: "kg/ha", optional: true },
    { type: "number", name: "potassium", label: "Available potassium (K)", suffix: "kg/ha", optional: true },
    { type: "number", name: "zn", label: "Zinc (Zn)", suffix: "ppm", optional: true },
    { type: "number", name: "b", label: "Boron (B)", suffix: "ppm", optional: true },
    { type: "number", name: "fe", label: "Iron (Fe)", suffix: "ppm", optional: true },
    { type: "number", name: "s", label: "Sulphur (S)", suffix: "ppm", optional: true },
    { type: "textarea", name: "notes", label: "Notes / recommendations written on the report", optional: true },
  ];
  const micro = (record?.micronutrients ?? {}) as Record<string, number>;
  return (
    <FormDialog
      trigger={trigger}
      title={record ? "Edit soil test" : "Add soil test result"}
      wide
      entity="soilTest"
      schema={S.soilTestSchema}
      fields={fields}
      recordId={record?.id}
      initial={record ? { ...toValues(record, ["testDate"]), zn: micro.Zn ?? "", b: micro.B ?? "", fe: micro.Fe ?? "", s: micro.S ?? "" } : { farmId: app.farm?.id, testDate: today() }}
      transform={(v) => {
        const { zn, b, fe, s, ...rest } = v;
        const m: Record<string, number> = {};
        for (const [k, val] of Object.entries({ Zn: zn, B: b, Fe: fe, S: s })) if (val !== "" && val != null) m[k] = Number(val);
        return { ...rest, micronutrients: Object.keys(m).length ? m : undefined };
      }}
      describe={(v) => `Soil test ${v.testDate}`}
    />
  );
}

export function IssueFormDialog({ trigger, record, onCreated }: { trigger: Trigger; record?: Rec; onCreated?: (id: string) => void }) {
  const app = useAppData();
  const fields: FieldDef[] = [
    { type: "plot", name: "plotId", label: "Plot", optional: true },
    { type: "crop", name: "cropId", label: "Crop", optional: true },
    { type: "text", name: "title", label: "Short title", placeholder: "e.g. Yellowing leaves in arecanut", span: 2 },
    { type: "textarea", name: "description", label: "What do you see?", placeholder: "Which part of the plant, how many plants, how it is spreading…" },
    { type: "text", name: "symptomsText", label: "Symptoms (comma separated)", optional: true, span: 2, placeholder: "yellowing, nut fall, spots on leaves" },
    { type: "date", name: "startedOn", label: "Started on", optional: true },
    { type: "text", name: "affectedArea", label: "How much is affected", optional: true, placeholder: "e.g. 20 palms, half the plot" },
    { type: "textarea", name: "previousTreatments", label: "Anything already tried", optional: true },
    ...(record
      ? ([
          { type: "select", name: "status", label: "Status", options: opts({ OPEN: "Open", MONITORING: "Monitoring", RESOLVED: "Resolved" }) },
          { type: "textarea", name: "expertAdvice", label: "Advice received from an expert", optional: true, hint: "Record what the agriculture officer / KVK / scientist told you, and who it was." },
          { type: "textarea", name: "resolution", label: "Outcome", optional: true },
        ] as FieldDef[])
      : []),
  ];
  return (
    <FormDialog
      trigger={trigger}
      title={record ? "Update crop issue" : "Report a crop issue"}
      wide
      entity="cropIssue"
      schema={S.cropIssueSchema}
      fields={fields}
      recordId={record?.id}
      initial={record ? { ...toValues(record, ["startedOn"]), symptomsText: ((record.symptoms as string[]) ?? []).join(", ") } : { farmId: app.farm?.id, status: "OPEN" }}
      transform={(v) => {
        const { symptomsText, ...rest } = v;
        return { ...rest, symptoms: String(symptomsText ?? "").split(",").map((s) => s.trim()).filter(Boolean) };
      }}
      describe={(v) => `Crop issue: ${v.title ?? ""}`}
      onDone={(r) => {
        if (r.status === "saved" && !record && r.body.record) onCreated?.(r.body.record.id);
      }}
    />
  );
}
