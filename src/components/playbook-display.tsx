"use client";

import { useState, useEffect } from "react";
import { OptionsSignalResponse, ExitTimingResponse } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Verdict = "GO" | "WAIT" | "NO";

type PositionData = {
  entry_date: string;
  expiry_date: string;
  active: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function regimeLabel(regime: string): string {
  const lower = regime.toLowerCase();
  if (lower.includes("bull")) return "⚡ Bull Regime";
  if (lower.includes("bear")) return "🐻 Bear Regime";
  return "〰️ Sideway Regime";
}

function regimeColors(regime: string): { border: string; text: string; bg: string } {
  const lower = regime.toLowerCase();
  if (lower.includes("bull"))
    return { border: "border-orange-500/40", text: "text-orange-300", bg: "bg-orange-500/10" };
  if (lower.includes("bear"))
    return { border: "border-green-500/40", text: "text-green-300", bg: "bg-green-500/10" };
  return { border: "border-blue-500/40", text: "text-blue-300", bg: "bg-blue-500/10" };
}

function actionBadgeCls(value: string): string {
  const v = value.toUpperCase();
  if (["CALL", "ENTER", "HOLD", "GO"].includes(v))
    return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (["NO_TRADE", "AVOID", "EXIT", "NO", "PUT"].includes(v))
    return "bg-red-500/20 text-red-400 border-red-500/30";
  return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
}

function stepIcon(state: "green" | "yellow" | "red"): string {
  if (state === "green") return "✅";
  if (state === "yellow") return "⚠️";
  return "❌";
}

function computeVerdict(
  signalAction: string,
  entryRec: string | undefined,
  exitRec: string,
): Verdict {
  const action = signalAction.toUpperCase();
  const entry = (entryRec ?? "").toUpperCase();
  const exit = exitRec.toUpperCase();

  if (action === "CALL" && entry === "ENTER" && exit === "HOLD") return "GO";
  if (action !== "CALL" || entry === "AVOID" || exit === "EXIT") return "NO";
  return "WAIT";
}

function verdictDetails(v: Verdict): { icon: string; label: string; msg: string; cls: string } {
  if (v === "GO")
    return {
      icon: "✅",
      label: "GO",
      msg: "ALL CLEAR — Enter position",
      cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    };
  if (v === "WAIT")
    return {
      icon: "⚠️",
      label: "WAIT",
      msg: "Mixed signals — hold off or size small",
      cls: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    };
  return {
    icon: "❌",
    label: "NO",
    msg: "Skip — conditions not aligned",
    cls: "bg-red-500/10 border-red-500/30 text-red-400",
  };
}

function tradingDaysBetween(from: string, to: string): number {
  let count = 0;
  const d = new Date(from);
  const end = new Date(to);
  while (d < end) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

function calendarDaysLeft(expiry: string): number {
  const today = new Date();
  const exp = new Date(expiry);
  return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Ticker card
// ---------------------------------------------------------------------------

function PlaybookCard({
  ticker,
  signalData,
  exitTimingData,
  pos,
}: {
  ticker: string;
  signalData: OptionsSignalResponse | null;
  exitTimingData: ExitTimingResponse | null;
  pos: PositionData | undefined;
}) {
  const sigTicker = signalData?.tickers.find((t) => t.ticker === ticker);
  const exitTicker = exitTimingData?.tickers.find((t) => t.ticker === ticker);

  const action = sigTicker?.action ?? "—";
  const entryRec = exitTicker?.entry_recommendation;
  const exitRec = exitTicker?.recommendation ?? "NEUTRAL";
  const marketStructure = signalData?.market_structure ?? null;
  const streakLabel =
    sigTicker?.candle_direction && sigTicker.candle_streak_days != null
      ? `${sigTicker.candle_direction.toUpperCase()} ${sigTicker.candle_streak_days}d`
      : null;

  const hasPosition = pos?.active === true;
  const today = new Date().toISOString().slice(0, 10);
  const daysHeld = hasPosition ? tradingDaysBetween(pos!.entry_date, today) : 0;
  const daysLeft = hasPosition ? calendarDaysLeft(pos!.expiry_date) : 0;

  // Step states
  const step1State: "green" | "yellow" | "red" =
    action.toUpperCase() === "CALL" ? "green" : action.toUpperCase() === "PUT" ? "red" : "yellow";
  const step3State: "green" | "yellow" | "red" =
    exitRec === "HOLD" ? "green" : exitRec === "EXIT" ? "red" : "yellow";

  // --- MODE B: position active ---
  if (hasPosition) {
    // Position-aware verdict
    let posVerdictLabel: string;
    let posVerdictMsg: string;
    let posVerdictCls: string;
    const wr = exitTicker?.win_rate ?? exitTicker?.day4_win_rate ?? 0;
    const dayN = exitTicker?.next_hold_day ?? 4;
    const bucketLabel = exitTicker?.bucket_label ?? "";

    if (exitRec === "EXIT") {
      posVerdictLabel = "EXIT NOW";
      posVerdictMsg = `🚨 EXIT NOW — ${bucketLabel} historically reverses`;
      posVerdictCls = "bg-red-500/10 border-red-500/30 text-red-400";
    } else if (daysLeft <= 7) {
      posVerdictLabel = "EXIT SOON";
      posVerdictMsg = `⚠️ EXPIRY IN ${daysLeft} DAYS — Close position`;
      posVerdictCls = "bg-red-500/10 border-red-500/30 text-red-400";
    } else {
      posVerdictLabel = "HOLD";
      posVerdictMsg = `✅ HOLD POSITION — ${bucketLabel} · Day${dayN} WR ${(wr * 100).toFixed(1)}%`;
      posVerdictCls = "bg-blue-500/10 border-blue-500/30 text-blue-400";
    }

    return (
      <Card className="bg-zinc-900/50 border-zinc-800/80">
        <CardContent className="pt-4 pb-4 px-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <span className="text-2xl font-bold font-mono text-zinc-100 tracking-wider">{ticker}</span>
              <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                since {pos!.entry_date} · {daysLeft}d to expiry
              </p>
            </div>
            <Badge
              variant="outline"
              className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-sm font-bold tracking-widest px-4 py-1"
            >
              HOLDING
            </Badge>
          </div>

          {/* Step 1: Signal */}
          <div className="border-t border-white/10 pt-3">
            <p className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1.5">
              {stepIcon(step1State)} Step 1 · Signal
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`${actionBadgeCls(action)} text-xs font-bold tracking-wider px-2 py-0.5`}>
                {action}
              </Badge>
              {marketStructure && (
                <span className="text-xs font-mono text-zinc-400">{marketStructure}</span>
              )}
              {streakLabel && (
                <span className="text-xs font-mono text-zinc-500">Streak: {streakLabel}</span>
              )}
            </div>
          </div>

          {/* Step 2: Position Active */}
          <div className="border-t border-white/10 pt-3">
            <p className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1.5">
              📅 Step 2 · Position Active
            </p>
            <div className="space-y-1">
              <p className="text-xs font-mono text-zinc-400">
                📅 Held: <span className="text-zinc-200">{daysHeld} trading days</span>
                {" · "}since {pos!.entry_date}
              </p>
              <p
                className={`text-xs font-mono ${
                  daysLeft <= 7 ? "text-red-400" : daysLeft <= 14 ? "text-yellow-400" : "text-zinc-400"
                }`}
              >
                ⏳ Expiry: <span className="font-semibold">{daysLeft} days left</span>
                {" · "}{pos!.expiry_date}
              </p>
            </div>
          </div>

          {/* Step 3: Exit Timing */}
          <div className="border-t border-white/10 pt-3">
            <p className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1.5">
              {stepIcon(step3State)} Step 3 · Exit Timing
            </p>
            {exitTicker != null ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={`${actionBadgeCls(exitRec)} text-xs font-bold tracking-wider px-2 py-0.5`}
                >
                  {exitRec}
                </Badge>
                {exitTicker.bucket_label && (
                  <span className="text-xs font-mono text-zinc-400">{exitTicker.bucket_label}</span>
                )}
                <span
                  className={`text-xs font-mono font-semibold ${
                    wr >= 0.55 ? "text-emerald-400" : wr < 0.50 ? "text-red-400" : "text-yellow-400"
                  }`}
                >
                  Day{dayN} WR {(wr * 100).toFixed(1)}%
                </span>
                {exitTicker.validated && (
                  <span className="text-[10px] font-mono text-emerald-400">✅ WF validated</span>
                )}
              </div>
            ) : (
              <span className="text-xs font-mono text-zinc-600">No exit data</span>
            )}
          </div>

          {/* Verdict */}
          <div className={`border rounded-md px-3 py-2 mt-1 ${posVerdictCls}`}>
            <p className="text-xs font-bold font-mono tracking-wide">{posVerdictMsg}</p>
            <p className="text-[10px] font-mono mt-0.5 opacity-70">Combined OOS WR 62.0% · Sharpe 3.61</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- MODE A: no position ---
  const verdict = computeVerdict(action, entryRec, exitRec);
  const vd = verdictDetails(verdict);
  const step2State: "green" | "yellow" | "red" =
    entryRec === "ENTER" ? "green" : entryRec === "AVOID" ? "red" : "yellow";

  return (
    <Card className="bg-zinc-900/50 border-zinc-800/80">
      <CardContent className="pt-4 pb-4 px-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold font-mono text-zinc-100 tracking-wider">{ticker}</span>
          <Badge
            variant="outline"
            className={`${actionBadgeCls(verdict)} text-sm font-bold tracking-widest px-4 py-1`}
          >
            {verdict}
          </Badge>
        </div>

        {/* Step 1: Signal */}
        <div className="border-t border-white/10 pt-3">
          <p className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1.5">
            {stepIcon(step1State)} Step 1 · Signal
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`${actionBadgeCls(action)} text-xs font-bold tracking-wider px-2 py-0.5`}>
              {action}
            </Badge>
            {marketStructure && (
              <span className="text-xs font-mono text-zinc-400">{marketStructure}</span>
            )}
            {streakLabel && (
              <span className="text-xs font-mono text-zinc-500">Streak: {streakLabel}</span>
            )}
          </div>
        </div>

        {/* Step 2: Entry Quality */}
        <div className="border-t border-white/10 pt-3">
          <p className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1.5">
            {stepIcon(step2State)} Step 2 · Entry Quality
          </p>
          {exitTicker?.entry_recommendation != null ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className={`${actionBadgeCls(entryRec ?? "")} text-xs font-bold tracking-wider px-2 py-0.5`}
              >
                {entryRec}
              </Badge>
              {exitTicker.entry_bucket_label && (
                <span className="text-xs font-mono text-zinc-400">{exitTicker.entry_bucket_label}</span>
              )}
              {exitTicker.entry_day3_win_rate != null && (
                <span
                  className={`text-xs font-mono font-semibold ${
                    exitTicker.entry_day3_win_rate >= 0.58
                      ? "text-emerald-400"
                      : exitTicker.entry_day3_win_rate >= 0.54
                        ? "text-blue-400"
                        : "text-yellow-400"
                  }`}
                >
                  WR {(exitTicker.entry_day3_win_rate * 100).toFixed(1)}%
                </span>
              )}
              {exitTicker.entry_validated && (
                <span className="text-[10px] font-mono text-emerald-400">✅ WF validated</span>
              )}
            </div>
          ) : (
            <span className="text-xs font-mono text-zinc-600">No entry data</span>
          )}
        </div>

        {/* Step 3: Exit Timing */}
        <div className="border-t border-white/10 pt-3">
          <p className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1.5">
            {stepIcon(step3State)} Step 3 · Exit Timing
          </p>
          {exitTicker != null ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className={`${actionBadgeCls(exitRec)} text-xs font-bold tracking-wider px-2 py-0.5`}
              >
                {exitRec}
              </Badge>
              {exitTicker.bucket_label && (
                <span className="text-xs font-mono text-zinc-400">{exitTicker.bucket_label}</span>
              )}
              <span
                className={`text-xs font-mono font-semibold ${
                  exitTicker.day4_win_rate >= 0.55
                    ? "text-emerald-400"
                    : exitTicker.day4_win_rate < 0.50
                      ? "text-red-400"
                      : "text-yellow-400"
                }`}
              >
                Day4 WR {(exitTicker.day4_win_rate * 100).toFixed(1)}%
              </span>
              {exitTicker.validated && (
                <span className="text-[10px] font-mono text-emerald-400">✅ WF validated</span>
              )}
            </div>
          ) : (
            <span className="text-xs font-mono text-zinc-600">No exit data</span>
          )}
        </div>

        {/* Verdict */}
        <div className={`border rounded-md px-3 py-2 mt-1 ${vd.cls}`}>
          <p className="text-xs font-bold font-mono tracking-wide">
            {vd.icon} {vd.msg}
          </p>
          <p className="text-[10px] font-mono mt-0.5 opacity-70">
            Combined OOS WR 62.0% · Sharpe 3.61
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------

export function PlaybookDisplay({
  signalData,
  exitTimingData,
}: {
  signalData: OptionsSignalResponse | null;
  exitTimingData: ExitTimingResponse | null;
}) {
  const [positions, setPositions] = useState<Record<string, PositionData>>({});

  useEffect(() => {
    const saved = localStorage.getItem("exit_timing_positions");
    if (saved) setPositions(JSON.parse(saved));
  }, []);

  const regime = exitTimingData?.regime ?? signalData?.market_structure ?? null;
  const rc = regime ? regimeColors(regime) : null;

  return (
    <div className="space-y-6">
      {/* Regime banner */}
      {regime && rc && (
        <div className={`rounded-lg border px-5 py-4 flex items-center gap-3 ${rc.border} ${rc.bg}`}>
          <p className={`text-xl font-bold tracking-wide ${rc.text}`}>{regimeLabel(regime)}</p>
        </div>
      )}

      {/* Ticker cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {["SPY", "QQQ"].map((ticker) => (
          <PlaybookCard
            key={ticker}
            ticker={ticker}
            signalData={signalData}
            exitTimingData={exitTimingData}
            pos={positions[ticker]}
          />
        ))}
      </div>

      {/* Footer */}
      <p className="text-xs font-mono text-zinc-500 text-center mt-4">
        Combined Strategy · OOS WR 62.0% ± 4.2% · Sharpe 3.61 ± 1.08 · Validated 14/14 folds · Best regime: Sideway 71.4%
      </p>
    </div>
  );
}
