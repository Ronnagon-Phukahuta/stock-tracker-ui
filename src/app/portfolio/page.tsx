export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { getPrices, getMomentum, getLatestStockRankings, getPortfolioPositions } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { PortfolioTable, PortfolioRow } from "@/components/portfolio-table";
import { PortfolioEditor } from "@/components/portfolio-editor";
import { CashInvestedEditor } from "@/components/portfolio-cash-editor";

const PORTFOLIO_START_DATE = "2024-07-25";
const BENCHMARKS = ["SPY", "QQQ", "SMH"] as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PortfolioPage() {
  const today = new Date().toISOString().slice(0, 10);

  // Phase 1: fetch positions so we know the earliest entry date for SPY
  const positionsResult = await getPortfolioPositions().catch(() => null);
  const positions = positionsResult?.items ?? [];
  const totalCashInvested = positionsResult?.total_cash_invested ?? 0;

  const earliestDate =
    positions.length > 0
      ? [...positions.map((p) => p.entry_date)].filter(Boolean).sort()[0]
      : today;

  const [pricesResult, momentumResult, rankingsResult] =
    await Promise.allSettled([
      getPrices({
        tickers: [...positions.map((p) => p.ticker), ...BENCHMARKS].join(","),
        since_date: PORTFOLIO_START_DATE,
      }),
      getMomentum({ limit: 5000 }),
      getLatestStockRankings({ limit: 1000 }),
    ]);

  const allPrices   = pricesResult.status   === "fulfilled" ? pricesResult.value.items   : [];
  const allMomentum = momentumResult.status === "fulfilled" ? momentumResult.value.items : [];
  const rankings    = rankingsResult.status  === "fulfilled" ? rankingsResult.value.items : [];

  // -------------------------------------------------------------------------
  // Build lookup maps
  // -------------------------------------------------------------------------

  // Latest price + previous-day price per ticker
  type PriceEntry = { close: number; prevClose: number | null };
  const priceMap: Record<string, PriceEntry> = {};
  for (const pos of positions) {
    const hist = allPrices
      .filter((p) => p.ticker === pos.ticker)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (hist.length >= 2) {
      priceMap[pos.ticker] = {
        close: hist[hist.length - 1].price,
        prevClose: hist[hist.length - 2].price,
      };
    } else if (hist.length === 1) {
      priceMap[pos.ticker] = { close: hist[0].price, prevClose: null };
    }
  }

  // Latest momentum score per ticker
  const momentumMap: Record<string, number> = {};
  for (const pos of positions) {
    const hist = allMomentum
      .filter((m) => m.ticker === pos.ticker)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (hist.length > 0) {
      momentumMap[pos.ticker] = hist[hist.length - 1].momentum_score;
    }
  }

  // Rankings signal per ticker
  const signalMap: Record<string, string> = {};
  for (const item of rankings) {
    signalMap[item.ticker] = item.signal;
  }

  // -------------------------------------------------------------------------
  // Build position rows
  // -------------------------------------------------------------------------

  const rows: PortfolioRow[] = positions.map((pos) => {
    const shares      = pos.entry_price > 0 ? pos.invested_usd / pos.entry_price : 0;
    const pd          = priceMap[pos.ticker];
    const currentPrice = pd?.close ?? null;
    const prevPrice    = pd?.prevClose ?? null;
    const investedUsd  = pos.invested_usd;
    const marketValue  = currentPrice !== null ? shares * currentPrice : null;
    const pnlDollar    = marketValue  !== null ? marketValue - investedUsd : null;
    const pnlPct       = pnlDollar    !== null && investedUsd > 0
      ? (pnlDollar / investedUsd) * 100
      : null;
    const change1d =
      currentPrice !== null && prevPrice !== null
        ? ((currentPrice - prevPrice) / prevPrice) * 100
        : null;

    return {
      ticker:        pos.ticker,
      shares,
      entryPrice:    pos.entry_price,
      currentPrice,
      marketValue,
      costBasis:     investedUsd,
      pnlDollar,
      pnlPct,
      change1d,
      signal:        signalMap[pos.ticker] ?? "—",
      momentumScore: momentumMap[pos.ticker] ?? null,
    };
  });

  // -------------------------------------------------------------------------
  // Portfolio summary stats
  // -------------------------------------------------------------------------

  const totalValue    = rows.reduce((s, r) => s + (r.marketValue ?? 0), 0);
  const totalCost     = rows.reduce((s, r) => s + r.costBasis, 0);
  const totalPnlDollar = totalValue - totalCost;
  const totalPnlPct   = totalCost > 0 ? (totalPnlDollar / totalCost) * 100 : 0;

  // Weighted day change ($ terms)
  const dayChangeDollar = rows.reduce((s, r) => {
    if (r.change1d !== null && r.marketValue !== null) {
      return s + (r.marketValue * r.change1d) / 100;
    }
    return s;
  }, 0);

  const dayChangePct =
    totalValue - dayChangeDollar !== 0
      ? (dayChangeDollar / (totalValue - dayChangeDollar)) * 100
      : null;

  // -------------------------------------------------------------------------
  // SPY benchmark comparison (SPY is in the prices universe)
  // -------------------------------------------------------------------------

  // API may return dates as "2024-07-25T00:00:00" — normalise to "YYYY-MM-DD"
  const toDateStr = (d: string) => d.slice(0, 10);

  // -------------------------------------------------------------------------
  // Benchmark comparison (since PORTFOLIO_START_DATE)
  // -------------------------------------------------------------------------

  const benchmarkReturns: Record<string, number | null> = {};
  for (const sym of BENCHMARKS) {
    const hist = allPrices
      .filter((p) => p.ticker === sym)
      .sort((a, b) => toDateStr(a.date).localeCompare(toDateStr(b.date)));
    const start = hist.find((p) => toDateStr(p.date) >= PORTFOLIO_START_DATE) ?? hist[0] ?? null;
    const latest = hist.length > 0 ? hist[hist.length - 1] : null;
    benchmarkReturns[sym] =
      start && latest && toDateStr(start.date) !== toDateStr(latest.date)
        ? ((latest.price - start.price) / start.price) * 100
        : null;
  }

  // Lifetime portfolio return (total_cash_invested as cost basis)
  const lifetimeReturn =
    totalCashInvested > 0
      ? ((totalValue - totalCashInvested) / totalCashInvested) * 100
      : null;
  const lifetimePnl = totalValue - totalCashInvested;

  // Alpha vs SPY using the same PORTFOLIO_START_DATE anchor as the benchmark table
  const spyBenchmarkReturn = benchmarkReturns["SPY"] ?? null;
  const headerAlpha =
    lifetimeReturn !== null && spyBenchmarkReturn !== null
      ? lifetimeReturn - spyBenchmarkReturn
      : null;

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function fmtUsd(v: number) {
    return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const dataDate = rankings[0]?.date?.slice(0, 10) ?? null;

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
      {/* Page header */}
      <header className="border-b border-zinc-800/80 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <h1 className="text-sm font-semibold tracking-[0.15em] text-zinc-200 uppercase">
            Stock Tracker
            <span className="ml-2 text-zinc-400 font-normal tracking-normal normal-case">
              // Portfolio
            </span>
          </h1>
          <span className="text-[10px] text-zinc-400 tabular-nums">
            {positions.length} positions
          </span>
        </div>
        <div className="flex items-center gap-3">
          <PortfolioEditor positions={positions} />
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-xs text-zinc-400 tabular-nums">{timestamp}</span>
            {dataDate && <span className="text-zinc-500 text-xs">Data as of {dataDate}</span>}
          </div>
        </div>
      </header>

      <div className="p-6 space-y-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Portfolio Value */}
          <Card className="bg-zinc-900/50 border-zinc-800/80 border-t-2 border-t-violet-500/40">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">
                Portfolio Value
              </p>
              <p className="text-2xl font-semibold tabular-nums text-zinc-100">
                {fmtUsd(totalValue)}
              </p>
              <p className="text-[10px] text-zinc-400 mt-2">
                Cost basis {fmtUsd(totalCost)}
              </p>
            </CardContent>
          </Card>

          {/* Total P&L */}
          <Card
            className={`bg-zinc-900/50 border-zinc-800/80 border-t-2 ${
              totalPnlDollar >= 0 ? "border-t-emerald-500/40" : "border-t-red-500/40"
            }`}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">
                Total P&amp;L
              </p>
              <p
                className={`text-2xl font-semibold tabular-nums ${
                  totalPnlDollar >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {totalPnlDollar >= 0 ? "+" : "-"}
                {fmtUsd(Math.abs(totalPnlDollar))}
              </p>
              <p
                className={`text-[10px] mt-2 ${
                  totalPnlPct >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {totalPnlPct >= 0 ? "+" : ""}
                {totalPnlPct.toFixed(2)}%
              </p>
            </CardContent>
          </Card>

          {/* Day Change */}
          <Card
            className={`bg-zinc-900/50 border-zinc-800/80 border-t-2 ${
              dayChangeDollar >= 0 ? "border-t-sky-500/40" : "border-t-red-500/40"
            }`}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">
                Day Change
              </p>
              <p
                className={`text-2xl font-semibold tabular-nums ${
                  dayChangeDollar >= 0 ? "text-sky-400" : "text-red-400"
                }`}
              >
                {dayChangeDollar >= 0 ? "+" : "-"}
                {fmtUsd(Math.abs(dayChangeDollar))}
              </p>
              <p
                className={`text-[10px] mt-2 ${
                  dayChangeDollar >= 0 ? "text-sky-400" : "text-red-400"
                }`}
              >
                {dayChangePct !== null
                  ? `${dayChangePct >= 0 ? "+" : ""}${dayChangePct.toFixed(2)}%`
                  : "—"}
              </p>
            </CardContent>
          </Card>

          {/* vs SPY */}
          <Card className="bg-zinc-900/50 border-zinc-800/80 border-t-2 border-t-amber-500/40">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">
                Alpha vs SPY
              </p>
              {headerAlpha !== null ? (
                <>
                  <p
                    className={`text-2xl font-semibold tabular-nums ${
                      headerAlpha >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {headerAlpha >= 0 ? "+" : ""}
                    {headerAlpha.toFixed(2)}%
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-2">
                    Port {lifetimeReturn! >= 0 ? "+" : ""}
                    {lifetimeReturn!.toFixed(2)}% / SPY{" "}
                    {spyBenchmarkReturn! >= 0 ? "+" : ""}
                    {spyBenchmarkReturn!.toFixed(2)}%
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-semibold tabular-nums text-zinc-500">—</p>
                  <p className="text-[10px] text-zinc-400 mt-2">since {PORTFOLIO_START_DATE}</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Positions Table */}
        <PortfolioTable rows={rows} />

        {/* Lifetime Performance */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <p className="text-[10px] uppercase tracking-widest text-zinc-400">Lifetime Performance</p>
            <span className="text-[10px] text-zinc-600">since {PORTFOLIO_START_DATE}</span>
          </div>

          {/* Lifetime metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Cash Invested */}
            <Card className="bg-zinc-900/50 border-zinc-800/80 border-t-2 border-t-violet-500/40">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">Total Cash Invested</p>
                <CashInvestedEditor positions={positions} initialValue={totalCashInvested} />
              </CardContent>
            </Card>

            {/* Current Portfolio Value */}
            <Card className="bg-zinc-900/50 border-zinc-800/80 border-t-2 border-t-zinc-600/40">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">Portfolio Value</p>
                <p className="text-2xl font-semibold tabular-nums text-zinc-100">{fmtUsd(totalValue)}</p>
                <p className="text-[10px] text-zinc-400 mt-2">mark-to-market</p>
              </CardContent>
            </Card>

            {/* Overall P&L */}
            <Card
              className={`bg-zinc-900/50 border-zinc-800/80 border-t-2 ${
                lifetimePnl >= 0 ? "border-t-emerald-500/40" : "border-t-red-500/40"
              }`}
            >
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">Overall Profit</p>
                <p className={`text-2xl font-semibold tabular-nums ${
                  lifetimePnl >= 0 ? "text-emerald-400" : "text-red-400"
                }`}>
                  {lifetimePnl >= 0 ? "+" : "-"}{fmtUsd(Math.abs(lifetimePnl))}
                </p>
                {lifetimeReturn !== null && (
                  <p className={`text-[10px] mt-2 ${
                    lifetimeReturn >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {lifetimeReturn >= 0 ? "+" : ""}{lifetimeReturn.toFixed(2)}%
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Benchmark comparison table */}
          <div className="rounded-lg border border-zinc-800/80 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/80">
              <p className="text-[10px] uppercase tracking-widest text-zinc-400">Benchmark Comparison</p>
            </div>
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-zinc-800/60">
                  <th className="text-left text-[10px] uppercase tracking-widest text-zinc-500 px-4 py-2">Benchmark</th>
                  <th className="text-right text-[10px] uppercase tracking-widest text-zinc-500 px-4 py-2">Return</th>
                  <th className="text-right text-[10px] uppercase tracking-widest text-zinc-500 px-4 py-2">Your Return</th>
                  <th className="text-right text-[10px] uppercase tracking-widest text-zinc-500 px-4 py-2">Alpha</th>
                </tr>
              </thead>
              <tbody>
                {BENCHMARKS.map((sym) => {
                  const bmRet = benchmarkReturns[sym];
                  const a = lifetimeReturn !== null && bmRet !== null ? lifetimeReturn - bmRet : null;
                  return (
                    <tr key={sym} className="border-b border-zinc-800/40 hover:bg-zinc-800/20">
                      <td className="px-4 py-3 text-zinc-100 font-semibold">{sym}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {bmRet !== null ? (
                          <span className={bmRet >= 0 ? "text-emerald-300" : "text-red-300"}>
                            {bmRet >= 0 ? "+" : ""}{bmRet.toFixed(2)}%
                          </span>
                        ) : <span className="text-zinc-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {lifetimeReturn !== null ? (
                          <span className={lifetimeReturn >= 0 ? "text-emerald-300" : "text-red-300"}>
                            {lifetimeReturn >= 0 ? "+" : ""}{lifetimeReturn.toFixed(2)}%
                          </span>
                        ) : <span className="text-zinc-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {a !== null ? (
                          <span className={a >= 0 ? "text-emerald-300 font-semibold" : "text-red-300 font-semibold"}>
                            {a >= 0 ? "+" : ""}{a.toFixed(2)}%
                          </span>
                        ) : <span className="text-zinc-500">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
