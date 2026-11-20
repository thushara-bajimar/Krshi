import Link from "next/link";
import {
  BarChart3, BookOpenText, Calculator, CloudOff, CloudSun, FileText, HandCoins, Landmark, Languages, Mic, Package, ShieldCheck, Sprout, Users, Wheat,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { LinkButton } from "@/components/ui/button";

const features = [
  { icon: BookOpenText, title: "Farm activity diary", body: "Record every manure application, spray, irrigation and harvest by plot — with product, quantity, cost and who did it. See a timeline for each plot." },
  { icon: Users, title: "Labour & wages", body: "Daily, half-day, hourly or per-palm wages. 3 workers × 1 day × ₹800 is calculated for you, and pending payments are never forgotten." },
  { icon: HandCoins, title: "Expenses & sales", body: "A simple account book: expenses by category, sales with transport and commission deducted, and your recorded net income by crop, plot and month." },
  { icon: Calculator, title: "Input calculator", body: "Enter the dose from your product label or KVK and your plot area — KRSHI works out the quantity, water and cost. It never invents a dose." },
  { icon: BarChart3, title: "Market prices", body: "Arecanut, coconut, pepper, paddy and more across coastal markets, with trends and nearby-market comparison. Every price shows its source and date." },
  { icon: CloudSun, title: "Weather for your farm", body: "7-day forecast at your farm's location, IMD heavy-rain categories, and a rain check on the days you planned spraying." },
  { icon: Landmark, title: "Government schemes", body: "PM-KISAN, crop insurance, micro-irrigation, mechanisation and more — with official links, document checklists and your own application tracker." },
  { icon: Package, title: "Inventory", body: "Stock of copper sulphate, manure, seeds and tools. Deduct what an activity used, and get low-stock and expiry alerts." },
  { icon: Wheat, title: "Harvests & yield", body: "Harvest quantities by plot, what is sold and what remains, and yield per acre compared year to year." },
  { icon: FileText, title: "Reports", body: "Monthly, seasonal and yearly reports for a farm, plot or crop — print or save as PDF, or export CSV for your bank or accountant." },
];

export default function Landing() {
  return (
    <div className="bg-cream">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-ink/80 md:flex">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#region" className="hover:text-ink">For coastal Karnataka</a>
            <a href="#trust" className="hover:text-ink">Trust & data</a>
          </nav>
          <div className="flex items-center gap-2">
            <LinkButton href="/login" variant="ghost" size="sm">Sign in</LinkButton>
            <LinkButton href="/register" size="sm">Get started</LinkButton>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-leaf-200 bg-leaf-50 px-3 py-1 text-xs font-medium text-leaf-800">
            <Sprout className="h-3.5 w-3.5" /> Built for Dakshina Kannada & Udupi
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-leaf-950 sm:text-5xl lg:text-[3.4rem]">
            Your farm’s notebook, labour book and account book — in one place.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            KRSHI helps arecanut, coconut, paddy and mixed-crop farmers record what was done, what it cost and what it earned — and brings market prices, weather and government schemes alongside, with their sources.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/register" size="lg">Create a free account</LinkButton>
            <LinkButton href="/login" size="lg" variant="outline">Try the demo farm</LinkButton>
          </div>
          <p className="mt-4 text-sm text-muted">English and ಕನ್ನಡ · Works offline · Your data stays private</p>
        </div>

        {/* Product preview built from real UI primitives (not a screenshot) */}
        <div className="relative">
          <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-leaf-100/60" />
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Kedila Arecanut Garden</p>
                <p className="text-xs text-muted">Bantwal · 4 plots · 5 acres</p>
              </div>
              <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900">2 waiting to sync</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-line border-b border-line text-center">
              {[["Spent", "₹38,450", "text-ink"], ["Income", "₹62,800", "text-leaf-700"], ["Pending wages", "₹2,500", "text-amber-700"]].map(([l, v, c]) => (
                <div key={l} className="px-2 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted">{l}</p>
                  <p className={`mt-0.5 font-semibold tabular ${c}`}>{v}</p>
                </div>
              ))}
            </div>
            <ul className="divide-y divide-line text-sm">
              {[
                ["Fungicide application", "Areca Block A · 12 kg · ₹3,600", "bg-amber-100 text-amber-900"],
                ["Labour — climbing", "Ramesh · 1 day × ₹1,200 · Paid", "bg-earth-100 text-earth-800"],
                ["Sale — arecanut (chali)", "400 kg × ₹470 · net ₹187,500", "bg-leaf-100 text-leaf-800"],
                ["Task — harvest Block B", "In 3 days · Rain 70% that day", "bg-sky-100 text-sky-900"],
              ].map(([t, s, c]) => (
                <li key={t} className="flex items-center gap-3 px-4 py-3">
                  <span className={`h-8 w-8 shrink-0 rounded-lg ${c}`} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t}</p>
                    <p className="truncate text-xs text-muted">{s}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="card absolute -bottom-6 -left-4 hidden w-56 p-3 sm:block">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Arecanut · Puttur</p>
            <p className="mt-0.5 text-lg font-semibold tabular">₹46,200<span className="text-xs font-normal text-muted"> /qtl modal</span></p>
            <p className="mt-1 text-[11px] text-muted">Source & date shown with every price</p>
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-line bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-semibold text-leaf-950">Everything a working farm needs to remember</h2>
          <p className="mt-2 max-w-2xl text-muted">No more scattered notebooks, receipts and phone notes. Each module works with the others — an activity can update inventory and add an expense in one step.</p>
          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title}>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-leaf-50 text-leaf-800"><f.icon className="h-5 w-5" /></span>
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="region" className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <h2 className="font-display text-3xl font-semibold text-leaf-950">Made for the coast</h2>
            <p className="mt-3 text-muted">Cents and guntas alongside acres. Per-palm climbing wages. Bordeaux spray schedules before the monsoon. Markets from Mangaluru to Sirsi. KRSHI starts where your farm is.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["ಅಡಿಕೆ Arecanut", "ತೆಂಗು Coconut", "ಭತ್ತ Paddy", "ಕಾಳುಮೆಣಸು Pepper", "ಗೇರು Cashew", "ಬಾಳೆ Banana", "ಕೊಕ್ಕೊ Cocoa", "ರಬ್ಬರ್ Rubber", "ತರಕಾರಿ Vegetables"].map((c) => (
                <span key={c} className="rounded-full border border-line bg-white px-3 py-1 text-sm">{c}</span>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
            {[
              { icon: CloudOff, t: "Works on a weak signal", b: "Record activities, expenses, labour and harvests without internet. They sync on their own when you are back online — no duplicates, no silent overwrites." },
              { icon: Languages, t: "English and ಕನ್ನಡ", b: "Switch the interface to Kannada from settings. Crop names, menus and quick actions are translated." },
              { icon: Mic, t: "Speak instead of typing", b: "“I paid three workers 900 rupees each” becomes a labour entry you can check and edit before saving." },
            ].map((x) => (
              <div key={x.t} className="card p-5">
                <x.icon className="h-6 w-6 text-leaf-700" />
                <h3 className="mt-3 font-semibold">{x.t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{x.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="border-y border-line bg-leaf-900 py-16 text-leaf-50 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <ShieldCheck className="h-8 w-8 text-leaf-300" />
            <h2 className="mt-3 font-display text-3xl font-semibold">Honest information, clearly labelled</h2>
            <p className="mt-3 text-leaf-200">Farming decisions cost money. KRSHI never makes up a price, a forecast, a dose or an eligibility decision.</p>
          </div>
          <ul className="space-y-4 text-sm">
            {[
              "Every market price and forecast shows its source, the date it applies to and when it was fetched. Sample data is always marked as sample.",
              "The input calculator only works from a dose you enter from a label or an expert — and asks where it came from.",
              "Crop-issue help describes what can be seen and points you to KVKs and agriculture officers. It does not prescribe chemicals.",
              "Scheme pages link to the official portal and say when the summary was last checked.",
              "Your farm location and records are private. Share a farm only with the people you choose, with view-only or no-money access if you prefer.",
            ].map((t) => (
              <li key={t} className="flex gap-3"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf-300" /><span className="text-leaf-100">{t}</span></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-16 text-center sm:py-20">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="font-display text-3xl font-semibold text-leaf-950">Start with one plot. Add the rest as you go.</h2>
          <p className="mt-3 text-muted">Create your farm, add a plot and record today’s work. It takes two minutes.</p>
          <div className="mt-7 flex justify-center gap-3">
            <LinkButton href="/register" size="lg">Create a free account</LinkButton>
            <LinkButton href="/login" size="lg" variant="outline">Sign in</LinkButton>
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <Logo />
            <p className="mt-2">Farm management for coastal Karnataka.</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="https://pmkisan.gov.in/" target="_blank" rel="noopener noreferrer" className="hover:text-ink">PM-KISAN</a>
            <a href="https://raitamitra.karnataka.gov.in/" target="_blank" rel="noopener noreferrer" className="hover:text-ink">Karnataka Agriculture Dept.</a>
            <a href="https://mausam.imd.gov.in/" target="_blank" rel="noopener noreferrer" className="hover:text-ink">IMD</a>
            <span>Kisan Call Centre: 1800-180-1551</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
