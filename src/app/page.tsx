export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import {
  getLatestStockRankings,
  getLatestMarketRegime,
  getVixHistory,
  getLatestWatchlist,
  getPortfolioPositions,
  getPrices,
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
// Constants
// ---------------------------------------------------------------------------

const PORTFOLIO_START_DATE = "2024-07-25";

// ---------------------------------------------------------------------------
// Helpers
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

function SignalBadge({ signal }: { signal: Signal }) {
  return (
    <Badge variant="outline" className={SIGNAL_STYLES[signal]}>
      {SIGNAL_LABEL[signal]}
    </Badge>
  );
}

function RegimeBadge({ regime }: { regime: "bull" | "bear" | "neutral" }) {
  const styles = {
    bull: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    bear: "bg-red-500/15 text-red-400 border-red-500/30",
    neutral: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  };
  return (
    <Badge variant="outline" className={`px-3 py-1 text-sm ${styles[regime]}`}>
      {regime.toUpperCase()}
    </Badge>
  );
}

const SIGNAL_BAR: Record<Signal, string> = {
  BUY_CANDIDATE: "bg-emerald-500",
  WATCH: "bg-amber-500",
  WAIT: "bg-sky-500",
  AVOID: "bg-red-500",
};

function fmtDelta(v: number) {
  return (v >= 0 ? "+" : "-") + "$" + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtPct(v: number, precision = 2) {
  return (v >= 0 ? "+" : "") + v.toFixed(precision) + "%";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function Home() {
  // Phase 1: portfolio positions needed to know tickers for price fetch
  const positionsResult = await getPortfolioPositions().catch(() => null);
  const positions = positionsResult?.items ?? [];
  const totalCashInvested = positionsResult?.total_cash_invested ?? 0;
  const priceTickers = [...new Set([...positions.map((p) => p.ticker), "SPY"])].join(",");

  // Phase 2: all remaining data in parallel
  const [rankingsResult, regimeResult, vixResult, watchlistResult, pricesResult] =
    await Promise.allSettled([
      getLatestStockRankings({ limit: 1000 }),
      getLatestMarketRegime({ limit: 1 }),
      getVixHistory({ limit: 5 }),
      getLatestWatchlist({ limit: 200 }),
      getPrices({ tickers: priceTickers, since_date: PORTFOLIO_START_DATE }),
    ]);

  const rankings = rankingsResult.status === "fulfilled" ? rankingsResult.value.items : [];
  const regimeItems = regimeResult.status === "fulfilled" ? regimeResult.value.items : [];
  const vixItems = vixResult.status === "fulfilled" ? vixResult.value.items : [];
  const watchlist = watchlistResult.status === "fulfilled" ? watchlistResult.value.items : [];
  const allPrices = pricesResult.status === "fulfilled" ? pricesResult.value.items : [];

  // -------------------------------------------------------------------------
  // Market regime
  // -------------------------------------------------------------------------

  const latestRegime = regimeItems[0] ?? null;
  const latestVix = [...vixItems].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const vixValue = latestVix?.vix ?? null;

  const regimeLabel: "bull" | "bear" | "neutral" = latestRegime
    ? latestRegime.bullish_count > latestRegime.bearish_count
      ? "bull"
      : latestRegime.bearish_count > latestRegime.bullish_count
        ? "bear"
        : "neutral"
    : "neutral";

  // -------------------------------------------------------------------------
  // Signal distribution
  // -------------------------------------------------------------------------

  const signalCounts = rankings.reduce(
    (acc, r) => { acc[r.signal] = (acc[r.signal] ?? 0) + 1; return acc; },
    {} as Record<Signal, number>,
  );
  const total = rankings.length || 1;
  const breadthPct =
    (((signalCounts.BUY_CANDIDATE ?? 0) + (signalCounts.WATCH ?? 0)) / total) * 100;

  // -------------------------------------------------------------------------
  // Options signal (derived from regime + VIX + breadth)
  // -------------------------------------------------------------------------

  const vixLabel =
    vixValue === null ? "—"
    : vixValue < 15 ? "Calm"
    : vixValue < 20 ? "Normal"
    : vixValue < 25 ? "Elevated"
    : "Fear";

  const optionsDirection =
    regimeLabel === "bull" && (vixValue === null || vixValue < 22)
      ? "CALL"
      : regimeLabel === "bear" || (vixValue !== null && vixValue > 25)
        ? "PUT"
        : "NEUTRAL";

  const breadthLabel =
    breadthPct >= 55 ? "Strong breadth"
    : breadthPct >= 40 ? "Mixed breadth"
    : "Weak breadth";

  const edgeRating =
    regimeLabel === "bull" && breadthPct >= 50 && (vixValue ?? 99) < 22
      ? "HIGH"
      : (regimeLabel !== "neutral" || breadthPct > 40)
        ? "MODERATE"
        : "LOW";

  // -------------------------------------------------------------------------
  // Portfolio quick view
  // -------------------------------------------------------------------------

  type PE = { cur: number; prev: number | null };
  const priceMap: Record<string, PE> = {};
  for (const pos of positions) {
    const hist = allPrices
      .filter((p) => p.ticker === pos.ticker)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (hist.length >= 2)
      priceMap[pos.ticker] = { cur: hist[hist.length - 1].price, prev: hist[hist.length - 2].price };
    else if (hist.length === 1)
      priceMap[pos.ticker] = { cur: hist[0].price, prev: null };
  }

  let totalValue = 0;
  let totalCost = 0;
  let dayChangeDollar = 0;

  for (const pos of positions) {
    const shares = pos.entry_price > 0 ? pos.invested_usd / pos.entry_price : 0;
    const pd = priceMap[pos.ticker];
    if (pd) {
      totalValue += shares * pd.cur;
      if (pd.prev !== null) dayChangeDollar += shares * (pd.cur - pd.prev);
    }
    totalCost += pos.invested_usd;
  }

  const totalPnlDollar = totalValue > 0 ? totalValue - totalCost : null;
  const totalPnlPct =
    totalCost > 0 && totalPnlDollar !== null ? (totalPnlDollar / totalCost) * 100 : null;
  const dayChangePct =
    positions.length > 0 && totalValue - dayChangeDollar !== 0
      ? (dayChangeDollar / (totalValue - dayChangeDollar)) * 100
      : null;
  const lifetimeReturn =
    totalCashInvested > 0 && totalValue > 0
      ? ((totalValue - totalCashInvested) / totalCashInvested) * 100
      : null;

  const spyHist = allPrices
    .filter((p) => p.ticker === "SPY")
    .sort((a, b) => a.date.localeCompare(b.date));
  const spyStart =
    spyHist.find((p) => p.date.slice(0, 10) >= PORTFOLIO_START_DATE) ?? spyHist[0] ?? null;
  const spyLatest = spyHist.length > 0 ? spyHist[spyHist.length - 1] : null;
  const spyReturn =
    spyStart && spyLatest && spyStart.date !== spyLatest.date
      ? ((spyLatest.price - spyStart.price) / spyStart.price) * 100
      : null;
  const alphaVsSpy =
    lifetimeReturn !== null && spyReturn !== null ? lifetimeReturn - spyReturn : null;

  // -------------------------------------------------------------------------
  // Top 5 momentum leaders
  // -------------------------------------------------------------------------

  const topMomentum = [...rankings]
    .sort((a, b) => a.rank_momentum - b.rank_momentum)
    .slice(0, 5);

  // -------------------------------------------------------------------------
  // Watchlist highlights: top 3 BUY_CANDIDATE by rank_momentum
  // -------------------------------------------------------------------------

  const buySignals = [...rankings]
    .filter((r) => r.signal === "BUY_CANDIDATE")
    .sort((a, b) => a.rank_momentum - b.rank_momentum)
    .slice(0, 3);

  // -------------------------------------------------------------------------
  // Top sectors + themes by avg momentum score
  // -------------------------------------------------------------------------

  const sectorMap: Record<string, { total: number; count: number }> = {};
  const themeMap: Record<string, { total: number; count: number }> = {};

  for (const r of rankings) {
    if (r.sector) {
      if (!sectorMap[r.sector]) sectorMap[r.sector] = { total: 0, count: 0 };
      sectorMap[r.sector].total += r.momentum_score;
      sectorMap[r.sector].count += 1;
    }
    if (r.theme) {
      if (!themeMap[r.theme]) themeMap[r.theme] = { total: 0, count: 0 };
      themeMap[r.theme].total += r.momentum_score;
      themeMap[r.theme].count += 1;
    }
  }

  const topSectors = Object.entries(sectorMap)
    .map(([name, { total, count }]) => ({ name, avg: total / count, count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5);

  const topThemes = Object.entries(themeMap)
    .map(([name, { total, count }]) => ({ name, avg: total / count, count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5);

  const dataDate = rankings[0]?.date?.slice(0, 10) ?? latestRegime?.date?.slice(0, 10) ?? null;

  const timestamp = new Date().toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      {/* Header */}
      <header className="border-b border-zinc-800/80 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h1 className="text-sm font-semibold tracking-[0.15em] text-zinc-200 uppercase">
            Stock Tracker
            <span className="ml-2 text-zinc-400 font-normal tracking-normal normal-case">
              // Daily Briefing
            </span>
          </h1>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs text-zinc-400 tabular-nums">{timestamp}</span>
          {dataDate && <span className="text-zinc-500 text-xs">Data as of {dataDate}</span>}
        </div>
      </header>

      <div className="p-6 space-y-5">

        {/* Row 1: Market Regime + Signal Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          <Card className="bg-zinc-900/50 border-zinc-800/80">
            <CardHeader className="border-b border-zinc-800/60 pb-3">
              <CardTitle className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 uppercase">
                Market Regime
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {latestRegime ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <RegimeBadge regime={regimeLabel} />
                    <span className="text-xs text-zinc-400 tabular-nums">{latestRegime.date}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">% Bullish</p>
                      <p className="text-2xl font-semibold tabular-nums text-zinc-100">
                        {((latestRegime.bullish_count / latestRegime.total_stocks) * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">VIX</p>
                      <p className={`text-2xl font-semibold tabular-nums ${
                        vixValue === null ? "text-zinc-400"
                        : vixValue < 18 ? "text-emerald-400"
                        : vixValue < 25 ? "text-amber-400"
                        : "text-red-400"
                      }`}>
                        {vixValue !== null ? vixValue.toFixed(2) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Breadth</p>
                      <p className={`text-2xl font-semibold tabular-nums ${
                        breadthPct >= 50 ? "text-emerald-400"
                        : breadthPct >= 30 ? "text-amber-400"
                        : "text-red-400"
                      }`}>
                        {rankings.length > 0 ? `${breadthPct.toFixed(0)}%` : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-zinc-400 text-sm py-4 text-center">No regime data</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800/80">
            <CardHeader className="border-b border-zinc-800/60 pb-3">
              <CardTitle className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 uppercase">
                Signal Distribution
                {rankings.length > 0 && (
                  <span className="ml-2 text-zinc-500 font-normal normal-case tracking-normal">
                    {rankings.length.toLocaleString()} tickers
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {(["BUY_CANDIDATE", "WATCH", "WAIT", "AVOID"] as Signal[]).map((sig) => {
                const count = signalCounts[sig] ?? 0;
                const pct = total > 1 ? (count / total) * 100 : 0;
                return (
                  <div key={sig}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-zinc-400">{SIGNAL_LABEL[sig]}</span>
                      <span className="text-zinc-400 tabular-nums">
                        {count.toLocaleString()}
                        <span className="ml-1">({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${SIGNAL_BAR[sig]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Portfolio Quick View */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3 px-0.5">
            Portfolio Quick View
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-zinc-900/50 border border-zinc-800/80 border-t-2 border-t-violet-500/40 rounded-lg px-4 py-3">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-2">Value</p>
              <p className="text-xl font-semibold tabular-nums text-zinc-100">
                {totalValue > 0
                  ? "$" + totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })
                  : "—"}
              </p>
              {totalCashInvested > 0 && (
                <p className="text-[10px] text-zinc-500 mt-1 tabular-nums">
                  invested ${totalCashInvested.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </p>
              )}
            </div>

            <div className={`bg-zinc-900/50 border border-zinc-800/80 border-t-2 rounded-lg px-4 py-3 ${
              totalPnlDollar === null ? "border-t-zinc-600/40"
              : totalPnlDollar >= 0 ? "border-t-emerald-500/40"
              : "border-t-red-500/40"
            }`}>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-2">P&amp;L</p>
              <p className={`text-xl font-semibold tabular-nums ${
                totalPnlDollar === null ? "text-zinc-500"
                : totalPnlDollar >= 0 ? "text-emerald-400"
                : "text-red-400"
              }`}>
                {totalPnlDollar !== null ? fmtDelta(totalPnlDollar) : "—"}
              </p>
              {totalPnlPct !== null && (
                <p className={`text-[10px] mt-1 tabular-nums ${totalPnlPct >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {fmtPct(totalPnlPct)}
                </p>
              )}
            </div>

            <div className={`bg-zinc-900/50 border border-zinc-800/80 border-t-2 rounded-lg px-4 py-3 ${
              positions.length === 0 ? "border-t-zinc-600/40"
              : dayChangeDollar >= 0 ? "border-t-sky-500/40"
              : "border-t-orange-500/40"
            }`}>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-2">Day Delta</p>
              <p className={`text-xl font-semibold tabular-nums ${
                positions.length === 0 ? "text-zinc-500"
                : dayChangeDollar >= 0 ? "text-sky-400"
                : "text-orange-400"
              }`}>
                {positions.length > 0 ? fmtDelta(dayChangeDollar) : "—"}
              </p>
              {dayChangePct !== null && (
                <p className={`text-[10px] mt-1 tabular-nums ${
                  dayChangePct >= 0 ? "text-sky-400" : "text-orange-400"
                }`}>
                  {fmtPct(dayChangePct)}
                </p>
              )}
            </div>

            <div className={`bg-zinc-900/50 border border-zinc-800/80 border-t-2 rounded-lg px-4 py-3 ${
              alphaVsSpy === null ? "border-t-zinc-600/40"
              : alphaVsSpy >= 0 ? "border-t-emerald-500/40"
              : "border-t-red-500/40"
            }`}>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-2">Alpha vs SPY</p>
              <p className={`text-xl font-semibold tabular-nums ${
                alphaVsSpy === null ? "text-zinc-500"
                : alphaVsSpy >= 0 ? "text-emerald-400"
                : "text-red-400"
              }`}>
                {alphaVsSpy !== null ? fmtPct(alphaVsSpy) : "—"}
              </p>
              {spyReturn !== null && (
                <p className="text-[10px] text-zinc-500 mt-1 tabular-nums">SPY {fmtPct(spyReturn)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Options Signal + Watchlist Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          <Card className="bg-zinc-900/50 border-zinc-800/80">
            <CardHeader className="border-b border-zinc-800/60 pb-3">
              <CardTitle className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 uppercase">
                Options Signal
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-800/40 border border-zinc-700/40 rounded-lg p-3">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-2">Direction</p>
                  <p className={`text-2xl font-bold ${
                    optionsDirection === "CALL" ? "text-emerald-400"
                    : optionsDirection === "PUT" ? "text-red-400"
                    : "text-zinc-400"
                  }`}>{optionsDirection}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">{regimeLabel} regime</p>
                </div>
                <div className="bg-zinc-800/40 border border-zinc-700/40 rounded-lg p-3">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-2">VIX</p>
                  <p className={`text-2xl font-bold tabular-nums ${
                    vixValue === null ? "text-zinc-500"
                    : vixValue < 18 ? "text-emerald-400"
                    : vixValue < 25 ? "text-amber-400"
                    : "text-red-400"
                  }`}>{vixValue !== null ? vixValue.toFixed(2) : "—"}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">{vixLabel}</p>
                </div>
                <div className="bg-zinc-800/40 border border-zinc-700/40 rounded-lg p-3">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-2">Breadth</p>
                  <p className={`text-2xl font-bold tabular-nums ${
                    breadthPct >= 50 ? "text-emerald-400"
                    : breadthPct >= 35 ? "text-amber-400"
                    : "text-red-400"
                  }`}>{rankings.length > 0 ? `${breadthPct.toFixed(0)}%` : "—"}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">{breadthLabel}</p>
                </div>
                <div className="bg-zinc-800/40 border border-zinc-700/40 rounded-lg p-3">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-2">Edge Rating</p>
                  <p className={`text-2xl font-bold ${
                    edgeRating === "HIGH" ? "text-emerald-400"
                    : edgeRating === "MODERATE" ? "text-amber-400"
                    : "text-zinc-400"
                  }`}>{edgeRating}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">signal confidence</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800/80">
            <CardHeader className="border-b border-zinc-800/60 pb-3">
              <CardTitle className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 uppercase">
                Watchlist Highlights
                <span className="ml-2 text-zinc-500 font-normal normal-case tracking-normal">
                  top buy candidates
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {buySignals.length === 0 ? (
                <p className="text-zinc-500 text-xs py-4 text-center">No BUY candidates right now</p>
              ) : (
                <div className="space-y-2.5">
                  {buySignals.map((r) => {
                    const trendLower = r.trend.toLowerCase();
                    const trendCls = trendLower.includes("bull")
                      ? "bg-green-500/20 text-green-400 border-green-500/50"
                      : trendLower.includes("bear")
                        ? "bg-red-500/20 text-red-400 border-red-500/50"
                        : "bg-zinc-500/20 text-zinc-400 border-zinc-500/40";
                    const signalCls =
                      r.signal === "BUY_CANDIDATE"
                        ? "bg-green-500/20 text-green-400 border-green-500/50"
                        : r.signal === "WATCH"
                          ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
                          : "bg-zinc-500/20 text-zinc-400 border-zinc-500/40";
                    return (
                      <div
                        key={r.ticker}
                        className="bg-zinc-800/30 border border-zinc-800/60 rounded-lg px-3 py-2.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-zinc-100 w-14">{r.ticker}</span>
                            <span className={`${signalCls} border px-1.5 py-0.5 rounded text-[10px] font-medium`}>
                              {r.signal === "BUY_CANDIDATE" ? "BUY" : r.signal}
                            </span>
                            <span className={`${trendCls} border px-1.5 py-0.5 rounded text-[10px] font-medium`}>
                              {r.trend}
                            </span>
                          </div>
                          <p className="text-sm font-semibold tabular-nums text-zinc-100">
                            ${r.price.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-zinc-500 truncate max-w-36">{r.sector}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-zinc-400 tabular-nums">mom {r.momentum_score.toFixed(1)}</span>
                            <span className={`text-[10px] tabular-nums ${
                              r.return_30d >= 0 ? "text-emerald-400" : "text-red-400"
                            }`}>
                              {r.return_30d >= 0 ? "+" : ""}{r.return_30d.toFixed(1)}% 30d
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 4: Top 5 Momentum Leaders */}
        <Card className="bg-zinc-900/50 border-zinc-800/80">
          <CardHeader className="border-b border-zinc-800/60 pb-3">
            <CardTitle className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 uppercase">
              Top 5 Momentum Leaders
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800/60 hover:bg-transparent">
                  <TableHead className="text-[10px] tracking-widest text-zinc-400 uppercase pl-4 w-10">#</TableHead>
                  <TableHead className="text-[10px] tracking-widest text-zinc-400 uppercase">Ticker</TableHead>
                  <TableHead className="text-[10px] tracking-widest text-zinc-400 uppercase">Signal</TableHead>
                  <TableHead className="text-[10px] tracking-widests text-zinc-400 uppercase hidden sm:table-cell">Trend</TableHead>
                  <TableHead className="text-[10px] tracking-widest text-zinc-400 uppercase hidden md:table-cell">Sector</TableHead>
                  <TableHead className="text-[10px] tracking-widest text-zinc-400 uppercase text-right pr-4">Mom. Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topMomentum.length > 0 ? (
                  topMomentum.map((stock, i) => (
                    <TableRow key={stock.ticker} className="border-zinc-800/40 hover:bg-zinc-800/30">
                      <TableCell className="text-zinc-300 tabular-nums text-xs pl-4">{i + 1}</TableCell>
                      <TableCell className="font-semibold text-zinc-100 tracking-wide">{stock.ticker}</TableCell>
                      <TableCell><SignalBadge signal={stock.signal} /></TableCell>
                      <TableCell className="text-zinc-300 text-xs hidden sm:table-cell">{stock.trend}</TableCell>
                      <TableCell className="text-zinc-300 text-xs hidden md:table-cell">{stock.sector}</TableCell>
                      <TableCell className="text-right pr-4 tabular-nums font-semibold text-emerald-400">
                        {stock.momentum_score.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-zinc-400 py-10">
                      No rankings data available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Row 5: Top Sectors + Top Themes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-lg border border-zinc-800/80 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/60">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-zinc-400">
                Top Sectors
                <span className="ml-2 font-normal text-zinc-500 normal-case tracking-normal">avg momentum</span>
              </p>
            </div>
            {topSectors.length === 0 ? (
              <p className="px-4 py-6 text-xs text-zinc-500">No data</p>
            ) : (
              <div className="divide-y divide-zinc-800/40">
                {topSectors.map((s, i) => {
                  const barPct = topSectors[0].avg > 0 ? (s.avg / topSectors[0].avg) * 100 : 0;
                  return (
                    <div key={s.name} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/20">
                      <span className="text-[10px] text-zinc-500 w-4 tabular-nums shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-zinc-200 truncate">{s.name}</span>
                          <span className="text-xs tabular-nums text-emerald-400 ml-2 shrink-0">{s.avg.toFixed(2)}</span>
                        </div>
                        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-600/70 rounded-full" style={{ width: `${barPct}%` }} />
                        </div>
                      </div>
                      <span className="text-[10px] text-zinc-600 tabular-nums w-8 text-right shrink-0">{s.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-800/80 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/60">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-zinc-400">
                Top Themes
                <span className="ml-2 font-normal text-zinc-500 normal-case tracking-normal">avg momentum</span>
              </p>
            </div>
            {topThemes.length === 0 ? (
              <p className="px-4 py-6 text-xs text-zinc-500">No data</p>
            ) : (
              <div className="divide-y divide-zinc-800/40">
                {topThemes.map((t, i) => {
                  const barPct = topThemes[0].avg > 0 ? (t.avg / topThemes[0].avg) * 100 : 0;
                  return (
                    <div key={t.name} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/20">
                      <span className="text-[10px] text-zinc-500 w-4 tabular-nums shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-zinc-200 truncate">{t.name}</span>
                          <span className="text-xs tabular-nums text-violet-400 ml-2 shrink-0">{t.avg.toFixed(2)}</span>
                        </div>
                        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-600/70 rounded-full" style={{ width: `${barPct}%` }} />
                        </div>
                      </div>
                      <span className="text-[10px] text-zinc-600 tabular-nums w-8 text-right shrink-0">{t.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
