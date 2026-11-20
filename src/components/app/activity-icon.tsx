import { Droplets, FlaskConical, Leaf, Scissors, Shovel, Sparkles, Sprout, SprayCan, Tractor, Wheat, Bug, Circle } from "lucide-react";

const MAP: Record<string, typeof Leaf> = {
  FERTILIZER: Leaf, PESTICIDE: SprayCan, FUNGICIDE: SprayCan, HERBICIDE: SprayCan, IRRIGATION: Droplets, PRUNING: Scissors,
  CLEANING: Sparkles, PLANTING: Sprout, HARVESTING: Wheat, SOIL_PREPARATION: Shovel, PEST_MANAGEMENT: Bug, DISEASE_MANAGEMENT: FlaskConical,
  EQUIPMENT_USAGE: Tractor, OTHER: Circle,
};
export function ActivityIcon({ type, className = "h-[18px] w-[18px]" }: { type: string; className?: string }) {
  const I = MAP[type] ?? Circle;
  return <I className={className} />;
}
