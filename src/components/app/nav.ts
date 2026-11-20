import {
  BarChart3, BookOpenText, Calculator, CalendarDays, CloudSun, FileText, FlaskConical, HandCoins, Home, Landmark, LifeBuoy,
  Map, MessageSquareText, Package, RefreshCw, Settings, Sprout, Tractor, TrendingUp, Users, Wallet, Wheat, Bell, Bug,
} from "lucide-react";
import type { DictKey } from "@/lib/i18n/dict";

export interface NavItem { href: string; key: DictKey; icon: typeof Home; finance?: boolean }
export const NAV_GROUPS: { key: DictKey; items: NavItem[] }[] = [
  {
    key: "group.farm",
    items: [
      { href: "/app", key: "nav.dashboard", icon: Home },
      { href: "/app/farms", key: "nav.farms", icon: Map },
      { href: "/app/diary", key: "nav.diary", icon: BookOpenText },
      { href: "/app/calendar", key: "nav.calendar", icon: CalendarDays },
      { href: "/app/calculator", key: "nav.calculator", icon: Calculator },
      { href: "/app/harvests", key: "nav.harvests", icon: Wheat },
      { href: "/app/inventory", key: "nav.inventory", icon: Package },
      { href: "/app/equipment", key: "nav.equipment", icon: Tractor },
      { href: "/app/soil", key: "nav.soil", icon: FlaskConical },
      { href: "/app/issues", key: "nav.issues", icon: Bug },
    ],
  },
  {
    key: "group.money",
    items: [
      { href: "/app/labor", key: "nav.labor", icon: Users, finance: true },
      { href: "/app/finance", key: "nav.finance", icon: Wallet, finance: true },
      { href: "/app/finance/expenses", key: "nav.expenses", icon: HandCoins, finance: true },
      { href: "/app/finance/income", key: "nav.income", icon: TrendingUp, finance: true },
      { href: "/app/reports", key: "nav.reports", icon: FileText },
    ],
  },
  {
    key: "group.info",
    items: [
      { href: "/app/market", key: "nav.market", icon: BarChart3 },
      { href: "/app/weather", key: "nav.weather", icon: CloudSun },
      { href: "/app/schemes", key: "nav.schemes", icon: Landmark },
      { href: "/app/resources", key: "nav.resources", icon: LifeBuoy },
      { href: "/app/assistant", key: "nav.assistant", icon: MessageSquareText },
    ],
  },
  {
    key: "group.account",
    items: [
      { href: "/app/notifications", key: "nav.notifications", icon: Bell },
      { href: "/app/sync", key: "nav.sync", icon: RefreshCw },
      { href: "/app/settings", key: "nav.settings", icon: Settings },
    ],
  },
];
export { Sprout };
