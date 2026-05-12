"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { PortfolioPosition, RotationCandidate, ThemeEdge, TopTickerByTheme, ChainGraph, ChainNode, ChainEdge, EntryExitSignal, IcPoint, BacktestRow } from "@/lib/api";
import { getEntryExitSignals, getIcValidation, getBacktestResults } from "@/lib/api";
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
} from "recharts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CORE_TICKERS = new Set(["AVGO", "PWR"]);

// Stable color palette for themes (cycles if more themes than colors)
const THEME_COLORS = [
  "#6366f1", // indigo
  "#22d3ee", // cyan
  "#f59e0b", // amber
  "#10b981", // emerald
  "#f43f5e", // rose
  "#a78bfa", // violet
  "#fb923c", // orange
  "#34d399", // green
];

// Named theme color map for Market Overview
const NAMED_THEME_COLORS: Record<string, string> = {
  compute:    "#a78bfa", // purple
  storage:    "#2dd4bf", // teal
  networking: "#60a5fa", // blue
  optics:     "#f59e0b", // amber
  power:      "#fb7185", // coral
};

function namedThemeColor(theme: string): string {
  const key = theme.toLowerCase();
  for (const [k, v] of Object.entries(NAMED_THEME_COLORS)) {
    if (key.includes(k)) return v;
  }
  // fallback: cycle through palette
  const idx = Math.abs(
    theme.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0),
  ) % THEME_COLORS.length;
  return THEME_COLORS[idx];
}

function themeColor(theme: string, themeIndex: Map<string, number>): string {
  if (!themeIndex.has(theme)) {
    themeIndex.set(theme, themeIndex.size);
  }
  return THEME_COLORS[themeIndex.get(theme)! % THEME_COLORS.length];
}

// ---------------------------------------------------------------------------
// Market Overview — Section 0: Market Narrative
// ---------------------------------------------------------------------------

function MarketNarrative({
  themeEdges,
  topTickersByTheme,
}: {
  themeEdges: ThemeEdge[];
  topTickersByTheme: TopTickerByTheme[];
}) {
  // Deduplicate themes, take max avg_momentum_a, sort DESC
  const themeMap = new Map<string, number>();
  for (const e of themeEdges) {
    const prev = themeMap.get(e.theme_a) ?? -Infinity;
    if (e.avg_momentum_a > prev) themeMap.set(e.theme_a, e.avg_momentum_a);
  }
  const themesSorted = Array.from(themeMap.entries())
    .map(([theme, mom]) => ({ theme, mom }))
    .sort((a, b) => b.mom - a.mom);

  if (themesSorted.length === 0) return null;

  const top1 = themesSorted[0];
  const top2 = themesSorted[1] ?? null;
  const weakest = themesSorted[themesSorted.length - 1];
  const medianTheme = themesSorted[Math.floor(themesSorted.length / 2)];

  // Top 2 positive flows
  const topFlows = themeEdges
    .filter((e) => e.momentum_flow > 0)
    .sort((a, b) => b.momentum_flow - a.momentum_flow)
    .slice(0, 2);

  // Watch theme = highest avg_correlation among positive flow edges, theme_b side
  const watchEdge =
    themeEdges
      .filter((e) => e.momentum_flow > 0 && (e.correlation ?? null) != null)
      .sort((a, b) => (b.correlation ?? 0) - (a.correlation ?? 0))[0] ?? null;

  // Helper: top 3 tickers for a given theme
  const tickersFor = (theme: string) =>
    topTickersByTheme
      .filter((t) => t.theme === theme)
      .slice(0, 3)
      .map((t) => t.ticker);

  const fmt = (v: number | null | undefined, dp = 2) =>
    v != null ? v.toFixed(dp) : "—";
  const disp = (s: string | null | undefined) =>
    s ? s.replace(/_/g, " ") : "—";

  const NarrativeLine = ({
    dot,
    dim = false,
    children,
  }: {
    dot: string;
    dim?: boolean;
    children: React.ReactNode;
  }) => (
    <div className={`flex items-start gap-2 font-mono text-sm ${dim ? "text-zinc-400" : "text-zinc-300"}`}>
      <span className="mt-0.5 shrink-0">{dot}</span>
      <span className="leading-relaxed">{children}</span>
    </div>
  );

  const ThemeSpan = ({ theme }: { theme: string }) => (
    <span style={{ color: namedThemeColor(theme) }}>{disp(theme)}</span>
  );

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-mono text-zinc-300">Market Narrative</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Line 1: top1 */}
        <NarrativeLine dot="🟢">
          <ThemeSpan theme={top1.theme} />
          {` นำตลาดด้วย momentum ${fmt(top1.mom)} — top tickers: ${tickersFor(top1.theme).join(", ") || "—"}`}
        </NarrativeLine>

        {/* Line 2: top2 */}
        {top2 && (
          <NarrativeLine dot="🟢">
            <ThemeSpan theme={top2.theme} />
            {` กำลังแรง momentum ${fmt(top2.mom)} — top tickers: ${tickersFor(top2.theme).join(", ") || "—"}`}
          </NarrativeLine>
        )}

        {/* Line 3: top flow[0] */}
        {topFlows[0] && (
          <NarrativeLine dot="🔴">
            {"capital ไหลออกจาก "}
            <ThemeSpan theme={topFlows[0].theme_a} />
            {" → "}
            <ThemeSpan theme={topFlows[0].theme_b} />
            {` ชัดเจน (flow +${fmt(topFlows[0].momentum_flow)})`}
          </NarrativeLine>
        )}

        {/* Line 4: top flow[1] */}
        {topFlows[1] && (
          <NarrativeLine dot="🔴">
            <ThemeSpan theme={topFlows[1].theme_a} />
            {" → "}
            <ThemeSpan theme={topFlows[1].theme_b} />
            {` flow +${fmt(topFlows[1].momentum_flow)} — rotation signal`}
          </NarrativeLine>
        )}

        {/* Line 5: watch edge */}
        {watchEdge && (
          <NarrativeLine dot="🟡">
            <ThemeSpan theme={watchEdge.theme_b} />
            {" น่าจับตา — corr สูงกับ "}
            <ThemeSpan theme={watchEdge.theme_a} />
            {` (${fmt(watchEdge.correlation ?? null)})`}
          </NarrativeLine>
        )}

        {/* Line 6: median */}
        {themesSorted.length >= 3 && (
          <NarrativeLine dot="⚪" dim>
            <ThemeSpan theme={medianTheme.theme} />
            {" ยังทรงตัว — ยังไม่มีสัญญาณ breakout"}
          </NarrativeLine>
        )}

        {/* Line 7: weakest */}
        {themesSorted.length >= 2 && (
          <NarrativeLine dot="⚪" dim>
            <ThemeSpan theme={weakest.theme} />
            {` momentum ต่ำสุด ${fmt(weakest.mom)} — หลีกเลี่ยงในระยะนี้`}
          </NarrativeLine>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Market Overview — Section A: Theme momentum bar chart
// ---------------------------------------------------------------------------

function ThemeMomentumChart({ themeEdges }: { themeEdges: ThemeEdge[] }) {
  if (themeEdges.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 text-zinc-500 text-base">
          No theme momentum data available.
        </CardContent>
      </Card>
    );
  }

  // Aggregate avg_momentum_a per theme_a (take max if duplicated)
  const themeMap = new Map<string, number>();
  for (const e of themeEdges) {
    const prev = themeMap.get(e.theme_a) ?? 0;
    if (e.avg_momentum_a > prev) themeMap.set(e.theme_a, e.avg_momentum_a);
  }
  const themes = [...themeMap.entries()].sort((a, b) => b[1] - a[1]);
  const maxMom = Math.max(...themes.map(([, v]) => v), 1);

  const barH = 22;
  const gap = 8;
  const labelW = 90;
  const chartW = 340;
  const svgH = themes.length * (barH + gap) + 16;

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-mono text-zinc-300">
          Theme Momentum Ranking
        </CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center overflow-x-auto">
        <svg
          viewBox={`0 0 ${labelW + chartW + 60} ${svgH}`}
          width={labelW + chartW + 60}
          height={svgH}
          aria-label="Theme momentum bar chart"
        >
          {themes.map(([theme, val], i) => {
            const y = 8 + i * (barH + gap);
            const barW = (val / maxMom) * chartW;
            const color = namedThemeColor(theme);
            return (
              <g key={theme}>
                <text
                  x={labelW - 6}
                  y={y + barH / 2 + 4}
                  textAnchor="end"
                  fontSize={9}
                  fill="#a1a1aa"
                  fontFamily="monospace"
                >
                  {theme}
                </text>
                <rect
                  x={labelW}
                  y={y}
                  width={Math.max(2, barW)}
                  height={barH}
                  rx={3}
                  fill={color}
                  fillOpacity={0.75}
                />
                <text
                  x={labelW + Math.max(2, barW) + 5}
                  y={y + barH / 2 + 4}
                  fontSize={9}
                  fill={color}
                  fontFamily="monospace"
                >
                  {val != null ? val.toFixed(2) : "—"}
                </text>
              </g>
            );
          })}
        </svg>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Market Overview — Section B: Theme flow table
// ---------------------------------------------------------------------------

function ThemeFlowTable({ themeEdges }: { themeEdges: ThemeEdge[] }) {
  const rows = themeEdges
    .filter((e) => e.momentum_flow > 0.5)
    .sort((a, b) => b.momentum_flow - a.momentum_flow)
    .slice(0, 10);

  const maxFlow = Math.max(...rows.map((r) => r.momentum_flow), 1);
  const BAR_MAX = 120;

  if (rows.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 text-zinc-500 text-base">
          No positive theme flow data available.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-mono text-zinc-300">
          Theme Flow
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800">
              <TableHead className="text-zinc-500 text-sm">From</TableHead>
              <TableHead className="text-zinc-500 text-sm w-4"></TableHead>
              <TableHead className="text-zinc-500 text-sm">To</TableHead>
              <TableHead className="text-zinc-500 text-sm text-right">Flow</TableHead>
              <TableHead className="text-zinc-500 text-sm text-right">Avg Corr</TableHead>
              <TableHead className="text-zinc-500 text-sm">Bar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e, i) => {
              const colorA = namedThemeColor(e.theme_a);
              const colorB = namedThemeColor(e.theme_b);
              const barW = Math.max(2, (e.momentum_flow / maxFlow) * BAR_MAX);
              const avgCorr = e.correlation ?? null;
              return (
                <TableRow key={i} className="border-zinc-800">
                  <TableCell>
                    <span
                      className="inline-block rounded px-1.5 py-0.5 text-xs font-mono font-semibold"
                      style={{ backgroundColor: colorA + "22", color: colorA, border: `1px solid ${colorA}55` }}
                    >
                      {e.theme_a.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-zinc-600 text-sm font-mono">→</TableCell>
                  <TableCell>
                    <span
                      className="inline-block rounded px-1.5 py-0.5 text-xs font-mono font-semibold"
                      style={{ backgroundColor: colorB + "22", color: colorB, border: `1px solid ${colorB}55` }}
                    >
                      {e.theme_b.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-right text-zinc-300 tabular-nums">
                    {e.momentum_flow != null ? e.momentum_flow.toFixed(3) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-right text-zinc-400 tabular-nums">
                    {avgCorr !== null ? avgCorr.toFixed(2) : "—"}
                  </TableCell>
                  <TableCell>
                    <svg width={BAR_MAX} height={12} aria-hidden>
                      <rect x={0} y={2} width={barW} height={8} rx={2} fill={colorA} fillOpacity={0.7} />
                    </svg>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Market Overview — Section C: Top tickers per theme + chain drill-down
// ---------------------------------------------------------------------------

function ChainPanel({ graph, onClose }: { graph: ChainGraph; onClose: () => void }) {
  const MAX_PER_HOP = 3;

  if (graph.nodes.length === 0) {
    return (
      <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950 p-4 text-zinc-500 text-base">
        No chain data returned.
        <button onClick={onClose} className="ml-3 text-zinc-600 hover:text-zinc-400 text-sm underline">
          close
        </button>
      </div>
    );
  }

  // Group nodes by hop, sorted by hop, cap at MAX_PER_HOP per column
  const byHop = new Map<number, ChainNode[]>();
  // Ensure hop 0 root is correctly identified
  for (const n of graph.nodes) {
    const arr = byHop.get(n.hop) ?? [];
    if (arr.length < MAX_PER_HOP) {
      arr.push(n);
      byHop.set(n.hop, arr);
    }
  }
  const hops = [...byHop.keys()].sort((a, b) => a - b);

  // Build edge lookup: target node id → best (highest rotation_score) incoming edge
  const bestIncoming = new Map<string, ChainEdge>();
  for (const e of graph.edges) {
    const existing = bestIncoming.get(e.target);
    if (!existing || e.rotation_score > existing.rotation_score) {
      bestIncoming.set(e.target, e);
    }
  }

  // Per-hop: find the node with the highest incoming rotation_score (to highlight)
  const hopBestTarget = new Map<number, string>();
  for (const hop of hops) {
    if (hop === 0) continue;
    const nodes = byHop.get(hop)!;
    let bestScore = -Infinity;
    let bestId = "";
    for (const n of nodes) {
      const edge = bestIncoming.get(n.id);
      const score = edge?.rotation_score ?? -Infinity;
      if (score > bestScore) { bestScore = score; bestId = n.id; }
    }
    if (bestId) hopBestTarget.set(hop, bestId);
  }

  const HOP_LABELS: Record<number, string> = {
    0: "Hop 0 (root)",
    1: "Hop 1",
    2: "Hop 2",
    3: "Hop 3",
  };

  return (
    <div className="mt-4 rounded-md border border-zinc-700 bg-zinc-950 p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-mono text-zinc-400">
          Chain — hop 0 (root) → right
        </p>
        <button
          onClick={onClose}
          className="text-xs font-mono px-2 py-0.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors uppercase tracking-wide"
        >
          Close
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 0, minWidth: "max-content" }}>
          {hops.map((hop, colIdx) => {
            const nodes = byHop.get(hop)!;
            const isLast = colIdx === hops.length - 1;
            return (
              <div key={hop} style={{ display: "flex", alignItems: "flex-start" }}>
                {/* Column */}
                <div style={{ width: 168 }}>
                  {/* Column header */}
                  <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2 text-center">
                    {HOP_LABELS[hop] ?? `Hop ${hop}`}
                  </p>
                  {/* Node cards */}
                  <div className="space-y-2">
                    {nodes.map((n) => {
                      const color = namedThemeColor(n.theme);
                      const incomingEdge = bestIncoming.get(n.id);
                      const isHighlight = hopBestTarget.get(hop) === n.id;
                      const lowData = n.momentum_score === 0 && n.rs_rank > 400;

                      return (
                        <div
                          key={n.id}
                          className="rounded-md border border-zinc-800 bg-zinc-900 p-2.5 space-y-1.5"
                          style={{
                            borderLeftColor: isHighlight ? "#2dd4bf" : "transparent",
                            borderLeftWidth: isHighlight ? 3 : 1,
                          }}
                        >
                          {/* Ticker + theme badge */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="font-mono font-bold text-base text-zinc-100"
                            >
                              {n.ticker}
                            </span>
                            <span
                              className="text-[9px] font-mono px-1 py-0.5 rounded"
                              style={{
                                backgroundColor: color + "22",
                                color,
                                border: `1px solid ${color}44`,
                              }}
                            >
                              {n.theme}
                            </span>
                          </div>

                          {lowData ? (
                            <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700">
                              low data
                            </span>
                          ) : (
                            <>
                              <p className="text-xs font-mono text-zinc-400">
                                momentum:{" "}
                                <span className="text-zinc-200">
                                  {n.momentum_score != null ? n.momentum_score.toFixed(2) : "—"}
                                </span>
                              </p>

                              {hop === 0 ? (
                                <p className="text-xs font-mono text-zinc-400">
                                  rs_rank:{" "}
                                  <span className="text-zinc-200">#{n.rs_rank}</span>
                                </p>
                              ) : incomingEdge ? (
                                <p className="text-xs font-mono text-zinc-400">
                                  score:{" "}
                                  <span
                                    className="font-semibold"
                                    style={{ color: isHighlight ? "#2dd4bf" : "#e4e4e7" }}
                                  >
                                    {incomingEdge.rotation_score != null ? incomingEdge.rotation_score.toFixed(2) : "—"}
                                  </span>
                                </p>
                              ) : null}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Arrow divider between columns */}
                {!isLast && (
                  <div
                    style={{
                      width: 32,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingTop: 36,
                      flexShrink: 0,
                    }}
                  >
                    <span className="text-zinc-600 text-lg select-none">→</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TopTickersGrid({
  topTickersByTheme,
}: {
  topTickersByTheme: TopTickerByTheme[];
}) {
  const [chainTicker, setChainTicker] = useState<string | null>(null);
  const [chainGraph, setChainGraph] = useState<ChainGraph | null>(null);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainError, setChainError] = useState<string | null>(null);

  async function loadChain(ticker: string) {
    if (chainTicker === ticker) {
      // toggle off
      setChainTicker(null);
      setChainGraph(null);
      return;
    }
    setChainTicker(ticker);
    setChainGraph(null);
    setChainError(null);
    setChainLoading(true);
    try {
      const res = await fetch(
        `/api/rotation/chain?from_ticker=${encodeURIComponent(ticker)}&depth=3`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ChainGraph = await res.json();
      setChainGraph(data);
    } catch (err) {
      setChainError(err instanceof Error ? err.message : "Failed to load chain");
    } finally {
      setChainLoading(false);
    }
  }

  // Group by theme
  const byTheme = new Map<string, TopTickerByTheme[]>();
  for (const item of topTickersByTheme) {
    const arr = byTheme.get(item.theme) ?? [];
    arr.push(item);
    byTheme.set(item.theme, arr);
  }
  const themes = [...byTheme.entries()];

  if (themes.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 text-zinc-500 text-base">
          No top-ticker data available.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-mono text-zinc-300">
          Top Tickers per Theme
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {themes.map(([theme, tickers]) => {
            const color = namedThemeColor(theme);
            return (
              <div
                key={theme}
                className="rounded-md border border-zinc-800 bg-zinc-950 p-4 space-y-2"
                style={{ borderLeftColor: color, borderLeftWidth: 2 }}
              >
                <p
                  className="text-xs font-semibold font-mono uppercase tracking-wide"
                  style={{ color }}
                >
                  {theme}
                </p>
                {tickers.map((t) => (
                  <div key={t.ticker} className="flex items-center gap-1.5">
                    <span className="font-mono text-sm text-zinc-100 flex-1">
                      {t.ticker}
                    </span>
                    <span className="text-xs text-zinc-500">RS#{t.rs_rank}</span>
                    <span className="text-xs text-zinc-400">
                      {t.momentum_score != null ? t.momentum_score.toFixed(1) : "—"}
                    </span>
                    <button
                      onClick={() => loadChain(t.ticker)}
                      className="text-xs font-mono px-1.5 py-0.5 rounded border transition-colors"
                      style={{
                        borderColor: chainTicker === t.ticker ? color : "#3f3f46",
                        color: chainTicker === t.ticker ? color : "#71717a",
                        backgroundColor: chainTicker === t.ticker ? color + "18" : "transparent",
                      }}
                    >
                      {chainTicker === t.ticker && chainLoading ? "…" : "chain"}
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Chain panel — inline below grid */}
        {chainTicker && (
          <>
            {chainLoading && (
              <div className="mt-4 text-zinc-500 text-sm font-mono">
                Loading chain for {chainTicker}…
              </div>
            )}
            {chainError && (
              <div className="mt-4 text-red-400 text-sm font-mono">
                Error: {chainError}
              </div>
            )}
            {chainGraph && !chainLoading && (
              <ChainPanel
                graph={chainGraph}
                onClose={() => { setChainTicker(null); setChainGraph(null); }}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section D — Next Satellite Candidates
// ---------------------------------------------------------------------------

function NextSatelliteSection({
  positions,
  candidatesMap,
  themeEdges,
  topTickersByTheme,
}: {
  positions: PortfolioPosition[];
  candidatesMap: Record<string, RotationCandidate[]>;
  themeEdges: ThemeEdge[];
  topTickersByTheme: TopTickerByTheme[];
}) {
  const portfolioTickers = new Set(positions.map((p) => p.ticker));

  // ── Layer 1: Edge-based ──────────────────────────────────────────────────
  const layer1 = Object.entries(candidatesMap)
    .flatMap(([fromTicker, candidates]) =>
      candidates.map((c) => ({ ...c, from_ticker: fromTicker }))
    )
    .filter((c) => !portfolioTickers.has(c.ticker_b))
    .sort((a, b) => b.rotation_score - a.rotation_score)
    .filter((c, i, arr) => arr.findIndex((x) => x.ticker_b === c.ticker_b) === i)
    .slice(0, 2);

  const usedTickers = new Set(layer1.map((c) => c.ticker_b));

  // ── Layer 2: Theme momentum ──────────────────────────────────────────────
  // Sort themes by avg_momentum_a DESC
  const themeMap = new Map<string, number>();
  for (const e of themeEdges) {
    const prev = themeMap.get(e.theme_a) ?? -Infinity;
    if (e.avg_momentum_a > prev) themeMap.set(e.theme_a, e.avg_momentum_a);
  }
  const sortedThemes = [...themeMap.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);

  const layer2: Array<{ ticker: string; theme: string; rs_rank: number; momentum_score: number; reason: string }> = [];
  for (const theme of sortedThemes) {
    if (layer2.length >= 2) break;
    const tickers = topTickersByTheme
      .filter((t) => t.theme === theme && !portfolioTickers.has(t.ticker) && !usedTickers.has(t.ticker))
      .sort((a, b) => b.momentum_score - a.momentum_score);
    for (const t of tickers) {
      if (layer2.length >= 2) break;
      const mom = t.momentum_score != null ? t.momentum_score.toFixed(2) : "—";
      layer2.push({
        ticker: t.ticker,
        theme: t.theme,
        rs_rank: t.rs_rank,
        momentum_score: t.momentum_score,
        reason: `${t.theme.replace(/_/g, " ")} momentum ${mom} — theme กำลังแรง`,
      });
      usedTickers.add(t.ticker);
    }
  }

  // ── Layer 3: Universe scan ───────────────────────────────────────────────
  const allMom = topTickersByTheme.map((t) => t.momentum_score).filter((v) => v != null) as number[];
  const maxMom = Math.max(...allMom, 1);

  const layer3 = topTickersByTheme
    .filter((t) => !portfolioTickers.has(t.ticker) && !usedTickers.has(t.ticker))
    .map((t) => {
      const momNorm = (t.momentum_score ?? 0) / maxMom;
      const composite = (1 / Math.max(t.rs_rank, 1)) * 0.6 + momNorm * 0.4;
      return { ...t, composite };
    })
    .sort((a, b) => b.composite - a.composite)
    .slice(0, 2)
    .map((t) => ({
      ticker: t.ticker,
      theme: t.theme,
      rs_rank: t.rs_rank,
      momentum_score: t.momentum_score,
      composite: t.composite,
      reason: `RS#${t.rs_rank} · momentum ${t.momentum_score != null ? t.momentum_score.toFixed(2) : "—"} — composite score ${t.composite.toFixed(3)}`,
    }));

  // ── Shared row renderer ──────────────────────────────────────────────────
  type AnyRow = { ticker: string; theme: string; rs_rank: number; momentum_score: number | null; score?: string; reason: string };

  const CandidateRow = ({ row }: { row: AnyRow }) => {
    const color = namedThemeColor(row.theme);
    return (
      <TableRow className="border-zinc-800">
        <TableCell className="font-mono font-bold text-sm text-zinc-100">{row.ticker}</TableCell>
        <TableCell>
          <span
            className="inline-block rounded px-1.5 py-0.5 text-xs font-mono font-semibold"
            style={{ backgroundColor: color + "22", color, border: `1px solid ${color}55` }}
          >
            {row.theme.replace(/_/g, " ")}
          </span>
        </TableCell>
        <TableCell className="text-sm text-right text-zinc-400">#{row.rs_rank}</TableCell>
        <TableCell className="text-sm text-right text-zinc-300">
          {row.momentum_score != null ? row.momentum_score.toFixed(2) : "—"}
        </TableCell>
        <TableCell className="text-sm text-right font-semibold text-zinc-100">{row.score ?? "—"}</TableCell>
        <TableCell className="text-xs text-zinc-500 font-mono max-w-50 truncate">{row.reason}</TableCell>
      </TableRow>
    );
  };

  const EmptyRow = () => (
    <TableRow className="border-zinc-800">
      <TableCell colSpan={6} className="text-sm text-zinc-600 font-mono py-3">—</TableCell>
    </TableRow>
  );

  const LayerHeader = ({ label }: { label: string }) => (
    <TableRow className="border-zinc-800 bg-zinc-950">
      <TableCell colSpan={6} className="text-xs text-zinc-500 font-mono py-2 italic">{label}</TableCell>
    </TableRow>
  );

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-1">
        <CardTitle className="text-base font-mono text-zinc-300">Next Satellite Candidates</CardTitle>
        <p className="text-xs text-zinc-500 font-mono mt-0.5">ถ้าจะเพิ่มหรือเปลี่ยน satellite ตอนนี้</p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800">
              <TableHead className="text-zinc-500 text-sm">Ticker</TableHead>
              <TableHead className="text-zinc-500 text-sm">Theme</TableHead>
              <TableHead className="text-zinc-500 text-sm text-right">RS#</TableHead>
              <TableHead className="text-zinc-500 text-sm text-right">Mom</TableHead>
              <TableHead className="text-zinc-500 text-sm text-right">Score</TableHead>
              <TableHead className="text-zinc-500 text-sm">Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Layer 1 */}
            <LayerHeader label="Edge-based — correlated กับ satellite ปัจจุบัน" />
            {layer1.length > 0
              ? layer1.map((c) => (
                  <CandidateRow
                    key={c.ticker_b}
                    row={{
                      ticker: c.ticker_b,
                      theme: c.theme_b,
                      rs_rank: c.rs_rank,
                      momentum_score: c.momentum_score,
                      score: c.rotation_score != null ? c.rotation_score.toFixed(2) : "—",
                      reason: `rotation score ${c.rotation_score != null ? c.rotation_score.toFixed(2) : "—"} จาก ${c.from_ticker} — ${c.theme_b.replace(/_/g, " ")} momentum ${c.momentum_score != null ? c.momentum_score.toFixed(2) : "—"}`,
                    }}
                  />
                ))
              : <EmptyRow />}

            {/* Layer 2 */}
            <LayerHeader label="Theme momentum — theme ที่แรงสุดตอนนี้" />
            {layer2.length > 0
              ? layer2.map((r) => (
                  <CandidateRow
                    key={r.ticker}
                    row={{ ticker: r.ticker, theme: r.theme, rs_rank: r.rs_rank, momentum_score: r.momentum_score, reason: r.reason }}
                  />
                ))
              : <EmptyRow />}

            {/* Layer 3 */}
            <LayerHeader label="Universe scan — RS + momentum composite" />
            {layer3.length > 0
              ? layer3.map((r) => (
                  <CandidateRow
                    key={r.ticker}
                    row={{ ticker: r.ticker, theme: r.theme, rs_rank: r.rs_rank, momentum_score: r.momentum_score, reason: r.reason }}
                  />
                ))
              : <EmptyRow />}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Median helper
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Portfolio row type (computed in page.tsx, displayed here)
// ---------------------------------------------------------------------------

export interface PortfolioRow {
  ticker: string;
  shares: number;
  entry_price: number;
  invested_usd: number;
  current_price: number | null;
  market_value: number | null;
  pnl_dollar: number | null;
  pnl_pct: number | null;
  momentum_score: number | null;
  label: string;
}

function fmtUsd(v: number | null): string {
  if (v === null) return "—";
  return "$" + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}

// ---------------------------------------------------------------------------
// Section A — Portfolio status
// ---------------------------------------------------------------------------

function PortfolioStatus({
  positions,
  portfolioRows,
  candidatesMap,
  medianMomentum,
  topTickersByTheme,
  entryExitData,
  signalLoading,
}: {
  positions: PortfolioPosition[];
  portfolioRows: PortfolioRow[];
  candidatesMap: Record<string, RotationCandidate[]>;
  medianMomentum: number;
  topTickersByTheme: TopTickerByTheme[];
  entryExitData: EntryExitSignal[];
  signalLoading: boolean;
}) {
  if (positions.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 text-zinc-500 text-base">
          No portfolio holdings found.
        </CardContent>
      </Card>
    );
  }

  const rowMap = new Map(portfolioRows.map((r) => [r.ticker, r]));
  const tickerInfoMap = new Map(topTickersByTheme.map((t) => [t.ticker, t]));
  const exitSignalMap = new Map(entryExitData.map((s) => [s.ticker, s.exit_signal]));
  const portfolioTickers = new Set(positions.map((p) => p.ticker));
  // Best replacement not already in portfolio (for EXIT recommendation)
  const recTicker = topTickersByTheme.find((t) => !portfolioTickers.has(t.ticker));

  // Portfolio health summary
  const totalPnlDollar = portfolioRows.reduce((s, r) => s + (r.pnl_dollar ?? 0), 0);
  const totalInvested = portfolioRows.reduce((s, r) => s + r.invested_usd, 0);
  const totalPnlPct = totalInvested > 0 ? (totalPnlDollar / totalInvested) * 100 : 0;
  const coreCount = positions.filter((p) => CORE_TICKERS.has(p.ticker)).length;
  const satelliteCount = positions.filter((p) => !CORE_TICKERS.has(p.ticker)).length;
  const exitCount = positions.filter((p) => {
    if (CORE_TICKERS.has(p.ticker)) return false;
    const r = rowMap.get(p.ticker);
    const pnl = r?.pnl_pct ?? null;
    return (
      (candidatesMap[p.ticker]?.length ?? 0) === 0 ||
      (pnl !== null && pnl < -15) ||
      (pnl !== null && pnl > 30)
    );
  }).length;
  const watchCount = positions.filter((p) => {
    if (CORE_TICKERS.has(p.ticker)) return false;
    const r = rowMap.get(p.ticker);
    const pnl = r?.pnl_pct ?? null;
    return pnl !== null && pnl >= 10 && pnl <= 30;
  }).length;

  return (
    <div className="space-y-3">
      {/* Portfolio health summary */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4">
          <p className="text-xs font-mono text-zinc-300">
            {"Total P\u0026L: "}
            <span className={totalPnlDollar >= 0 ? "text-emerald-400" : "text-red-400"}>
              {totalPnlDollar >= 0 ? "+" : "\u2212"}{fmtUsd(totalPnlDollar)}{" "}
              ({totalPnlDollar >= 0 ? "+" : ""}{totalPnlPct.toFixed(1)}%)
            </span>
            {` \u00b7 ${coreCount} core \u00b7 ${satelliteCount} satellite`}
            {exitCount > 0 && <span className="text-red-400">{` \u00b7 \u26a0\ufe0f ${exitCount} EXIT`}</span>}
            {watchCount > 0 && <span className="text-amber-400">{` \u00b7 ${watchCount} WATCH`}</span>}
          </p>
        </CardContent>
      </Card>
      {positions.map((pos) => {
        const isCore = CORE_TICKERS.has(pos.ticker);
        const row = rowMap.get(pos.ticker);
        const candidates = candidatesMap[pos.ticker] ?? [];
        const topCandidate = candidates[0] ?? null;
        const inUniverse = candidates.length > 0;
        const info = tickerInfoMap.get(pos.ticker);
        const theme = info?.theme ?? null;
        const rsRank = info?.rs_rank ?? null;
        const currentMomentum = row?.momentum_score ?? info?.momentum_score ?? null;
        const pnlPct = row?.pnl_pct ?? null;
        const pnlDollar = row?.pnl_dollar ?? null;

        // While signals are loading, show neutral placeholder for non-core positions
        if (!isCore && signalLoading) {
          return (
            <Card key={pos.ticker} className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold font-mono text-zinc-100">{pos.ticker}</span>
                  <Badge variant="outline" className="text-[10px] bg-zinc-800 text-zinc-500 border-zinc-700">…</Badge>
                </div>
                {pnlPct !== null && (
                  <p className="text-xs font-mono text-zinc-400">
                    P&amp;L: <span className={pnlPct >= 0 ? "text-emerald-400" : "text-red-400"}>{pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%</span>
                  </p>
                )}
                <p className="text-[11px] text-zinc-600">Loading signal…</p>
              </CardContent>
            </Card>
          );
        }

        // Action — priority: P&L thresholds first, then exit_signal from signal data
        const exitSig = !isCore ? exitSignalMap.get(pos.ticker) : undefined;
        type ActionType = "core" | "hold" | "hold_watch" | "suggest_exit" | "exit_no_universe" | "exit_15" | "exit_10" | "exit_immediate" | "exit_warn";
        let action: ActionType;
        let actionLabel = "";
        if (isCore) {
          action = "core"; actionLabel = "CORE";
        } else if (!inUniverse) {
          action = "exit_no_universe"; actionLabel = "EXIT (no universe)";
        } else if (pnlPct !== null && pnlPct >= 15) {
          action = "exit_15"; actionLabel = "EXIT +15%";
        } else if (pnlPct !== null && pnlPct >= 10 && exitSig !== "HOLD") {
          action = "exit_10"; actionLabel = "EXIT +10%";
        } else if (pnlPct !== null && pnlPct >= 10 && exitSig === "HOLD") {
          action = "suggest_exit"; actionLabel = "SUGGEST EXIT";
        } else if (exitSig === "EXIT_IMMEDIATE") {
          action = "exit_immediate"; actionLabel = "EXIT";
        } else if (exitSig === "EXIT_WARN") {
          action = "exit_warn"; actionLabel = "EXIT WARN";
        } else if (exitSig === "HOLD_WATCH") {
          action = "hold_watch"; actionLabel = "HOLD WATCH";
        } else {
          action = "hold"; actionLabel = "HOLD";
        }

        // Narrative
        let narrative = "";
        if (isCore) {
          narrative = "core position — ไม่ rotate, ถือระยะยาว";
        } else if (action === "exit_no_universe") {
          narrative = "ไม่อยู่ใน AI infra universe — พิจารณาสับเปลี่ยนไปยังตัวที่มี rotation edges";
        } else if (action === "exit_15" || action === "exit_10") {
          narrative = `ทำกำไรได้ +${(pnlPct ?? 0).toFixed(1)}% — ควรออกและ rotate`;
        } else if (action === "suggest_exit") {
          narrative = `P&L +${(pnlPct ?? 0).toFixed(1)}% — signal บอก HOLD แต่ถึง target zone แล้ว พิจารณา rotate`;
        } else if (action === "exit_immediate" || action === "exit_warn") {
          narrative = `signal ${exitSig ?? ""} — พิจารณาออกจากตัวนี้`;
        } else if (action === "hold_watch") {
          narrative = "signal HOLD_WATCH — จับตาดูใกล้ชิด";
        } else {
          // HOLD
          const rsStr = rsRank !== null ? `RS#${rsRank}` : null;
          const themeStr = theme ? `theme ${theme} ยังนำตลาด` : null;
          const progressStr = pnlPct !== null
            ? `Progress: ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}% → target +10% (เหลืออีก ~${Math.max(0, 10 - pnlPct).toFixed(1)}%)`
            : null;
          narrative = [progressStr, rsStr, themeStr].filter(Boolean).join(" · ");
        }

        return (
          <Card key={pos.ticker} className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4 space-y-1.5">
              {/* Row 1: ticker + role + action */}
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-lg text-zinc-100">
                  {pos.ticker}
                </span>
                {isCore ? (
                  <Badge variant="outline" className="text-xs bg-sky-500/10 text-sky-400 border-sky-500/30">
                    core
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs bg-violet-500/10 text-violet-400 border-violet-500/30">
                    satellite
                  </Badge>
                )}
                <div className="ml-auto">
                  {action === "core" && (
                    <Badge variant="outline" className="text-xs bg-zinc-500/15 text-zinc-400 border-zinc-500/30">
                      CORE
                    </Badge>
                  )}
                  {action === "hold" && (
                    <Badge variant="outline" className="text-xs bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                      HOLD
                    </Badge>
                  )}
                  {action === "hold_watch" && (
                    <Badge variant="outline" className="text-xs bg-amber-400/15 text-amber-300 border-amber-400/30">
                      HOLD WATCH
                    </Badge>
                  )}
                  {action === "suggest_exit" && (
                    <Badge variant="outline" className="text-xs bg-amber-500/15 text-amber-400 border-amber-500/30">
                      SUGGEST EXIT
                    </Badge>
                  )}
                  {action === "exit_warn" && (
                    <Badge variant="outline" className="text-xs bg-orange-500/15 text-orange-400 border-orange-500/30">
                      EXIT WARN
                    </Badge>
                  )}
                  {(action === "exit_15" || action === "exit_10" || action === "exit_immediate" || action === "exit_no_universe") && (
                    <Badge variant="outline" className="text-xs bg-red-500/15 text-red-400 border-red-500/30">
                      {actionLabel}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Row 2: theme · RS# · momentum (satellites only) */}
              {!isCore && (
                <p className="text-xs font-mono text-zinc-500">
                  {!inUniverse
                    ? "ไม่อยู่ใน AI infra universe"
                    : [
                        theme,
                        rsRank !== null ? `RS#${rsRank}` : null,
                        currentMomentum !== null ? `momentum ${currentMomentum.toFixed(2)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                </p>
              )}

              {/* Row 3: P&L */}
              {row && (
                <p className="text-xs font-mono text-zinc-400">
                  {"P&L: "}
                  <span className={(pnlDollar ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {(pnlDollar ?? 0) >= 0 ? "+" : "−"}{fmtUsd(pnlDollar)}{" "}
                    ({fmtPct(pnlPct)})
                  </span>
                  {" · value "}{fmtUsd(row.market_value)}
                  {" · entry $"}{pos.entry_price != null ? pos.entry_price.toFixed(0) : "—"}
                </p>
              )}

              {/* Row 4: narrative */}
              {narrative && (
                <p className="text-xs text-zinc-500 italic leading-relaxed">
                  &ldquo;{narrative}&rdquo;
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section B — Candidates table
// ---------------------------------------------------------------------------

function CandidatesTable({
  satellites,
  candidatesMap,
  selected,
  onSelect,
  entryExitData,
}: {
  satellites: PortfolioPosition[];
  candidatesMap: Record<string, RotationCandidate[]>;
  selected: string;
  onSelect: (ticker: string) => void;
  entryExitData: EntryExitSignal[];
}) {
  const candidates = (candidatesMap[selected] ?? []).slice(0, 5);
  const entrySignalMap = new Map(entryExitData.map((s) => [s.ticker, s.entry_signal]));

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2 flex flex-row items-center gap-3">
        <CardTitle className="text-base font-mono text-zinc-300 flex-1">
          Rotation Candidates
        </CardTitle>
        {satellites.length > 1 && (
          <Select value={selected} onValueChange={onSelect}>
            <SelectTrigger className="w-32 h-7 text-sm bg-zinc-800 border-zinc-700 text-zinc-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              {satellites.map((s) => (
                <SelectItem
                  key={s.ticker}
                  value={s.ticker}
                  className="text-sm text-zinc-200"
                >
                  {s.ticker}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {candidates.length === 0 ? (
          <p className="p-4 text-zinc-500 text-base">
            No candidates available for {selected}.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800">
                <TableHead className="text-zinc-500 text-sm">#</TableHead>
                <TableHead className="text-zinc-500 text-sm">Ticker</TableHead>
                <TableHead className="text-zinc-500 text-sm">Signal</TableHead>
                <TableHead className="text-zinc-500 text-sm">Theme</TableHead>
                <TableHead className="text-zinc-500 text-sm text-right">
                  Corr W
                </TableHead>
                <TableHead className="text-zinc-500 text-sm text-right">
                  RS Rank
                </TableHead>
                <TableHead className="text-zinc-500 text-sm text-right">
                  Mom Score
                </TableHead>
                <TableHead className="text-zinc-500 text-sm text-right">
                  Theme Mom
                </TableHead>
                <TableHead className="text-zinc-500 text-sm text-right">
                  Rot Score
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((c, idx) => (
                <TableRow
                  key={c.ticker_b}
                  className={
                    idx === 0
                      ? "border-b border-zinc-800 border-l-2 border-l-amber-400 bg-amber-950/20"
                      : "border-zinc-800 opacity-70"
                  }
                >
                  <TableCell className={`text-sm ${idx === 0 ? "text-amber-400 font-semibold" : "text-zinc-500"}`}>{idx + 1}</TableCell>
                  <TableCell className={`font-mono text-sm font-bold ${idx === 0 ? "text-zinc-50" : "text-zinc-300"}`}>
                    <span className="flex items-center gap-2">
                      {c.ticker_b}
                      {idx === 0 && (
                        <Badge variant="outline" className="text-xs font-mono bg-amber-500/10 text-amber-300 border-amber-500/40 py-0">
                          ★ Top Pick
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const sig = entrySignalMap.get(c.ticker_b);
                      if (!sig) return <span className="text-zinc-600 text-xs">—</span>;
                      const cls =
                        sig === "ENTRY"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : sig === "WATCH"
                            ? "bg-amber-400/20 text-amber-300 border-amber-500/40"
                            : "bg-zinc-500/15 text-zinc-400 border-zinc-600/40";
                      return (
                        <Badge variant="outline" className={`text-xs font-mono ${cls}`}>
                          {sig}
                        </Badge>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-sm text-zinc-400">
                    {c.theme_b || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-right text-zinc-300">
                    {c.correlation_60d != null ? c.correlation_60d.toFixed(2) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-right text-zinc-300">
                    {c.rs_rank}
                  </TableCell>
                  <TableCell className="text-sm text-right text-zinc-300">
                    {c.momentum_score != null ? c.momentum_score.toFixed(2) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-right text-zinc-300">
                    {c.theme_momentum != null ? c.theme_momentum.toFixed(2) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-right font-semibold text-zinc-100">
                    {c.rotation_score != null ? c.rotation_score.toFixed(2) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section C — SVG relationship graph
// ---------------------------------------------------------------------------

function RelationshipGraph({
  satellite,
  candidates,
}: {
  satellite: string;
  candidates: RotationCandidate[];
}) {
  const themeIndex = new Map<string, number>();
  const W = 320;
  const H = 300;
  const cx = W / 2;
  const cy = H / 2;
  const radius = 100;
  const top5 = candidates.slice(0, 5);

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-mono text-zinc-300">
          Relationship Graph — {satellite}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center">
        {top5.length === 0 ? (
          <p className="py-8 text-zinc-500 text-base">
            No candidates to visualise.
          </p>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width={W}
            height={H}
            aria-label={`Rotation graph for ${satellite}`}
          >
            {/* Edges */}
            {top5.map((c, i) => {
              const angle = (2 * Math.PI * i) / top5.length - Math.PI / 2;
              const nx = cx + radius * Math.cos(angle);
              const ny = cy + radius * Math.sin(angle);
              const strokeW = Math.max(
                0.5,
                Math.abs(c.correlation_60d) * 5,
              );
              return (
                <line
                  key={c.ticker_b}
                  x1={cx}
                  y1={cy}
                  x2={nx}
                  y2={ny}
                  stroke="#52525b"
                  strokeWidth={strokeW}
                  strokeOpacity={0.7}
                />
              );
            })}

            {/* Candidate nodes */}
            {top5.map((c, i) => {
              const angle = (2 * Math.PI * i) / top5.length - Math.PI / 2;
              const nx = cx + radius * Math.cos(angle);
              const ny = cy + radius * Math.sin(angle);
              const color = themeColor(c.theme_b, themeIndex);
              return (
                <g key={c.ticker_b}>
                  <circle cx={nx} cy={ny} r={22} fill={color} fillOpacity={0.2} stroke={color} strokeWidth={1.5} />
                  <text
                    x={nx}
                    y={ny - 4}
                    textAnchor="middle"
                    fontSize={9}
                    fill={color}
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {c.ticker_b}
                  </text>
                  <text
                    x={nx}
                    y={ny + 7}
                    textAnchor="middle"
                    fontSize={7}
                    fill="#a1a1aa"
                    fontFamily="monospace"
                  >
                    {c.rotation_score != null ? c.rotation_score.toFixed(1) : ""}
                  </text>
                </g>
              );
            })}

            {/* Centre (satellite) node */}
            <circle cx={cx} cy={cy} r={26} fill="#3f3f46" stroke="#71717a" strokeWidth={1.5} />
            <text
              x={cx}
              y={cy + 4}
              textAnchor="middle"
              fontSize={11}
              fill="#f4f4f5"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {satellite}
            </text>

            {/* Legend */}
            {[...themeIndex.entries()].map(([theme, idx], i) => (
              <g key={theme} transform={`translate(8, ${H - 12 - i * 14})`}>
                <rect width={8} height={8} rx={2} fill={THEME_COLORS[idx % THEME_COLORS.length]} />
                <text x={11} y={7} fontSize={7} fill="#a1a1aa" fontFamily="monospace">
                  {theme}
                </text>
              </g>
            ))}
          </svg>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Signal Quality tab
// ---------------------------------------------------------------------------

function SignalQualityTab({
  icPoints,
  backtestRows,
  loading,
}: {
  icPoints: IcPoint[];
  backtestRows: BacktestRow[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="text-zinc-500 text-sm font-mono py-8 text-center">
        Loading signal quality data…
      </div>
    );
  }

  const safeIcPoints = icPoints ?? [];

  // Pivot long→wide: one row per date with ic_5d and ic_10d columns
  type IcWidePoint = { date: string; ic_5d: number | null; ic_10d: number | null };
  const icWideMap = new Map<string, IcWidePoint>();
  for (const pt of safeIcPoints) {
    const dateKey = pt.date.slice(0, 10);
    if (!icWideMap.has(dateKey)) icWideMap.set(dateKey, { date: dateKey, ic_5d: null, ic_10d: null });
    const row = icWideMap.get(dateKey)!;
    if (pt.horizon === 5) row.ic_5d = pt.ic;
    if (pt.horizon === 10) row.ic_10d = pt.ic;
  }
  const icWide = Array.from(icWideMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  // Filter backtest to horizon=5 only, sorted by date
  const btPoints = (backtestRows ?? [])
    .filter((r) => r.horizon === 5)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (icWide.length === 0 && btPoints.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 text-zinc-500 text-base">
          No signal quality data available.
        </CardContent>
      </Card>
    );
  }

  // Compute summary stats from horizon=5 rows where n_entry > 0
  const activeRows = btPoints.filter((r) => r.n_entry > 0 && r.spread_entry_wait != null);
  const spreads = activeRows.map((r) => r.spread_entry_wait as number);
  const meanSpread = spreads.length > 0 ? spreads.reduce((a, b) => a + b, 0) / spreads.length : null;
  const winRate = spreads.length > 0 ? spreads.filter((s) => s > 0).length / spreads.length : null;
  const sharpe = (() => {
    if (spreads.length < 2 || meanSpread == null) return null;
    const variance = spreads.reduce((acc, s) => acc + (s - meanSpread) ** 2, 0) / spreads.length;
    const std = Math.sqrt(variance);
    return std === 0 ? null : (meanSpread / std) * Math.sqrt(12);
  })();

  const fmtPct = (v: number | null) => v != null ? (v * 100).toFixed(1) + "%" : "—";
  const fmtNum = (v: number | null, dp = 2) => v != null ? v.toFixed(dp) : "—";
  const shortDate = (d: string) => d.slice(0, 7);

  const ic5dColor = "#34d399";
  const ic10dColor = "#60a5fa";

  // Bar chart data: use spread_entry_wait if not null, else 0 (gray = no ENTRY signal)
  const barData = btPoints.map((r) => ({
    date: r.date,
    spread: r.spread_entry_wait ?? 0,
    hasEntry: r.n_entry > 0 && r.spread_entry_wait != null,
    n_entry: r.n_entry,
  }));

  const CustomBarTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: typeof barData[number] }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs font-mono text-zinc-200">
        <p className="text-zinc-400 mb-1">{label}</p>
        {row.hasEntry ? (
          <p className={row.spread >= 0 ? "text-emerald-400" : "text-red-400"}>
            Spread: {row.spread >= 0 ? "+" : ""}{(row.spread * 100).toFixed(2)}%
          </p>
        ) : (
          <p className="text-zinc-500">No ENTRY signals this period</p>
        )}
        <p className="text-zinc-400">n_entry: {row.n_entry}</p>
      </div>
    );
  };

  const CustomIcTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs font-mono text-zinc-200">
        <p className="text-zinc-400 mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value.toFixed(3)}</p>
        ))}
      </div>
    );
  };

  const NEntryLabel = (props: { x?: number; y?: number; width?: number; index?: number }) => {
    const { x = 0, y = 0, width = 0, index = 0 } = props;
    const row = barData[index];
    if (!row || row.n_entry === 0) return null;
    return (
      <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="#71717a" fontFamily="monospace">
        {row.n_entry}
      </text>
    );
  };

  const hasSummary = meanSpread != null || winRate != null || sharpe != null;

  return (
    <div className="space-y-6">
      {hasSummary && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4 text-center">
              <p className="text-xs font-mono text-zinc-500 mb-1">Mean Spread 5d</p>
              <p className={`text-2xl font-bold font-mono tabular-nums ${(meanSpread ?? 0) >= 0.005 ? "text-emerald-400" : "text-zinc-300"}`}>
                {fmtPct(meanSpread)}
              </p>
              <p className="text-xs font-mono text-zinc-600 mt-1">{activeRows.length} active periods</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4 text-center">
              <p className="text-xs font-mono text-zinc-500 mb-1">Sharpe (ann.)</p>
              <p className={`text-2xl font-bold font-mono tabular-nums ${(sharpe ?? 0) >= 1 ? "text-emerald-400" : (sharpe ?? 0) >= 0 ? "text-zinc-300" : "text-red-400"}`}>
                {fmtNum(sharpe)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4 text-center">
              <p className="text-xs font-mono text-zinc-500 mb-1">Win Rate 5d</p>
              <p className={`text-2xl font-bold font-mono tabular-nums ${(winRate ?? 0) >= 0.55 ? "text-emerald-400" : "text-zinc-300"}`}>
                {fmtPct(winRate)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {icWide.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-mono text-zinc-300">IC Walk-Forward</CardTitle>
            <p className="text-xs font-mono text-zinc-500">Information Coefficient over time — higher = better predictive signal</p>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={icWide} margin={{ top: 8, right: 80, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10, fill: "#71717a", fontFamily: "monospace" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#71717a", fontFamily: "monospace" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v.toFixed(2)} width={40} />
                <Tooltip content={<CustomIcTooltip />} />
                <ReferenceLine y={0} stroke="#52525b" strokeDasharray="3 3" />
                <ReferenceLine y={0.05} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: "Acceptable", position: "right", fontSize: 9, fill: "#fbbf24", fontFamily: "monospace" }} />
                <ReferenceLine y={0.10} stroke="#34d399" strokeDasharray="4 4" label={{ value: "Good", position: "right", fontSize: 9, fill: "#34d399", fontFamily: "monospace" }} />
                <Line type="monotone" dataKey="ic_5d" name="IC 5d" stroke={ic5dColor} strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="ic_10d" name="IC 10d" stroke={ic10dColor} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 justify-end mt-1">
              <span className="text-xs font-mono text-zinc-400"><span style={{ color: ic5dColor }}>■</span> IC 5d</span>
              <span className="text-xs font-mono text-zinc-400"><span style={{ color: ic10dColor }}>■</span> IC 10d</span>
            </div>
          </CardContent>
        </Card>
      )}

      {barData.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-mono text-zinc-300">Backtest Spread per Period (horizon=5d)</CardTitle>
            <p className="text-xs font-mono text-zinc-500">ENTRY avg return − WAIT avg return · bar label = n_entry · gray = no ENTRY signals</p>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10, fill: "#71717a", fontFamily: "monospace" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#71717a", fontFamily: "monospace" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v * 100).toFixed(1) + "%"} width={48} />
                <Tooltip content={<CustomBarTooltip />} />
                <ReferenceLine y={0} stroke="#52525b" />
                <Bar dataKey="spread" radius={[2, 2, 0, 0]} label={<NEntryLabel />}>
                  {barData.map((p, i) => (
                    <Cell key={i} fill={!p.hasEntry ? "#52525b" : p.spread >= 0 ? "#34d399" : "#f87171"} fillOpacity={p.hasEntry ? 0.75 : 0.4} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entry / Exit Signals tab
// ---------------------------------------------------------------------------

function entrySignalClass(signal: string): string {
  const s = signal.toUpperCase();
  if (s === "ENTRY") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (s === "WATCH") return "bg-amber-400/20 text-amber-300 border-amber-500/40";
  return "bg-zinc-500/15 text-zinc-400 border-zinc-600/40";
}

function exitSignalClass(signal: string): string {
  const s = signal.toUpperCase();
  if (s === "EXIT_IMMEDIATE") return "bg-red-500/20 text-red-300 border-red-500/40";
  if (s === "EXIT_WARN") return "bg-orange-500/20 text-orange-300 border-orange-500/40";
  if (s === "HOLD_WATCH") return "bg-amber-400/20 text-amber-300 border-amber-500/40";
  if (s === "HOLD") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  return "bg-zinc-500/15 text-zinc-400 border-zinc-600/40";
}

const ENTRY_ORDER: Record<string, number> = { ENTRY: 0, WATCH: 1, WAIT: 2 };
const EXIT_ORDER: Record<string, number> = { EXIT_IMMEDIATE: 0, EXIT_WARN: 1, HOLD_WATCH: 2, HOLD: 3 };

function EntryExitTab({
  data,
  date,
  loading,
  topTickersByTheme,
}: {
  data: EntryExitSignal[];
  date: string | null;
  loading: boolean;
  topTickersByTheme: TopTickerByTheme[];
}) {
  const [entryFilter, setEntryFilter] = useState<string | null>("ENTRY");
  // "URGENT" = EXIT_IMMEDIATE + EXIT_WARN combined
  const [exitFilter, setExitFilter] = useState<string | null>("URGENT");
  const [showLegend, setShowLegend] = useState(false);

  if (loading) {
    return (
      <div className="text-zinc-500 text-sm font-mono py-8 text-center">
        Loading entry/exit signals…
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 text-zinc-500 text-base">
          No entry/exit signal data available.
        </CardContent>
      </Card>
    );
  }

  const themeMap = new Map(topTickersByTheme.map((t) => [t.ticker, t.theme]));

  // Rank map: ranks only ENTRY-signal rows, stable regardless of active filter
  const entryRankMap = new Map<string, number>(
    [...data]
      .filter((s) => s.entry_signal === "ENTRY" && s.entry_score != null)
      .sort((a, b) => {
        const scoreDiff = (b.entry_score ?? 0) - (a.entry_score ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        return (b.momentum_delta ?? 0) - (a.momentum_delta ?? 0);
      })
      .map((s, i) => [s.ticker, i + 1]),
  );

  const entryRows = [...data]
    .filter((s) => s.entry_score != null)
    .filter((s) => !entryFilter || s.entry_signal === entryFilter)
    .sort((a, b) => {
      const oa = ENTRY_ORDER[a.entry_signal ?? ""] ?? 99;
      const ob = ENTRY_ORDER[b.entry_signal ?? ""] ?? 99;
      if (oa !== ob) return oa - ob;
      const scoreDiff = (b.entry_score ?? 0) - (a.entry_score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.momentum_delta ?? 0) - (a.momentum_delta ?? 0);
    });

  const exitRows = [...data]
    .filter((s) => s.exit_score != null)
    .filter((s) => {
      if (!exitFilter) return true;
      if (exitFilter === "URGENT") return s.exit_signal === "EXIT_IMMEDIATE" || s.exit_signal === "EXIT_WARN";
      return s.exit_signal === exitFilter;
    })
    .sort((a, b) => {
      const oa = EXIT_ORDER[a.exit_signal ?? ""] ?? 99;
      const ob = EXIT_ORDER[b.exit_signal ?? ""] ?? 99;
      if (oa !== ob) return oa - ob;
      return (b.exit_score ?? 0) - (a.exit_score ?? 0);
    });

  const fmtDelta = (v: number | null | undefined) => {
    if (v == null) return "—";
    return (v >= 0 ? "+" : "") + v.toFixed(2);
  };

  const ScoreBadge = ({ score, forEntry }: { score: number | undefined; forEntry: boolean }) => {
    if (score == null) return <span className="text-zinc-600 tabular-nums">—</span>;
    const max = forEntry ? 4.5 : 3.0;
    const pct = Math.round((score / max) * 100);
    const cls =
      pct >= 90
        ? forEntry ? "text-emerald-300 font-semibold" : "text-red-300 font-semibold"
        : pct >= 60
          ? forEntry ? "text-emerald-400/80" : "text-orange-300"
          : pct >= 30
            ? "text-zinc-300"
            : "text-zinc-500";
    return <span className={`font-mono tabular-nums ${cls}`}>{pct}%</span>;
  };

  const FilterBtn = ({
    label,
    active,
    onClick,
  }: {
    label: string;
    active: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${
        active
          ? "bg-zinc-700 border-zinc-500 text-zinc-100"
          : "bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      {date && (
        <p className="text-xs font-mono text-zinc-500">Signal date: {date}</p>
      )}

      {/* Legend toggle */}
      <div>
        <button
          onClick={() => setShowLegend((v) => !v)}
          className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
        >
          <span>ℹ️ How signals work</span>
          <span className="text-zinc-600">{showLegend ? "▲" : "▼"}</span>
        </button>

        {showLegend && (
          <div className="mt-2 rounded-md border border-zinc-800 bg-zinc-950 px-4 py-3 text-xs font-mono text-zinc-400 space-y-3">
            <div>
              <p className="text-zinc-300 font-semibold mb-1">SCORING</p>
              <p>Score % = weighted conditions met (100% = all conditions satisfied)</p>
              <p className="text-zinc-500">Entry max: 4.5 pts (weighted) · Exit max: 3.0 pts (equal weight)</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-emerald-400 font-semibold mb-1">Entry conditions (+1 each)</p>
                <ul className="space-y-0.5 text-zinc-400">
                  <li><span className="text-zinc-300">Momentum Trend &gt; 0</span> — momentum accelerating vs 5-day average</li>
                  <li><span className="text-zinc-300">RS Rank Change &lt; 0</span> — rank number improved (lower = better rank)</li>
                  <li><span className="text-zinc-300">RS Score rising</span> — relative strength score increasing</li>
                </ul>
              </div>
              <div>
                <p className="text-red-400 font-semibold mb-1">Exit conditions (+1 each)</p>
                <ul className="space-y-0.5 text-zinc-400">
                  <li><span className="text-zinc-300">Momentum Trend &lt; 0</span> — momentum decelerating vs 5-day average</li>
                  <li><span className="text-zinc-300">RS Rank Change &gt; 3</span> — rank worsened by more than 3 positions</li>
                  <li><span className="text-zinc-300">Momentum negative</span> — absolute momentum below zero</li>
                </ul>
              </div>
            </div>
            <div className="border-t border-zinc-800 pt-2">
              <p className="text-zinc-300 font-semibold mb-1">RS RANK CHANGE</p>
              <p><span className="text-emerald-400">Negative (−140)</span> = rank improved by 140 positions = GOOD</p>
              <p><span className="text-red-400">Positive (+77)</span>&nbsp;&nbsp;= rank worsened by 77 positions&nbsp;&nbsp;= BAD</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Entry Signals */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2 space-y-2">
            <CardTitle className="text-base font-mono text-zinc-300">
              Entry Signals
            </CardTitle>
            <div className="flex flex-wrap gap-1">
              <FilterBtn label="All" active={entryFilter === null} onClick={() => setEntryFilter(null)} />
              <FilterBtn label="ENTRY" active={entryFilter === "ENTRY"} onClick={() => setEntryFilter("ENTRY")} />
              <FilterBtn label="WATCH" active={entryFilter === "WATCH"} onClick={() => setEntryFilter("WATCH")} />
              <FilterBtn label="WAIT" active={entryFilter === "WAIT"} onClick={() => setEntryFilter("WAIT")} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-500 text-sm w-8">#</TableHead>
                  <TableHead className="text-zinc-500 text-sm">Ticker</TableHead>
                  <TableHead className="text-zinc-500 text-sm">Signal</TableHead>
                  <TableHead className="text-zinc-500 text-sm">Theme</TableHead>
                  <TableHead className="text-zinc-500 text-sm text-right">Score</TableHead>
                  <TableHead className="text-zinc-500 text-sm text-right" title="momentum now vs 5-day avg">
                    Momentum Trend
                  </TableHead>
                  <TableHead className="text-zinc-500 text-sm text-right" title="rank improvement, negative = better">
                    RS Rank Change
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entryRows.length === 0 ? (
                  <TableRow className="border-zinc-800">
                    <TableCell colSpan={7} className="text-zinc-600 text-sm font-mono py-4 text-center">
                      No signals match the current filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  entryRows.map((s) => {
                    const rank = entryRankMap.get(s.ticker);
                    const isTop = rank === 1;
                    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
                    return (
                    <TableRow key={s.ticker} className={isTop ? "border-zinc-800 border-l-2 border-l-amber-400 bg-amber-950/20" : "border-zinc-800"}>
                      <TableCell className="text-sm font-mono w-8 text-center">
                        {rank != null ? (medal ?? <span className="text-zinc-500">{rank}</span>) : <span className="text-zinc-700">—</span>}
                      </TableCell>
                      <TableCell className={`font-mono font-bold text-sm ${isTop ? "text-zinc-50" : "text-zinc-100"}`}>
                        {s.ticker}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs font-mono ${entrySignalClass(s.entry_signal ?? "")}`}
                        >
                          {s.entry_signal ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400 font-mono">
                        {themeMap.get(s.ticker) ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-right">
                        <ScoreBadge score={s.entry_score} forEntry={true} />
                      </TableCell>
                      <TableCell
                        className={`text-sm text-right tabular-nums font-mono ${
                          (s.momentum_delta ?? 0) > 0
                            ? "text-emerald-400"
                            : (s.momentum_delta ?? 0) < 0
                              ? "text-red-400"
                              : "text-zinc-400"
                        }`}
                      >
                        {fmtDelta(s.momentum_delta)}
                      </TableCell>
                      <TableCell
                        className={`text-sm text-right tabular-nums font-mono ${
                          (s.rs_rank_delta ?? 0) < 0
                            ? "text-emerald-400"
                            : (s.rs_rank_delta ?? 0) > 0
                              ? "text-red-400"
                              : "text-zinc-400"
                        }`}
                      >
                        {fmtDelta(s.rs_rank_delta)}
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Exit Signals */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2 space-y-2">
            <CardTitle className="text-base font-mono text-zinc-300">
              Exit Signals
            </CardTitle>
            <div className="flex flex-wrap gap-1">
              <FilterBtn label="All" active={exitFilter === null} onClick={() => setExitFilter(null)} />
              <FilterBtn label="Urgent" active={exitFilter === "URGENT"} onClick={() => setExitFilter("URGENT")} />
              <FilterBtn label="EXIT_IMMEDIATE" active={exitFilter === "EXIT_IMMEDIATE"} onClick={() => setExitFilter("EXIT_IMMEDIATE")} />
              <FilterBtn label="EXIT_WARN" active={exitFilter === "EXIT_WARN"} onClick={() => setExitFilter("EXIT_WARN")} />
              <FilterBtn label="HOLD_WATCH" active={exitFilter === "HOLD_WATCH"} onClick={() => setExitFilter("HOLD_WATCH")} />
              <FilterBtn label="HOLD" active={exitFilter === "HOLD"} onClick={() => setExitFilter("HOLD")} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-500 text-sm">Ticker</TableHead>
                  <TableHead className="text-zinc-500 text-sm">Signal</TableHead>
                  <TableHead className="text-zinc-500 text-sm">Theme</TableHead>
                  <TableHead className="text-zinc-500 text-sm text-right">Score</TableHead>
                  <TableHead className="text-zinc-500 text-sm text-right" title="momentum now vs 5-day avg">
                    Momentum Trend
                  </TableHead>
                  <TableHead className="text-zinc-500 text-sm text-right" title="rank improvement, negative = better">
                    RS Rank Change
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exitRows.length === 0 ? (
                  <TableRow className="border-zinc-800">
                    <TableCell colSpan={6} className="text-zinc-600 text-sm font-mono py-4 text-center">
                      No signals match the current filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  exitRows.map((s) => (
                    <TableRow key={s.ticker} className="border-zinc-800">
                      <TableCell className="font-mono font-bold text-sm text-zinc-100">
                        {s.ticker}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs font-mono ${exitSignalClass(s.exit_signal ?? "")}`}
                        >
                          {s.exit_signal ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400 font-mono">
                        {themeMap.get(s.ticker) ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-right">
                        <ScoreBadge score={s.exit_score} forEntry={false} />
                      </TableCell>
                      <TableCell
                        className={`text-sm text-right tabular-nums font-mono ${
                          (s.momentum_delta ?? 0) > 0
                            ? "text-emerald-400"
                            : (s.momentum_delta ?? 0) < 0
                              ? "text-red-400"
                              : "text-zinc-400"
                        }`}
                      >
                        {fmtDelta(s.momentum_delta)}
                      </TableCell>
                      <TableCell
                        className={`text-sm text-right tabular-nums font-mono ${
                          (s.rs_rank_delta ?? 0) < 0
                            ? "text-emerald-400"
                            : (s.rs_rank_delta ?? 0) > 0
                              ? "text-red-400"
                              : "text-zinc-400"
                        }`}
                      >
                        {fmtDelta(s.rs_rank_delta)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root client component
// ---------------------------------------------------------------------------

export function RotationDashboard({
  positions,
  candidatesMap,
  themeEdges,
  topTickersByTheme,
  portfolioRows,
}: {
  positions: PortfolioPosition[];
  candidatesMap: Record<string, RotationCandidate[]>;
  themeEdges: ThemeEdge[];
  topTickersByTheme: TopTickerByTheme[];
  portfolioRows: PortfolioRow[];
}) {
  const firstWithCandidates =
    positions
      .filter((p) => p.label !== "core")
      .find((p) => (candidatesMap[p.ticker]?.length ?? 0) > 0)?.ticker ?? "";
  const [selected, setSelected] = useState(firstWithCandidates);
  const satellites = positions.filter((p) => p.label !== "core");

  const [entryExitData, setEntryExitData] = useState<EntryExitSignal[]>([]);
  const [signalDate, setSignalDate] = useState<string | null>(null);
  const [signalLoading, setSignalLoading] = useState(false);

  useEffect(() => {
    setSignalLoading(true);
    getEntryExitSignals()
      .then((res) => {
        setEntryExitData(res.signals);
        setSignalDate(res.date);
      })
      .catch(() => {
        // silently ignore — table will show empty state
      })
      .finally(() => setSignalLoading(false));
  }, []);

  const [icPoints, setIcPoints] = useState<IcPoint[]>([]);
  const [backtestRows, setBacktestRows] = useState<BacktestRow[]>([]);
  const [qualityLoading, setQualityLoading] = useState(false);

  useEffect(() => {
    setQualityLoading(true);
    Promise.all([getIcValidation(), getBacktestResults()])
      .then(([ic, bt]) => {
        setIcPoints(ic ?? []);
        setBacktestRows(bt ?? []);
      })
      .catch((err) => {
        console.error("[SignalQuality] fetch error:", err);
      })
      .finally(() => setQualityLoading(false));
  }, []);

  // Compute median momentum_score across ALL candidates from all satellites
  const allScores: number[] = Object.values(candidatesMap)
    .flat()
    .map((c) => c.momentum_score);
  const medianMomentum = median(allScores);

  const selectedCandidates = candidatesMap[selected] ?? [];

  return (
    <Tabs defaultValue="portfolio" className="space-y-4">
      <TabsList className="bg-zinc-800 border border-zinc-700">
        <TabsTrigger value="portfolio" className="text-sm font-mono">
          Portfolio
        </TabsTrigger>
        <TabsTrigger value="market" className="text-sm font-mono">
          Market Overview
        </TabsTrigger>
        <TabsTrigger value="signals" className="text-sm font-mono">
          Entry / Exit
        </TabsTrigger>
        <TabsTrigger value="quality" className="text-sm font-mono">
          Signal Quality
        </TabsTrigger>
      </TabsList>

      {/* ------------------------------------------------------------------ */}
      {/* Tab 1: Portfolio                                                     */}
      {/* ------------------------------------------------------------------ */}
      <TabsContent value="portfolio">
        <div className="space-y-6">
          <PortfolioStatus
            positions={positions}
            portfolioRows={portfolioRows}
            candidatesMap={candidatesMap}
            medianMomentum={medianMomentum}
            topTickersByTheme={topTickersByTheme}
            entryExitData={entryExitData}
            signalLoading={signalLoading}
          />
          {satellites.length === 0 ? (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4 text-zinc-500 text-base">
                No satellite holdings found.
              </CardContent>
            </Card>
          ) : (
            <>
              <CandidatesTable
                satellites={satellites}
                candidatesMap={candidatesMap}
                selected={selected}
                onSelect={setSelected}
                entryExitData={entryExitData}
              />
              <RelationshipGraph
                satellite={selected}
                candidates={selectedCandidates}
              />
              <NextSatelliteSection
                positions={positions}
                candidatesMap={candidatesMap}
                themeEdges={themeEdges}
                topTickersByTheme={topTickersByTheme}
              />
            </>
          )}
        </div>
      </TabsContent>

      {/* ------------------------------------------------------------------ */}
      {/* Tab 2: Market Overview                                               */}
      {/* ------------------------------------------------------------------ */}
      <TabsContent value="market">
        <div className="space-y-6">
          <MarketNarrative themeEdges={themeEdges} topTickersByTheme={topTickersByTheme} />
          <ThemeMomentumChart themeEdges={themeEdges} />
          <ThemeFlowTable themeEdges={themeEdges} />
          <TopTickersGrid topTickersByTheme={topTickersByTheme} />
        </div>
      </TabsContent>

      {/* ------------------------------------------------------------------ */}
      {/* Tab 3: Entry / Exit Signals                                          */}
      {/* ------------------------------------------------------------------ */}
      <TabsContent value="signals">
        <EntryExitTab
          data={entryExitData}
          date={signalDate}
          loading={signalLoading}
          topTickersByTheme={topTickersByTheme}
        />
      </TabsContent>

      {/* ------------------------------------------------------------------ */}
      {/* Tab 4: Signal Quality                                                */}
      {/* ------------------------------------------------------------------ */}
      <TabsContent value="quality">
        <SignalQualityTab
          icPoints={icPoints}
          backtestRows={backtestRows}
          loading={qualityLoading}
        />
      </TabsContent>
    </Tabs>
  );
}
