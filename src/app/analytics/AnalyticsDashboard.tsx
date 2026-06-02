"use client";

import { useState, useRef, useEffect } from "react";
import type React from "react";
import { AnalyticsData } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell,
  CartesianGrid,
} from "recharts";

function fmtUsd(v: number) {
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: number | null | undefined) {
  if (v == null) return "N/A";
  return v.toFixed(2) + "%";
}

// ---------------------------------------------------------------------------
// Custom tooltip for line chart
// ---------------------------------------------------------------------------
function CumulativeTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 mb-1">{label}</p>
      <p className={val >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
        {val >= 0 ? "+" : ""}{fmtUsd(val)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip for bar charts
// ---------------------------------------------------------------------------
function BarTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 mb-1">{label}</p>
      <p className={val >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
        {typeof val === "number" && val <= 1 && val >= 0
          ? fmtPct(val * 100)
          : val >= 0
            ? "+" + fmtUsd(val)
            : fmtUsd(val)}
      </p>
    </div>
  );
}



// ---------------------------------------------------------------------------
// Custom tooltip for distribution histogram
// ---------------------------------------------------------------------------
function DistTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const count = payload[0].value;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 mb-1">{label}</p>
      <p className="text-zinc-100 font-semibold">{count} trade{count !== 1 ? "s" : ""}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary card — compact
// ---------------------------------------------------------------------------
function SummaryCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
  sub?: string;
}) {
  return (
    <div className={`bg-zinc-900/60 border border-zinc-800 border-t-2 rounded-lg px-3 py-3 ${accent ?? "border-t-zinc-700"}`}>
      <p className="text-[9px] uppercase tracking-widest text-slate-400 mb-1.5">{label}</p>
      <div className="text-lg font-semibold tabular-nums text-zinc-100 leading-tight">{value}</div>
      {sub && <p className="text-[9px] text-zinc-600 mt-1">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------
export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  const {
    account_capital: initialAccountCapital,
    total_pnl,
    win_rate,
    avg_hold_days,
    avg_win,
    avg_loss,
    risk_reward_ratio,
    max_drawdown_portfolio,
    worst_trade,
    avg_dte,
    avg_hold_time_ratio,
    cumulative_pnl_over_time,
    pnl_per_trade,
    win_rate_by_ticker,
    trade_count_by_ticker,
    net_pnl_by_ticker,
  } = data;

  const [capitalInput, setCapitalInput] = useState<string>(
    initialAccountCapital != null ? String(initialAccountCapital) : ""
  );

  const distRef = useRef<HTMLDivElement>(null);
  const [distWidth, setDistWidth] = useState(800);

  useEffect(() => {
    if (distRef.current) {
      setDistWidth(distRef.current.offsetWidth);
    }
  }, []);

  const accountCapital = capitalInput !== "" ? parseFloat(capitalInput) : null;
  const roi =
    accountCapital != null && isFinite(accountCapital) && accountCapital > 0
      ? (total_pnl / accountCapital) * 100
      : null;

  // Win rate by ticker — convert dict to array, merge trade counts and net P&L
  const winRateData = Object.entries(win_rate_by_ticker ?? {}).map(([ticker, rate]) => ({
    ticker,
    rate,
    count: (trade_count_by_ticker ?? {})[ticker] ?? 0,
    pnl: net_pnl_by_ticker?.[ticker] ?? null as number | null,
  }));

  // Colour helpers
  const pnlColor = (v: number) => (v >= 0 ? "#34d399" : "#f87171");

  // Null-safe filtered arrays
  const cumulativeData = (cumulative_pnl_over_time ?? []).filter(
    (d) => d != null && d.date != null && d.value != null
  );
  const perTradeData = (pnl_per_trade ?? []).filter(
    (d) => d != null && d.date != null && d.value != null
  );

  // Streak computation from ordered trade history
  const { currentStreak, currentIsWin, maxWinStreak, maxLossStreak } = (() => {
    if (perTradeData.length === 0) {
      return { currentStreak: 0, currentIsWin: true, maxWinStreak: 0, maxLossStreak: 0 };
    }
    let maxW = 0, maxL = 0, runW = 0, runL = 0;
    for (const d of perTradeData) {
      if (d.value >= 0) { runW++; runL = 0; if (runW > maxW) maxW = runW; }
      else              { runL++; runW = 0; if (runL > maxL) maxL = runL; }
    }
    const lastIsWin = perTradeData[perTradeData.length - 1].value >= 0;
    let streak = 1;
    for (let i = perTradeData.length - 2; i >= 0; i--) {
      if ((perTradeData[i].value >= 0) === lastIsWin) streak++;
      else break;
    }
    return { currentStreak: streak, currentIsWin: lastIsWin, maxWinStreak: maxW, maxLossStreak: maxL };
  })();

  // P&L distribution histogram buckets
  const histData = [
    { label: "< -$200",      min: -Infinity, max: -200,     color: "#f87171" },
    { label: "-$200 – $0",   min: -200,      max: 0,        color: "#fca5a5" },
    { label: "$0 – $100",    min: 0,         max: 100,      color: "#6ee7b7" },
    { label: "$100 – $200",  min: 100,       max: 200,      color: "#34d399" },
    { label: "> $200",       min: 200,       max: Infinity, color: "#059669" },
  ].map((b) => ({
    label: b.label,
    count: perTradeData.filter((d) => d.value >= b.min && d.value < b.max).length,
    color: b.color,
  }));

  return (
    <div className="space-y-4">

      {/* Row 1: core KPIs */}
      <div className="grid grid-cols-5 gap-3">
        {/* Account Capital — editable */}
        <div className="bg-zinc-900/60 border border-zinc-800 border-t-2 border-t-violet-500/60 rounded-lg px-3 py-3">
          <p className="text-[9px] uppercase tracking-widest text-slate-400 mb-1.5">Account Capital</p>
          <div className="flex items-center gap-1">
            <span className="text-zinc-500 text-xs">$</span>
            <input
              type="number"
              min="0"
              step="1000"
              value={capitalInput}
              onChange={(e) => setCapitalInput(e.target.value)}
              placeholder="100000"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 font-mono tabular-nums"
            />
          </div>
          {accountCapital != null && !isNaN(accountCapital) && (
            <p className="text-[9px] text-zinc-600 mt-1">{fmtUsd(accountCapital)}</p>
          )}
        </div>

        <SummaryCard
          label="Total P&L"
          value={(total_pnl >= 0 ? "+" : "") + fmtUsd(total_pnl)}
          accent={total_pnl >= 0 ? "border-t-emerald-500/60" : "border-t-red-500/60"}
        />
        <SummaryCard
          label="ROI"
          value={roi != null ? (roi >= 0 ? "+" : "") + fmtPct(roi) : "N/A"}
          accent={roi != null && roi >= 0 ? "border-t-emerald-500/60" : roi != null ? "border-t-red-500/60" : "border-t-zinc-700"}
          sub={accountCapital != null ? "vs account capital" : "set capital above"}
        />
        <SummaryCard
          label="Win Rate"
          value={fmtPct(win_rate)}
          accent="border-t-sky-500/60"
        />
        <SummaryCard
          label="Avg Hold Days"
          value={avg_hold_days.toFixed(1) + "d"}
          accent="border-t-amber-500/60"
        />
      </div>

      {/* Row 2: risk / quality / timing metrics */}
      <div className="grid grid-cols-7 gap-3">
        <SummaryCard
          label="Avg Win"
          value={avg_win != null ? "+" + fmtUsd(avg_win) : "N/A"}
          accent="border-t-emerald-500/60"
        />
        <SummaryCard
          label="Avg Loss"
          value={avg_loss != null ? fmtUsd(avg_loss) : "N/A"}
          accent="border-t-red-500/60"
        />
        <SummaryCard
          label="Risk / Reward"
          value={risk_reward_ratio != null ? risk_reward_ratio.toFixed(2) : "N/A"}
          accent="border-t-violet-500/60"
        />
        <SummaryCard
          label="Portfolio Drawdown"
          value={max_drawdown_portfolio != null ? fmtUsd(max_drawdown_portfolio) : "N/A"}
          accent="border-t-red-500/60"
        />
        <SummaryCard
          label="Worst Trade"
          value={worst_trade != null ? fmtUsd(worst_trade) : "N/A"}
          accent="border-t-red-500/60"
        />
        <SummaryCard
          label="Avg DTE"
          value={avg_dte != null ? avg_dte.toFixed(1) + "d" : "N/A"}
          accent="border-t-zinc-600"
        />
        <SummaryCard
          label="Avg Hold / DTE"
          value={avg_hold_time_ratio != null ? fmtPct(avg_hold_time_ratio * 100) : "N/A"}
          accent="border-t-zinc-600"
        />
      </div>

      {/* Row 2b: streak cards */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          label="Current Streak"
          value={perTradeData.length === 0 ? "N/A" : (currentIsWin ? "W" : "L") + currentStreak}
          accent={perTradeData.length === 0 ? "border-t-zinc-600" : currentIsWin ? "border-t-emerald-500/60" : "border-t-red-500/60"}
        />
        <SummaryCard
          label="Max Win Streak"
          value={maxWinStreak > 0 ? "W" + maxWinStreak : "N/A"}
          accent="border-t-emerald-500/60"
        />
        <SummaryCard
          label="Max Loss Streak"
          value={maxLossStreak > 0 ? "L" + maxLossStreak : "N/A"}
          accent="border-t-red-500/60"
        />
      </div>

      {/* Row 3: Cumulative P&L line chart */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-xs font-semibold text-zinc-300 uppercase tracking-widest">Cumulative P&L Over Time</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          {cumulativeData.length < 2 ? (
            <p className="text-xs text-zinc-500 py-8 text-center">Not enough data</p>
          ) : (
            <div style={{ width: "100%", height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: "#3f3f46" }}
                    tickFormatter={(v: string) => v.slice(0, 10)}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => (v >= 0 ? "+" : "") + "$" + (Math.abs(v) >= 1000 ? (Math.abs(v) / 1000).toFixed(1) + "k" : Math.abs(v).toFixed(0))}
                    width={64}
                  />
                  <Tooltip content={<CumulativeTooltip />} />
                  <ReferenceLine y={0} stroke="#52525b" strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#a78bfa" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 4: P&L per trade bar chart */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-xs font-semibold text-zinc-300 uppercase tracking-widest">P&L per Trade</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          {perTradeData.length === 0 ? (
            <p className="text-xs text-zinc-500 py-8 text-center">No trades</p>
          ) : (
            <div style={{ width: "100%", height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perTradeData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#71717a", fontSize: 9 }}
                    tickLine={false}
                    axisLine={{ stroke: "#3f3f46" }}
                    interval={perTradeData.length > 20 ? Math.floor(perTradeData.length / 10) : 0}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => (v >= 0 ? "+" : "") + "$" + Math.abs(v).toFixed(0)}
                    width={64}
                  />
                  <Tooltip content={<BarTooltip />} />
                  <ReferenceLine y={0} stroke="#52525b" />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {perTradeData.map((entry, i) => (
                      <Cell key={i} fill={pnlColor(entry.value)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 5: Win Rate by Ticker */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-xs font-semibold text-zinc-300 uppercase tracking-widest">Win Rate by Ticker</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          {winRateData.length === 0 ? (
            <p className="text-xs text-zinc-500 py-8 text-center">No trades</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium uppercase tracking-wider text-[10px]">Ticker</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium uppercase tracking-wider text-[10px]">Trades</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium uppercase tracking-wider text-[10px]">Wins</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium uppercase tracking-wider text-[10px]">Losses</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium uppercase tracking-wider text-[10px]">Net P&L</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium uppercase tracking-wider text-[10px]">Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {winRateData.map((row) => {
                  const wins = Math.round((row.rate / 100) * row.count);
                  const losses = row.count - wins;
                  const isGreen = row.rate >= 50;
                  return (
                    <tr key={row.ticker} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className={`py-2 px-3 font-semibold ${isGreen ? "text-emerald-400" : "text-red-400"}`}>{row.ticker}</td>
                      <td className="py-2 px-3 text-right text-zinc-300 tabular-nums">{row.count}</td>
                      <td className="py-2 px-3 text-right text-emerald-400 tabular-nums">{wins}</td>
                      <td className="py-2 px-3 text-right text-red-400 tabular-nums">{losses}</td>
                      <td className={`py-2 px-3 text-right tabular-nums ${row.pnl != null ? (row.pnl >= 0 ? "text-emerald-400" : "text-red-400") : "text-zinc-500"}`}>{row.pnl != null ? (row.pnl >= 0 ? "+" : "") + fmtUsd(row.pnl) : "N/A"}</td>
                      <td className={`py-2 px-3 text-right font-semibold tabular-nums ${isGreen ? "text-emerald-400" : "text-red-400"}`}>{fmtPct(row.rate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Row 6: P&L Distribution histogram */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-xs font-semibold text-zinc-300 uppercase tracking-widest">P&L Distribution</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          {perTradeData.length === 0 ? (
            <p className="text-xs text-zinc-500 py-8 text-center">No trades</p>
          ) : (
            <div ref={distRef} style={{ width: "100%" }}>
              <BarChart width={distWidth} height={200} data={histData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: "#3f3f46" }}
                />
                <YAxis
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={40}
                />
                <Tooltip content={<DistTooltip />} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {histData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
