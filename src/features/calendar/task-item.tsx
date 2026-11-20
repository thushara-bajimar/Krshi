"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CloudRain, Pencil, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { DeleteRecordButton } from "@/components/forms/delete-button";
import { ActivityFormDialog, TaskFormDialog } from "@/features/farm-forms";
import { submitRecord } from "@/offline/mutate";
import { TASK_LABEL, TASK_STATUS_LABEL } from "@/lib/constants";
import { date, money, relativeDays } from "@/lib/format";
import { cn } from "@/lib/cn";

export type TaskRec = Record<string, unknown> & {
  id: string; version: number; title: string; category: string; date: string; time: string | null; status: string; plotId: string | null; cropId: string | null;
  estimatedCost: number | null; actualCost: number | null; plot?: { name: string } | null; workers?: { workerId: string; worker?: { name: string } }[];
};
const TASK_TO_ACTIVITY: Record<string, string> = { fertilizer: "FERTILIZER", spraying: "PESTICIDE", irrigation: "IRRIGATION", cleaning: "CLEANING", pruning: "PRUNING", harvesting: "HARVESTING", planting: "PLANTING", maintenance: "EQUIPMENT_USAGE" };

export function TaskItem({ task, editable, weather, overdue }: { task: TaskRec; editable: boolean; weather?: { risk: string; note: string } | null; overdue?: boolean }) {
  const router = useRouter();
  async function setStatus(status: string) {
    const { plot: _p, workers, crop: _c, farm: _f, createdAt: _ca, updatedAt: _u, deletedAt: _d, createdById: _cb, version: _v, ...rest } = task as Record<string, unknown> & TaskRec;
    const data = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v === null ? undefined : k === "date" ? String(v).slice(0, 10) : v]));
    const r = await submitRecord({ entity: "task", op: "update", id: task.id, baseVersion: task.version, data: { ...data, status, workerIds: (workers ?? []).map((w) => w.workerId) }, label: `Task "${task.title}" → ${status.toLowerCase()}` });
    if (r.status === "saved") { toast.success(status === "COMPLETED" ? "Marked as done" : "Updated"); router.refresh(); }
    else if (r.status === "queued") toast.info("Saved offline — will sync later");
    else if (r.status === "conflict") { toast.warning("This task was changed elsewhere — reloading"); router.refresh(); }
    else toast.error(r.error);
  }
  const done = task.status === "COMPLETED" || task.status === "CANCELLED";
  return (
    <div className={cn("flex items-start gap-3 px-4 py-3 sm:px-5", done && "opacity-70")}>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", task.status === "CANCELLED" && "line-through")}>{task.title}</p>
        <p className="mt-0.5 text-xs text-muted">
          {[TASK_LABEL[task.category], task.plot?.name, `${date(task.date, { weekday: "short", day: "numeric", month: "short" })}${task.time ? ` ${task.time}` : ""}`, task.workers?.length ? task.workers.map((w) => w.worker?.name).filter(Boolean).join(", ") : null, task.estimatedCost ? `est. ${money(task.estimatedCost)}` : null, task.actualCost ? `actual ${money(task.actualCost)}` : null].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge tone={overdue ? "red" : task.status === "COMPLETED" ? "green" : task.status === "IN_PROGRESS" ? "blue" : "neutral"}>{overdue ? `Overdue · ${relativeDays(task.date)}` : task.status === "PLANNED" ? relativeDays(task.date) : TASK_STATUS_LABEL[task.status]}</Badge>
          {weather?.risk === "rain" && !done && <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-900" title={weather.note}><CloudRain className="h-3.5 w-3.5" />Rain forecast</span>}
        </div>
        {weather?.risk === "rain" && !done && <p className="mt-1 text-xs text-muted">{weather.note}</p>}
      </div>
      {editable && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {task.status === "PLANNED" && <Button size="sm" variant="ghost" onClick={() => setStatus("IN_PROGRESS")} aria-label="Start"><Play className="h-4 w-4" /></Button>}
          {!done && (
            <ActivityFormDialog
              defaults={{ type: TASK_TO_ACTIVITY[task.category] ?? "OTHER", plotId: task.plotId ?? "", description: task.title, cost: task.actualCost != null ? String(task.actualCost) : "" }}
              trigger={(o) => (
                <Button size="sm" variant="secondary" onClick={async () => { await setStatus("COMPLETED"); o(); }}><Check className="h-4 w-4" />Done</Button>
              )}
            />
          )}
          <TaskFormDialog record={task} trigger={(o) => <Button size="icon" variant="ghost" onClick={o} aria-label="Edit task"><Pencil className="h-4 w-4" /></Button>} />
          <DeleteRecordButton iconOnly entity="task" id={task.id} label="this task" />
        </div>
      )}
    </div>
  );
}
