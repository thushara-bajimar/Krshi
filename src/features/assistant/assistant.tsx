"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Loader2, Mic, MicOff, Send, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Badge, Notice, Provenance } from "@/components/ui/misc";
import { useAppData } from "@/components/app/app-data";
import { ActivityFormDialog, TaskFormDialog } from "@/features/farm-forms";
import { ExpenseFormDialog, LaborFormDialog } from "@/features/money-forms";
import { cn } from "@/lib/cn";

type Reply = {
  intent: string; text: string; parser?: "ai" | "rules"; aiAvailable?: boolean;
  items?: { title: string; detail?: string; href?: string }[];
  sources?: { label: string; url?: string; kind: "USER" | "LIVE" | "SAMPLE" | "CACHED" | "CURATED" }[];
  draft?: { entity: "activity" | "expense" | "labor" | "task"; defaults: Record<string, unknown>; summary: string[] };
  error?: string;
};
type Msg = { role: "user" | "assistant"; text: string; reply?: Reply; saved?: boolean };

const EXAMPLES = [
  "I sprayed fertilizer in my arecanut plot today",
  "I paid three workers 900 rupees each",
  "How much did I spend this month?",
  "Show my labour expenses",
  "What did I apply to plot 2 last month?",
  "What is the price of arecanut today?",
  "Show my upcoming farm activities",
  "Add an expense of 500 rupees for transport",
  "ಇಂದು ಅಡಿಕೆ ತೋಟಕ್ಕೆ ಗೊಬ್ಬರ ಹಾಕಿದೆ",
];

// Minimal typing for the Web Speech API (not in TS DOM lib)
type SR = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };

export function Assistant({ voiceDefault }: { voiceDefault: string }) {
  const app = useAppData();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState(voiceDefault);
  const [speak, setSpeak] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState<boolean | null>(null);
  const rec = useRef<SR | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    setVoiceSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [msgs]);

  function say(t: string) {
    if (!speak || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(t);
    u.lang = voiceLang;
    const v = speechSynthesis.getVoices().find((x) => x.lang === voiceLang);
    if (v) u.voice = v;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  async function send(input: string) {
    const q = input.trim();
    if (!q) return;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setText("");
    if (!navigator.onLine) {
      setMsgs((m) => [...m, { role: "assistant", text: "The assistant needs internet. You can still add records with the + button — they will be saved offline." }]);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: q }) });
      const j: Reply = await r.json();
      if (!r.ok) setMsgs((m) => [...m, { role: "assistant", text: j.error ?? "Something went wrong." }]);
      else {
        setMsgs((m) => [...m, { role: "assistant", text: j.text, reply: j }]);
        say(j.text);
      }
    } catch {
      setMsgs((m) => [...m, { role: "assistant", text: "Could not reach the server." }]);
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    if (listening) { rec.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = voiceLang;
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    r.onresult = (e) => {
      finalText = Array.from(e.results).map((x) => x[0].transcript).join(" ");
      setText(finalText);
    };
    r.onerror = (e) => { setListening(false); if (e.error !== "aborted" && e.error !== "no-speech") setMsgs((m) => [...m, { role: "assistant", text: e.error === "not-allowed" ? "Microphone permission was denied." : `Voice input error: ${e.error}` }]); };
    r.onend = () => { setListening(false); if (finalText.trim()) send(finalText); };
    rec.current = r;
    setListening(true);
    r.start();
  }

  const DraftButton = ({ d, idx }: { d: NonNullable<Reply["draft"]>; idx: number }) => {
    const done = () => setMsgs((m) => m.map((x, i) => (i === idx ? { ...x, saved: true } : x)));
    const trigger = (o: () => void) => <Button size="sm" onClick={o} disabled={msgs[idx].saved}>{msgs[idx].saved ? "Saved" : "Review & save"}</Button>;
    const onDone = (r: { status: string }) => (r.status === "saved" || r.status === "queued") && done();
    if (d.entity === "activity") return <ActivityFormDialog defaults={d.defaults} trigger={trigger} onDone={onDone} />;
    if (d.entity === "expense") return <ExpenseFormDialog defaults={d.defaults} trigger={trigger} onDone={onDone} />;
    if (d.entity === "labor") return <LaborFormDialog defaults={d.defaults} trigger={trigger} onDone={onDone} />;
    return <TaskFormDialog defaults={d.defaults} trigger={trigger} onDone={onDone} />;
  };

  return (
    <div className="flex min-h-[60dvh] flex-col">
      <div className="flex-1 space-y-4">
        {msgs.length === 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-leaf-100 text-leaf-800"><Bot className="h-5 w-5" /></span><p className="font-medium">Ask about your farm, or tell me what you did.</p></div>
            <p className="mt-2 text-sm text-muted">I prepare records for you to check before saving, and answer from your own records, stored market prices and the weather forecast — with sources.</p>
            <div className="mt-4 flex flex-wrap gap-2">{EXAMPLES.map((e) => <button key={e} onClick={() => send(e)} className="rounded-full border border-line bg-white px-3 py-1.5 text-left text-sm hover:bg-sand">{e}</button>)}</div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[92%] rounded-2xl px-4 py-3 text-sm sm:max-w-[80%]", m.role === "user" ? "bg-leaf-800 text-white" : "card")}>
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.reply?.items && m.reply.items.length > 0 && (
                <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
                  {m.reply.items.map((it, j) => (
                    <li key={j} className="px-3 py-2">
                      {it.href ? <Link href={it.href} className="font-medium hover:underline">{it.title}</Link> : <p className="font-medium">{it.title}</p>}
                      {it.detail && <p className="text-xs text-muted">{it.detail}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {m.reply?.draft && (
                <div className="mt-3 rounded-lg border border-leaf-200 bg-leaf-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-leaf-800">Not saved yet</p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">{m.reply.draft.summary.map((s, j) => <li key={j}><Badge tone="green">{s}</Badge></li>)}</ul>
                  <div className="mt-2"><DraftButton d={m.reply.draft} idx={i} /></div>
                </div>
              )}
              {m.reply?.sources?.map((s, j) => <Provenance key={j} className="mt-2" kind={s.kind} source={s.label} sourceUrl={s.url} />)}
              {m.reply?.parser && <p className="mt-1 text-[10px] text-muted">Understood by {m.reply.parser === "ai" ? "AI parser" : "built-in parser"}</p>}
            </div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" />Thinking…</div>}
        <div ref={end} />
      </div>

      <div className="sticky bottom-20 mt-4 lg:bottom-4">
        <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="card flex items-center gap-2 p-2">
          {voiceSupported && (
            <Button type="button" variant={listening ? "danger" : "secondary"} size="icon" onClick={toggleMic} aria-label={listening ? "Stop listening" : "Speak"} className="h-11 w-11 shrink-0 rounded-full">
              {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
          )}
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={listening ? "Listening…" : "Type or tap the mic"} aria-label="Message" className="border-0 focus:ring-0" />
          <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Send" className="h-11 w-11 shrink-0 rounded-full"><Send className="h-5 w-5" /></Button>
        </form>
        <div className="mt-2 flex flex-wrap items-center gap-3 px-1 text-xs text-muted">
          <label className="flex items-center gap-1.5">Voice language
            <Select className="h-8 w-auto text-xs" value={voiceLang} onChange={(e) => setVoiceLang(e.target.value)}><option value="en-IN">English (India)</option><option value="kn-IN">ಕನ್ನಡ</option></Select>
          </label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={speak} onChange={(e) => setSpeak(e.target.checked)} className="accent-leaf-700" /><Volume2 className="h-3.5 w-3.5" />Read replies aloud</label>
          {voiceSupported === false && <span>Voice input is not supported in this browser (try Chrome on Android).</span>}
          {!app.farm && <span>Add a farm to record activities.</span>}
        </div>
      </div>
    </div>
  );
}
