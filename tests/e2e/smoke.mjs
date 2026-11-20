// End-to-end smoke test against a running PRODUCTION server (npm run build && npm start).
// Uses an installed Chrome via playwright-core. Usage: node tests/e2e/smoke.mjs [outDir]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "test-results";
mkdirSync(OUT, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`); };

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "chrome", headless: true });
const errors = [];
try {
  // ---------------- desktop
  const desk = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  desk.setDefaultTimeout(20000);
  const d = await desk.newPage();
  d.on("pageerror", (e) => errors.push(`desktop: ${e.message}`));
  await d.goto(BASE + "/");
  await shot(d, "01-landing-desktop");
  await d.goto(BASE + "/login");
  await d.fill("#email", "demo@krishi.app");
  await d.fill("#password", "krishi-demo-2026");
  await d.click("button[type=submit]");
  await d.waitForURL("**/app");
  check("login redirects to dashboard", d.url().endsWith("/app"));
  await d.waitForSelector("text=Upcoming tasks");
  await shot(d, "02-dashboard-desktop");
  for (const [p, label] of [["/app/finance", "finance"], ["/app/market", "market"], ["/app/calendar", "calendar"], ["/app/labor", "labour"], ["/app/calculator", "calculator"], ["/app/schemes", "schemes"], ["/app/weather", "weather"]]) {
    const res = await d.goto(BASE + p);
    check(`desktop ${label} loads`, res?.status() === 200);
    await d.waitForTimeout(400);
    await shot(d, `03-${label}-desktop`);
  }
  const plots = await d.goto(BASE + "/app/farms");
  await d.click("main a[href^='/app/farms/'] >> text=Kedila");
  await d.waitForSelector("text=People with access");
  await d.click("a[href^='/app/plots/'] >> nth=0");
  await d.waitForSelector("text=Timeline");
  await shot(d, "04-plot-timeline-desktop");
  check("plot timeline renders", true);

  // ---------------- mobile
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: await desk.storageState() });
  mob.setDefaultTimeout(20000);
  const m = await mob.newPage();
  m.on("pageerror", (e) => errors.push(`mobile: ${e.message}`));
  await m.goto(BASE + "/app");
  await m.waitForSelector("text=Upcoming tasks");
  await shot(m, "05-dashboard-mobile");
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("mobile dashboard has no horizontal overflow", overflow <= 1, `overflow ${overflow}px`);
  // quick add via the + sheet
  await m.click("button[aria-label='Add']");
  await m.locator("[role=dialog]").getByRole("button", { name: "Add expense" }).click();
  await m.waitForSelector("#f-amount");
  await m.fill("#f-amount", "275");
  await m.selectOption("#f-category", "TRANSPORT");
  await m.fill("#f-description", "E2E auto fare");
  await shot(m, "06-add-expense-mobile");
  await m.locator("[role=dialog] form button[type=submit]").click();
  await m.waitForSelector("text=Saved", { timeout: 10000 });
  check("expense saved from mobile quick-add", true);
  for (const p of ["/app/diary", "/app/labor", "/app/finance/expenses", "/app/calendar", "/app/market", "/app/assistant"]) {
    await m.goto(BASE + p);
    await m.waitForTimeout(300);
    const ov = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`mobile ${p} fits width`, ov <= 1, `overflow ${ov}px`);
    await shot(m, `07-${p.replaceAll("/", "_")}-mobile`);
  }

  // ---------------- offline round trip
  await m.goto(BASE + "/app/diary");
  const swReady = await m.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
  check("service worker active", swReady);
  await m.reload(); // now controlled by the SW → page cached
  await m.waitForSelector("h1:has-text(\"Activity diary\")");
  await mob.setOffline(true);
  await m.reload();
  await m.waitForSelector("h1:has-text(\"Activity diary\")", { timeout: 15000 });
  check("diary opens offline from cache", true);
  await m.waitForSelector("text=You are offline");
  const marker = `Offline e2e ${Date.now()}`;
  await m.locator("main").getByRole("button", { name: "Record activity" }).first().click();
  await m.waitForSelector("#f-description");
  await m.selectOption("#f-type", "IRRIGATION");
  await m.fill("#f-description", marker);
  await m.locator("[role=dialog] form button[type=submit]").click();
  await m.waitForSelector("text=Saved on this device", { timeout: 10000 });
  check("activity queued while offline", true);
  await m.waitForSelector("text=waiting to sync");
  await shot(m, "08-offline-queued-mobile");
  await mob.setOffline(false);
  await m.waitForSelector("text=synced", { timeout: 30000 });
  check("queued activity synced when back online", true);
  const found = await m.evaluate(async (mk) => {
    const farms = await (await fetch("/api/farms")).json();
    const recs = await (await fetch(`/api/records/activity?farmId=${farms.farms.find((f) => f.name.startsWith("Kedila")).id}`)).json();
    return recs.records.filter((r) => r.description === mk).length;
  }, marker);
  check("exactly one synced copy on the server", found === 1, `found ${found}`);
  await shot(m, "09-after-sync-mobile");
} catch (e) {
  check("e2e run completed", false, e.message);
} finally {
  await browser.close();
}
if (errors.length) console.log("Page errors:\n" + errors.join("\n"));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed || errors.length ? 1 : 0);
