"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function SwitchFarmButton({ farmId, label = "Make this my active farm" }: { farmId: string; label?: string }) {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        const r = await fetch("/api/farms/select", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ farmId }) });
        if (r.ok) router.refresh();
        else toast.error("Could not switch farm");
      }}
    >
      {label}
    </Button>
  );
}
