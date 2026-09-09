export type RiskLevel = "safe" | "warning" | "critical";

export type ProductType = "Dairy" | "Frozen" | "Produce" | "Pharma" | "Meat";

export type Reading = {
  t: number;
  temperature: number;
  humidity: number;
};

export type Shipment = {
  id: string;
  productType: ProductType;
  route: string;
  driver: string;
  safeRange: [number, number];
  temperature: number;
  humidity: number;
  doorOpen: boolean;
  minutesOutsideRange: number;
  etaMinutes: number;
  history: Reading[];
};

const PRODUCTS: { type: ProductType; range: [number, number] }[] = [
  { type: "Dairy", range: [2, 6] },
  { type: "Frozen", range: [-22, -16] },
  { type: "Produce", range: [4, 10] },
  { type: "Pharma", range: [2, 8] },
  { type: "Meat", range: [-2, 2] },
];

const ROUTES = [
  "Lucknow → Kanpur",
  "Pune → Mumbai",
  "Delhi → Jaipur",
  "Chennai → Bengaluru",
  "Ahmedabad → Surat",
  "Kolkata → Ranchi",
];

const DRIVERS = ["R. Mehta", "S. Iyer", "A. Khan", "P. Nair", "V. Sharma", "D. Bose"];

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function riskOf(s: Shipment): { level: RiskLevel; score: number } {
  const [lo, hi] = s.safeRange;
  const drift = s.temperature > hi ? s.temperature - hi : lo - s.temperature;
  let score = 0;
  if (drift > 0) score += Math.min(55, drift * 14);
  score += Math.min(30, s.minutesOutsideRange * 1.1);
  if (s.doorOpen) score += 10;
  if (s.humidity > 80) score += 6;
  score = Math.max(0, Math.min(99, Math.round(score)));
  const level: RiskLevel = score >= 65 ? "critical" : score >= 32 ? "warning" : "safe";
  return { level, score };
}

export function makeShipments(count = 6): Shipment[] {
  return Array.from({ length: count }, (_, i) => {
    const p = PRODUCTS[i % PRODUCTS.length]!;
    const mid = (p.range[0] + p.range[1]) / 2;
    const stressed = i % 3 === 0;
    const temperature = +(mid + (stressed ? rand(1.5, 5) : rand(-0.8, 0.8))).toFixed(1);
    const now = Date.now();
    const history: Reading[] = Array.from({ length: 24 }, (_, k) => ({
      t: now - (23 - k) * 5 * 60 * 1000,
      temperature: +(temperature + rand(-1.2, 1.2)).toFixed(1),
      humidity: Math.round(rand(58, 84)),
    }));
    return {
      id: `SHIP${String(101 + i)}`,
      productType: p.type,
      route: ROUTES[i % ROUTES.length]!,
      driver: DRIVERS[i % DRIVERS.length]!,
      safeRange: p.range,
      temperature,
      humidity: Math.round(rand(58, 86)),
      doorOpen: stressed && Math.random() > 0.5,
      minutesOutsideRange: stressed ? Math.round(rand(6, 28)) : 0,
      etaMinutes: Math.round(rand(20, 260)),
      history,
    };
  });
}

export function tick(shipments: Shipment[]): Shipment[] {
  return shipments.map((s) => {
    const [lo, hi] = s.safeRange;
    const temperature = +(s.temperature + rand(-0.7, 0.75)).toFixed(1);
    const outside = temperature < lo || temperature > hi;
    const humidity = Math.max(45, Math.min(95, Math.round(s.humidity + rand(-3, 3))));
    return {
      ...s,
      temperature,
      humidity,
      doorOpen: Math.random() > 0.94 ? !s.doorOpen : s.doorOpen,
      minutesOutsideRange: outside
        ? s.minutesOutsideRange + 1
        : Math.max(0, s.minutesOutsideRange - 1),
      etaMinutes: Math.max(0, s.etaMinutes - 1),
      history: [...s.history.slice(-47), { t: Date.now(), temperature, humidity }],
    };
  });
}

/* --- Driver report text analysis (keyword + sentiment heuristics) --- */

const NEGATIVE = [
  "stopped","failed","broken","leak","delay","warm","melted","spoiled","damaged",
  "accident","overheat","stuck","alarm","dead","smell","late","open","thaw","thawed",
];
const POSITIVE = ["fine","normal","ok","okay","good","stable","sealed","on time","cold"];
const KEY_TERMS = [
  "refrigeration","compressor","door","temperature","power","battery","traffic",
  "generator","coolant","ice","seal","unit","engine","sensor",
];

export type ReportAnalysis = {
  sentiment: "negative" | "neutral" | "positive";
  severity: RiskLevel;
  score: number;
  keywords: string[];
  durationMinutes: number | null;
  recommendation: string;
};

export function analyzeReport(text: string): ReportAnalysis {
  const lower = text.toLowerCase();
  const negHits = NEGATIVE.filter((w) => lower.includes(w));
  const posHits = POSITIVE.filter((w) => lower.includes(w));
  const keywords = KEY_TERMS.filter((w) => lower.includes(w));

  const durMatch = lower.match(/(\d+)\s*(minute|min|hour|hr)/);
  let durationMinutes: number | null = null;
  if (durMatch) {
    const n = parseInt(durMatch[1]!, 10);
    durationMinutes = durMatch[2]!.startsWith("h") ? n * 60 : n;
  }

  let score = negHits.length * 18 - posHits.length * 12;
  if (durationMinutes) score += Math.min(35, durationMinutes * 1.2);
  score = Math.max(0, Math.min(99, Math.round(score)));

  const sentiment =
    negHits.length > posHits.length ? "negative" : posHits.length > 0 ? "positive" : "neutral";
  const severity: RiskLevel = score >= 60 ? "critical" : score >= 28 ? "warning" : "safe";

  const recommendation =
    severity === "critical"
      ? "Dispatch inspection at next stop and notify the consignee before delivery."
      : severity === "warning"
        ? "Flag for quality check on arrival and keep logging readings every 5 minutes."
        : "No action needed — continue normal monitoring.";

  return { sentiment, severity, score, keywords, durationMinutes, recommendation };
}
