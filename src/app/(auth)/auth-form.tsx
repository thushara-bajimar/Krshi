"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { loginSchema, registerSchema } from "@/lib/validation/schemas";
import { DISTRICT_NAMES } from "@/lib/constants";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [v, setV] = useState<Record<string, string>>({ language: "en", district: "Dakshina Kannada" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const schema = mode === "login" ? loginSchema : registerSchema;
    const parsed = schema.safeParse(v);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
      setErrors(fe);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (j.fieldErrors) setErrors(Object.fromEntries(Object.entries(j.fieldErrors as Record<string, string[]>).map(([k, x]) => [k, x[0]])));
        setError(j.error ?? "Something went wrong");
        return;
      }
      const next = params.get("next");
      router.push(next && next.startsWith("/app") ? next : mode === "register" ? "/app/farms?welcome=1" : "/app");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {mode === "register" && (
        <Field label="Your name" htmlFor="name" error={errors.name}>
          <Input id="name" autoComplete="name" value={v.name ?? ""} onChange={set("name")} aria-invalid={!!errors.name} />
        </Field>
      )}
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input id="email" type="email" autoComplete="email" inputMode="email" value={v.email ?? ""} onChange={set("email")} aria-invalid={!!errors.email} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password} hint={mode === "register" ? "At least 8 characters" : undefined}>
        <Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={v.password ?? ""} onChange={set("password")} aria-invalid={!!errors.password} />
      </Field>
      {mode === "register" && (
        <>
          <Field label="Phone" htmlFor="phone" optional error={errors.phone}>
            <Input id="phone" type="tel" autoComplete="tel" inputMode="tel" value={v.phone ?? ""} onChange={set("phone")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="District" htmlFor="district">
              <Select id="district" value={v.district} onChange={set("district")}>
                {DISTRICT_NAMES.map((d) => <option key={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label="Language / ಭಾಷೆ" htmlFor="language">
              <Select id="language" value={v.language} onChange={set("language")}>
                <option value="en">English</option>
                <option value="kn">ಕನ್ನಡ (Kannada)</option>
              </Select>
            </Field>
          </div>
        </>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" size="lg" className="w-full" loading={busy}>{mode === "login" ? "Sign in" : "Create account"}</Button>
      <p className="text-center text-sm text-muted">
        {mode === "login" ? <>New to KRSHI? <Link href="/register" className="font-medium text-leaf-700 hover:underline">Create an account</Link></> : <>Already registered? <Link href="/login" className="font-medium text-leaf-700 hover:underline">Sign in</Link></>}
      </p>
    </form>
  );
}
