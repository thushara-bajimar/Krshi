"use client";
import { CalendarPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskFormDialog } from "@/features/farm-forms";

export const AddTaskButton = ({ date }: { date?: string }) => <TaskFormDialog defaults={date ? { date } : undefined} trigger={(o) => <Button onClick={o}><Plus className="h-4 w-4" />Plan task</Button>} />;
export const PlanFromHistory = ({ title, category, plotId, date }: { title: string; category: string; plotId: string | null; date: string }) => (
  <TaskFormDialog defaults={{ title, category, plotId: plotId ?? "", date }} trigger={(o) => <Button size="sm" variant="outline" onClick={o}><CalendarPlus className="h-4 w-4" />Plan</Button>} />
);
