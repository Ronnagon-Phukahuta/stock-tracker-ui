"use client";

import { OptionsSignalTicker, ExitTimingResponse } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
  );
}

// ---------------------------------------------------------------------------
// Action badge (2xl, prominent)
// ---------------------------------------------------------------------------

function ActionBadge({ action }: { action: string }) {
  const upper = action.toUpperCase();
  const cls =
    upper === "CALL"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
      : upper === "PUT"
        ? "bg-red-500/20 text-red-300 border-red-500/50"
        : "bg-zinc-800/60 text-zinc-400 border-zinc-700/60";
  return (
    <Badge
      variant="outline"
      className={`${cls} text-2xl font-bold px-5 py-2 whitespace-nowrap tracking-widest leading-none`}
    >
      {upper === "CALL" ? "CALL ✓" : upper === "PUT" ? "PUT ✓" : action}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Derive human-readable action summary line
// Output: "Market: Sideway · VIX: calm · Streak: UP 1d"
// ---------------------------------------------------------------------------

function deriveActionReason(
  t: OptionsSignalTicker,
  marketStructure: string | null,
  vixLabel: string | null,
): string {
  const parts: string[] = [];

  if (marketStructure) parts.push(`Market: ${marketStructure}`);
  if (vixLabel) parts.push(`VIX: ${vixLabel}`);

  if (t.candle_direction && t.candle_streak_days !== null && t.candle_streak_days <= 5) {
    const dirLabel = t.candle_direction.toUpperCase() === "UP" ? "UP" : "DOWN";
    parts.push(`Streak: ${dirLabel} ${t.candle_streak_days}d`);
  }

  return parts.length > 0 ? parts.join(" · ") : "—";
}

// ---------------------------------------------------------------------------
// Derive optimal exit day hint from market structure + ticker
// ---------------------------------------------------------------------------

function deriveOptimalExit(marketStructure: string | null, ticker: string): string | null {
  if (!marketStructure) return null;
  const ms = marketStructure.toLowerCase();
  if (ms.includes("sideway")) return "Optimal exit: Day 1 after entry";
  if (ms.includes("bull") && ticker.toUpperCase() === "QQQ") return "Optimal exit: Day 3 after entry";
  if (ms.includes("bull") && ticker.toUpperCase() === "SPY") return "Optimal exit: Day 7 after entry";
  if (ms.includes("bear")) return "Optimal exit: Day 1–3 after entry";
  return null;
}

// ---------------------------------------------------------------------------
// Derive regime threshold hint for re-entry
// ---------------------------------------------------------------------------

function deriveThreshold(regime: string | null): string | null {
  if (!regime) return null;
  const lower = regime.toLowerCase();
  if (lower.includes("bull")) return "Bull: need 2× DOWN to trigger";
  if (lower.includes("sideway")) return "Sideway: need 1× DOWN to trigger";
  if (lower.includes("bear")) return "Bear: wait for 3× DOWN → then UP flip";
  return null;
}

// ---------------------------------------------------------------------------
// Single ticker card
// ---------------------------------------------------------------------------

function TickerCard({
  t,
  nextTradingDay,
  marketStructure,
  vixLabel,
  exitTiming,
}: {
  t: OptionsSignalTicker;
  nextTradingDay: string;
  marketStructure: string | null;
  vixLabel: string | null;
  exitTiming?: ExitTimingResponse | null;
}) {
  const actionUpper = t.action.toUpperCase();
  const isNoTrade = actionUpper === "NO_TRADE" || actionUpper === "WAIT";
  const actionReason = deriveActionReason(t, marketStructure, vixLabel);
  const threshold = deriveThreshold(t.regime_label);

  const streakLabel =
    t.candle_direction && t.candle_streak_days !== null && t.candle_streak_days <= 5
      ? `${t.candle_direction.toUpperCase() === "UP" ? "UP" : "DOWN"} ${t.candle_streak_days}d`
      : null;

  const streakNeed =
    t.candle_direction && streakLabel
      ? t.candle_direction.toUpperCase() === "UP"
        ? "(need DOWN to trigger)"
        : "(need more DOWN or regime shift)"
      : null;

  return (
    <Card className="bg-zinc-800/50 border border-zinc-700">
      {/* Ticker header */}
      <CardHeader className="border-b border-zinc-700 pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-zinc-100 tracking-wider">{t.ticker}</span>
          {t.signal_strength && (
            <Badge
              variant="outline"
              className={`text-[10px] font-medium whitespace-nowrap ${
                t.signal_strength.toUpperCase() === "STRONG"
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                  : t.signal_strength.toUpperCase() === "MODERATE"
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                    : "bg-zinc-500/20 text-zinc-400 border-zinc-600/40"
              }`}
            >
              {t.signal_strength}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-0 pt-0 pb-0">

        {/* ── SECTION 1: Tomorrow's Action ── */}
        <div className="px-4 pt-4 pb-4 space-y-3">
          <SectionHeader label="Tomorrow's Action" />
          <ActionBadge action={t.action} />
          <p className="text-xs text-zinc-400 leading-relaxed">{actionReason}</p>

          {/* Transition risk skip warning */}
          {t.mining_skip_reason && (
            <div className="pt-0.5">
              <Badge
                variant="outline"
                className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-medium"
              >
                ⚠ Transition risk elevated — signal skipped
              </Badge>
            </div>
          )}

          {/* Mining recommendation */}
          {t.mining_recommended_ticker && (
            t.mining_recommended_ticker === t.ticker ? (
              <p className="text-xs text-emerald-400 pt-0.5">
                ✓ This ticker has the edge
                {t.mining_edge_reason ? ` (${t.mining_edge_reason})` : ""}
              </p>
            ) : (
              <p className="text-xs text-emerald-400 pt-0.5">
                → Consider {t.mining_recommended_ticker} instead
                {t.mining_edge_reason ? ` (${t.mining_edge_reason})` : ""}
              </p>
            )
          )}
        </div>

        {/* ── SECTION 2: If you have a position ── */}
        <div className="border-t border-zinc-700 px-4 pt-4 pb-4 space-y-2">
          <SectionHeader label="If You Have a Position" />
          {t.exit_advice ? (
            <p
              className={`text-sm font-medium leading-relaxed ${
                t.exit_urgency === "exit_now"
                  ? "text-red-400 font-bold"
                  : t.exit_urgency === "caution"
                    ? "text-amber-400"
                    : "text-emerald-400"
              }`}
            >
              {t.exit_advice}
            </p>
          ) : null}
          {(() => {
            const optExit = deriveOptimalExit(marketStructure, t.ticker);
            return optExit ? (
              <p className="text-[10px] text-emerald-400/80">{optExit}</p>
            ) : null;
          })()}
          <p className="text-[10px] text-zinc-500">
            Hard limits:{" "}
            {t.take_profit_pct !== null && (
              <span className="text-emerald-400/70">TP {fmtPct(t.take_profit_pct)}</span>
            )}
            {t.take_profit_pct !== null && t.stop_loss_pct !== null && (
              <span className="text-zinc-600"> / </span>
            )}
            {t.stop_loss_pct !== null && (
              <span className="text-red-400/70">SL {fmtPct(t.stop_loss_pct)}</span>
            )}
            {(t.take_profit_pct !== null || t.stop_loss_pct !== null) && (
              <span className="text-zinc-600"> — primary exit, don&apos;t wait for streak signal</span>
            )}
          </p>
          {t.dte_range && (
            <p className="text-[10px] text-zinc-500">DTE: {t.dte_range}</p>
          )}
          <p className="text-[10px] text-zinc-600 pt-0.5">
            Signal based on today&apos;s close — action for tomorrow open
          </p>
        </div>

        {/* ── ROTATION OPPORTUNITY ── */}
        {t.rotation_signal && (
          <div className="border-t border-zinc-700 px-4 pt-4 pb-4 space-y-2">
            <SectionHeader label="Rotation Opportunity" />
            {t.rotation_urgency === "now" ? (
              <p className="text-sm font-bold text-emerald-400 leading-relaxed">
                {t.rotation_signal}
              </p>
            ) : (
              <p className="text-sm font-medium text-amber-400 leading-relaxed">
                {t.rotation_signal}
              </p>
            )}
            <p className="text-[10px] text-zinc-500">
              {t.rotation_urgency === "now"
                ? `→ Rotate to ${t.rotation_target ?? "QQQ"} — signal active`
                : `Both active — consider ${t.rotation_target ?? "QQQ"} first`}
            </p>
          </div>
        )}

        {/* ── SECTION 3: Re-entry signal ── */}
        <div className="border-t border-zinc-700 px-4 pt-4 pb-4 space-y-2">
          <SectionHeader label="Re-Entry Signal" />
          {streakLabel && (
            <p className="text-xs text-zinc-400">
              <span className="font-bold text-white">{streakLabel}</span>
              {streakNeed && <span className="text-zinc-500 ml-1.5">{streakNeed}</span>}
            </p>
          )}
          {threshold && (
            <p className="text-[10px] text-zinc-500">{threshold}</p>
          )}
          {t.mining_edge_reason && !t.mining_recommended_ticker && (
            <p className="text-[10px] text-emerald-400/80">{t.mining_edge_reason}</p>
          )}
          {t.wf_consistent != null && (
            <div className="pt-0.5">
              <Badge
                variant="outline"
                className={
                  t.wf_consistent
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]"
                }
              >
                {t.wf_consistent
                  ? "✓ Pattern consistent across 27yr"
                  : `~ Mixed across market cycles${t.wf_cycle_note ? ` (${t.wf_cycle_note})` : ""}`}
              </Badge>
            </div>
          )}
        </div>

        {/* ── EXIT TIMING ── */}
        {(() => {
          const exitTimingTicker = exitTiming?.tickers.find(
            (et) => et.ticker === t.ticker,
          );
          if (!exitTiming || !exitTimingTicker) return null;
          const recColor =
            exitTimingTicker.recommendation === "HOLD"
              ? "text-green-400"
              : exitTimingTicker.recommendation === "EXIT"
                ? "text-red-400"
                : "text-yellow-400";
          return (
            <div className="border-t border-white/10 mx-4 mt-0 mb-3 pt-2 space-y-1">
              <p className="text-xs font-mono text-zinc-400">
                Exit Timing · 3d return:{" "}
                <span
                  className={
                    exitTimingTicker.return_3d >= 0 ? "text-emerald-400" : "text-red-400"
                  }
                >
                  {(exitTimingTicker.return_3d * 100).toFixed(1)}%
                </span>
                {" · "}{exitTimingTicker.bucket_label}
              </p>
              <p className="text-xs font-mono">
                <span className={recColor}>{exitTimingTicker.recommendation}</span>
                {" — "}{exitTimingTicker.reasoning}
              </p>
            </div>
          );
        })()}

      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------

export function OptionsSignalDisplay({
  tickers,
  nextTradingDay,
  marketStructure,
  vixLabel,
  exitTiming,
}: {
  tickers: OptionsSignalTicker[];
  nextTradingDay: string;
  marketStructure?: string | null;
  vixLabel?: string | null;
  exitTiming?: ExitTimingResponse | null;
}) {
  if (tickers.length === 0) {
    return (
      <p className="text-sm text-zinc-500 py-8 text-center">No ticker signals available.</p>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {tickers.map((t) => (
        <TickerCard
          key={t.ticker}
          t={t}
          nextTradingDay={nextTradingDay}
          marketStructure={marketStructure ?? null}
          vixLabel={vixLabel ?? null}
          exitTiming={exitTiming}
        />
      ))}
    </div>
  );
}
