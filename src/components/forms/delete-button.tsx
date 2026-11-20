"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm";
import { Button } from "@/components/ui/button";
import { submitRecord } from "@/offline/mutate";

export function DeleteRecordButton({ entity, id, label, body, redirectTo, size = "sm", iconOnly }: { entity: string; id: string; label: string; body?: React.ReactNode; redirectTo?: string; size?: "sm" | "md"; iconOnly?: boolean }) {
  const router = useRouter();
  return (
    <ConfirmButton
      title={`Delete ${label}?`}
      body={body ?? "This cannot be undone."}
      trigger={(open) =>
        iconOnly ? (
          <Button variant="ghost" size="icon" onClick={open} aria-label={`Delete ${label}`} className="text-muted hover:text-clay-600"><Trash2 className="h-4 w-4" /></Button>
        ) : (
          <Button variant="outline" size={size} onClick={open} className="text-clay-600"><Trash2 className="h-4 w-4" /> Delete</Button>
        )
      }
      onConfirm={async () => {
        const r = await submitRecord({ entity, op: "delete", id, label: `Delete ${label}` });
        if (r.status === "saved") {
          toast.success("Deleted");
          if (redirectTo) router.push(redirectTo);
          router.refresh();
        } else if (r.status === "queued") toast.info("Deletion saved offline — will sync when online");
        else toast.error(r.status === "error" ? r.error : "Could not delete");
      }}
    />
  );
}
