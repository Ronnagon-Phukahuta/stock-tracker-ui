import { getCandleAnalysis, CandleAnalysisRow } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REGIME_STYLE: Record<
  string,
  { accent: string; titleColor: string; badgeCls: string; desc: string }
> = {
  Bull: {
    accent: "border-t-emerald-500/60",
    titleColor: "text-emerald-400",
    badgeCls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    desc: "DOWN streak = buy the dip. UP streak = no edge.",
  },
  Bear: {
    accent: "border-t-red-500/60",
    titleColor: "text-red-400",
    badgeCls: "bg-red-500/20 text-red-300 border-red-500/40",
    desc: "DOWN 3+ days = dead cat bounce setup → wait → PUT.",
  },
  Sideway: {
    accent: "border-t-amber-500/60",
    titleColor: "text-amber-400",
    badgeCls: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    desc: "DOWN = mean reversion CALL. UP 3+ = danger zone.",
  },
};

const REGIME_ORDER = ["Bull", "Bear", "Sideway"];

// ---------------------------------------------------------------------------
// Playbook data (static rules derived from statistical analysis)
// ---------------------------------------------------------------------------

type PlaybookTier = "green" | "amber" | "warning" | "red";

interface PlaybookRule {
  tier: PlaybookTier;
  condition: string;
  action: string;
  stats: string;
}

const PLAYBOOK: Record<string, PlaybookRule[]> = {
  Bull: [
    { tier: "green",   condition: "SPY แดง 2+ วัน",  action: "CALL พรุ่งนี้",  stats: "53% bounce · avg +1.55% in 7 days (N=2 threshold)" },
    { tier: "amber",   condition: "SPY แดง 1 วัน",   action: "CALL? (weak)",   stats: "51% · รอดูก่อน" },
    { tier: "red",     condition: "SPY เขียว",        action: "ไม่เล่น",        stats: "41–44% — ต่ำกว่า 50% ไม่คุ้มเสี่ยง" },
  ],
  Sideway: [
    { tier: "green",   condition: "SPY แดง 1+ วัน",    action: "CALL พรุ่งนี้",  stats: "64% bounce · avg +1.32% in 7 days (N=1 threshold)" },
    { tier: "red",     condition: "SPY เขียว 3+ วัน",  action: "อันตราย!",       stats: "33% เท่านั้น — หลีกเลี่ยง" },
    { tier: "red",     condition: "SPY เขียว 1–2 วัน", action: "ไม่เล่น",        stats: "47–50% — ไม่คุ้ม" },
  ],
  Bear: [
    { tier: "warning", condition: "SPY แดง 3+ วัน",            action: "รอก่อน",   stats: "Bounce กำลังมา — อย่าเพิ่ง PUT" },
    { tier: "green",   condition: "หลังแดง 3+ วัน แล้วเขียว", action: "PUT",       stats: "Dead cat bounce จบแล้ว · 53% · avg +2.66% in 7 days" },
    { tier: "red",     condition: "อื่นๆ",                     action: "ไม่เล่น",  stats: "No statistical edge" },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtPct(v: number): string {
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}

function reversalColor(pct: number): string {
  if (pct >= 60) return "text-emerald-400 font-semibold";
  if (pct >= 55) return "text-green-400 font-medium";
  if (pct >= 50) return "text-amber-400";
  return "text-red-400/70";
}

function getAction(
  regime: string,
  row: CandleAnalysisRow,
): { label: string; cls: string } | null {
  const dir = row.direction.toUpperCase();
  const n = row.n;
  if (regime === "Bull") {
    if (dir === "DOWN" && n >= 2) return { label: "CALL ✓", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50" };
    if (dir === "DOWN" && n === 1) return { label: "CALL?",      cls: "bg-amber-500/20 text-amber-300 border-amber-500/50" };
    return null;
  }
  if (regime === "Bear") {
    if (dir === "DOWN" && n >= 3) return { label: "→ PUT setup", cls: "bg-amber-500/20 text-amber-300 border-amber-500/50" };
    return null;
  }
  if (regime === "Sideway") {
    if (dir === "DOWN")           return { label: "CALL ✓", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50" };
    if (dir === "UP" && n >= 3)   return { label: "DANGER",    cls: "bg-red-500/20 text-red-300 border-red-500/50" };
    return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Playbook card
// ---------------------------------------------------------------------------

const TIER_BORDER: Record<PlaybookTier, string> = {
  green:   "border-l-emerald-500/80 bg-emerald-500/5",
  amber:   "border-l-amber-500/80   bg-amber-500/5",
  warning: "border-l-amber-500/80   bg-amber-500/5",
  red:     "border-l-red-500/30     bg-transparent",
};

const TIER_ACTION: Record<PlaybookTier, string> = {
  green:   "text-emerald-400 font-semibold",
  amber:   "text-amber-400   font-semibold",
  warning: "text-amber-300   font-semibold",
  red:     "text-zinc-500",
};

const TIER_ICON: Record<PlaybookTier, string> = {
  green:   "🟢",
  amber:   "🟡",
  warning: "⚠️",
  red:     "🔴",
};

function PlaybookCard({ name, isCurrent }: { name: string; isCurrent: boolean }) {
  const style = REGIME_STYLE[name] ?? {
    accent: "border-t-zinc-600/60",
    titleColor: "text-zinc-300",
    badgeCls: "bg-zinc-500/20 text-zinc-400 border-zinc-600/40",
    desc: "",
  };
  const rules = PLAYBOOK[name] ?? [];

  return (
    <Card className={`bg-zinc-900/50 border-zinc-800/80 border-t-2 ${style.accent}`}>
      <CardHeader className="border-b border-zinc-800/60 pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className={`text-sm font-bold tracking-wide ${style.titleColor}`}>
            {name}
          </CardTitle>
          {isCurrent && (
            <Badge variant="outline" className={`${style.badgeCls} text-[10px]`}>
              ← current
            </Badge>
          )}
        </div>
        <p className="text-[10px] text-zinc-500 mt-0.5">{style.desc}</p>
      </CardHeader>
      <CardContent className="px-4 pt-3 pb-4 space-y-2">
        {rules.map((rule, i) => (
          <div
            key={i}
            className={`border-l-2 pl-3 py-1.5 rounded-r-sm ${TIER_BORDER[rule.tier]}`}
          >
            <p className="text-[10px] text-zinc-400 mb-0.5">
              {TIER_ICON[rule.tier]} {rule.condition}
            </p>
            <p className={`text-sm ${TIER_ACTION[rule.tier]}`}>{rule.action}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{rule.stats}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Regime card (statistical details)

function RegimeCard({
  name,
  totalDays,
  rows,
}: {
  name: string;
  totalDays: number;
  rows: CandleAnalysisRow[];
}) {
  const style = REGIME_STYLE[name] ?? {
    accent: "border-t-zinc-600/60",
    titleColor: "text-zinc-300",
    badgeCls: "bg-zinc-500/20 text-zinc-400 border-zinc-600/40",
    desc: "",
  };

  return (
    <Card className={`bg-zinc-900/50 border-zinc-800/80 border-t-2 ${style.accent}`}>
      <CardHeader className="border-b border-zinc-800/60 pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className={`text-sm font-bold tracking-wide ${style.titleColor}`}>
              {name}
            </CardTitle>
            <p className="text-[10px] text-zinc-500 mt-0.5">{style.desc}</p>
          </div>
          <Badge variant="outline" className={`${style.badgeCls} text-[10px] shrink-0`}>
            {totalDays.toLocaleString()} days
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800/60 hover:bg-transparent">
              <TableHead className="text-[9px] uppercase tracking-widest text-zinc-500 w-8 pl-4">N</TableHead>
              <TableHead className="text-[9px] uppercase tracking-widest text-zinc-500 w-14">Dir</TableHead>
              <TableHead className="text-[9px] uppercase tracking-widest text-zinc-500 text-right">Obs</TableHead>
              <TableHead className="text-[9px] uppercase tracking-widest text-zinc-500 text-right">Reversal</TableHead>
              <TableHead className="text-[9px] uppercase tracking-widest text-zinc-500 text-right">fwd+1</TableHead>
              <TableHead className="text-[9px] uppercase tracking-widest text-zinc-500 text-right">fwd+3</TableHead>
              <TableHead className="text-[9px] uppercase tracking-widest text-zinc-500 text-right">fwd+7</TableHead>
              <TableHead className="text-[9px] uppercase tracking-widest text-zinc-500 text-right pr-4">Action</TableHead>
            </TableRow>
            <TableRow className="border-zinc-800/30 hover:bg-transparent bg-zinc-950/40">
              <TableHead className="text-[8px] text-zinc-600 font-normal pl-4 py-1">streak</TableHead>
              <TableHead className="text-[8px] text-zinc-600 font-normal py-1">candle</TableHead>
              <TableHead className="text-[8px] text-zinc-600 font-normal text-right py-1">samples</TableHead>
              <TableHead className="text-[8px] text-zinc-600 font-normal text-right py-1">next day flips</TableHead>
              <TableHead className="text-[8px] text-zinc-600 font-normal text-right py-1">avg return</TableHead>
              <TableHead className="text-[8px] text-zinc-600 font-normal text-right py-1">avg return</TableHead>
              <TableHead className="text-[8px] text-zinc-600 font-normal text-right py-1">avg return</TableHead>
              <TableHead className="text-[8px] text-zinc-600 font-normal text-right py-1 pr-4">tomorrow</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const action = getAction(name, row);
              return (
                <TableRow
                  key={`${row.n}-${row.direction}`}
                  className={
                    row.is_threshold
                      ? "border-l-2 border-l-emerald-500/70 bg-emerald-500/5 border-zinc-800/40 hover:bg-emerald-500/10"
                      : "border-zinc-800/40 hover:bg-zinc-800/30"
                  }
                >
                  <TableCell className="text-sm font-semibold tabular-nums text-zinc-200 pl-4">
                    {row.n}
                  </TableCell>
                  <TableCell
                    className={`text-xs font-medium ${
                      row.direction.toUpperCase() === "DOWN" ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
                    {row.direction}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-zinc-500 text-right">{row.obs}</TableCell>
                  <TableCell className={`text-xs tabular-nums text-right ${reversalColor(row.reversal_pct)}`}>
                    {row.reversal_pct.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-zinc-300 text-right">{fmtPct(row.fwd1_pct)}</TableCell>
                  <TableCell className="text-xs tabular-nums text-zinc-300 text-right">{fmtPct(row.fwd3_pct)}</TableCell>
                  <TableCell className="text-xs tabular-nums text-zinc-300 text-right">
                    <span className="flex items-center justify-end gap-1.5">
                      {fmtPct(row.fwd7_pct)}
                      {row.is_threshold && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/20 text-emerald-300 border-emerald-500/50 text-[9px] font-semibold whitespace-nowrap"
                        >
                          ✓ fires tomorrow
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    {action ? (
                      <Badge
                        variant="outline"
                        className={`${action.cls} text-[9px] font-semibold whitespace-nowrap`}
                      >
                        {action.label}
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-zinc-700">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-xs text-zinc-500 py-4">
                  No data
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Exported Server Component
// ---------------------------------------------------------------------------

export async function CandleAnalysis({ marketStructure }: { marketStructure?: string | null } = {}) {
  const data = await getCandleAnalysis().catch(() => null);

  const dateRange =
    data?.spy_date_range
      ? `${data.spy_date_range.from} → ${data.spy_date_range.to}`
      : null;

  const generatedAt = data?.generated_at
    ? new Date(data.generated_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : null;

  // Render regimes in fixed order; fall back to whatever keys came back
  const regimeKeys =
    data
      ? [
          ...REGIME_ORDER.filter((k) => k in data.regimes),
          ...Object.keys(data.regimes).filter((k) => !REGIME_ORDER.includes(k)),
        ]
      : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold text-zinc-100 tracking-tight"
          style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", "Meiryo", sans-serif' }}
        >
          数字は嘘を言わぬ
        </h2>
        <p className="text-sm text-zinc-500 mt-0.5">Numbers don&apos;t lie</p>
        {dateRange && data?.spy_total_days && (
          <p className="text-[11px] text-zinc-500 mt-1 tabular-nums">
            Based on SPY {dateRange} · {data.spy_total_days.toLocaleString()} trading days
          </p>
        )}
        <p className="text-xs text-zinc-500 mt-3 max-w-2xl leading-relaxed">
          How often SPY reverses direction after N consecutive same-direction days, broken down
          by market structure. The system uses the{" "}
          <span className="text-zinc-300">THRESHOLD</span> row from each regime to decide
          tomorrow&apos;s trade.
        </p>
      </div>

      {/* How to read */}
      <Card className="bg-zinc-900/50 border-zinc-800/80 border-l-2 border-l-violet-500/60">
        <CardContent className="py-3 px-4">
          <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">How to read</p>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Example: If market is <span className="text-amber-400">Sideway</span> and SPY closes{" "}
            <span className="text-red-400">DOWN</span> today → 64.3% chance it reverses UP tomorrow
            → System signals{" "}
            <span className="text-emerald-400 font-semibold">CALL</span> for tomorrow.
          </p>
        </CardContent>
      </Card>

      {/* Playbook — primary view */}
      <div>
        <p className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 uppercase mb-3">Playbook</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {REGIME_ORDER.map((key) => (
            <PlaybookCard
              key={key}
              name={key}
              isCurrent={
                !!marketStructure &&
                marketStructure.toLowerCase().includes(key.toLowerCase())
              }
            />
          ))}
        </div>
      </div>

      {/* Statistical Details — collapsible */}
      {data === null ? (
        <Card className="bg-zinc-900/50 border-zinc-800/80">
          <CardContent className="py-12 text-center text-sm text-zinc-500">
            Candle analysis data unavailable
          </CardContent>
        </Card>
      ) : (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer list-none select-none">
            <span className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 uppercase">
              Statistical Details
            </span>
            <span className="text-zinc-600 text-xs transition-transform group-open:rotate-90">▸</span>
          </summary>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {regimeKeys.map((key) => (
                <RegimeCard
                  key={key}
                  name={key}
                  totalDays={data.regimes[key].total_days}
                  rows={data.regimes[key].rows}
                />
              ))}
            </div>
            <div className="flex flex-col gap-0.5 pt-2 border-t border-zinc-800/60">
              {generatedAt && (
                <p className="text-[10px] text-zinc-500 tabular-nums">Updated: {generatedAt}</p>
              )}
              <p className="text-[10px] text-zinc-600">
                Re-runs every 2 weeks with retrain pipeline
              </p>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
