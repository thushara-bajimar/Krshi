import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Create your KRSHI account</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Free. We only ask for what the app needs.</p>
      <Suspense><AuthForm mode="register" /></Suspense>
    </>
  );
}
