import "server-only";
import { redirect } from "next/navigation";
import { getFarmContext } from "@/lib/authz";

export async function pageContext() {
  const ctx = await getFarmContext();
  if (!ctx) redirect("/login");
  return ctx;
}
export type PageContext = Awaited<ReturnType<typeof pageContext>>;
