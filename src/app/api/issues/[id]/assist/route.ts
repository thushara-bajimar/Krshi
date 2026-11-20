import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { authed, json } from "@/lib/http";
import { requireFarmPermission } from "@/lib/authz";
import { HttpError, notFound } from "@/lib/errors";
import { readStored } from "@/server/storage";
import { aiConfigured } from "@/server/assistant/ai";

const SYSTEM = `You help a farmer in coastal Karnataka document a crop problem so that an agricultural officer, KVK scientist or extension worker can advise them.
Strict rules:
- Describe only what is visible in the photos and stated in the report. Say clearly when photos are unclear or insufficient.
- You may list a few POSSIBLE causes to discuss with an expert, each marked with your uncertainty (low / medium / high confidence) and what would distinguish them. Never present any cause as a diagnosis.
- Do NOT recommend, name or dose any pesticide, fungicide, herbicide or fertilizer product, and do not give application rates.
- Suggest what extra photos or observations would help (e.g. underside of leaves, whole palm, affected nuts cut open), and questions the expert is likely to ask.
- Always end by advising the farmer to confirm with their Raitha Samparka Kendra, KVK, or the Kisan Call Centre (1800-180-1551).
Write in simple English with short headings: "What I can see", "Possible causes to discuss with an expert", "Helpful extra information", "Next step".`;

export const POST = authed<{ id: string }>(async (_req, user, { id }) => {
  const issue = await prisma.cropIssue.findUnique({ where: { id }, include: { attachments: true, crop: true, plot: true } });
  if (!issue) throw notFound();
  await requireFarmPermission(user.id, issue.farmId, "write");
  if (!aiConfigured()) throw new HttpError(503, "AI assistance is not configured on this server.");
  const images = issue.attachments.filter((a) => a.mimeType.startsWith("image/")).slice(0, 4);
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const img of images) {
    const buf = await readStored(img.storagePath).catch(() => null);
    if (buf) content.push({ type: "image", source: { type: "base64", media_type: img.mimeType as "image/jpeg" | "image/png" | "image/webp", data: buf.toString("base64") } });
  }
  content.push({
    type: "text",
    text: `Crop: ${issue.crop?.name ?? "not given"}. Plot: ${issue.plot?.name ?? "not given"}.\nTitle: ${issue.title}\nDescription: ${issue.description}\nSymptoms: ${issue.symptoms.join(", ") || "not listed"}\nStarted: ${issue.startedOn?.toISOString().slice(0, 10) ?? "not given"}\nAffected: ${issue.affectedArea ?? "not given"}\nAlready tried: ${issue.previousTreatments ?? "nothing stated"}\nPhotos attached: ${images.length}`,
  });
  const client = new Anthropic({ maxRetries: 2, timeout: 60_000 });
  try {
    const res = await client.beta.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "medium" },
      messages: [{ role: "user", content }],
    });
    if (res.stop_reason === "refusal") throw new HttpError(422, "The AI declined this request. Please contact an expert directly.");
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    if (!text) throw new HttpError(502, "The AI returned no text.");
    const stamped = `${text}\n\n— AI observations generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC from ${images.length} photo(s). Not a diagnosis.`;
    await prisma.cropIssue.update({ where: { id }, data: { aiNotes: stamped } });
    return json({ aiNotes: stamped });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new HttpError(429, "AI service is busy. Try again in a minute.");
    if (e instanceof Anthropic.APIError) throw new HttpError(502, `AI service error (${e.status}).`);
    throw e;
  }
}, { limit: 5, windowMs: 10 * 60 * 1000 });
