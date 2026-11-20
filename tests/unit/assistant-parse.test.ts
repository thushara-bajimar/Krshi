import { describe, expect, it } from "vitest";
import { normaliseNumbers, parseCommand, type ParseContext } from "@/lib/assistant/parse";

const ctx: ParseContext = {
  today: "2026-11-20",
  plots: [
    { id: "p1", name: "Areca Block A", cropKey: "arecanut" },
    { id: "p2", name: "Coconut grove", cropKey: "coconut" },
    { id: "p3", name: "Paddy field", cropKey: "paddy" },
  ],
  workers: [{ id: "w1", name: "Ramesh" }, { id: "w2", name: "Suresh" }],
  crops: [{ id: "c1", key: "arecanut", name: "Arecanut", nameKn: "ಅಡಿಕೆ" }, { id: "c2", key: "coconut", name: "Coconut", nameKn: null }],
};

describe("assistant rule parser", () => {
  it("number words", () => {
    expect(normaliseNumbers("three workers nine hundred rupees")).toBe("3 workers 900 rupees");
    expect(normaliseNumbers("ಮೂರು ಜನ")).toBe("3 ಜನ");
    expect(normaliseNumbers("2,400 and 1.5k")).toBe("2400 and 1500");
  });
  it("records an activity on the only arecanut plot, today", () => {
    const r = parseCommand("I sprayed fertilizer in my arecanut plot today", ctx);
    expect(r.intent).toBe("record_activity");
    if (r.intent === "record_activity") {
      expect(r.activity.type).toBe("FERTILIZER");
      expect(r.activity.plotId).toBe("p1");
      expect(r.activity.date).toBe("2026-11-20");
    }
  });
  it("labour: three workers 900 each, paid", () => {
    const r = parseCommand("I paid three workers 900 rupees each", ctx);
    expect(r.intent).toBe("record_labor");
    if (r.intent === "record_labor") {
      expect(r.labor.workerCount).toBe(3);
      expect(r.labor.rate).toBe(900);
      expect(r.labor.amountPaid).toBe(2700);
    }
  });
  it("labour: named workers yesterday", () => {
    const r = parseCommand("Ramesh and Suresh climbed coconut yesterday 1200 each", ctx);
    expect(r.intent).toBe("record_labor");
    if (r.intent === "record_labor") {
      expect(r.labor.workerIds).toEqual(["w1", "w2"]);
      expect(r.labor.date).toBe("2026-11-19");
      expect(r.labor.taskCategory).toBe("climbing");
    }
  });
  it("expense with amount and category", () => {
    const r = parseCommand("Add an expense of 500 rupees for transport", ctx);
    expect(r).toMatchObject({ intent: "record_expense", expense: { amount: 500, category: "TRANSPORT" } });
  });
  it("questions", () => {
    expect(parseCommand("How much did I spend this month?", ctx)).toEqual({ intent: "query_spend", period: "month" });
    expect(parseCommand("Show my labor expenses", ctx).intent).toBe("query_labor");
    expect(parseCommand("What is the price of arecanut today?", ctx)).toEqual({ intent: "query_price", cropKey: "arecanut" });
    expect(parseCommand("Show my upcoming farm activities", ctx).intent).toBe("query_tasks");
    const q = parseCommand("What did I apply to plot 2 last month?", ctx);
    expect(q).toMatchObject({ intent: "query_activities", period: "last_month", plotId: "p2" });
  });
  it("Kannada phrases", () => {
    const r = parseCommand("ಇಂದು ಅಡಿಕೆ ತೋಟಕ್ಕೆ ಗೊಬ್ಬರ ಹಾಕಿದೆ", ctx);
    expect(r.intent).toBe("record_activity");
    if (r.intent === "record_activity") expect(r.activity.type).toBe("FERTILIZER");
    expect(parseCommand("ಈ ತಿಂಗಳು ಖರ್ಚು ಎಷ್ಟು?", ctx).intent).toBe("query_spend");
  });
  it("tasks and unknown input", () => {
    const t = parseCommand("Remind me to spray the paddy field tomorrow", ctx);
    expect(t).toMatchObject({ intent: "record_task", task: { date: "2026-11-21", category: "spraying", plotId: "p3" } });
    expect(parseCommand("hello there", ctx).intent).toBe("unknown");
  });
});
