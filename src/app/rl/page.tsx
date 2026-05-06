export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import {
  getRlPaperState,
  getRlPaperCycles,
  getRlPaperTrades,
  getRlLiveSignals,
  getPortfolioPositions,
  getPrices,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EquityCurve } from "@/components/equity-curve";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt$(v: number) {
  return (
    "$" +
    v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

function fmtPct(v: number) {
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}

function SignalBadge({ signal }: { signal: string }) {
  const upper = signal.toUpperCase();
  const cls =
    upper === "BUY_CANDIDATE" || upper === "BUY"
      ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50"
      : upper === "WATCH"
        ? "bg-amber-400/25 text-amber-300 border-amber-500/50"
        : upper === "WAIT"
          ? "bg-sky-500/25 text-sky-300 border-sky-500/50"
          : upper === "AVOID" || upper === "SELL"
            ? "bg-red-500/25 text-red-300 border-red-500/50"
            : "bg-zinc-500/20 text-zinc-400 border-zinc-600/50";
  return (
    <Badge variant="outline" className={`${cls} text-[10px] font-medium whitespace-nowrap`}>
      {signal.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
    </Badge>
  );
}

function ActionBadge({ action }: { action: string }) {
  const isBuy = action.toUpperCase() === "BUY";
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-medium whitespace-nowrap ${
        isBuy
          ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50"
          : "bg-red-500/25 text-red-300 border-red-500/50"
      }`}
    >
      {action}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RlPage() {
  // Phase 1: fetch positions + cycles in parallel so we can derive rl_start_date
  // before fetching prices (prices must use the same start date as the RL agent).
  const [positionsResult, cyclesPhase1Result] = await Promise.allSettled([
    getPortfolioPositions(),
    getRlPaperCycles({ limit: 500 }),
  ]);

  const positions = positionsResult.status === "fulfilled" ? positionsResult.value.items : [];
  const totalCashInvested =
    positionsResult.status === "fulfilled"
      ? (positionsResult.value.total_cash_invested ?? 0)
      : 0;

  const cyclesPhase1 =
    cyclesPhase1Result.status === "fulfilled"
      ? [...cyclesPhase1Result.value.items].sort((a, b) => a.ts.localeCompare(b.ts))
      : [];

  // RL start date = timestamp of the very first cycle (YYYY-MM-DD)
  const rlStartDate = cyclesPhase1.length > 0 ? cyclesPhase1[0].ts.slice(0, 10) : null;

  // Phase 2: everything else in parallel, prices anchored to rl_start_date
  const [stateResult, tradesResult, signalsResult, pricesResult] =
    await Promise.allSettled([
      getRlPaperState(),
      getRlPaperTrades({ limit: 50 }),
      getRlLiveSignals({ limit: 20 }),
      positions.length > 0 && rlStartDate !== null
        ? getPrices({
            tickers: positions.map((p) => p.ticker).join(","),
            since_date: rlStartDate,
          })
        : Promise.resolve({ items: [], count: 0 }),
    ]);

  const state = stateResult.status === "fulfilled" ? stateResult.value : null;
  // cyclesPhase1 is already sorted ascending — reuse it
  const cycles = cyclesPhase1;
  const trades =
    tradesResult.status === "fulfilled"
      ? [...tradesResult.value.items].sort((a, b) => b.ts.localeCompare(a.ts))
      : [];
  const signals =
    signalsResult.status === "fulfilled"
      ? [...signalsResult.value.items].sort((a, b) => b.score - a.score)
      : [];
  const allPrices = pricesResult.status === "fulfilled" ? pricesResult.value.items : [];

  // -------------------------------------------------------------------------
  // Human portfolio return (anchored to rl_start_date for a fair comparison)
  // -------------------------------------------------------------------------

  // Build per-ticker price history sorted ascending
  const priceHistMap: Record<string, { date: string; price: number }[]> = {};
  for (const p of allPrices) {
    if (!priceHistMap[p.ticker]) priceHistMap[p.ticker] = [];
    priceHistMap[p.ticker].push({ date: p.date.slice(0, 10), price: p.price });
  }
  for (const hist of Object.values(priceHistMap)) {
    hist.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Weighted return: sum(invested_usd * ret_i) / sum(invested_usd)
  // For each position: start price = first price on/after rl_start_date, end = latest
  let weightedReturnNumer = 0;
  let weightedReturnDenom = 0;
  let humanCurrentValue = 0;

  for (const pos of positions) {
    const hist = priceHistMap[pos.ticker] ?? [];
    const startEntry = rlStartDate
      ? hist.find((p) => p.date >= rlStartDate)
      : hist[0] ?? null;
    const endEntry = hist.length > 0 ? hist[hist.length - 1] : null;

    if (startEntry && endEntry) {
      const ret = (endEntry.price - startEntry.price) / startEntry.price;
      weightedReturnNumer += ret * pos.invested_usd;
      weightedReturnDenom += pos.invested_usd;
    }

    // Also accumulate current market value for lifetime return
    if (endEntry) {
      const shares = pos.entry_price > 0 ? pos.invested_usd / pos.entry_price : 0;
      humanCurrentValue += shares * endEntry.price;
    }
  }

  // Primary: weighted return since rl_start_date (apples-to-apples with RL)
  const humanPositionReturn =
    weightedReturnDenom > 0 ? (weightedReturnNumer / weightedReturnDenom) * 100 : null;

  // Secondary: lifetime return vs total cash ever invested
  const humanLifetimeReturn =
    totalCashInvested > 0 && humanCurrentValue > 0
      ? ((humanCurrentValue - totalCashInvested) / totalCashInvested) * 100
      : null;

  // -------------------------------------------------------------------------
  // Derived stats
  // -------------------------------------------------------------------------

  const botRunning = state !== null;
  // Current equity: last cycle's equity_usd (most recent snapshot)
  const lastCycle = cycles.length > 0 ? cycles[cycles.length - 1] : null;
  const equity = lastCycle?.equity_usd ?? state?.starting_capital_usd ?? 0;
  const cash = state?.cash_usd ?? 0;
  const openPositions = state ? Object.keys(state.positions ?? {}) : [];
  const positionCount = openPositions.length;

  // RL return: use last cycle's total_return_pct (cumulative from start, as %)
  const rlReturn = lastCycle != null ? lastCycle.total_return_pct * 100 : null;

  // Win rate from state (closed trades)
  const winRate =
    state && state.trades_count > 0
      ? (state.wins_count / state.trades_count) * 100
      : null;
  const winCycles = state?.wins_count ?? 0;
  const tradesCount = state?.trades_count ?? 0;

  const dataDate = signals[0]?.date?.slice(0, 10) ?? lastCycle?.ts?.slice(0, 10) ?? null;

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
      {/* Header */}
      <header className="border-b border-zinc-800/80 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`w-2 h-2 rounded-full ${
              botRunning ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
            }`}
          />
          <h1 className="text-sm font-semibold tracking-[0.15em] text-zinc-200 uppercase">
            Stock Tracker
            <span className="ml-2 text-zinc-400 font-normal tracking-normal normal-case">
              // RL vs Human
            </span>
          </h1>
          {!botRunning && (
            <span className="text-[10px] text-red-400 border border-red-400/40 rounded px-1.5 py-0.5">
              Bot offline
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs text-zinc-400 tabular-nums">{timestamp}</span>
          {dataDate && <span className="text-zinc-500 text-xs">Data as of {dataDate}</span>}
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* RL Agent Status cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-zinc-900/50 border-zinc-800/80 border-t-2 border-t-violet-500/40">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">
                RL Equity
              </p>
              <p className="text-2xl font-semibold tabular-nums text-zinc-100">
                {botRunning ? fmt$(equity) : "—"}
              </p>
              <p className="text-[10px] text-zinc-400 mt-2">
                Cash {botRunning ? fmt$(cash) : "—"}
              </p>
            </CardContent>
          </Card>

          <Card
            className={`bg-zinc-900/50 border-zinc-800/80 border-t-2 ${
              rlReturn !== null && rlReturn >= 0
                ? "border-t-emerald-500/40"
                : "border-t-red-500/40"
            }`}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">
                RL Return
              </p>
              <p
                className={`text-2xl font-semibold tabular-nums ${
                  rlReturn === null
                    ? "text-zinc-500"
                    : rlReturn >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                }`}
              >
                {rlReturn !== null ? fmtPct(rlReturn) : "—"}
              </p>
              <p className="text-[10px] text-zinc-400 mt-2">
                since cycle 1 ({cycles.length} cycles)
              </p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800/80 border-t-2 border-t-sky-500/40">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">
                Win Rate
              </p>
              <p className="text-2xl font-semibold tabular-nums text-sky-400">
                {winRate !== null ? winRate.toFixed(1) + "%" : "—"}
              </p>
              <p className="text-[10px] text-zinc-400 mt-2">
                {tradesCount > 0 ? `${winCycles} / ${tradesCount} trades` : "—"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800/80 border-t-2 border-t-amber-500/40">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">
                Open Positions
              </p>
              <p className="text-2xl font-semibold tabular-nums text-amber-400">
                {botRunning ? positionCount : "—"}
              </p>
              <p className="text-[10px] text-zinc-400 mt-2 truncate">
                {openPositions.slice(0, 4).join(", ") || "none"}
                {openPositions.length > 4 ? ` +${openPositions.length - 4}` : ""}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Performance Comparison */}
        <div className="rounded-lg border border-zinc-800/80 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/80">
            <p className="text-[10px] uppercase tracking-widest text-zinc-400">
              Performance Comparison
            </p>
          </div>
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-zinc-800/60">
                <th className="text-left text-[10px] uppercase tracking-widest text-zinc-500 px-4 py-2">
                  Strategy
                </th>
                <th className="text-right text-[10px] uppercase tracking-widest text-zinc-500 px-4 py-2">
                  Return
                </th>
                <th className="text-right text-[10px] uppercase tracking-widest text-zinc-500 px-4 py-2 hidden sm:table-cell">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800/40 hover:bg-zinc-800/20">
                <td className="px-4 py-3 text-zinc-100 font-semibold">RL Agent</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {rlReturn !== null ? (
                    <span className={rlReturn >= 0 ? "text-emerald-300" : "text-red-300"}>
                      {fmtPct(rlReturn)}
                    </span>
                  ) : (
                    <span className="text-zinc-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-zinc-400 text-xs hidden sm:table-cell">
                  Paper trading
                </td>
              </tr>
              <tr className="border-b border-zinc-800/40 hover:bg-zinc-800/20">
                <td className="px-4 py-3 text-zinc-100 font-semibold">Human (Portfolio)</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {humanPositionReturn !== null ? (
                    <span className={humanPositionReturn >= 0 ? "text-emerald-300" : "text-red-300"}>
                      {fmtPct(humanPositionReturn)}
                    </span>
                  ) : (
                    <span className="text-zinc-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-zinc-400 text-xs hidden sm:table-cell">
                  {rlStartDate
                    ? `since ${rlStartDate}${humanLifetimeReturn !== null ? ` · lifetime ${fmtPct(humanLifetimeReturn)}` : ""}`
                    : humanLifetimeReturn !== null
                      ? `lifetime ${fmtPct(humanLifetimeReturn)}`
                      : "open positions"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Equity Curve */}
        {cycles.length >= 2 && (
          <div className="rounded-lg border border-zinc-800/80 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/80">
              <p className="text-[10px] uppercase tracking-widest text-zinc-400">
                RL Equity Curve
              </p>
            </div>
            <div className="px-4 py-4">
              <EquityCurve
                data={cycles.map((c) => ({ date: c.ts.slice(0, 10), equity: c.equity_usd }))}
                referenceValue={state?.starting_capital_usd ?? 100000}
              />
            </div>
          </div>
        )}

        {/* Recent Trades + Live Signals side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Trades */}
          <div className="rounded-lg border border-zinc-800/80 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/80">
              <p className="text-[10px] uppercase tracking-widest text-zinc-400">Recent Trades</p>
            </div>
            {trades.length === 0 ? (
              <p className="px-4 py-6 text-zinc-500 text-xs">No trades recorded.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800/80 hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase tracking-widest text-zinc-500">
                      Date
                    </TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest text-zinc-500">
                      Ticker
                    </TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest text-zinc-500">
                      Action
                    </TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest text-zinc-500 text-right">
                      Qty
                    </TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest text-zinc-500 text-right">
                      Price
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.slice(0, 15).map((t, i) => (
                    <TableRow
                      key={i}
                      className="border-zinc-800/60 hover:bg-zinc-800/30"
                    >
                      <TableCell className="text-xs text-zinc-400 py-2.5 tabular-nums">
                        {t.ts.slice(0, 10)}
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-zinc-100 py-2.5">
                        {t.ticker}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <ActionBadge action={t.event} />
                      </TableCell>
                      <TableCell className="text-sm text-zinc-300 text-right tabular-nums py-2.5">
                        {t.shares.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-sm text-zinc-300 text-right tabular-nums py-2.5">
                        {fmt$(t.price)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Live Signals */}
          <div className="rounded-lg border border-zinc-800/80 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/80">
              <p className="text-[10px] uppercase tracking-widest text-zinc-400">
                RL Live Signals
              </p>
            </div>
            {signals.length === 0 ? (
              <p className="px-4 py-6 text-zinc-500 text-xs">No live signals available.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800/80 hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase tracking-widest text-zinc-500">
                      Ticker
                    </TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest text-zinc-500">
                      Signal
                    </TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest text-zinc-500 text-right">
                      Score
                    </TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest text-zinc-500 text-right hidden sm:table-cell">
                      Date
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signals.map((s, i) => {
                    const pct = Math.min(100, Math.max(0, s.score * 100));
                    const barColor =
                      pct >= 70
                        ? "bg-emerald-500"
                        : pct >= 40
                          ? "bg-amber-500"
                          : "bg-red-500";
                    const textColor =
                      pct >= 70
                        ? "text-emerald-300"
                        : pct >= 40
                          ? "text-amber-300"
                          : "text-red-300";
                    return (
                      <TableRow
                        key={i}
                        className="border-zinc-800/60 hover:bg-zinc-800/30"
                      >
                        <TableCell className="text-sm font-semibold text-zinc-100 py-2.5">
                          {s.ticker}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <SignalBadge signal={s.signal} />
                        </TableCell>
                        <TableCell className="text-right py-2.5">
                          <div className="flex items-center justify-end gap-2 min-w-20">
                            <div className="flex-1 h-1.5 rounded-full bg-zinc-800">
                              <div
                                className={`h-1.5 rounded-full ${barColor}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-xs tabular-nums ${textColor} w-8 text-right`}>
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-zinc-400 text-right tabular-nums py-2.5 hidden sm:table-cell">
                          {String(s.date).slice(0, 10)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {/* Last updated */}
        {lastCycle && (
          <p className="text-[10px] text-zinc-600 tabular-nums">
            Last cycle snapshot: {lastCycle.ts.slice(0, 19).replace("T", " ")} UTC
          </p>
        )}
      </div>
    </main>
  );
}
