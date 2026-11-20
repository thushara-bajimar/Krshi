import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { SyncCenter } from "@/offline/sync-center";

export const metadata: Metadata = { title: "Offline & sync" };

export default function SyncPage() {
  return (
    <>
      <PageHeader title="Offline & sync" subtitle="Entries saved on this device while offline, and any that need your attention." />
      <SyncCenter />
    </>
  );
}
