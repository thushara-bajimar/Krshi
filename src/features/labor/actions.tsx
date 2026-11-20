"use client";
import { IndianRupee, Pencil, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LaborFormDialog, PaymentFormDialog, WorkerFormDialog } from "@/features/money-forms";

export const AddLaborButton = () => <LaborFormDialog trigger={(o) => <Button onClick={o}><Plus className="h-4 w-4" />Add labour</Button>} />;
export const EditLaborButton = ({ record }: { record: Record<string, unknown> & { id: string; version: number } }) => (
  <LaborFormDialog record={record} trigger={(o) => <Button variant="ghost" size="icon" onClick={o} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>} />
);
export const PayButton = ({ id, pending, who }: { id: string; pending: number; who: string }) => (
  <PaymentFormDialog laborRecordId={id} pending={pending} who={who} trigger={(o) => <Button size="sm" variant="secondary" onClick={o}><IndianRupee className="h-3.5 w-3.5" />Pay</Button>} />
);
export const AddWorkerButton = () => <WorkerFormDialog trigger={(o) => <Button onClick={o}><UserPlus className="h-4 w-4" />Add worker</Button>} />;
export const EditWorkerButton = ({ record }: { record: Record<string, unknown> & { id: string } }) => (
  <WorkerFormDialog record={record} trigger={(o) => <Button variant="outline" size="sm" onClick={o}><Pencil className="h-4 w-4" />Edit</Button>} />
);
