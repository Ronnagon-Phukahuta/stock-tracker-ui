export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { getStockSnapshot } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SnapshotTable } from "@/components/snapshot-table";

export default async function SnapshotPage() {
  const snapshotResult = await getStockSnapshot({ limit: 5000 }).catch(() => null);
  const snapshots = snapshotResult?.items ?? [];

  const rows = snapshots.map((s) => ({
    ticker: s.ticker,
    price: s.price,
    change_1d: s.change_1d,
    change_1w: s.change_1w,
    change_1m: s.change_1m,
    change_ytd: s.change_ytd,
    entry_low: s.entry_low,
    entry_high: s.entry_high,
    stop_loss: s.stop_loss,
    target_price: s.target_price,
    risk_reward: s.risk_reward,
    trade_probability: s.trade_probability,
    recommendation: s.recommendation,
  }));

  // Summary stats
  const buyCount = rows.filter((r) => r.recommendation === "ENTRY ZONE").length;
  const avgRR = rows.length > 0 ? rows.reduce((s, r) => s + r.risk_reward, 0) / rows.length : 0;
  const avgProb = rows.length > 0 ? rows.reduce((s, r) => s + r.trade_probability, 0) / rows.length : 0;
  const highConviction = rows.filter((r) => r.trade_probability >= 60 && r.risk_reward >= 2).length;

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
      <header className="border-b border-zinc-800/80 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <h1 className="text-sm font-semibold tracking-[0.15em] text-zinc-200 uppercase">
            Stock Tracker
            <span className="ml-2 text-zinc-400 font-normal tracking-normal normal-case">
              // Snapshot
            </span>
          </h1>
          {rows.length > 0 && (
            <span className="text-[10px] text-zinc-400 tabular-nums">
              {rows.length.toLocaleString()} stocks
            </span>
          )}
        </div>
        <span className="text-xs text-zinc-400 tabular-nums">{timestamp}</span>
      </header>

      <div className="p-6 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-zinc-900/50 border-zinc-800/80 border-t-2 border-t-emerald-500/40">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">Buy Signals</p>
              <p className="text-3xl font-semibold tabular-nums text-emerald-400">{buyCount.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-400 mt-2">
                {rows.length > 0 ? ((buyCount / rows.length) * 100).toFixed(1) : "0.0"}% of universe
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800/80 border-t-2 border-t-sky-500/40">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">High Conviction</p>
              <p className="text-3xl font-semibold tabular-nums text-sky-400">{highConviction.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-400 mt-2">Prob ≥60% &amp; R:R ≥2</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800/80 border-t-2 border-t-amber-500/40">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">Avg R:R</p>
              <p className="text-3xl font-semibold tabular-nums text-amber-400">{avgRR.toFixed(2)}</p>
              <p className="text-[10px] text-zinc-400 mt-2">universe average</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800/80 border-t-2 border-t-zinc-500/40">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">Avg Trade Prob</p>
              <p className="text-3xl font-semibold tabular-nums text-zinc-200">{avgProb.toFixed(1)}%</p>
              <p className="text-[10px] text-zinc-400 mt-2">universe average</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card className="bg-zinc-900/50 border-zinc-800/80">
          <CardHeader className="border-b border-zinc-800/60 pb-3">
            <CardTitle className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 uppercase">
              Stock Rankings
            </CardTitle>
          </CardHeader>
          {rows.length > 0 ? (
            <SnapshotTable rows={rows} />
          ) : (
            <div className="py-12 text-center text-sm text-zinc-500">No snapshot data available</div>
          )}
        </Card>
      </div>
    </main>
  );
}
