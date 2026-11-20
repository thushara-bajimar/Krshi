"use client";
import { ArrowDownToLine, ArrowUpFromLine, ClipboardList, Pencil, Plus, Trash, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EquipmentFormDialog, EquipmentLogFormDialog, InventoryItemFormDialog, StockMoveFormDialog } from "@/features/stock-forms";
import { HarvestFormDialog } from "@/features/farm-forms";

type Item = { id: string; name: string; unit: string; quantity: number };
export const AddItemButton = () => <InventoryItemFormDialog trigger={(o) => <Button onClick={o}><Plus className="h-4 w-4" />Add item</Button>} />;
export const EditItemButton = ({ record }: { record: Record<string, unknown> & { id: string; version: number } }) => <InventoryItemFormDialog record={record} trigger={(o) => <Button variant="outline" size="sm" onClick={o}><Pencil className="h-4 w-4" />Edit</Button>} />;
export function StockButtons({ item, compact }: { item: Item; compact?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <StockMoveFormDialog item={item} type="PURCHASE" trigger={(o) => <Button size="sm" variant="secondary" onClick={o}><ArrowDownToLine className="h-4 w-4" />{compact ? "In" : "Purchase"}</Button>} />
      <StockMoveFormDialog item={item} type="USAGE" trigger={(o) => <Button size="sm" variant="secondary" onClick={o}><ArrowUpFromLine className="h-4 w-4" />{compact ? "Use" : "Use"}</Button>} />
      {!compact && <StockMoveFormDialog item={item} type="WASTAGE" trigger={(o) => <Button size="sm" variant="outline" onClick={o}><Trash className="h-4 w-4" />Wastage</Button>} />}
      {!compact && <StockMoveFormDialog item={item} type="ADJUSTMENT" trigger={(o) => <Button size="sm" variant="outline" onClick={o}><ClipboardList className="h-4 w-4" />Correct count</Button>} />}
    </div>
  );
}
export const AddHarvestButton = () => <HarvestFormDialog trigger={(o) => <Button onClick={o}><Plus className="h-4 w-4" />Record harvest</Button>} />;
export const EditHarvestButton = ({ record }: { record: Record<string, unknown> & { id: string; version: number } }) => <HarvestFormDialog record={record} trigger={(o) => <Button variant="ghost" size="icon" onClick={o} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>} />;
export const AddEquipmentButton = () => <EquipmentFormDialog trigger={(o) => <Button onClick={o}><Plus className="h-4 w-4" />Add equipment</Button>} />;
export const EditEquipmentButton = ({ record }: { record: Record<string, unknown> & { id: string } }) => <EquipmentFormDialog record={record} trigger={(o) => <Button variant="outline" size="sm" onClick={o}><Pencil className="h-4 w-4" />Edit</Button>} />;
export const AddLogButton = ({ id, name }: { id: string; name: string }) => <EquipmentLogFormDialog equipmentId={id} name={name} trigger={(o) => <Button size="sm" onClick={o}><Wrench className="h-4 w-4" />Add log</Button>} />;
