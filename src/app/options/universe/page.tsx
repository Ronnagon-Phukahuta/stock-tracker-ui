export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { getOptionsUniverse, getTodaysPicks, type OptionsUniverseItem, type OptionsPick } from "@/lib/api";
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
// Types
// ---------------------------------------------------------------------------

type LiquidityGrade = OptionsUniverseItem["liquidity_grade"];
type HoldMode = OptionsUniverseItem["hold_mode"];

// re-export for pick cards
type _OptionsPick = OptionsPick;

// ---------------------------------------------------------------------------
// Styling maps
// ---------------------------------------------------------------------------

const GRADE_BADGE: Record<LiquidityGrade, string> = {
  A: "bg-green-500/20 text-green-400 border-green-500/30",
  B: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  C: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  F: "bg-red-500/20 text-red-400 border-red-500/30",
};

const HOLD_MODE_BADGE: Record<HoldMode, string> = {
  short_hold: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  long_hold: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const HOLD_MODE_LABEL: Record<HoldMode, string> = {
  short_hold: "Short 1-3d",
  long_hold: "Long 7-10d",
};

// ---------------------------------------------------------------------------
// Cell formatters
// ---------------------------------------------------------------------------

function vixBannerCls(vix: number): { bar: string; text: string; label: string } {
  if (vix < 15)
    return { bar: "bg-green-500/10 border-green-500/20", text: "text-green-400", label: "Low volatility — full size" };
  if (vix < 20)
    return { bar: "bg-blue-500/10 border-blue-500/20", text: "text-blue-400", label: "Normal volatility" };
  if (vix < 30)
    return { bar: "bg-yellow-500/10 border-yellow-500/20", text: "text-yellow-400", label: "Elevated — reduced size" };
  return { bar: "bg-red-500/10 border-red-500/20", text: "text-red-400", label: "Extreme fear — minimal size" };
}

function sizeCls(_v: number): string {
  return "";
}

// ---------------------------------------------------------------------------
// Pick card ring
// ---------------------------------------------------------------------------

function pickRing(mode: _OptionsPick["hold_mode"]): string {
  return mode === "short_hold"
    ? "ring-1 ring-green-500/30"
    : "ring-1 ring-purple-500/30";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function OptionsUniversePage() {
  const [universeResult, picksResult] = await Promise.allSettled([
    getOptionsUniverse("B", true),
    getTodaysPicks(),
  ]);

  const universeData =
    universeResult.status === "fulfilled" ? universeResult.value : null;
  const picksData =
    picksResult.status === "fulfilled" ? picksResult.value : null;

  const items = universeData?.items ?? [];
  const summary = universeData?.summary;
  const picks = picksData?.picks ?? [];

  const shortHoldCount = items.filter((r) => r.hold_mode === "short_hold").length;
  const longHoldCount = items.filter((r) => r.hold_mode === "long_hold").length;
  const tradableCount = items.filter((r) => !r.earnings_flag).length;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      {/* ----------------------------------------------------------------- */}
      {/* Page header                                                         */}
      {/* ----------------------------------------------------------------- */}
      <header className="border-b border-zinc-800/80 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <h1 className="text-sm font-semibold tracking-[0.15em] text-zinc-200 uppercase">
            Stock Tracker
            <span className="ml-2 text-zinc-400 font-normal tracking-normal normal-case">
              // Options Universe
            </span>
          </h1>
        </div>
        <span className="text-xs text-zinc-400">
          Tech Infra · Long CALL only · DTE 15-21 · Exit at +20-30% or 3-5 days
        </span>
      </header>

      <div className="p-6 space-y-6">
        {/* -------------------------------------------------------------- */}
        {/* Error state                                                       */}
        {/* -------------------------------------------------------------- */}
        {universeData === null && (
          <Card className="bg-zinc-900/50 border-red-500/40">
            <CardContent className="py-10 text-center text-sm text-red-400">
              Unable to load options universe data. Backend may be unavailable.
            </CardContent>
          </Card>
        )}

        {/* -------------------------------------------------------------- */}
        {/* Summary cards                                                     */}
        {/* -------------------------------------------------------------- */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Card className="bg-zinc-900/50 border-zinc-800/80">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-[9px] text-zinc-500 uppercase tracking-widest">
                Tradable
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-3xl font-bold text-green-400 tabular-nums">
                {universeData !== null ? tradableCount : "—"}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {summary ? `${summary.filtered_count} shown · ${summary.filter_note}` : "Grade A+B"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800/80">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-[9px] text-zinc-500 uppercase tracking-widest">
                Short Hold
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-3xl font-bold text-blue-400 tabular-nums">
                {summary?.short_hold ?? "—"}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">1-3 day exits · full universe</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800/80">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-[9px] text-zinc-500 uppercase tracking-widest">
                Long Hold
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-3xl font-bold text-purple-400 tabular-nums">
                {summary?.long_hold ?? "—"}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">7-10 day exits · full universe</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800/80">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-[9px] text-zinc-500 uppercase tracking-widest">
                Earnings Block
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-3xl font-bold text-red-400 tabular-nums">
                {summary?.earnings_blocked ?? "—"}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">skip these</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800/80">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-[9px] text-zinc-500 uppercase tracking-widest">
                Last Scan
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm font-mono text-zinc-200 tabular-nums">
                {summary?.scan_date ?? "—"}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">updated daily</p>
            </CardContent>
          </Card>
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Today's Picks                                                     */}
        {/* -------------------------------------------------------------- */}
        <div>
          <div className="mb-3">
            <p className="text-xs font-semibold tracking-[0.2em] text-zinc-400 uppercase">
              Today&apos;s Picks
            </p>
            <p className="text-[11px] text-zinc-600 mt-0.5">
              Rotation + liquidity filtered · Long CALL only
            </p>
          </div>
          {picks.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {picks.map((pick) => (
                <Card
                  key={pick.ticker}
                  className={`bg-zinc-900/50 border-zinc-800/80 ${pickRing(pick.hold_mode)}`}
                >
                  <CardContent className="px-4 pt-4 pb-3 space-y-2">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-lg font-bold font-mono text-zinc-100 leading-none">
                        {pick.ticker}
                      </p>
                      <Badge
                        variant="outline"
                        className={`${GRADE_BADGE[pick.liquidity_grade]} text-[10px] font-semibold shrink-0`}
                      >
                        {pick.liquidity_grade}
                      </Badge>
                    </div>
                    <Badge
                      variant="outline"
                      className={`${HOLD_MODE_BADGE[pick.hold_mode]} text-[10px]`}
                    >
                      {HOLD_MODE_LABEL[pick.hold_mode]}
                    </Badge>
                    <div className="space-y-0.5 text-[11px] font-mono text-zinc-400">
                      <p>Spot: <span className="text-zinc-200">${pick.spot_price.toFixed(2)}</span></p>
                      <p>RS Rank: <span className="text-zinc-200">#{pick.rs_rank}</span></p>
                      <p>Momentum: <span className="text-zinc-200">{pick.momentum_score.toFixed(3)}</span></p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-600">Picks unavailable</p>
          )}
        </div>

        {/* -------------------------------------------------------------- */}
        {/* VIX context banner                                                */}
        {/* -------------------------------------------------------------- */}
        {items.length > 0 && (() => {
          const vix = items[0].vix_latest;
          const regime = items[0].regime;
          const { bar, text, label } = vixBannerCls(vix);
          const regimeCls = regime === "Bull"
            ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
            : regime === "Bear"
              ? "bg-green-500/20 text-green-400 border-green-500/30"
              : "bg-blue-500/20 text-blue-400 border-blue-500/30";
          return (
            <div className={`rounded border px-4 py-2.5 flex items-center justify-between ${bar}`}>
              <span className={`text-sm font-mono font-medium ${text} flex items-center gap-2`}>
                Market VIX: {vix.toFixed(1)}
                {regime && (
                  <Badge variant="outline" className={`${regimeCls} text-[10px] font-medium`}>
                    {regime}
                  </Badge>
                )}
              </span>
              <span className={`text-xs ${text} opacity-75`}>{label}</span>
            </div>
          );
        })()}

        {/* -------------------------------------------------------------- */}
        {/* Main table                                                        */}
        {/* -------------------------------------------------------------- */}
        <Card className="bg-zinc-900/50 border-zinc-800/80">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800/80 hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-medium pl-4">
                    Ticker
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
                    Grade
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-medium text-right">
                    Avg Vol (30d)
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-medium text-right">
                    Spot
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
                    Hold Mode
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-medium text-right pr-4">
                    Next Earnings
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {universeData !== null && items.length === 0 && (
                  <TableRow className="border-zinc-800/80">
                    <TableCell colSpan={6} className="py-12 text-center text-sm text-zinc-500">
                      No tradable tickers found. All Grade A/B tickers may be in earnings window.
                    </TableCell>
                  </TableRow>
                )}

                {items.map((row) => (
                  <TableRow
                    key={row.ticker}
                    className={`border-zinc-800/80 hover:bg-white/5 transition-colors${row.earnings_flag ? " opacity-50" : ""}`}
                  >
                    <TableCell className="pl-4 font-mono font-bold text-sm text-zinc-100">
                      {row.ticker}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${GRADE_BADGE[row.liquidity_grade]} text-[10px] font-semibold`}
                      >
                        {row.liquidity_grade}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-zinc-300 tabular-nums">
                      {row.avg_volume_30d >= 1_000_000_000
                        ? `${(row.avg_volume_30d / 1e9).toFixed(1)}B`
                        : row.avg_volume_30d >= 1_000_000
                          ? `${(row.avg_volume_30d / 1e6).toFixed(1)}M`
                          : `${(row.avg_volume_30d / 1000).toFixed(0)}K`}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-zinc-300 tabular-nums">
                      ${row.spot_price.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${HOLD_MODE_BADGE[row.hold_mode]} text-[10px]`}
                      >
                        {HOLD_MODE_LABEL[row.hold_mode]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums pr-4">
                      {!row.days_to_earnings ? (
                        <span className="text-muted-foreground">—</span>
                      ) : row.earnings_flag ? (
                        <span className="text-red-400">⚠️ {row.days_to_earnings}d — avoid</span>
                      ) : row.days_to_earnings <= 30 ? (
                        <span className="text-yellow-400">{row.days_to_earnings}d — soon</span>
                      ) : (
                        <span className="text-muted-foreground">{row.days_to_earnings}d</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* -------------------------------------------------------------- */}
        {/* Footer note                                                       */}
        {/* -------------------------------------------------------------- */}
        <p className="text-[11px] text-zinc-600 leading-relaxed">
          Earnings-blocked tickers are hidden by default · IV uses 21-day realized vol
          proxy · Scan runs daily before market open · Grade A ≥70 · B ≥45 · C ≥25 · F &lt;25
        </p>
      </div>
    </main>
  );
}
