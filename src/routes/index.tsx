import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  DoorOpen,
  Droplets,
  Gauge,
  MessageSquareText,
  Pause,
  Play,
  Snowflake,
  Thermometer,
  Truck,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  analyzeReport,
  makeShipments,
  riskOf,
  tick,
  type ReportAnalysis,
  type RiskLevel,
  type Shipment,
} from "@/lib/freshtrack";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FreshTrack | Cold Chain Monitoring" },
      {
        name: "description",
        content:
          "AI-Powered Cold Chain Monitoring & Spoilage Risk Prediction — live shipment telemetry, alerts and incident analysis.",
      },
      { property: "og:title", content: "FreshTrack | Cold Chain Monitoring" },
      {
        property: "og:description",
        content:
          "AI-Powered Cold Chain Monitoring & Spoilage Risk Prediction — live shipment telemetry, alerts and incident analysis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const riskStyles: Record<RiskLevel, { text: string; bg: string; label: string }> = {
  safe: { text: "text-safe", bg: "bg-safe/12 border-safe/35", label: "Safe" },
  warning: { text: "text-warning", bg: "bg-warning/12 border-warning/35", label: "Warning" },
  critical: { text: "text-critical", bg: "bg-critical/12 border-critical/40", label: "Spoilage risk" },
};

function RiskChip({ level, score }: { level: RiskLevel; score: number }) {
  const s = riskStyles[level];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[0.68rem] tracking-widest uppercase ${s.bg} ${s.text}`}
    >
      <span className={`pulse-dot h-1.5 w-1.5 rounded-full bg-current`} />
      {s.label} · {score}
    </span>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = "text-foreground",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <span className="label-caps">{label}</span>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <p className={`mt-2 font-display text-3xl ${tone}`}>{value}</p>
    </div>
  );
}

function Dashboard() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedId, setSelectedId] = useState("SHIP101");
  const [live, setLive] = useState(true);
  const [report, setReport] = useState(
    "Refrigeration unit stopped working for 20 minutes near the toll plaza, door was open during reloading.",
  );
  const [analysis, setAnalysis] = useState<ReportAnalysis | null>(null);
  const [alerts, setAlerts] = useState<{ id: string; text: string; level: RiskLevel; at: string }[]>(
    [],
  );
  const alertCounter = useRef(0);

  // Generate the random starting data only after the page loads in the browser,
  // so the server-rendered page and the browser always match.
  useEffect(() => {
    setShipments(makeShipments());
  }, []);

  useEffect(() => {
    if (!live || shipments.length === 0) return;
    const i = setInterval(() => setShipments((prev) => tick(prev)), 2000);
    return () => clearInterval(i);
  }, [live, shipments.length]);

  useEffect(() => {
    shipments.forEach((s) => {
      const { level, score } = riskOf(s);
      if (level !== "safe" && Math.random() > 0.82) {
        alertCounter.current += 1;
        setAlerts((a) =>
          [
            {
              id: `${s.id}-${Date.now()}-${alertCounter.current}`,
              level,
              at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              text: `${s.id} · ${s.productType} at ${s.temperature.toFixed(1)}°C (limit ${s.safeRange[1]}°C) — risk ${score}`,
            },
            ...a,
          ].slice(0, 8),
        );
      }
    });
  }, [shipments]);

  const selected = shipments.find((s) => s.id === selectedId) ?? shipments[0];
  const selectedRisk = selected ? riskOf(selected) : { level: "safe" as RiskLevel, score: 0 };

  const counts = useMemo(() => {
    const c = { safe: 0, warning: 0, critical: 0 };
    shipments.forEach((s) => c[riskOf(s).level]++);
    return c;
  }, [shipments]);

  if (!selected) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-8">
        <p className="text-sm text-muted-foreground">Loading shipment data…</p>
      </main>
    );
  }

  const chartData = selected.history.map((r) => ({
    time: new Date(r.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    temperature: r.temperature,
    humidity: r.humidity,
  }));

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Snowflake className="h-5 w-5" />
            <span className="label-caps text-primary">Cold chain control room</span>
          </div>
          <h1 className="mt-1 font-display text-4xl">FreshTrack</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-Powered Cold Chain Monitoring & Spoilage Risk Prediction.
          </p>
        </div>
        <Button variant="outline" onClick={() => setLive((v) => !v)} className="gap-2">
          {live ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {live ? "Pause feed" : "Resume feed"}
        </Button>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Truck} label="Active shipments" value={String(shipments.length)} />
        <Stat icon={Activity} label="Safe" value={String(counts.safe)} tone="text-safe" />
        <Stat icon={AlertTriangle} label="Warning" value={String(counts.warning)} tone="text-warning" />
        <Stat icon={Gauge} label="Spoilage risk" value={String(counts.critical)} tone="text-critical" />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
        <div className="panel p-4">
          <h2 className="label-caps">Shipments</h2>
          <ul className="mt-3 space-y-2">
            {shipments.map((s) => {
              const r = riskOf(s);
              const active = s.id === selectedId;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => setSelectedId(s.id)}
                    className={`w-full rounded-md border px-3 py-3 text-left transition-colors ${
                      active ? "border-primary/60 bg-primary/10" : "border-border bg-secondary/40 hover:bg-secondary"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm">{s.id}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.productType} · {s.route}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-display text-xl ${riskStyles[r.level].text}`}>
                          {s.temperature.toFixed(1)}°C
                        </p>
                        <p className="text-[0.7rem] text-muted-foreground">
                          safe {s.safeRange[0]}–{s.safeRange[1]}°C
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <RiskChip level={r.level} score={r.score} />
                      {s.doorOpen && (
                        <span className="inline-flex items-center gap-1 text-[0.7rem] text-warning">
                          <DoorOpen className="h-3.5 w-3.5" /> door open
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="label-caps">Telemetry · {selected.id}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selected.productType} · driver {selected.driver} · ETA {selected.etaMinutes} min
              </p>
            </div>
            <RiskChip level={selectedRisk.level} score={selectedRisk.score} />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-md border border-border bg-secondary/40 p-3">
              <span className="label-caps flex items-center gap-1">
                <Thermometer className="h-3.5 w-3.5" /> Temp
              </span>
              <p className="font-display text-2xl">{selected.temperature.toFixed(1)}°C</p>
            </div>
            <div className="rounded-md border border-border bg-secondary/40 p-3">
              <span className="label-caps flex items-center gap-1">
                <Droplets className="h-3.5 w-3.5" /> Humidity
              </span>
              <p className="font-display text-2xl">{selected.humidity}%</p>
            </div>
            <div className="rounded-md border border-border bg-secondary/40 p-3">
              <span className="label-caps">Out of range</span>
              <p className="font-display text-2xl">{selected.minutesOutsideRange}m</p>
            </div>
          </div>

          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-grid)" strokeDasharray="3 4" vertical={false} />
                <ReferenceArea
                  y1={selected.safeRange[0]}
                  y2={selected.safeRange[1]}
                  fill="var(--color-safe)"
                  fillOpacity={0.12}
                />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  interval={5}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={54}
                  domain={["auto", "auto"]}
                  tickFormatter={(v: number) => `${v.toFixed(0)}°`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="temperature"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#tempFill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <h2 className="label-caps flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Alert stream
          </h2>
          <ul className="mt-3 space-y-2">
            {alerts.length === 0 && (
              <li className="rounded-md border border-border bg-secondary/40 px-3 py-6 text-center text-sm text-muted-foreground">
                No alerts yet — all shipments within range.
              </li>
            )}
            {alerts.map((a) => (
              <li
                key={a.id}
                className={`flex items-start gap-3 rounded-md border px-3 py-2 text-sm ${riskStyles[a.level].bg}`}
              >
                <span className="mt-1 font-mono text-[0.68rem] text-muted-foreground">{a.at}</span>
                <span className={riskStyles[a.level].text}>{a.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel p-4">
          <h2 className="label-caps flex items-center gap-2">
            <MessageSquareText className="h-4 w-4" /> Driver report analysis
          </h2>
          <Textarea
            value={report}
            onChange={(e) => setReport(e.target.value)}
            rows={4}
            className="mt-3 resize-none bg-secondary/40"
            placeholder="e.g. Refrigeration unit stopped working for 20 minutes"
          />
          <Button className="mt-3" onClick={() => setAnalysis(analyzeReport(report))}>
            Analyse report
          </Button>

          {analysis && (
            <div className="mt-4 space-y-3 rounded-md border border-border bg-secondary/40 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <RiskChip level={analysis.severity} score={analysis.score} />
                <span className="label-caps">sentiment: {analysis.sentiment}</span>
                {analysis.durationMinutes !== null && (
                  <span className="label-caps">incident: {analysis.durationMinutes} min</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {analysis.keywords.length === 0 && (
                  <span className="text-xs text-muted-foreground">No key terms detected.</span>
                )}
                {analysis.keywords.map((k) => (
                  <span
                    key={k}
                    className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[0.7rem] text-primary"
                  >
                    {k}
                  </span>
                ))}
              </div>
              <p className="text-muted-foreground">{analysis.recommendation}</p>
            </div>
          )}
        </div>
      </section>

      <footer className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Demo data is simulated in the browser — no live sensors are connected.
      </footer>
    </main>
  );
}
