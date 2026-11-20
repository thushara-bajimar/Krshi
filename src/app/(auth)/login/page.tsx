import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Sign in to your farm records.</p>
      <Suspense><AuthForm mode="login" /></Suspense>
      <div className="mt-8 rounded-lg border border-dashed border-line bg-white p-3 text-xs text-muted">
        <p className="font-medium text-ink">Try the demo</p>
        <p className="mt-0.5">Email <code className="rounded bg-sand px-1">demo@krishi.app</code> · Password <code className="rounded bg-sand px-1">krishi-demo-2026</code></p>
        <p className="mt-0.5">All demo records are illustrative.</p>
      </div>
    </>
  );
}
