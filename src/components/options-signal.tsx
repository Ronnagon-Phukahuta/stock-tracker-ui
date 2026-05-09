"use client";

import { OptionsSignalTicker } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
}

function fmtNum(v: number | null, decimals = 1): string {
  if (v === null) return "—";
  return v.toFixed(decimals);
}

function fmtUsd(v: number | null): string {
  if (v === null) return "—";
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// Action badge
// ---------------------------------------------------------------------------

function ActionBadge({ action }: { action: string }) {
  const upper = action.toUpperCase();
  const cls =
    upper === "CALL"
      ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50"
      : upper === "PUT"
        ? "bg-red-500/25 text-red-300 border-red-500/50"
        : "bg-zinc-500/20 text-zinc-400 border-zinc-600/50";
  return (
    <Badge variant="outline" className={`${cls} text-[10px] font-medium whitespace-nowrap`}>
      {action}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Signal strength badge
// ---------------------------------------------------------------------------

function StrengthBadge({ strength }: { strength: string | null }) {
  if (!strength) return null;
  const upper = strength.toUpperCase();
  const cls =
    upper === "STRONG"
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
      : upper === "MODERATE"
        ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
        : "bg-zinc-500/20 text-zinc-400 border-zinc-600/40";
  return (
    <Badge variant="outline" className={`${cls} text-[10px] font-medium whitespace-nowrap`}>
      {strength}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Single ticker card
// ---------------------------------------------------------------------------

function TickerCard({ t, nextTradingDay }: { t: OptionsSignalTicker; nextTradingDay: string }) {
  return (
    <Card className="bg-zinc-900/50 border-zinc-800/80">
      <CardHeader className="border-b border-zinc-800/60 pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-zinc-100 tracking-wider">{t.ticker}</span>
          <div className="flex items-center gap-2">
            <ActionBadge action={t.action} />
            <StrengthBadge strength={t.signal_strength} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pt-0 pb-4 divide-y divide-zinc-800/40">
        {/* Row 1: RSI | BB Position | Stoch %K */}
        <div className="grid grid-cols-3 gap-2 py-3">
          <div>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-0.5">RSI</p>
            <p className="text-sm font-semibold tabular-nums text-zinc-200">{fmtNum(t.rsi)}</p>
          </div>
          <div>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-0.5">BB Position</p>
            <p className="text-sm font-semibold text-zinc-200">{t.bb_position ?? "—"}</p>
          </div>
          <div>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-0.5">Stoch %K</p>
            <p className="text-sm font-semibold tabular-nums text-zinc-200">{fmtNum(t.stoch_k)}</p>
          </div>
        </div>

        {/* Candle streak */}
        <div className="py-3">
          {t.candle_direction === null || t.candle_streak_days === null ? (
            <p className="text-[11px] text-zinc-600">📊 Today: calculating...</p>
          ) : t.candle_streak_days > 5 ? (
            <p className="text-[11px] text-zinc-600">📊 Today: —</p>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500">📊 Today:</span>
              <Badge
                variant="outline"
                className={`text-xs font-semibold px-2 py-1 whitespace-nowrap ${
                  t.candle_direction.toUpperCase() === "UP"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-red-500/20 text-red-300 border-red-500/40"
                }`}
              >
                {t.candle_direction.toUpperCase() === "UP" ? "↑" : "↓"}{" "}
                {t.candle_direction} · {t.candle_streak_days}d
              </Badge>
              <span className="text-zinc-500 text-sm">→</span>
              <Badge
                variant="outline"
                className={`text-sm font-bold px-3 py-1 whitespace-nowrap ${
                  t.action.toUpperCase() === "CALL"
                    ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50"
                    : t.action.toUpperCase() === "PUT"
                      ? "bg-red-500/25 text-red-300 border-red-500/50"
                      : t.action.toUpperCase() === "WAIT"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-zinc-500/20 text-zinc-400 border-zinc-600/40"
                }`}
              >
                {t.action.toUpperCase() === "CALL"
                  ? "CALL ✓"
                  : t.action.toUpperCase() === "PUT"
                    ? "PUT ✓"
                    : t.action}
              </Badge>
            </div>
          )}
        </div>

        {/* Row 2: Hit rate | Recent hit rate | Score */}
        <div className="grid grid-cols-3 gap-2 py-3">
          <div>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-0.5">Hit Rate</p>
            <p className="text-sm font-semibold tabular-nums text-zinc-200">
              {t.hit_rate !== null ? (t.hit_rate * 100).toFixed(0) + "%" : "—"}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-0.5">Recent HR</p>
            <p className="text-sm font-semibold tabular-nums text-zinc-200">
              {t.hit_rate_recent !== null ? (t.hit_rate_recent * 100).toFixed(0) + "%" : "—"}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-0.5">Score</p>
            <p className="text-sm font-semibold tabular-nums text-zinc-200">{fmtNum(t.score_holistic, 2)}</p>
          </div>
        </div>

        {/* Row 3: DTE | Take profit | Stop loss */}
        <div className="grid grid-cols-3 gap-2 py-3">
          <div>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-0.5">DTE</p>
            <p className="text-sm font-semibold text-zinc-200">{t.dte_range ?? "—"}</p>
          </div>
          <div>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-0.5">Take Profit</p>
            <p className="text-sm font-semibold tabular-nums text-emerald-400">{fmtPct(t.take_profit_pct)}</p>
          </div>
          <div>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-0.5">Stop Loss</p>
            <p className="text-sm font-semibold tabular-nums text-red-400">{fmtPct(t.stop_loss_pct)}</p>
          </div>
        </div>

        {/* Regime + gate reason */}
        <div className="pt-3 space-y-2">
          {t.regime_label && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-zinc-500">Regime: <span className="text-zinc-300">{t.regime_label}</span></span>
            </div>
          )}

          {t.gate_reason && (
            <p className="text-[10px] text-zinc-500">
              {t.gate_reason === "budget_exceeded"
                ? "Within budget: check before entry"
                : t.gate_reason}
            </p>
          )}
        </div>
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
}: {
  tickers: OptionsSignalTicker[];
  nextTradingDay: string;
}) {
  if (tickers.length === 0) {
    return (
      <p className="text-sm text-zinc-500 py-8 text-center">No ticker signals available.</p>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {tickers.map((t) => (
        <TickerCard key={t.ticker} t={t} nextTradingDay={nextTradingDay} />
      ))}
    </div>
  );
}
