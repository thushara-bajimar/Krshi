"use client";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";

async function act(body: object) {
  await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
export function NotificationActions({ id, read }: { id: string; read: boolean }) {
  const router = useRouter();
  return (
    <div className="flex shrink-0">
      <Button variant="ghost" size="icon" aria-label={read ? "Mark unread" : "Mark read"} onClick={async () => { await act({ ids: [id], action: read ? "unread" : "read" }); router.refresh(); }}><Check className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" aria-label="Dismiss" onClick={async () => { await act({ ids: [id], action: "dismiss" }); router.refresh(); }}><X className="h-4 w-4" /></Button>
    </div>
  );
}
export function MarkAllRead() {
  const router = useRouter();
  return <Button variant="outline" size="sm" onClick={async () => { await act({ all: true, action: "read" }); router.refresh(); }}><CheckCheck className="h-4 w-4" />Mark all read</Button>;
}
