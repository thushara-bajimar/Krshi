"use client";
import { BookOpenText, CalendarPlus, Users, Wheat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityFormDialog, HarvestFormDialog, TaskFormDialog } from "@/features/farm-forms";
import { LaborFormDialog } from "@/features/money-forms";
import { useAppData } from "@/components/app/app-data";

export function PlotQuickAdd({ plotId, cropId }: { plotId: string; cropId: string | null }) {
  const app = useAppData();
  const d = { plotId, ...(cropId ? { cropId } : {}) };
  return (
    <div className="flex flex-wrap gap-2">
      <ActivityFormDialog defaults={d} trigger={(o) => <Button size="sm" variant="secondary" onClick={o}><BookOpenText className="h-4 w-4" />Activity</Button>} />
      {app.perms.financeWrite && <LaborFormDialog defaults={{ plotId }} trigger={(o) => <Button size="sm" variant="secondary" onClick={o}><Users className="h-4 w-4" />Labour</Button>} />}
      <HarvestFormDialog trigger={(o) => <Button size="sm" variant="secondary" onClick={o}><Wheat className="h-4 w-4" />Harvest</Button>} />
      <TaskFormDialog defaults={d} trigger={(o) => <Button size="sm" variant="secondary" onClick={o}><CalendarPlus className="h-4 w-4" />Task</Button>} />
    </div>
  );
}
