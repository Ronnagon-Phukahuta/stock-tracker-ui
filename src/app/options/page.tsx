export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { getOptionsSignal, getOptionsTrades, getTodaysPicks, getExitTiming } from "@/lib/api";
import { ExitTimingDisplay } from "@/components/exit-timing-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OptionsSignalDisplay } from "@/components/options-signal";
import { OptionsTradesManager } from "@/components/options-trades-manager";
import { TechPicksDisplay } from "@/components/tech-picks-display";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CandleAnalysis } from "@/components/candle-analysis";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function actionColor(action: string) {
  const upper = action.toUpperCase();
  if (upper === "CALL") return "text-emerald-400";
  if (upper === "PUT") return "text-red-400";
  return "text-zinc-400";
}

function actionAccent(action: string) {
  const upper = action.toUpperCase();
  if (upper === "CALL") return "border-t-emerald-500/60";
  if (upper === "PUT") return "border-t-red-500/60";
  return "border-t-zinc-600/60";
}

function marketStructureBadge(ms: string | null) {
  if (!ms) return null;
  const lower = ms.toLowerCase();
  const cls = lower.includes("bull")
    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
    : lower.includes("bear")
      ? "bg-red-500/20 text-red-300 border-red-500/40"
      : "bg-amber-500/20 text-amber-300 border-amber-500/40";
  return (
    <Badge variant="outline" className={`${cls} text-[10px] font-medium`}>
      {ms}
    </Badge>
  );
}

function vixBadge(label: string | null) {
  if (!label) return null;
  const lower = label.toLowerCase();
  const cls = lower.includes("low")
    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
    : lower.includes("high") || lower.includes("extreme")
      ? "bg-red-500/20 text-red-300 border-red-500/40"
      : "bg-amber-500/20 text-amber-300 border-amber-500/40";
  return (
    <Badge variant="outline" className={`${cls} text-[10px] font-medium`}>
      {label}
    </Badge>
  );
}

function getNextTradingDay(from: Date): string {
  const d = new Date(from);
  const day = d.getDay(); // 0=Sun 1=Mon … 5=Fri 6=Sat
  const add = day === 5 ? 3 : day === 6 ? 2 : 1;
  d.setDate(d.getDate() + add);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function breadthBadge(pct: number | null) {
  if (pct === null) return null;
  const cls =
    pct >= 60
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
      : pct <= 40
        ? "bg-red-500/20 text-red-300 border-red-500/40"
        : "bg-zinc-500/20 text-zinc-400 border-zinc-600/40";
  const label = pct >= 60 ? "Strong" : pct <= 40 ? "Weak" : "Neutral";
  return (
    <Badge variant="outline" className={`${cls} text-[10px] font-medium`}>
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function OptionsPage() {
  const [signalResult, tradesResult, picksResult, exitTimingResult] = await Promise.allSettled([
    getOptionsSignal(),
    getOptionsTrades(),
    getTodaysPicks(),
    getExitTiming(),
  ]);

  const signal = signalResult.status === "fulfilled" ? signalResult.value : null;
  const trades = tradesResult.status === "fulfilled" ? tradesResult.value.items : [];
  const picksData = picksResult.status === "fulfilled" ? picksResult.value : null;
  const exitTimingData = exitTimingResult.status === "fulfilled" ? exitTimingResult.value : null;

  const timestamp = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const tickers = signal?.tickers ?? [];
  const total = tickers.length;
  const call_count = tickers.filter(t => t.action.toUpperCase() === "CALL").length;
  const put_count  = tickers.filter(t => t.action.toUpperCase() === "PUT").length;
  const signal_action = call_count > 0 ? "CALL" : put_count > 0 ? "PUT" : "NO_TRADE";
  const signal_bias   = call_count > 0 ? `${call_count}/${total}` : put_count > 0 ? `${put_count}/${total}` : `0/${total}`;

  const signalDate = signal?.generated_at ? new Date(signal.generated_at) : new Date();
  const signalDateStr = signalDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const nextTradingDay = getNextTradingDay(signalDate);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      {/* Page header */}
      <header className="border-b border-zinc-800/80 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <h1 className="text-sm font-semibold tracking-[0.15em] text-zinc-200 uppercase">
            Stock Tracker
            <span className="ml-2 text-zinc-400 font-normal tracking-normal normal-case">
              // Options Signal
            </span>
          </h1>
        </div>
        <span className="text-xs text-zinc-400 tabular-nums">{timestamp}</span>
      </header>

      <div className="p-6">
        <Tabs defaultValue="signal">
          <TabsList className="mb-6 bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="signal" className="font-mono text-xs">Signal</TabsTrigger>
            <TabsTrigger value="tech-picks" className="font-mono text-xs">Tech Picks</TabsTrigger>
            <TabsTrigger value="analysis" className="font-mono text-xs">Market Analysis</TabsTrigger>
            <TabsTrigger value="exit-timing" className="font-mono text-xs">Exit Timing</TabsTrigger>
          </TabsList>

          <TabsContent value="signal">
            <div className="space-y-6">
        {signal === null ? (
          <Card className="bg-zinc-900/50 border-zinc-800/80">
            <CardContent className="py-12 text-center text-sm text-zinc-500">
              Options signal data unavailable
            </CardContent>
          </Card>
        ) : (
          <>
            {/* A. Action Banner */}
            <Card className={`bg-zinc-900/50 border-zinc-800/80 border-t-2 ${actionAccent(signal_action)}`}>
              <CardContent className="pt-5 pb-4 px-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">
                      Tomorrow&apos;s Action
                    </p>
                    <p className={`text-4xl font-bold tracking-widest ${actionColor(signal_action)}`}>
                      {signal_action}
                    </p>
                    <p className="text-sm text-zinc-400 mt-1 tabular-nums">
                      {signal_bias}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-2 tabular-nums">
                      📅 {signalDateStr} → Action for: {nextTradingDay}
                    </p>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-2">
                    {marketStructureBadge(signal.market_structure)}
                    {signal.market_structure_reason && (
                      <p className="text-[11px] text-zinc-500 max-w-xs text-right">
                        {signal.market_structure_reason}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* B. Market Context */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* VIX */}
              <Card className="bg-zinc-900/50 border-zinc-800/80">
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2">VIX</p>
                  <div className="flex items-end gap-2">
                    <p className="text-2xl font-semibold tabular-nums text-zinc-200">
                      {signal.vix_latest !== null ? signal.vix_latest.toFixed(2) : "—"}
                    </p>
                    {vixBadge(signal.vix_label)}
                  </div>
                </CardContent>
              </Card>

              {/* Breadth */}
              <Card className="bg-zinc-900/50 border-zinc-800/80">
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2">Market Breadth</p>
                  <div className="flex items-end gap-2">
                    <p className="text-2xl font-semibold tabular-nums text-zinc-200">
                      {signal.breadth_pct !== null ? signal.breadth_pct.toFixed(1) + "%" : "—"}
                    </p>
                    {breadthBadge(signal.breadth_pct)}
                  </div>
                </CardContent>
              </Card>

              {/* Generated at */}
              <Card className="bg-zinc-900/50 border-zinc-800/80">
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2">Signal Generated</p>
                  <p className="text-sm text-zinc-300 tabular-nums">
                    {signal.generated_at
                      ? new Date(signal.generated_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZoneName: "short",
                        })
                      : "—"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* C. Ticker Cards */}
            <Card className="bg-zinc-900/50 border-zinc-800/80">
              <CardHeader className="border-b border-zinc-800/60 pb-3">
                <CardTitle className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 uppercase">
                  Ticker Signals
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <OptionsSignalDisplay
                  tickers={signal.tickers}
                  nextTradingDay={nextTradingDay}
                  marketStructure={signal.market_structure}
                  vixLabel={signal.vix_label}
                  exitTiming={exitTimingData}
                />
              </CardContent>
            </Card>
          </>
        )}

        {/* D. Paper Trades */}
        <div>
          <p className="text-[11px] text-zinc-500 mb-4">
            ⏰ Signal runs after market close (05:15 BKK) — Enter position at market open on{" "}
            <span className="text-zinc-300">{nextTradingDay}</span>
          </p>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 uppercase mb-3">
            Paper Trades
          </p>
          <OptionsTradesManager initialTrades={trades} />
        </div>
            </div>
          </TabsContent>

          <TabsContent value="analysis">
            <CandleAnalysis marketStructure={signal?.market_structure ?? null} />
          </TabsContent>

          <TabsContent value="tech-picks">
            <TechPicksDisplay
              picks={picksData}
              signalAction={signal?.action_now ?? "NO_TRADE"}
            />
          </TabsContent>

          <TabsContent value="exit-timing">
            <ExitTimingDisplay data={exitTimingData} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
