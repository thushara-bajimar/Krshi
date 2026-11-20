"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { checkRelevance, type Rules, type SchemeAnswers } from "@/lib/schemes";

type S = { slug: string; name: string; rules: Rules | null; crops: string[] };
const tri = (v: string) => (v === "yes" ? true : v === "no" ? false : null);

export function RelevanceChecker({ schemes, defaultCrops, defaultAcres }: { schemes: S[]; defaultCrops: string[]; defaultAcres: number | null }) {
  const [v, setV] = useState({ ownsLand: "", incomeTaxPayer: "", age: "", acres: defaultAcres != null ? String(defaultAcres) : "", water: "", karnataka: "yes" });
  useEffect(() => {
    try { const s = localStorage.getItem("krishi:scheme-answers"); if (s) setV((x) => ({ ...x, ...JSON.parse(s) })); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => { try { localStorage.setItem("krishi:scheme-answers", JSON.stringify(v)); } catch { /* ignore */ } }, [v]);
  const answers: SchemeAnswers = { ownsLand: tri(v.ownsLand), incomeTaxPayer: tri(v.incomeTaxPayer), age: v.age ? Number(v.age) : null, landAcres: v.acres ? Number(v.acres) : null, hasWaterSource: tri(v.water), inKarnataka: tri(v.karnataka), crops: defaultCrops };
  const results = schemes.map((s) => ({ s, r: checkRelevance(s.rules, answers, s.crops) }));
  const yn = (k: keyof typeof v, label: string) => (
    <Field label={label} htmlFor={`rel-${k}`}>
      <Select id={`rel-${k}`} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })}><option value="">Not sure / skip</option><option value="yes">Yes</option><option value="no">No</option></Select>
    </Field>
  );
  const icon = { fits_basics: <CheckCircle2 className="h-4 w-4 text-leaf-700" />, does_not_fit: <XCircle className="h-4 w-4 text-clay-600" />, need_info: <HelpCircle className="h-4 w-4 text-amber-700" /> };
  const label = { fits_basics: "Fits the published basics", does_not_fit: "Does not fit", need_info: "Need more information" };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Answer a few questions. Your answers stay on this device. This checks only the basic published criteria — it is <b>not</b> an eligibility decision. Only the department can decide that.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {yn("ownsLand", "Land in your name?")}
        {yn("incomeTaxPayer", "Do you pay income tax?")}
        {yn("water", "Have a water source?")}
        <Field label="Your age" htmlFor="rel-age"><Input id="rel-age" type="number" inputMode="numeric" value={v.age} onChange={(e) => setV({ ...v, age: e.target.value })} /></Field>
        <Field label="Total land (acres)" htmlFor="rel-acres"><Input id="rel-acres" type="number" inputMode="decimal" value={v.acres} onChange={(e) => setV({ ...v, acres: e.target.value })} /></Field>
        {yn("karnataka", "Farm in Karnataka?")}
      </div>
      {defaultCrops.length > 0 && <p className="text-xs text-muted">Crops considered (from your plots): {defaultCrops.join(", ")}</p>}
      <ul className="divide-y divide-line rounded-lg border border-line">
        {results.sort((a, b) => ["fits_basics", "need_info", "does_not_fit"].indexOf(a.r.verdict) - ["fits_basics", "need_info", "does_not_fit"].indexOf(b.r.verdict)).map(({ s, r }) => (
          <li key={s.slug} className="px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/app/schemes/${s.slug}`} className="flex items-start gap-2 text-sm font-medium hover:underline">{icon[r.verdict]}{s.name}</Link>
              <Badge tone={r.verdict === "fits_basics" ? "green" : r.verdict === "does_not_fit" ? "red" : "amber"}>{label[r.verdict]}</Badge>
            </div>
            {(r.reasons.length > 0 || r.missing.length > 0) && <p className="ml-6 mt-0.5 text-xs text-muted">{[...r.reasons, ...r.missing.map((m) => `Unanswered: ${m}`)].join(" · ")}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
