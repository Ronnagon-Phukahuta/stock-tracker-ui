export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import {
  getPortfolioPositions,
  getNextSatellite,
  getThemeEdges,
  getTopTickersByTheme,
  getPrices,
  getMomentum,
  type PortfolioPosition,
  type RotationCandidate,
  type ThemeEdge,
  type TopTickerByTheme,
} from "@/lib/api";
import { RotationDashboard, type PortfolioRow } from "./RotationDashboard";

const CORE_TICKERS = new Set(["AVGO", "PWR"]);

export default async function RotationPage() {
  const positionsResult = await getPortfolioPositions().catch(() => null);
  const positions: PortfolioPosition[] = positionsResult?.items ?? [];

  const satellites = positions.filter((p) => !CORE_TICKERS.has(p.ticker));

  const allTickers = positions.map((p) => p.ticker).join(",");

  const [candidateResults, themeEdgesResult, topTickersResult, pricesResult, momentumResult] =
    await Promise.all([
      Promise.allSettled(
        satellites.map((p) => getNextSatellite({ from_ticker: p.ticker, top_n: 5, universe: "ai_infra" })),
      ),
      getThemeEdges({ universe: "ai_infra" }).catch(() => null),
      getTopTickersByTheme({ universe: "ai_infra", top_n: 50 }).catch(() => null),
      getPrices({ tickers: allTickers, since_date: "2024-07-25" }).catch(() => null),
      getMomentum({ limit: 5000 }).catch(() => null),
    ]);

  const candidatesMap: Record<string, RotationCandidate[]> = {};
  for (let i = 0; i < satellites.length; i++) {
    const result = candidateResults[i];
    candidatesMap[satellites[i].ticker] =
      result.status === "fulfilled" ? result.value.items : [];
  }

  const themeEdges: ThemeEdge[] = themeEdgesResult?.items ?? [];
  const topTickersByTheme: TopTickerByTheme[] = topTickersResult?.items ?? [];

  const allPrices = pricesResult?.items ?? [];
  const allMomentum = momentumResult?.items ?? [];

  // Build latest close price per ticker
  const priceMap: Record<string, number> = {};
  for (const pos of positions) {
    const hist = allPrices
      .filter((p) => p.ticker === pos.ticker)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (hist.length > 0) priceMap[pos.ticker] = hist[hist.length - 1].price;
  }

  // Build latest momentum score per ticker
  const momentumMap: Record<string, number> = {};
  for (const pos of positions) {
    const hist = allMomentum
      .filter((m) => m.ticker === pos.ticker)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (hist.length > 0) momentumMap[pos.ticker] = hist[hist.length - 1].momentum_score;
  }

  // Compute P&L rows
  const portfolioRows: PortfolioRow[] = positions.map((pos) => {
    const shares = pos.entry_price > 0 ? pos.invested_usd / pos.entry_price : 0;
    const currentPrice = priceMap[pos.ticker] ?? null;
    const marketValue = currentPrice !== null ? shares * currentPrice : null;
    const pnlDollar = marketValue !== null ? marketValue - pos.invested_usd : null;
    const pnlPct =
      pnlDollar !== null && pos.invested_usd > 0
        ? (pnlDollar / pos.invested_usd) * 100
        : null;
    return {
      ticker: pos.ticker,
      shares,
      entry_price: pos.entry_price,
      invested_usd: pos.invested_usd,
      current_price: currentPrice,
      market_value: marketValue,
      pnl_dollar: pnlDollar,
      pnl_pct: pnlPct,
      momentum_score: momentumMap[pos.ticker] ?? null,
      label: pos.label,
    };
  });

  // Derive latest data date from prices
  const latestDate =
    allPrices.length > 0
      ? allPrices.reduce((max, p) => (p.date > max ? p.date : max), allPrices[0].date)
      : null;

  const timestamp = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold font-mono text-zinc-100">
            Rotation Dashboard
          </h1>
          {latestDate && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {(() => {
                const [year, month, day] = latestDate.slice(0, 10).split("-").map(Number);
                const d = new Date(year, month - 1, day);
                return `Last updated: ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
              })()}
            </p>
          )}
        </div>
        <span className="text-xs text-zinc-400 tabular-nums shrink-0">{timestamp}</span>
      </div>
      <RotationDashboard
        positions={positions}
        candidatesMap={candidatesMap}
        themeEdges={themeEdges}
        topTickersByTheme={topTickersByTheme}
        portfolioRows={portfolioRows}
      />
    </main>
  );
}

