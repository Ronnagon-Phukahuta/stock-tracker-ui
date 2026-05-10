import { Fragment } from "react";
import { getCandleAnalysis, CandleAnalysisRow, CandleAnalysisTickerBlock } from "@/lib/api";
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

function PlaybookCard({
  name,
  isCurrent,
  thresholdRow,
}: {
  name: string;
  isCurrent: boolean;
  thresholdRow?: CandleAnalysisRow | null;
}) {
  const style = REGIME_STYLE[name] ?? {
    accent: "border-t-zinc-600/60",
    titleColor: "text-zinc-300",
    badgeCls: "bg-zinc-500/20 text-zinc-400 border-zinc-600/40",
    desc: "",
  };
  const rules = PLAYBOOK[name] ?? [];

  // Build live stats string from threshold row when available
  function liveStats(row: CandleAnalysisRow): string {
    const reversal = row.reversal_pct.toFixed(0);
    const optDay = String(row.optimal_exit_day ?? "").toLowerCase().trim();
    let days = "7";
    let fwdPct: number | null = row.fwd7_pct;
    if (["1", "day1", "fwd1", "d1"].includes(optDay)) { days = "1"; fwdPct = row.fwd1_pct; }
    else if (["3", "day3", "fwd3", "d3"].includes(optDay)) { days = "3"; fwdPct = row.fwd3_pct; }
    const avgStr = fwdPct != null ? (fwdPct >= 0 ? "+" : "") + fwdPct.toFixed(2) + "%" : "—";
    return `${reversal}% bounce · ${avgStr} avg · exit day ${days}`;
  }

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
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {rule.tier === "green" && thresholdRow ? liveStats(thresholdRow) : rule.stats}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Market Context Bar
// ---------------------------------------------------------------------------

function MarketContextBar({
  currentVix,
  currentVixBand,
  transitionRisk,
}: {
  currentVix?: number | null;
  currentVixBand?: string | null;
  transitionRisk?: { alert: string; probability: number } | null;
}) {
  const alert = transitionRisk?.alert?.toUpperCase();
  const riskCls =
    alert === "HIGH"
      ? "text-red-400"
      : alert === "ELEVATED"
        ? "text-amber-400"
        : "text-emerald-400";

  return (
    <Card className="bg-zinc-900/50 border-zinc-800/80">
      <CardContent className="py-3 px-4">
        <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2">Current Market Context</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          {currentVix != null && (
            <span className="text-sm text-zinc-200 tabular-nums">
              VIX {currentVix.toFixed(2)}
              {currentVixBand && (
                <span className="text-zinc-500 ml-1.5">· {currentVixBand}</span>
              )}
            </span>
          )}
          {transitionRisk && (
            <span className={`text-sm font-medium ${riskCls}`}>
              Regime Shift Risk:{" "}
              <span className="font-bold">{transitionRisk.alert}</span>{" "}
              {(transitionRisk.probability * 100).toFixed(1)}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Regime card (statistical details)
// ---------------------------------------------------------------------------

function RegimeCard({
  name,
  totalDays,
  rows,
  tickers,
}: {
  name: string;
  totalDays: number;
  rows: CandleAnalysisRow[];
  tickers?: Record<string, CandleAnalysisTickerBlock> | null;
}) {
  const style = REGIME_STYLE[name] ?? {
    accent: "border-t-zinc-600/60",
    titleColor: "text-zinc-300",
    badgeCls: "bg-zinc-500/20 text-zinc-400 border-zinc-600/40",
    desc: "",
  };

  const spyRows = tickers?.SPY?.rows ?? rows;
  const qqqRows = tickers?.QQQ?.rows ?? null;

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
            {spyRows.map((row) => {
              const action = getAction(name, row);
              const qqqRow =
                qqqRows?.find((r) => r.n === row.n && r.direction === row.direction) ?? null;
              return (
                <Fragment key={`${row.n}-${row.direction}`}>
                  <TableRow
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
                  {row.is_threshold && (qqqRow != null || (row.wf_folds?.length ?? 0) > 0) ? (
                    <TableRow className="border-0 hover:bg-transparent">
                      <TableCell colSpan={8} className="py-3 px-4 bg-zinc-950/60">
                        <div className="flex flex-col gap-3">
                          {/* SPY vs QQQ comparison */}
                          {qqqRow && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">SPY</p>
                                <p className="text-xs tabular-nums text-zinc-300">
                                  {row.obs} obs ·{" "}
                                  <span className={reversalColor(row.reversal_pct)}>
                                    {row.reversal_pct.toFixed(1)}%
                                  </span>
                                </p>
                                <p className="text-[10px] tabular-nums text-zinc-500 mt-0.5">
                                  {fmtPct(row.fwd1_pct)} / {fmtPct(row.fwd3_pct)} / {fmtPct(row.fwd7_pct)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">QQQ</p>
                                <p className="text-xs tabular-nums text-zinc-300">
                                  {qqqRow.obs} obs ·{" "}
                                  <span className={reversalColor(qqqRow.reversal_pct)}>
                                    {qqqRow.reversal_pct.toFixed(1)}%
                                  </span>
                                </p>
                                <p className="text-[10px] tabular-nums text-zinc-500 mt-0.5">
                                  {fmtPct(qqqRow.fwd1_pct)} / {fmtPct(qqqRow.fwd3_pct)} / {fmtPct(qqqRow.fwd7_pct)}
                                </p>
                              </div>
                            </div>
                          )}
                          {/* Walk-forward validation */}
                          {row.wf_folds && row.wf_folds.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-1.5">
                                <p className="text-[9px] text-zinc-500 uppercase tracking-widest">
                                  Walk-Forward
                                </p>
                                {row.wf_consistent != null && (
                                  <Badge
                                    variant="outline"
                                    className={
                                      row.wf_consistent
                                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px]"
                                        : "bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px]"
                                    }
                                  >
                                    {row.wf_consistent ? "✓ Consistent" : "~ Mixed"}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex gap-1.5 mb-1.5">
                                {row.wf_folds.map((fold, i) => (
                                  <span
                                    key={i}
                                    className={`w-2.5 h-2.5 rounded-full inline-block ${
                                      fold.obs_test < 10
                                        ? "bg-zinc-600"
                                        : (fold.reversal_pct_test ?? 0) > 52
                                          ? "bg-emerald-400"
                                          : "bg-red-400"
                                    }`}
                                    title={`${fold.year}: ${fold.reversal_pct_test != null ? fold.reversal_pct_test.toFixed(1) : "—"}% (n=${fold.obs_test})`}
                                  />
                                ))}
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                {row.wf_folds.map((fold, i) => (
                                  <span key={i} className="text-[9px] text-zinc-500 tabular-nums">
                                    {fold.year}: {fold.reversal_pct_test != null ? fold.reversal_pct_test.toFixed(1) : "—"}% (n={fold.obs_test})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
            {spyRows.length === 0 && (
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
// Exit Timing Guide card
// ---------------------------------------------------------------------------

const EXIT_DAYS: Array<{ key: string; aliases: string[]; label: string; fwdKey: keyof CandleAnalysisRow; posKey: keyof CandleAnalysisRow }> = [
  { key: "fwd1", aliases: ["1", "day1", "fwd1", "d1"],  label: "Day 1", fwdKey: "fwd1_pct", posKey: "fwd1_pct_positive" },
  { key: "fwd3", aliases: ["3", "day3", "fwd3", "d3"],  label: "Day 3", fwdKey: "fwd3_pct", posKey: "fwd3_pct_positive" },
  { key: "fwd7", aliases: ["7", "day7", "fwd7", "d7"],  label: "Day 7", fwdKey: "fwd7_pct", posKey: "fwd7_pct_positive" },
];

function ExitTimingCard({
  name,
  rows,
  tickers,
}: {
  name: string;
  rows: CandleAnalysisRow[];
  tickers?: Record<string, CandleAnalysisTickerBlock> | null;
}) {
  const style = REGIME_STYLE[name] ?? {
    accent: "border-t-zinc-600/60",
    titleColor: "text-zinc-300",
    badgeCls: "bg-zinc-500/20 text-zinc-400 border-zinc-600/40",
    desc: "",
  };

  const spyRows = (tickers?.SPY?.regimes?.[name]?.rows ?? tickers?.SPY?.rows ?? rows) as CandleAnalysisRow[];
  const qqqRows = (tickers?.QQQ?.regimes?.[name]?.rows ?? tickers?.QQQ?.rows ?? null) as CandleAnalysisRow[] | null;

  const spyThreshold = spyRows.find((r) => r.is_threshold) ?? null;
  const qqqThreshold = qqqRows?.find((r) => r.is_threshold) ?? null;

  if (!spyThreshold) return null;

  function DayColumns({ row, label }: { row: CandleAnalysisRow; label: string }) {
    const optimal = String(row.optimal_exit_day ?? "").toLowerCase().trim();
    return (
      <div>
        <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2">{label}</p>
        <div className="flex gap-2">
          {EXIT_DAYS.map(({ aliases, label: dayLabel, fwdKey, posKey }) => {
            const isOptimal = optimal !== "" && aliases.includes(optimal);
            const avgVal = row[fwdKey] as number | null | undefined;
            const posVal = row[posKey] as number | null | undefined;
            return (
              <div
                key={dayLabel}
                className={`flex-1 rounded px-2 py-2 text-center border ${
                  isOptimal
                    ? "border-emerald-500/60 bg-green-900/50"
                    : "border-zinc-800/40 bg-transparent"
                }`}
              >
                <p className={`text-[9px] font-semibold uppercase tracking-wider mb-1.5 ${isOptimal ? "text-emerald-300" : "text-zinc-600"}`}>
                  {dayLabel}
                </p>
                <p className={`text-sm font-bold tabular-nums ${isOptimal ? "text-emerald-300" : "text-zinc-500"}`}>
                  {avgVal != null ? (avgVal >= 0 ? "+" : "") + avgVal.toFixed(2) + "%" : "—"}
                </p>
                <p className={`text-[9px] tabular-nums mt-0.5 ${isOptimal ? "text-emerald-400/70" : "text-zinc-500"}`}>
                  {posVal != null ? posVal.toFixed(0) + "% positive" : ""}
                </p>
                {isOptimal && (
                  <p className="text-[9px] font-semibold text-emerald-400 mt-1.5">★ Best exit</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Card className={`bg-zinc-900/50 border-zinc-800/80 border-t-2 ${style.accent}`}>
      <CardHeader className="border-b border-zinc-800/60 pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className={`text-sm font-bold tracking-wide ${style.titleColor}`}>
            {name}
          </CardTitle>
          <span className="text-[9px] text-zinc-500">
            {spyThreshold.direction.toUpperCase()} {spyThreshold.n}d streak
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-3 pb-4 space-y-3">
        <DayColumns row={spyThreshold} label="SPY" />
        {qqqThreshold && <DayColumns row={qqqThreshold} label="QQQ" />}
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

      {/* Current Market Context */}
      {(data?.current_vix != null || data?.transition_risk) && (
        <MarketContextBar
          currentVix={data?.current_vix}
          currentVixBand={data?.current_vix_band}
          transitionRisk={data?.transition_risk}
        />
      )}

      {/* Playbook — primary view */}
      <div>
        <p className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 uppercase mb-3">Playbook</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {REGIME_ORDER.map((key) => {
            const regimeData = data?.regimes[key];
            const spyRows = regimeData?.tickers?.SPY?.rows ?? regimeData?.rows ?? [];
            const thresholdRow = spyRows.find((r) => r.is_threshold) ?? null;
            return (
              <PlaybookCard
                key={key}
                name={key}
                isCurrent={
                  !!marketStructure &&
                  marketStructure.toLowerCase().includes(key.toLowerCase())
                }
                thresholdRow={thresholdRow}
              />
            );
          })}
        </div>
      </div>

      {/* Statistical Details — collapsible */}
      {data !== null && (
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 uppercase mb-3">
            Exit Timing Guide
          </p>
          <p className="text-[10px] text-zinc-500 mb-3">
            Based on 27yr historical distribution · ★ = statistically optimal exit day
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {regimeKeys.map((key) => (
              <ExitTimingCard
                key={key}
                name={key}
                rows={data.regimes[key].rows}
                tickers={data.tickers}
              />
            ))}
          </div>
        </div>
      )}

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
                  tickers={data.regimes[key].tickers}
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
