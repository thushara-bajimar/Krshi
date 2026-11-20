import { Map } from "lucide-react";
import { EmptyState } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";

export function NoFarm() {
  return (
    <div className="card">
      <EmptyState icon={<Map className="h-6 w-6" />} title="Add your first farm" body="Create a farm and its plots to start recording activities, labour, expenses and harvests." action={<LinkButton href="/app/farms">Add a farm</LinkButton>} />
    </div>
  );
}

export function NoAccess({ what = "this section" }: { what?: string }) {
  return (
    <div className="card">
      <EmptyState title="Not available for your role" body={`Your access to this farm does not include ${what}. Ask the farm owner if you need it.`} />
    </div>
  );
}
