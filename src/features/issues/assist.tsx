"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AssistButton({ id, hasPhotos, configured }: { id: string; hasPhotos: boolean; configured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!configured) return <p className="text-xs text-muted">AI observations are not enabled on this server. Use the checklist below and contact an expert.</p>;
  return (
    <Button variant="secondary" loading={busy} onClick={async () => {
      setBusy(true);
      const r = await fetch(`/api/issues/${id}/assist`, { method: "POST" });
      setBusy(false);
      if (!r.ok) return void toast.error((await r.json().catch(() => ({}))).error ?? "Could not get AI observations");
      router.refresh();
    }}><Sparkles className="h-4 w-4" />{hasPhotos ? "Get AI observations from photos" : "Get AI help organising this report"}</Button>
  );
}
