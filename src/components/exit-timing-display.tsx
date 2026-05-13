"use client";

import { useState, useEffect } from "react";
import { ExitTimingResponse, ExitTimingTicker } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function regimeColors(regime: string): { border: string; text: string; bg: string } {
  const lower = regime.toLowerCase();
  if (lower.includes("bull"))
    return {
      border: "border-orange-500/40",
      text: "text-orange-300",
      bg: "bg-orange-500/10",
    };
  if (lower.includes("bear"))
    return {
      border: "border-green-500/40",
      text: "text-green-300",
      bg: "bg-green-500/10",
    };
  // Sideway / default
  return {
    border: "border-blue-500/40",
    text: "text-blue-300",
    bg: "bg-blue-500/10",
  };
}

function regimeLabel(regime: string): string {
  const lower = regime.toLowerCase();
  if (lower.includes("bull")) return "⚡ Bull Regime";
  if (lower.includes("bear")) return "🐻 Bear Regime";
  return "〰️ Sideway Regime";
}

function bucketBadge(bucket: string, bucketLabel: string) {
  const cls =
    bucket === "big_loss"
      ? "bg-red-500/20 text-red-300 border-red-500/50"
      : bucket === "small_loss"
        ? "bg-orange-500/20 text-orange-300 border-orange-500/50"
        : bucket === "small_gain"
          ? "bg-blue-500/20 text-blue-300 border-blue-500/50"
          : bucket === "medium_gain"
            ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/50"
            : "bg-green-500/20 text-green-300 border-green-500/50"; // big_gain
  return (
    <Badge variant="outline" className={`${cls} text-[10px] font-medium`}>
      {bucketLabel}
    </Badge>
  );
}

function winRateClass(rate: number): string {
  if (rate >= 0.55) return "text-emerald-400";
  if (rate < 0.50) return "text-red-400";
  return "text-yellow-400";
}

function recommendationBadge(rec: ExitTimingTicker["recommendation"]) {
  const map: Record<
    ExitTimingTicker["recommendation"],
    { cls: string; label: string }
  > = {
    HOLD: {
      cls: "bg-green-500/20 text-green-300 border-green-500/50",
      label: "HOLD",
    },
    EXIT: {
      cls: "bg-red-500/20 text-red-300 border-red-500/50",
      label: "EXIT",
    },
    NEUTRAL: {
      cls: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50",
      label: "NEUTRAL",
    },
  };
  const { cls, label } = map[rec];
  return (
    <Badge variant="outline" className={`${cls} text-sm font-bold tracking-widest px-4 py-1`}>
      {label}
    </Badge>
  );
}

function recommendationRingClass(rec: ExitTimingTicker["recommendation"]): string {
  if (rec === "HOLD") return "ring-1 ring-green-500/30";
  if (rec === "EXIT") return "ring-1 ring-red-500/30";
  return "ring-1 ring-yellow-500/30";
}

function fmtPct(v: number): string {
  return (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%";
}

// ---------------------------------------------------------------------------
// Position tracking types
// ---------------------------------------------------------------------------

type PositionData = {
  entry_date: string;
  expiry_date: string;
  active: boolean;
};

// ---------------------------------------------------------------------------
// Ticker card
// ---------------------------------------------------------------------------

function TickerExitCard({
  originalTicker,
  entryTicker,
  pos,
  isEditing,
  formEntry,
  formExpiry,
  daysLeft,
  onOpenForm,
  onCancelForm,
  onSave,
  onReset,
  onChangeEntry,
  onChangeExpiry,
}: {
  originalTicker: ExitTimingTicker;
  entryTicker?: ExitTimingTicker;
  pos: PositionData | undefined;
  isEditing: boolean;
  formEntry: string;
  formExpiry: string;
  daysLeft: number;
  onOpenForm: () => void;
  onCancelForm: () => void;
  onSave: () => void;
  onReset: () => void;
  onChangeEntry: (v: string) => void;
  onChangeExpiry: (v: string) => void;
}) {
  // For header badge and ring: prefer entry-aware recommendation when position is active
  const activeRec = (pos?.active && entryTicker?.recommendation) ? entryTicker.recommendation : originalTicker.recommendation;

  return (
    <Card
      className={`bg-zinc-900/50 border-zinc-800/80 ${recommendationRingClass(activeRec)}`}
    >
      <CardContent className="pt-4 pb-4 px-4">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl font-bold font-mono text-zinc-100 tracking-wider">{originalTicker.ticker}</span>
          {recommendationBadge(activeRec)}
        </div>

        {/* ── Section 0: Entry Quality ── */}
        {originalTicker.entry_recommendation != null && (
          <div className="border-b border-white/10 mb-3 pb-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Entry Quality</p>
            <div className="space-y-2">
              {originalTicker.entry_bucket != null && originalTicker.entry_bucket_label != null && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500">Entry Bucket:</span>
                  {bucketBadge(originalTicker.entry_bucket, originalTicker.entry_bucket_label)}
                </div>
              )}
              {originalTicker.entry_day3_win_rate != null && (
                <p className="text-xs text-zinc-400">
                  <span className="text-zinc-500 mr-1">Day 3 Win Rate:</span>
                  <span
                    className={`font-semibold ${
                      originalTicker.entry_day3_win_rate >= 0.58
                        ? "text-emerald-400"
                        : originalTicker.entry_day3_win_rate >= 0.54
                          ? "text-blue-400"
                          : "text-yellow-400"
                    }`}
                  >
                    {(originalTicker.entry_day3_win_rate * 100).toFixed(1)}%
                  </span>
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const rec = originalTicker.entry_recommendation;
                  const cls =
                    rec === "ENTER"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : rec === "AVOID"
                        ? "bg-red-500/20 text-red-400 border-red-500/30"
                        : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
                  return (
                    <Badge
                      variant="outline"
                      className={`${cls} text-sm font-bold tracking-widest px-4 py-1`}
                    >
                      {rec}
                    </Badge>
                  );
                })()}
                {originalTicker.entry_validated && (
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded px-1.5 py-0.5 font-mono">
                    ✅ WF validated
                  </span>
                )}
              </div>
              {originalTicker.entry_reasoning && (
                <p className="text-xs font-mono italic text-zinc-500">
                  {originalTicker.entry_reasoning}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Section 1: Market Stats — always original data (market context, not position) ── */}
        <div>
          <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Market Stats — 3d Return Analysis</p>
          {(() => {
            const s = originalTicker;
            return (
              <div className="space-y-2">
                <p className="text-xs text-zinc-400">
                  <span className="text-zinc-500 mr-1">3d Market Return:</span>
                  <span className={s.return_3d >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                    {fmtPct(s.return_3d)}
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500">Bucket:</span>
                  {bucketBadge(s.bucket, s.bucket_label)}
                </div>
                <p className="text-xs text-zinc-400">
                  <span className="text-zinc-500 mr-1">Day 4 Win Rate:</span>
                  <span className={`font-semibold ${winRateClass(s.day4_win_rate)}`}>
                    {(s.day4_win_rate * 100).toFixed(1)}%
                  </span>
                </p>
                <p className="text-xs text-zinc-400">
                  <span className="text-zinc-500 mr-1">Avg Incremental:</span>
                  <span className={s.day4_avg_incremental >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {(s.day4_avg_incremental >= 0 ? "+" : "") + (s.day4_avg_incremental * 100).toFixed(2) + "%"}
                  </span>
                </p>
                <p className="text-xs font-mono text-zinc-500 italic mt-1">
                  {s.reasoning}
                </p>
                {s.validated && (
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 mt-1 inline-block">
                    ✅ Walk-forward validated
                  </span>
                )}
                {s.regime_used && (
                  <p className="text-xs font-mono text-zinc-500 mt-0.5">
                    Regime:{" "}
                    <span
                      className={
                        s.regime_used === "Bull"
                          ? "text-orange-400"
                          : s.regime_used === "Bear"
                            ? "text-emerald-400"
                            : "text-blue-400"
                      }
                    >
                      {s.regime_used}
                    </span>
                  </p>
                )}
              </div>
            );
          })()}
        </div>

        {/* ── Section 2: My Position — entry-aware data ── */}
        <div className="border-t border-white/10 mt-3 pt-3">
          <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">My Position</p>
          {pos?.active === true ? (
            <div className="space-y-1">
              {entryTicker?.actual_return != null && (
                <p className="text-xs font-mono text-zinc-400">
                  <span className="text-zinc-500 mr-1">Actual Return:</span>
                  <span className={entryTicker.actual_return >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                    {fmtPct(entryTicker.actual_return)}
                  </span>
                </p>
              )}
              <p className="text-xs font-mono text-zinc-400">
                📅 Held:{" "}
                <span className="text-zinc-200">
                  {entryTicker?.days_held != null ? entryTicker.days_held : "—"} trading days
                </span>
                {" · "}since {pos.entry_date}
              </p>
              <p
                className={`text-xs font-mono ${
                  daysLeft <= 7
                    ? "text-red-400"
                    : daysLeft <= 14
                      ? "text-yellow-400"
                      : "text-zinc-400"
                }`}
              >
                ⏳ Expiry: <span className="font-semibold">{daysLeft} days left</span>
                {" · "}{pos.expiry_date}
                {daysLeft <= 7 && " · ⚠️ Close soon"}
              </p>
              <button
                onClick={onReset}
                className="text-xs font-mono px-2 py-0.5 rounded border border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-500/50 transition-colors mt-1"
              >
                Reset Position
              </button>
            </div>
          ) : isEditing ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-mono text-zinc-500 w-16">Entry</label>
                <input
                  type="date"
                  value={formEntry}
                  onChange={(e) => onChangeEntry(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-2 py-1 text-xs font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-mono text-zinc-500 w-16">Expiry</label>
                <input
                  type="date"
                  value={formExpiry}
                  onChange={(e) => onChangeExpiry(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-2 py-1 text-xs font-mono"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onSave}
                  className="text-xs font-mono px-2 py-0.5 rounded border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={onCancelForm}
                  className="text-xs font-mono px-2 py-0.5 rounded border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onOpenForm}
              className="text-xs font-mono px-2 py-0.5 rounded border border-zinc-700 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/50 transition-colors"
            >
              + Open Position
            </button>
          )}
        </div>

        {/* ── Section 3: Recommendation — entry-aware ── */}
        {pos?.active === true && (
          <div className="border-t border-white/10 mt-3 pt-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Recommendation</p>
            {(() => {
              const rec = entryTicker?.recommendation ?? originalTicker.recommendation;
              const bucketLabel = entryTicker?.bucket_label ?? originalTicker.bucket_label;
              const wr = entryTicker?.win_rate ?? entryTicker?.day4_win_rate ?? originalTicker.day4_win_rate;
              const dayLabel = entryTicker?.next_hold_day ?? 4;
              const daysHeld = entryTicker?.days_held ?? 0;
              let cls: string;
              let msg: string;
              if (rec === "EXIT") {
                cls = "bg-red-500/10 border-red-500/30 text-red-400";
                msg = `🚨 EXIT signal — ${bucketLabel} bucket historically reverses at day 4`;
              } else if (daysLeft <= 7) {
                cls = "bg-red-500/10 border-red-500/30 text-red-400";
                msg = `⚠️ Expiry in ${daysLeft} days — close position soon regardless of signal`;
              } else if (daysLeft <= 14) {
                cls = "bg-yellow-500/10 border-yellow-500/30 text-yellow-400";
                msg = `🟡 Approaching expiry (${daysLeft}d left) — plan exit by day ${daysHeld + 3}`;
              } else if (rec === "HOLD") {
                cls = "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
                msg = `✅ HOLD — ${bucketLabel} → Day${dayLabel} WR ${(wr * 100).toFixed(1)}% · Consider exit at day ${daysHeld + 2}–${daysHeld + 3} or if +20–30% profit`;
              } else {
                cls = "bg-zinc-500/10 border-zinc-500/30 text-zinc-400";
                msg = "⚪ NEUTRAL — monitor closely, exit at profit target";
              }
              return (
                <div className={`rounded-md border p-2 text-xs font-mono ${cls}`}>
                  {msg}
                </div>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------

export function ExitTimingDisplay({ data }: { data: ExitTimingResponse | null }) {
  const [positions, setPositions] = useState<Record<string, PositionData>>({});
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, { entry: string; expiry: string }>>({});
  const [entryAwareData, setEntryAwareData] = useState<ExitTimingResponse | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("exit_timing_positions");
    if (saved) setPositions(JSON.parse(saved));
  }, []);

  // Refetch with entry dates whenever positions change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const spyPos = positions["SPY"];
    const qqqPos = positions["QQQ"];
    if (!spyPos?.active && !qqqPos?.active) {
      setEntryAwareData(null);
      return;
    }
    const params = new URLSearchParams();
    if (spyPos?.active) params.set("entry_date_spy", spyPos.entry_date);
    if (qqqPos?.active) params.set("entry_date_qqq", qqqPos.entry_date);
    fetch(`/api/options/exit-timing?${params}`)
      .then((r) => r.json())
      .then(setEntryAwareData)
      .catch(() => setEntryAwareData(null));
  }, [JSON.stringify(positions)]);

  function savePosition(ticker: string) {
    const form = formData[ticker];
    if (!form?.entry || !form?.expiry) return;
    const updated = {
      ...positions,
      [ticker]: { entry_date: form.entry, expiry_date: form.expiry, active: true },
    };
    setPositions(updated);
    localStorage.setItem("exit_timing_positions", JSON.stringify(updated));
    setEditingTicker(null);
  }

  function resetPosition(ticker: string) {
    const updated = { ...positions };
    delete updated[ticker];
    setPositions(updated);
    localStorage.setItem("exit_timing_positions", JSON.stringify(updated));
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
  if (!data) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800/80">
        <CardContent className="py-12 text-center text-sm text-zinc-500">
          Exit timing data unavailable
        </CardContent>
      </Card>
    );
  }

  const rc = regimeColors(data.regime);

  return (
    <div className="space-y-6">
      {/* Regime banner */}
      <div
        className={`rounded-lg border px-5 py-4 flex items-center gap-3 ${rc.border} ${rc.bg}`}
      >
        <p className={`text-xl font-bold tracking-wide ${rc.text}`}>{regimeLabel(data.regime)}</p>
      </div>

      {/* Ticker cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {data.tickers.map((originalTicker) => {
          const entryTicker = entryAwareData?.tickers.find(
            (e) => e.ticker === originalTicker.ticker,
          );
          const pos = positions[originalTicker.ticker];
          const daysLeft = pos ? calendarDaysLeft(pos.expiry_date) : 0;
          return (
            <TickerExitCard
              key={originalTicker.ticker}
              originalTicker={originalTicker}
              entryTicker={entryTicker}
              pos={pos}
              isEditing={editingTicker === originalTicker.ticker}
              formEntry={formData[originalTicker.ticker]?.entry ?? ""}
              formExpiry={formData[originalTicker.ticker]?.expiry ?? ""}
              daysLeft={daysLeft}
              onOpenForm={() => setEditingTicker(originalTicker.ticker)}
              onCancelForm={() => setEditingTicker(null)}
              onSave={() => savePosition(originalTicker.ticker)}
              onReset={() => resetPosition(originalTicker.ticker)}
              onChangeEntry={(v) =>
                setFormData((prev) => ({
                  ...prev,
                  [originalTicker.ticker]: { ...prev[originalTicker.ticker], entry: v },
                }))
              }
              onChangeExpiry={(v) =>
                setFormData((prev) => ({
                  ...prev,
                  [originalTicker.ticker]: { ...prev[originalTicker.ticker], expiry: v },
                }))
              }
            />
          );
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-800/60" />

      {/* Footer */}
      <p className="text-[10px] text-zinc-600 leading-relaxed">
        Based on walk-forward validated return partition analysis · SPY/QQQ only · Individual
        stocks not reliable
      </p>
    </div>
  );
}
