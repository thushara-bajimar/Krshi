"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, FileText, Loader2, X } from "lucide-react";

type Att = { id: string; fileName: string; mimeType: string };

/** Photo / document attachments for a record. Images are downscaled on the phone before upload to save data. */
export function Attachments({ target, targetId, items, editable }: { target: "activity" | "expense" | "soilTest" | "issue"; targetId: string; items: Att[]; editable: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function shrink(file: File): Promise<Blob> {
    if (!file.type.startsWith("image/") || file.size < 600_000) return file;
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
      return await new Promise((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", 0.82));
    } catch {
      return file;
    }
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (!navigator.onLine) return void toast.error("Photos can only be uploaded when online");
    setBusy(true);
    for (const f of Array.from(files)) {
      const fd = new FormData();
      const blob = await shrink(f);
      fd.append("file", blob, blob === f ? f.name : f.name.replace(/\.\w+$/, "") + ".jpg");
      fd.append("target", target);
      fd.append("targetId", targetId);
      const r = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!r.ok) toast.error((await r.json().catch(() => ({}))).error ?? `Could not upload ${f.name}`);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  async function remove(id: string) {
    const r = await fetch(`/api/uploads/${id}`, { method: "DELETE" });
    if (r.ok) router.refresh();
    else toast.error("Could not remove");
  }

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((a) => (
            <li key={a.id} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-sand">
              <a href={`/api/uploads/${a.id}`} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
                {a.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/uploads/${a.id}`} alt={a.fileName} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-muted"><FileText className="h-6 w-6" /><span className="line-clamp-2">{a.fileName}</span></span>
                )}
              </a>
              {editable && (
                <button onClick={() => remove(a.id)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-ink shadow" aria-label={`Remove ${a.fileName}`}><X className="h-3.5 w-3.5" /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-white px-3 py-3 text-sm font-medium text-leaf-800 hover:bg-leaf-50 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {busy ? "Uploading…" : "Add photo or PDF"}
          </button>
          <p className="text-xs text-muted">JPEG, PNG, WebP or PDF, up to 5 MB each. Photos are resized on your phone before upload.</p>
        </>
      )}
      {!editable && items.length === 0 && <p className="text-sm text-muted">No attachments.</p>}
    </div>
  );
}
