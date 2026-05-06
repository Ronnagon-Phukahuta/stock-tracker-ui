export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { getLatestWatchlist, getLatestStockRankings, StockRanking } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WatchlistTable, RsTrendBadge } from "@/components/watchlist-table";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function WatchlistPage() {
  const [rankingsResult, watchlistResult] = await Promise.allSettled([
    getLatestStockRankings({ limit: 5000 }),
    getLatestWatchlist({ limit: 1000 }),
  ]);

  const rankings = rankingsResult.status === "fulfilled" ? rankingsResult.value.items : [];
  const items = watchlistResult.status === "fulfilled" ? watchlistResult.value.items : [];

  const companyNames: Record<string, string> = {};
  for (const r of rankings) {
    if (r.company_name) companyNames[r.ticker] = r.company_name;
  }

  const buyCandidates: StockRanking[] = rankings
    .filter((r) => r.signal === "BUY_CANDIDATE")
    .sort((a, b) => a.rank_momentum - b.rank_momentum);

  const buyCount = buyCandidates.length;
  const watchCount = items.filter((w) => w.watchlist_signal.toUpperCase() === "WATCH").length;
  const total = items.length;

  const topBuys = buyCandidates.slice(0, 4);

  const sortedItems = [...items].sort((a, b) => a.relative_strength_rank - b.relative_strength_rank);

  const dataDate = rankings[0]?.date?.slice(0, 10) ?? null;

  const timestamp = new Date().toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <header className="border-b border-zinc-800/80 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h1 className="text-sm font-semibold tracking-[0.15em] text-zinc-200 uppercase">
            Stock Tracker
            <span className="ml-2 text-zinc-400 font-normal tracking-normal normal-case">
              // Watchlist
            </span>
          </h1>
          {total > 0 && (
            <span className="text-[10px] text-zinc-400 tabular-nums">
              {total.toLocaleString()} tracked
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs text-zinc-400 tabular-nums">{timestamp}</span>
          {dataDate && <span className="text-zinc-500 text-xs">Data as of {dataDate}</span>}
        </div>
      </header>

      <div className="p-6 space-y-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-zinc-900/50 border-zinc-800/80 border-t-2 border-t-emerald-500/40">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">Buy Candidates</p>
              <p className="text-3xl font-semibold tabular-nums text-emerald-400">{buyCount.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-400 mt-2">
                {total > 0 ? ((buyCount / total) * 100).toFixed(1) : "0.0"}% of watchlist
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800/80 border-t-2 border-t-amber-500/40">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">Watch</p>
              <p className="text-3xl font-semibold tabular-nums text-amber-400">{watchCount.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-400 mt-2">
                {total > 0 ? ((watchCount / total) * 100).toFixed(1) : "0.0"}% of watchlist
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800/80 border-t-2 border-t-zinc-500/40">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">Total Tracked</p>
              <p className="text-3xl font-semibold tabular-nums text-zinc-200">{total.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Top BUY Candidates */}
        {topBuys.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 uppercase mb-3">
              Top Buy Candidates
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {topBuys.map((item) => (
                <Card
                  key={item.ticker}
                  className="bg-zinc-900 border-zinc-800 border-l-2 border-l-green-500 hover:bg-zinc-800/80 transition-colors"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold tracking-wide text-zinc-100">{item.ticker}</span>
                      <Badge variant="outline" className="bg-emerald-500/25 text-emerald-300 border-emerald-500/50 text-[10px] font-medium">
                        Buy Candidate
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-0.5">Price</p>
                        <p className="text-lg font-semibold tabular-nums text-zinc-100">${item.price.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-0.5">Mom. Rank</p>
                        <p className="text-lg font-semibold tabular-nums text-zinc-100">#{item.rank_momentum}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-0.5">30d Return</p>
                        <p className={`text-sm tabular-nums font-semibold ${item.return_30d >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                          {item.return_30d >= 0 ? "+" : ""}{(item.return_30d * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-0.5">Trend</p>
                        <RsTrendBadge trend={item.trend} />
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-300 truncate">{item.sector}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Full Watchlist Table */}
        <Card className="bg-zinc-900/50 border-zinc-800/80">
          <CardHeader className="border-b border-zinc-800/60 pb-3">
            <CardTitle className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 uppercase">
              Full Watchlist
              {total > 0 && (
                <span className="ml-2 text-zinc-400 font-normal normal-case tracking-normal">
                  {total.toLocaleString()} tickers
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {sortedItems.length > 0 ? (
              <WatchlistTable items={sortedItems} companyNames={companyNames} />
            ) : (
              <p className="text-zinc-400 text-sm py-8 text-center">No watchlist data</p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}