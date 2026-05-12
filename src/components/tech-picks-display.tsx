"use client";

import { type TodaysPicksResponse, type OptionsPick } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionLabel = OptionsPick["action_label"];
type HoldMode = OptionsPick["hold_mode"];
type LiquidityGrade = OptionsPick["liquidity_grade"];

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const ACTION_BADGE: Record<ActionLabel, string> = {
  ENTRY: "bg-green-500/20 text-green-400 border-green-500/30",
  WATCH: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  AVOID: "bg-red-500/20 text-red-400 border-red-500/30",
};

const ACTION_RING: Record<ActionLabel, string> = {
  ENTRY: "ring-1 ring-green-500/30",
  WATCH: "ring-1 ring-yellow-500/30",
  AVOID: "ring-1 ring-red-500/30",
};

const GRADE_BADGE: Record<LiquidityGrade, string> = {
  A: "bg-green-500/20 text-green-400 border-green-500/30",
  B: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  C: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  F: "bg-red-500/20 text-red-400 border-red-500/30",
};

function liquidRankColor(rank: number): string {
  if (rank === 1) return "text-emerald-400 font-bold";
  if (rank === 2) return "text-emerald-400 font-bold";
  if (rank === 3) return "text-sky-400 font-bold";
  return "text-slate-300";
}

const HOLD_MODE_LABEL: Record<HoldMode, string> = {
  short_hold: "Short 1-3d",
  long_hold: "Long 7-10d",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sizeFactor(vix: number): string {
  if (vix < 15) return "1.0x (full)";
  if (vix < 20) return "0.75x (normal)";
  if (vix < 30) return "0.50x (elevated)";
  return "0.25x (extreme)";
}

// ---------------------------------------------------------------------------
// Pick card
// ---------------------------------------------------------------------------

function PickCard({ pick, regime }: { pick: OptionsPick; regime: string }) {
  const dimmed = regime === "Bull" && pick.action_label === "WATCH";
  return (
    <Card
      className={`${
        pick.action_label === "ENTRY"
          ? "bg-emerald-950/40 border-emerald-500/40"
          : pick.action_label === "WATCH"
          ? "bg-slate-800/60 border-slate-600/40"
          : "bg-red-950/30 border-red-500/30"
      } ${ACTION_RING[pick.action_label]}${dimmed ? " opacity-75" : ""}`}
    >
      <CardContent className="px-4 pt-4 pb-4 space-y-3">
        {/* Header row: ticker + action badge */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-xl font-bold font-mono text-white leading-none tracking-wider">
            {pick.ticker}
          </span>
          <Badge
            variant="outline"
            className={`${ACTION_BADGE[pick.action_label]} text-[10px] font-semibold shrink-0`}
          >
            {pick.action_label}
          </Badge>
        </div>

        {/* Grade + Hold Mode */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="outline"
            className={`${GRADE_BADGE[pick.liquidity_grade]} text-[10px] font-semibold`}
          >
            Grade {pick.liquidity_grade}
          </Badge>
          <span className="text-[10px] text-zinc-600">·</span>
          <span className="text-[10px] text-zinc-500 font-mono">
            {HOLD_MODE_LABEL[pick.hold_mode]}
          </span>
        </div>

        {/* Metrics */}
        <div className="space-y-0.5 text-[11px] font-mono">
          <p>
            <span className="text-zinc-500">Spot:</span>{" "}
            <span className="text-white font-mono">${pick.spot_price.toFixed(2)}</span>
          </p>
          {pick.spot_price > 300 ? (
            <p className="text-xs text-yellow-400 font-medium">⚠️ Premium may be high — check broker</p>
          ) : pick.spot_price > 150 ? (
            <p className="text-xs text-muted-foreground">Check premium before entry</p>
          ) : null}
          <p>
            <span className="text-zinc-500">Liquid Rank:</span>{" "}
            <span className={liquidRankColor(pick.liquid_rank)}>#{pick.liquid_rank}</span>
          </p>
          <p>
            <span className="text-zinc-500">Score:</span>{" "}
            <span className="text-slate-300">{pick.pick_score.toFixed(3)}</span>
          </p>
        </div>

        {/* Reasoning */}
        {pick.reasoning && (
          <p className="text-[11px] text-slate-300 italic leading-relaxed">
            {pick.reasoning}
          </p>
        )}

        {/* Next Earnings */}
        <p className="text-[11px] font-mono text-slate-400">
          {!pick.days_to_earnings ? (
            "Next earnings: —"
          ) : pick.earnings_flag ? (
            <span className="text-red-400">⚠️ Earnings in {pick.days_to_earnings}d</span>
          ) : (
            `Next earnings: ${pick.days_to_earnings}d`
          )}
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------

export function TechPicksDisplay({
  picks,
  signalAction,
}: {
  picks: TodaysPicksResponse | null;
  signalAction: string;
}) {
  const upper = signalAction.toUpperCase();
  const isNoTrade = upper === "NO_TRADE";

  const regime = picks?.regime ?? null;
  const vix = picks?.vix_latest ?? null;
  const generatedAt = picks?.generated_at ?? null;
  const regimeCriteriaNote = picks?.regime_criteria?.note ?? null;

  return (
    <div className="space-y-4">
      {/* ----------------------------------------------------------------- */}
      {/* Regime banner                                                       */}
      {/* ----------------------------------------------------------------- */}
      {regime === "Bear" && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 space-y-1">
          <p className="text-sm text-green-400 font-mono">
            ✅ Bear Regime — Strongest edge · OOS Win Rate 68% · Top 5 Liquid Rank (Grade A/B)
          </p>
          {isNoTrade && (
            <p className="text-xs text-yellow-400 font-mono">
              ⚠️ SPY/QQQ signal is NO_TRADE — additional caution advised
            </p>
          )}
        </div>
      )}
      {regime === "Sideway" && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 space-y-1">
          <p className="text-sm text-blue-400 font-mono">
            ✅ Sideway Regime — Good edge · OOS Win Rate 62% · Top 5 Liquid Rank (Grade A/B)
          </p>
          {isNoTrade && (
            <p className="text-xs text-yellow-400 font-mono">
              ⚠️ SPY/QQQ signal is NO_TRADE — additional caution advised
            </p>
          )}
        </div>
      )}
      {regime === "Bull" && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 space-y-1">
          <p className="text-sm text-orange-400 font-mono">
            ⚡ Bull Regime — Weaker edge (56%) · Top 5 Liquid Grade A/B · Use caution
          </p>
          {isNoTrade && (
            <p className="text-xs text-yellow-400 font-mono">
              ⚠️ SPY/QQQ signal is NO_TRADE — additional caution advised
            </p>
          )}
        </div>
      )}
      {!regime && isNoTrade && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
          <p className="text-sm text-yellow-400 font-mono">
            ⚠️ SPY/QQQ signal is NO_TRADE today — trade with caution
          </p>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* VIX context line                                                    */}
      {/* ----------------------------------------------------------------- */}
      {vix !== null && (
        <p className="text-[11px] text-slate-300 font-mono">
          VIX {vix.toFixed(1)} · {regime ?? "—"}
          {regimeCriteriaNote && <> · {regimeCriteriaNote}</>}
          {generatedAt && (
            <>
              {" · "}
              {new Date(generatedAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZoneName: "short",
              })}
            </>
          )}
        </p>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Picks grid or empty state                                           */}
      {/* ----------------------------------------------------------------- */}
      {!picks ? (
        <Card className="bg-zinc-900/50 border-red-500/30">
          <CardContent className="py-12 text-center text-sm text-red-400">
            Tech picks unavailable — backend may be offline
          </CardContent>
        </Card>
      ) : picks.picks.length === 0 && regime === "Bull" ? (
        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardContent className="py-10 text-center space-y-2">
            <p className="text-sm text-orange-400 font-mono font-medium">
              No picks pass Bull filter today
            </p>
            <p className="text-xs text-zinc-500 leading-relaxed max-w-sm mx-auto">
              Bull regime requires RS Rank #1-2 AND momentum &gt;1.5.<br />
              Current top picks don&apos;t meet strict criteria.<br />
              Consider waiting for Sideway/Bear regime.
            </p>
          </CardContent>
        </Card>
      ) : picks.picks.length === 0 ? (
        <Card className="bg-zinc-900/50 border-zinc-800/80">
          <CardContent className="py-10 text-center space-y-2">
            <p className="text-sm text-zinc-400 font-mono">
              No qualified picks
            </p>
            <p className="text-xs text-zinc-600">
              Top 3 tickers may be in earnings window or below liquidity threshold
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {picks.picks.slice(0, 5).map((pick) => (
            <PickCard key={pick.ticker} pick={pick} regime={regime ?? ""} />
          ))}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Footer                                                              */}
      {/* ----------------------------------------------------------------- */}
      <p className="text-[11px] text-zinc-600 leading-relaxed">
        Walk-forward validated · OOS Win Rate 64.5% · Sharpe 2.09 ·
        Sideway/Bear: Liquid top 5 · Bull: Top 5 Liquid rank · weaker edge ·
        Hold 3d · Long CALL · DTE 15-21 · Exit +20-30%
      </p>
    </div>
  );
}
