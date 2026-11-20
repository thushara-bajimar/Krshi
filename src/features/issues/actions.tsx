"use client";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IssueFormDialog } from "@/features/farm-forms";

export function ReportIssueButton() {
  const router = useRouter();
  return <IssueFormDialog onCreated={(id) => router.push(`/app/issues/${id}?new=1`)} trigger={(o) => <Button onClick={o}><Plus className="h-4 w-4" />Report an issue</Button>} />;
}
export const EditIssueButton = ({ record }: { record: Record<string, unknown> & { id: string } }) => <IssueFormDialog record={record} trigger={(o) => <Button variant="outline" size="sm" onClick={o}><Pencil className="h-4 w-4" />Update</Button>} />;
