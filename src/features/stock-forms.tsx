"use client";
import { FormDialog, type FieldDef } from "@/components/forms/record-form";
import { useAppData } from "@/components/app/app-data";
import { Notice } from "@/components/ui/misc";
import * as S from "@/lib/validation/schemas";
import { INVENTORY_LABEL } from "@/lib/constants";
import { money } from "@/lib/format";
import { opts, toValues, today } from "./form-utils";

type Trigger = (open: () => void) => React.ReactNode;
type Rec = Record<string, unknown> & { id: string; version?: number };
const UNIT_OPTS = ["kg", "g", "l", "ml", "bag", "packet", "nos", "m"].map((u) => ({ value: u, label: u }));

export function InventoryItemFormDialog({ trigger, record }: { trigger: Trigger; record?: Rec }) {
  const app = useAppData();
  const fields: FieldDef[] = [
    { type: "text", name: "name", label: "Item name", span: 2, placeholder: "e.g. Copper sulphate, Rajphos, Neem cake" },
    { type: "select", name: "category", label: "Category", options: opts(INVENTORY_LABEL) },
    { type: "select", name: "unit", label: "Unit", options: UNIT_OPTS },
    { type: "number", name: "lowStockThreshold", label: "Warn when stock falls to", optional: true },
    { type: "date", name: "expiryDate", label: "Expiry date", optional: true },
    { type: "text", name: "supplier", label: "Supplier", optional: true },
    { type: "text", name: "storageNotes", label: "Storage notes", optional: true },
    ...(!record
      ? ([
          { type: "section", label: "Opening stock" },
          { type: "number", name: "openingQuantity", label: "Quantity in stock now", optional: true },
          { type: "number", name: "openingUnitCost", label: "Cost per unit (₹)", optional: true },
          { type: "checkbox", name: "recordExpense", label: "Record this purchase as an expense", hint: "Only if you bought it now — skip for stock you already had." },
        ] as FieldDef[])
      : []),
  ];
  return (
    <FormDialog
      trigger={trigger}
      title={record ? "Edit inventory item" : "Add inventory item"}
      wide
      entity="inventoryItem"
      schema={S.inventoryItemSchema}
      fields={fields}
      recordId={record?.id}
      baseVersion={record?.version}
      initial={record ? toValues(record, ["expiryDate"]) : { farmId: app.farm?.id, category: "FERTILIZER", unit: "kg", recordExpense: false }}
      transform={(v) => ({ ...v, recordExpense: !!v.recordExpense && app.perms.financeWrite })}
      describe={(v) => `Inventory item ${v.name ?? ""}`}
    />
  );
}

export function StockMoveFormDialog({ trigger, item, type }: { trigger: Trigger; item: { id: string; name: string; unit: string; quantity: number }; type: "PURCHASE" | "USAGE" | "WASTAGE" | "ADJUSTMENT" }) {
  const app = useAppData();
  const title = { PURCHASE: "Record purchase", USAGE: "Record usage", WASTAGE: "Record wastage / loss", ADJUSTMENT: "Correct stock count" }[type];
  const fields: FieldDef[] = [
    { type: "number", name: "quantity", label: type === "ADJUSTMENT" ? `Actual stock counted (${item.unit})` : `Quantity (${item.unit})` },
    { type: "date", name: "date", label: "Date" },
    ...(type === "PURCHASE"
      ? ([
          { type: "number", name: "unitCost", label: `Cost per ${item.unit} (₹)`, optional: true },
          { type: "text", name: "supplier", label: "Supplier", optional: true },
          { type: "checkbox", name: "recordExpense", label: "Also add to expenses", hint: app.perms.financeWrite ? undefined : "Your role cannot record expenses." },
        ] as FieldDef[])
      : []),
    { type: "text", name: "notes", label: "Notes", optional: true, span: 2 },
  ];
  return (
    <FormDialog
      trigger={trigger}
      title={`${title} — ${item.name}`}
      entity="inventoryTxn"
      schema={S.inventoryTxnSchema}
      fields={fields}
      initial={{ itemId: item.id, type, date: today(), recordExpense: type === "PURCHASE" && app.perms.financeWrite }}
      transform={(v) => ({ ...v, recordExpense: !!v.recordExpense && app.perms.financeWrite })}
      describe={(v) => `${title}: ${v.quantity ?? ""} ${item.unit} ${item.name}`}
      preview={(v) => {
        const q = Number(v.quantity);
        if (!Number.isFinite(q) || v.quantity === "") return null;
        const after = type === "PURCHASE" ? item.quantity + q : type === "ADJUSTMENT" ? q : item.quantity - q;
        return (
          <Notice tone={after < 0 ? "danger" : "info"}>
            Stock: {item.quantity} → <b>{Math.round(after * 1000) / 1000} {item.unit}</b>
            {after < 0 && " — not enough stock"}
            {type === "PURCHASE" && Number(v.unitCost) > 0 && <> · Cost {money(q * Number(v.unitCost))}</>}
          </Notice>
        );
      }}
    />
  );
}

export function EquipmentFormDialog({ trigger, record }: { trigger: Trigger; record?: Rec }) {
  const app = useAppData();
  const fields: FieldDef[] = [
    { type: "text", name: "name", label: "Name", placeholder: "e.g. HTP power sprayer" },
    { type: "select", name: "category", label: "Type", options: opts({ sprayer: "Sprayer", pump: "Pump / motor", tiller: "Tiller / tractor", dryer: "Dryer", climber: "Tree climber", cutter: "Brush cutter / chainsaw", vehicle: "Vehicle", tool: "Hand tool", other: "Other" }) },
    { type: "select", name: "ownership", label: "Ownership", options: opts({ OWNED: "Owned", RENTED: "Rented", SHARED: "Shared" }) },
    { type: "select", name: "status", label: "Condition", options: opts({ WORKING: "Working", NEEDS_REPAIR: "Needs repair", RETIRED: "Retired" }) },
    { type: "date", name: "purchaseDate", label: "Purchase date", optional: true },
    { type: "number", name: "purchaseCost", label: "Purchase cost (₹)", optional: true },
    { type: "text", name: "rentalInfo", label: "Rental details", optional: true, span: 2, placeholder: "Who it is rented from/to and the rate" },
    { type: "textarea", name: "notes", label: "Notes", optional: true },
  ];
  return (
    <FormDialog trigger={trigger} title={record ? "Edit equipment" : "Add equipment"} wide entity="equipment" schema={S.equipmentSchema} fields={fields} recordId={record?.id}
      initial={record ? toValues(record, ["purchaseDate"]) : { farmId: app.farm?.id, category: "sprayer", ownership: "OWNED", status: "WORKING" }}
      describe={(v) => `Equipment ${v.name ?? ""}`} />
  );
}

export function EquipmentLogFormDialog({ trigger, equipmentId, name }: { trigger: Trigger; equipmentId: string; name: string }) {
  const app = useAppData();
  const fields: FieldDef[] = [
    { type: "select", name: "type", label: "Entry", options: opts({ MAINTENANCE: "Maintenance / service", REPAIR: "Repair", RENTAL: "Rental", USAGE: "Usage" }) },
    { type: "date", name: "date", label: "Date" },
    { type: "number", name: "cost", label: "Cost (₹)", optional: true },
    { type: "number", name: "hours", label: "Hours used", optional: true },
    { type: "text", name: "description", label: "Details", optional: true, span: 2 },
    { type: "date", name: "nextDueDate", label: "Next service due", optional: true },
    { type: "checkbox", name: "recordExpense", label: "Add cost to expenses", hint: app.perms.financeWrite ? undefined : "Your role cannot record expenses." },
  ];
  return (
    <FormDialog trigger={trigger} title={`Log — ${name}`} entity="equipmentLog" schema={S.equipmentLogSchema} fields={fields}
      initial={{ equipmentId, type: "MAINTENANCE", date: today(), recordExpense: app.perms.financeWrite }}
      transform={(v) => ({ ...v, recordExpense: !!v.recordExpense && app.perms.financeWrite })}
      describe={(v) => `${name}: ${String(v.type).toLowerCase()}`} />
  );
}
