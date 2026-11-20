import Link from "next/link";
import { CloudOff } from "lucide-react";
import { Logo } from "@/components/logo";

export const metadata = { title: "Offline" };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo />
      <CloudOff className="h-10 w-10 text-amber-700" />
      <h1 className="text-xl font-semibold">You are offline</h1>
      <p className="max-w-sm text-sm text-muted">This page has not been opened on this device before, so it is not saved for offline use. Pages you have visited (dashboard, diary, labour, finance…) still open offline, and you can add records there — they sync when you are back online.</p>
      <Link href="/app" className="font-medium text-leaf-700 underline">Go to dashboard</Link>
    </div>
  );
}
