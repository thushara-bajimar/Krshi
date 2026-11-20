"use client";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityFormDialog } from "@/features/farm-forms";

export function AddActivityButton() {
  return <ActivityFormDialog trigger={(o) => <Button onClick={o}><Plus className="h-4 w-4" />Record activity</Button>} />;
}
export function EditActivityButton({ record }: { record: Record<string, unknown> & { id: string; version: number } }) {
  return <ActivityFormDialog record={record} trigger={(o) => <Button variant="outline" size="sm" onClick={o}><Pencil className="h-4 w-4" />Edit</Button>} />;
}
