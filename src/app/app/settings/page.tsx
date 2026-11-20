import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DeleteAccount, PasswordForm, PreferencesForm, ProfileForm } from "@/features/settings/settings-forms";
import { dateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await pageContext();
  const u = ctx.user;
  const s = u.settings ?? (await prisma.userSettings.create({ data: { userId: u.id } }));
  const sessions = await prisma.session.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Settings" subtitle={u.email} />
      <div className="space-y-6">
        <Card><CardHeader title="Profile" subtitle="Only what KRSHI needs. Your district is used for weather and scheme filtering." /><CardBody><ProfileForm profile={{ name: u.name, phone: u.phone, language: u.language, district: u.district, taluk: u.taluk, village: u.village, areaUnit: u.areaUnit }} /></CardBody></Card>
        <Card id="notifications"><CardHeader title="Notifications & voice" /><CardBody><PreferencesForm settings={{ notifyTasks: s.notifyTasks, notifyInventory: s.notifyInventory, notifyPayments: s.notifyPayments, notifyWeather: s.notifyWeather, notifyPriceAlerts: s.notifyPriceAlerts, taskReminderDays: s.taskReminderDays, voiceLanguage: s.voiceLanguage }} /></CardBody></Card>
        <Card><CardHeader title="Password" /><CardBody><PasswordForm /></CardBody></Card>
        <Card>
          <CardHeader title="Signed-in devices" subtitle="Changing your password signs out all other devices" />
          <ul className="divide-y divide-line">{sessions.map((x) => <li key={x.id} className="px-5 py-2.5 text-sm"><p className="truncate">{x.userAgent ?? "Unknown device"}{x.id === u.sessionId && <span className="ml-2 text-leaf-700">(this device)</span>}</p><p className="text-xs text-muted">Signed in {dateTime(x.createdAt)} · expires {dateTime(x.expiresAt)}</p></li>)}</ul>
        </Card>
        <Card><CardHeader title="Privacy" /><CardBody className="space-y-3 text-sm text-muted">
          <p>Your farm records, locations and finances are visible only to you and to people you share a specific farm with. KRSHI does not publish farm locations. Photos are stored privately and served only to authorised members.</p>
          <p>Voice input uses your browser's speech service. If the AI assistant is enabled by the server, the text you type or say is sent to the AI provider only to understand the request.</p>
          <DeleteAccount />
        </CardBody></Card>
      </div>
    </>
  );
}
