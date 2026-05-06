export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import {
  getLatestStockRankings,
  getRelativeStrength,
  getSignalProfile,
  getStockRankings,
  type Signal,
} from "@/lib/api";
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
// Sub-components
// ---------------------------------------------------------------------------

const SIGNAL_STYLES: Record<Signal, string> = {
  BUY_CANDIDATE: "bg-green-500/20 text-green-400 border-green-500/50",
  WATCH: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  WAIT: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  AVOID: "bg-red-500/20 text-red-400 border-red-500/50",
};

const SIGNAL_LABEL: Record<Signal, string> = {
  BUY_CANDIDATE: "BUY",
  WATCH: "WATCH",
  WAIT: "WAIT",
  AVOID: "AVOID",
};

const SIGNAL_BAR: Record<Signal, string> = {
  BUY_CANDIDATE: "bg-emerald-500",
  WATCH: "bg-amber-500",
  WAIT: "bg-sky-500",
  AVOID: "bg-red-500",
};

const SIGNAL_CARD_ACCENT: Record<Signal, string> = {
  BUY_CANDIDATE: "border-emerald-500/30 text-emerald-400",
  WATCH: "border-amber-500/30 text-amber-400",
  WAIT: "border-sky-500/30 text-sky-400",
  AVOID: "border-red-500/30 text-red-400",
};

function SignalBadge({ signal }: { signal: Signal }) {
  return (
    <Badge variant="outline" className={`${SIGNAL_STYLES[signal]} text-[10px]`}>
      {SIGNAL_LABEL[signal]}
    </Badge>
  );
}

function TrendBadge({ trend }: { trend: string }) {
  const lower = trend.toLowerCase();
  const cls = lower.includes("bull")
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : lower.includes("bear")
      ? "bg-red-500/15 text-red-400 border-red-500/30"
      : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  return (
    <Badge variant="outline" className={`${cls} text-[10px]`}>
      {trend}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Delta windows
// ---------------------------------------------------------------------------

const WINDOWS = [
  { label: "Δ1d", days: 1 },
  { label: "Δ3d", days: 3 },
  { label: "Δ7d", days: 7 },
  { label: "Δ14d", days: 14 },
  { label: "Δ1mo", days: 30 },
] as const;

function findClosestDate(targetMs: number, dates: string[]): string | null {
  if (dates.length === 0) return null;
  let best: string | null = null;
  let bestDiff = Infinity;
  for (const d of dates) {
    const diff = Math.abs(new Date(d).getTime() - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = d;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ScreenerPage() {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - 31);
  const date_from = dateFrom.toISOString().split("T")[0];

  const [rankingsResult, rsResult, profileResult, histResult] =
    await Promise.allSettled([
      getLatestStockRankings({ limit: 1000 }),
      getRelativeStrength({ limit: 1000 }),
      getSignalProfile(),
      getStockRankings({ limit: 5000 , date_from }),
    ]);

  const rankings =
    rankingsResult.status === "fulfilled" ? rankingsResult.value.items : [];
  const rsItems =
    rsResult.status === "fulfilled" ? rsResult.value.items : [];
  const profile =
    profileResult.status === "fulfilled" ? profileResult.value : null;
  const histItems =
    histResult.status === "fulfilled"
      ? histResult.value.items
      : (console.error("[screener] histResult rejected:", (histResult as PromiseRejectedResult).reason), []);

  console.log(`[screener] histItems.length=${histItems.length} date_from=${date_from}`);
  console.log("[screener] histResult:", JSON.stringify(histResult).slice(0, 200));
  // Build delta maps: date-string → Map<ticker, rank_momentum>
  const byDate = new Map<string, Map<string, number>>();
  for (const item of histItems) {
    const dk = item.date.split("T")[0];
    if (!byDate.has(dk)) byDate.set(dk, new Map());
    byDate.get(dk)!.set(item.ticker, item.rank_momentum);
  }
  // Include ALL historical dates — latest date IS the current snapshot date,
  // so filter it out only if it truly matches, but use the latest rankings
  // date (not wall-clock) as the anchor so Δ1d picks the prior trading day.
  const currentDateKey = rankings[0]?.date?.split("T")[0];
  const availableDates = [...byDate.keys()]
    .filter((d) => d !== currentDateKey)
    .sort();
  console.log(`[screener] currentDateKey=${currentDateKey} availableDates(${availableDates.length})=[${availableDates.join(",")}]`);

  // Anchor deltas to the latest data date, not wall-clock "now"
  const latestDataMs = currentDateKey
    ? new Date(currentDateKey).getTime()
    : Date.now();
  const deltaRankMaps = new Map<string, Map<string, number>>();
  for (const { label, days } of WINDOWS) {
    const targetMs = latestDataMs - days * 86_400_000;
    const closest = findClosestDate(targetMs, availableDates);
    console.log(`[screener] ${label}: target=${new Date(targetMs).toISOString().split("T")[0]} closest=${closest} mapSize=${closest ? byDate.get(closest)!.size : 0}`);
    if (closest) deltaRankMaps.set(label, byDate.get(closest)!);
  }

  // RS lookup by ticker
  const rsMap = new Map(rsItems.map((r) => [r.ticker, r]));

  // Signal distribution
  const signalCounts = rankings.reduce(
    (acc, r) => {
      acc[r.signal] = (acc[r.signal] ?? 0) + 1;
      return acc;
    },
    {} as Record<Signal, number>,
  );
  const total = rankings.length || 1;

  // Top 20 by rank_momentum ascending (rank 1 = best)
  const top20 = [...rankings]
    .sort((a, b) => a.rank_momentum - b.rank_momentum)
    .slice(0, 20);

  // Top sectors by avg momentum score
  const sectorAgg = new Map<string, { count: number; totalScore: number }>();
  for (const r of rankings) {
    const s = sectorAgg.get(r.sector) ?? { count: 0, totalScore: 0 };
    s.count++;
    s.totalScore += r.momentum_score;
    sectorAgg.set(r.sector, s);
  }
  const topSectors = [...sectorAgg.entries()]
    .map(([name, { count, totalScore }]) => ({
      name,
      count,
      avgScore: totalScore / count,
    }))
    .filter((s) => s.name)
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 10);

  // Top themes by avg momentum score
  const themeAgg = new Map<string, { count: number; totalScore: number }>();
  for (const r of rankings) {
    const t = themeAgg.get(r.theme) ?? { count: 0, totalScore: 0 };
    t.count++;
    t.totalScore += r.momentum_score;
    themeAgg.set(r.theme, t);
  }
  const topThemes = [...themeAgg.entries()]
    .map(([name, { count, totalScore }]) => ({
      name,
      count,
      avgScore: totalScore / count,
    }))
    .filter((t) => t.name)
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 10);

  const dataDate = currentDateKey ?? null;

  const timestamp = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-zinc-800/80 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <h1 className="text-sm font-semibold tracking-[0.15em] text-zinc-200 uppercase">
            Stock Tracker
            <span className="ml-2 text-zinc-400 font-normal tracking-normal normal-case">
              // Screener
            </span>
          </h1>
          {rankings.length > 0 && (
            <span className="text-[10px] text-zinc-400 tabular-nums">
              {rankings.length.toLocaleString()} stocks
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs text-zinc-400 tabular-nums">{timestamp}</span>
          {dataDate && <span className="text-zinc-500 text-xs">Data as of {dataDate}</span>}
        </div>
      </header>

      <div className="p-6 space-y-5">
        {/* ── Signal Distribution Cards ───────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(["BUY_CANDIDATE", "WATCH", "WAIT", "AVOID"] as Signal[]).map(
            (sig) => {
              const count = signalCounts[sig] ?? 0;
              const pct = total > 1 ? (count / total) * 100 : 0;
              return (
                <Card
                  key={sig}
                  className={`bg-zinc-900/50 border-zinc-800/80 border-t-2 ${SIGNAL_CARD_ACCENT[sig]}`}
                >
                  <CardContent className="pt-4 pb-3 px-4">
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">
                      {SIGNAL_LABEL[sig]}
                    </p>
                    <p
                      className={`text-3xl font-semibold tabular-nums ${SIGNAL_CARD_ACCENT[sig]}`}
                    >
                      {count.toLocaleString()}
                    </p>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex justify-between text-[10px] text-zinc-400">
                        <span>of universe</span>
                        <span className="tabular-nums">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${SIGNAL_BAR[sig]}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            },
          )}
        </div>

        {/* ── Top 20 Momentum Leaders ─────────────────────────────────── */}
        <Card className="bg-zinc-900/50 border-zinc-800/80">
          <CardHeader className="border-b border-zinc-800/60 pb-3">
            <CardTitle className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 uppercase">
              Top 20 Momentum Leaders
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {top20.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800/60 hover:bg-transparent">
                    <TableHead className="text-[10px] tracking-widest text-zinc-400 uppercase pl-4 w-10">
                      #
                    </TableHead>
                    <TableHead className="text-[10px] tracking-widest text-zinc-400 uppercase">
                      Ticker
                    </TableHead>
                    <TableHead className="text-[10px] tracking-widest text-zinc-400 uppercase hidden lg:table-cell">
                      Sector
                    </TableHead>
                    <TableHead className="text-[10px] tracking-widest text-zinc-400 uppercase hidden xl:table-cell">
                      Theme
                    </TableHead>
                    <TableHead className="text-[10px] tracking-widest text-zinc-400 uppercase text-right">
                      Price
                    </TableHead>
                    <TableHead className="text-[10px] tracking-widest text-zinc-400 uppercase text-right">
                      Mom. Score
                    </TableHead>
                    <TableHead className="text-[10px] tracking-widests text-zinc-400 uppercase hidden sm:table-cell">
                      Trend
                    </TableHead>
                    <TableHead className="text-[10px] tracking-widest text-zinc-400 uppercase">
                      Signal
                    </TableHead>
                    <TableHead className="text-[10px] tracking-widest text-zinc-400 uppercase text-right">
                      RS Rank
                    </TableHead>
                    {WINDOWS.map(({ label }) => (
                      <TableHead
                        key={label}
                        className="text-[10px] tracking-widest text-zinc-400 uppercase text-right hidden 2xl:table-cell"
                      >
                        {label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {top20.map((stock, i) => {
                    const rs = rsMap.get(stock.ticker);
                    return (
                      <TableRow
                        key={stock.ticker}
                        className="border-zinc-800/40 hover:bg-zinc-800/30"
                      >
                        <TableCell className="text-zinc-300 tabular-nums text-xs pl-4">
                          {i + 1}
                        </TableCell>
                        <TableCell className="font-semibold text-zinc-100 tracking-wide">
                          {stock.ticker}
                        </TableCell>
                        <TableCell className="text-zinc-300 text-xs hidden lg:table-cell max-w-35 truncate">
                          {stock.sector || "—"}
                        </TableCell>
                        <TableCell className="text-zinc-300 text-xs hidden xl:table-cell max-w-35 truncate">
                          {stock.theme || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-zinc-300">
                          ${stock.price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-emerald-400">
                          {stock.momentum_score.toFixed(2)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <TrendBadge trend={stock.trend} />
                        </TableCell>
                        <TableCell>
                          <SignalBadge signal={stock.signal} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-zinc-300">
                          {rs ? rs.rank : "—"}
                        </TableCell>
                        {WINDOWS.map(({ label }) => {
                          const oldRank = deltaRankMaps
                            .get(label)
                            ?.get(stock.ticker);
                          const delta =
                            oldRank !== undefined
                              ? oldRank - stock.rank_momentum
                              : null;
                          return (
                            <TableCell
                              key={label}
                              className="text-right tabular-nums text-xs pr-3 hidden 2xl:table-cell"
                            >
                              {delta === null ? (
                                <span className="text-zinc-400">—</span>
                              ) : delta > 0 ? (
                                <span className="text-emerald-400">
                                  ▲{delta}
                                </span>
                              ) : delta < 0 ? (
                                <span className="text-red-400">
                                  ▼{Math.abs(delta)}
                                </span>
                              ) : (
                                <span className="text-zinc-400">0</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-zinc-400 text-sm py-6 text-center">
                No ranking data
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Top Sectors + Top Themes ────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Top Sectors */}
          <Card className="bg-zinc-900/50 border-zinc-800/80">
            <CardHeader className="border-b border-zinc-800/60 pb-3">
              <CardTitle className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 uppercase">
                Top Sectors
                <span className="ml-2 text-zinc-400 font-normal normal-case tracking-normal">
                  by avg momentum
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {topSectors.length > 0 ? (
                topSectors.map((sector, i) => {
                  const max = topSectors[0].avgScore || 1;
                  return (
                    <div key={sector.name}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-zinc-400 tabular-nums w-4 shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-zinc-300 truncate">
                            {sector.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <span className="text-zinc-400 tabular-nums">
                            {sector.count}
                          </span>
                          <span className="text-emerald-400 tabular-nums font-semibold w-12 text-right">
                            {sector.avgScore.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500/60"
                          style={{
                            width: `${(sector.avgScore / max) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-zinc-400 text-sm py-4 text-center">
                  No sector data
                </p>
              )}
            </CardContent>
          </Card>

          {/* Top Themes */}
          <Card className="bg-zinc-900/50 border-zinc-800/80">
            <CardHeader className="border-b border-zinc-800/60 pb-3">
              <CardTitle className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 uppercase">
                Top Themes
                <span className="ml-2 text-zinc-400 font-normal normal-case tracking-normal">
                  by avg momentum
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {topThemes.length > 0 ? (
                topThemes.map((theme, i) => {
                  const max = topThemes[0].avgScore || 1;
                  return (
                    <div key={theme.name}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-zinc-400 tabular-nums w-4 shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-zinc-300 truncate">
                            {theme.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <span className="text-zinc-400 tabular-nums">
                            {theme.count}
                          </span>
                          <span className="text-sky-400 tabular-nums font-semibold w-12 text-right">
                            {theme.avgScore.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-500/60"
                          style={{ width: `${(theme.avgScore / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-zinc-400 text-sm py-4 text-center">
                  No theme data
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
