"use client";
import { useState } from "react";
import { Modal } from "./dialog";
import { Button } from "./button";

export function ConfirmButton({ trigger, title, body, confirmLabel = "Delete", onConfirm, tone = "danger" }: { trigger: (open: () => void) => React.ReactNode; title: string; body: React.ReactNode; confirmLabel?: string; onConfirm: () => Promise<unknown> | void; tone?: "danger" | "primary" }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      {trigger(() => setOpen(true))}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={title}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button
              variant={tone}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        }
      >
        <div className="text-sm text-ink/80">{body}</div>
      </Modal>
    </>
  );
}
