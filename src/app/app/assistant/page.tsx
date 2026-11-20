import type { Metadata } from "next";
import { pageContext } from "@/server/context";
import { aiConfigured } from "@/server/assistant/ai";
import { PageHeader, Notice } from "@/components/ui/misc";
import { Assistant } from "@/features/assistant/assistant";

export const metadata: Metadata = { title: "Assistant" };

export default async function AssistantPage() {
  const ctx = await pageContext();
  return (
    <>
      <PageHeader title="Assistant" subtitle="Speak or type in English or Kannada. Nothing is saved until you check and confirm it." />
      {!aiConfigured() && <Notice className="mb-4">Running with the built-in parser (no AI provider configured). It understands common phrases about activities, expenses, labour, tasks, prices, weather and schemes.</Notice>}
      <Assistant voiceDefault={ctx.user.settings?.voiceLanguage ?? "en-IN"} />
      <p className="mt-6 text-xs text-muted">Voice recognition is done by your browser (in Chrome it is sent to Google's speech service). Kannada recognition depends on browser support; Tulu is not supported. Answers about money and farm work come only from your records.</p>
    </>
  );
}
