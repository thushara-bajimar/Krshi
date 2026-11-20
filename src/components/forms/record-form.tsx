"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ZodTypeAny } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { Modal } from "@/components/ui/dialog";
import { useAppData } from "@/components/app/app-data";
import { submitRecord, type SubmitResult } from "@/offline/mutate";
import { cn } from "@/lib/cn";
import { WORK_LABEL } from "@/lib/constants";

export type Values = Record<string, unknown>;
type Opt = { value: string; label: string };

export type FieldDef =
  | { type: "section"; label: string; hint?: string }
  | { type: "custom"; render: (v: Values, set: (k: string, val: unknown) => void) => React.ReactNode; span?: 1 | 2 }
  | {
      type: "text" | "number" | "date" | "textarea" | "time" | "select" | "plot" | "crop" | "worker" | "workers" | "inventory" | "checkbox";
      name: string;
      label: string;
      options?: Opt[];
      placeholder?: string;
      hint?: React.ReactNode;
      optional?: boolean;
      step?: string;
      span?: 1 | 2;
      suffix?: string;
      showIf?: (v: Values) => boolean;
      emptyLabel?: string;
    };

export interface RecordFormProps {
  entity: string;
  schema: ZodTypeAny;
  fields: FieldDef[] | ((v: Values) => FieldDef[]);
  initial: Values;
  recordId?: string;
  baseVersion?: number;
  submitLabel?: string;
  describe: (v: Values) => string;
  transform?: (v: Values) => Values;
  preview?: (v: Values) => React.ReactNode;
  onDone?: (r: SubmitResult) => void;
  onChange?: (k: string, v: unknown, all: Values) => Values | void;
}

export function RecordForm(props: RecordFormProps) {
  const { entity, schema, initial, recordId, baseVersion, describe, transform, preview, onDone, onChange } = props;
  const app = useAppData();
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ error: string; server: unknown } | null>(null);
  const [busy, setBusy] = useState(false);
  const fields = typeof props.fields === "function" ? props.fields(values) : props.fields;

  const set = (k: string, v: unknown) =>
    setValues((prev) => {
      const next = { ...prev, [k]: v };
      const patched = onChange?.(k, v, next);
      return patched ?? next;
    });

  async function submit(e?: React.FormEvent, overwrite = false) {
    e?.preventDefault();
    setFormError(null);
    const payload = transform ? transform(values) : values;
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) fe[String(issue.path[0] ?? "_")] ??= issue.message;
      setErrors(fe);
      setFormError(fe._ ?? "Please check the highlighted fields");
      return;
    }
    setErrors({});
    setBusy(true);
    const r = await submitRecord({
      entity,
      op: recordId ? "update" : "create",
      id: recordId,
      data: payload,
      baseVersion: overwrite ? undefined : baseVersion,
      label: describe(values),
      farmId: app.farm?.id,
    });
    setBusy(false);
    if (r.status === "saved") {
      toast.success(recordId ? "Changes saved" : "Saved");
      setConflict(null);
      router.refresh();
      onDone?.(r);
    } else if (r.status === "queued") {
      toast.info("Saved on this device", { description: "You're offline. It will sync automatically when you're back online." });
      onDone?.(r);
    } else if (r.status === "conflict") {
      setConflict({ error: r.error, server: r.server });
    } else {
      if (r.fieldErrors) setErrors(Object.fromEntries(Object.entries(r.fieldErrors).map(([k, v]) => [k, v?.[0] ?? "Invalid"])));
      setFormError(r.error);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {conflict && (
        <Notice tone="warn" title="Someone else changed this record">
          <p>{conflict.error}. You can reload to see their version, or save yours over it.</p>
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => { router.refresh(); onDone?.({ status: "error", error: "reload" }); }}>Reload latest</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => submit(undefined, true)}>Save mine anyway</Button>
          </div>
        </Notice>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f, i) => {
          if (f.type === "section")
            return (
              <div key={`s${i}`} className="sm:col-span-2 -mb-1 border-t border-line pt-4 first:border-0 first:pt-0">
                <p className="text-sm font-semibold text-ink">{f.label}</p>
                {f.hint && <p className="text-xs text-muted">{f.hint}</p>}
              </div>
            );
          if (f.type === "custom") return <div key={`c${i}`} className={f.span === 1 ? "" : "sm:col-span-2"}>{f.render(values, set)}</div>;
          if (f.showIf && !f.showIf(values)) return null;
          return (
            <FieldControl key={f.name} f={f} value={values[f.name]} error={errors[f.name]} onChange={(v) => set(f.name, v)} />
          );
        })}
      </div>
      {preview && <div>{preview(values)}</div>}
      {formError && !conflict && <Notice tone="danger">{formError}</Notice>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" loading={busy} size="lg" className="w-full sm:w-auto">{props.submitLabel ?? "Save"}</Button>
      </div>
    </form>
  );
}

function FieldControl({ f, value, error, onChange }: { f: Extract<FieldDef, { name: string }>; value: unknown; error?: string; onChange: (v: unknown) => void }) {
  const app = useAppData();
  const id = `f-${f.name}`;
  const span = f.span === 2 || f.type === "textarea" || f.type === "workers" ? "sm:col-span-2" : "";
  const common = { id, "aria-invalid": !!error || undefined, "aria-describedby": error ? `${id}-err` : undefined };
  const str = (value ?? "") as string;

  const options: Opt[] = useMemo(() => {
    if (f.type === "plot") return app.plots.filter((p) => p.status !== "ARCHIVED").map((p) => ({ value: p.id, label: `${p.name}${p.cropName ? ` · ${p.cropName}` : ""}` }));
    if (f.type === "crop") return app.crops.map((c) => ({ value: c.id, label: app.user.language === "kn" && c.nameKn ? `${c.nameKn} (${c.name})` : c.name }));
    if (f.type === "worker") return app.workers.filter((w) => w.active).map((w) => ({ value: w.id, label: w.name }));
    if (f.type === "inventory") return app.inventory.map((it) => ({ value: it.id, label: `${it.name} (${it.quantity} ${it.unit} left)` }));
    return f.options ?? [];
  }, [f, app]);

  if (f.type === "checkbox") {
    return (
      <div className="sm:col-span-2">
        <Checkbox label={f.label} hint={typeof f.hint === "string" ? f.hint : undefined} checked={!!value} onChange={onChange} />
      </div>
    );
  }

  if (f.type === "workers") {
    const selected = new Set((value as string[]) ?? []);
    const active = app.workers.filter((w) => w.active);
    return (
      <Field label={f.label} error={error} hint={f.hint} optional={f.optional} className={span}>
        {active.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-sm text-muted">No workers saved yet — add them under Labour → Workers, or enter a count below.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {active.map((w) => {
              const on = selected.has(w.id);
              return (
                <button
                  type="button"
                  key={w.id}
                  aria-pressed={on}
                  onClick={() => {
                    const n = new Set(selected);
                    if (on) n.delete(w.id);
                    else n.add(w.id);
                    onChange([...n]);
                  }}
                  className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors", on ? "border-leaf-700 bg-leaf-800 text-white" : "border-line bg-white hover:bg-sand")}
                >
                  {w.name}
                  <span className={cn("ml-1 text-xs", on ? "text-leaf-100" : "text-muted")}>{WORK_LABEL[w.category] ?? w.category}</span>
                </button>
              );
            })}
          </div>
        )}
      </Field>
    );
  }

  let control: React.ReactNode;
  if (f.type === "textarea") control = <Textarea {...common} value={str} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
  else if (["select", "plot", "crop", "worker", "inventory"].includes(f.type))
    control = (
      <Select {...common} value={str} onChange={(e) => onChange(e.target.value)}>
        <option value="">{f.emptyLabel ?? (f.optional ? "— None —" : "Choose…")}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    );
  else
    control = (
      <div className="relative">
        <Input
          {...common}
          type={f.type}
          inputMode={f.type === "number" ? "decimal" : undefined}
          step={f.type === "number" ? f.step ?? "any" : undefined}
          min={f.type === "number" ? 0 : undefined}
          value={str}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={f.suffix ? "pr-14" : undefined}
        />
        {f.suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">{f.suffix}</span>}
      </div>
    );

  return (
    <Field label={f.label} htmlFor={id} error={error} hint={f.hint} optional={f.optional} className={span}>
      {control}
    </Field>
  );
}

/** A button that opens a modal containing a RecordForm. */
export function FormDialog({ trigger, title, description, wide, ...form }: RecordFormProps & { trigger: (open: () => void) => React.ReactNode; title: string; description?: string; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const [k, setK] = useState(0);
  return (
    <>
      {trigger(() => {
        setK((x) => x + 1);
        setOpen(true);
      })}
      <Modal open={open} onOpenChange={setOpen} title={title} description={description} wide={wide}>
        <RecordForm
          key={k}
          {...form}
          onDone={(r) => {
            setOpen(false);
            form.onDone?.(r);
          }}
        />
      </Modal>
    </>
  );
}
