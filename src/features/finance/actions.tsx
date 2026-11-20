"use client";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExpenseFormDialog, IncomeFormDialog } from "@/features/money-forms";

type H = { id: string; label: string; unit: string; cropId: string; remaining: number }[];
export const AddExpenseButton = () => <ExpenseFormDialog trigger={(o) => <Button onClick={o}><Plus className="h-4 w-4" />Add expense</Button>} />;
export const EditExpenseButton = ({ record, icon }: { record: Record<string, unknown> & { id: string; version: number }; icon?: boolean }) => (
  <ExpenseFormDialog record={record} trigger={(o) => (icon ? <Button variant="ghost" size="icon" onClick={o} aria-label="Edit"><Pencil className="h-4 w-4" /></Button> : <Button variant="outline" size="sm" onClick={o}><Pencil className="h-4 w-4" />Edit</Button>)} />
);
export const AddSaleButton = ({ harvests }: { harvests: H }) => <IncomeFormDialog harvests={harvests} trigger={(o) => <Button onClick={o}><Plus className="h-4 w-4" />Record sale / income</Button>} />;
export const EditSaleButton = ({ record, harvests }: { record: Record<string, unknown> & { id: string; version: number }; harvests: H }) => (
  <IncomeFormDialog record={record} harvests={harvests} trigger={(o) => <Button variant="ghost" size="icon" onClick={o} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>} />
);
