"use client";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SoilTestFormDialog } from "@/features/farm-forms";

export const AddSoilButton = () => <SoilTestFormDialog trigger={(o) => <Button onClick={o}><Plus className="h-4 w-4" />Add soil test</Button>} />;
export const EditSoilButton = ({ record }: { record: Record<string, unknown> & { id: string } }) => <SoilTestFormDialog record={record} trigger={(o) => <Button variant="ghost" size="icon" onClick={o} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>} />;
