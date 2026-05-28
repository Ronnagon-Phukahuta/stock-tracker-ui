"use client";

import { useState, useCallback } from "react";
import {
  getSectorStocks,
  type SectorRotationItem,
  type SectorStockItem,
  type SectorStocksResponse,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}

function pctCls(v: number): string {
  if (v >= 1) return "text-emerald-400 font-semibold";
  if (v >= 0) return "text-emerald-500/80";
  if (v >= -1) return "text-red-400/80";
  return "text-red-400 font-semibold";
}

/** Primary 1-day return: ETF return when available, otherwise stock universe avg. */
function etf1d(s: SectorRotationItem): number {
  return s.etf_return_1d ?? s.avg_change_1d;
}

/** Finviz-style solid tile background: deep green / light green / light red / deep red */
function tileColor(v: number): string {
  if (v >= 2)  return "#065f46"; // deep green  (emerald-900)
  if (v >= 0)  return "#047857"; // light green  (emerald-700)
  if (v >= -2) return "#991b1b"; // light red    (red-800)
  return "#450a0a";              // deep red     (red-950)
}

const SELECTED_BORDER = "rgba(250,204,21,0.90)";

const SIGNAL_CLS: Record<string, string> = {
  bullish: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  bearish: "bg-red-500/15 text-red-300 border-red-500/40",
  watch:   "bg-amber-500/15 text-amber-300 border-amber-500/40",
  neutral: "bg-zinc-700/40 text-zinc-400 border-zinc-600/40",
};

function signalCls(sig: string): string {
  return SIGNAL_CLS[sig.toLowerCase()] ?? "bg-zinc-700/40 text-zinc-400 border-zinc-600/40";
}

// ---------------------------------------------------------------------------
// Squarified treemap layout (Bruls et al.)
// ---------------------------------------------------------------------------

interface TileLayout { x: number; y: number; w: number; h: number; }

/**
 * Computes a squarified treemap layout.
 * @param values  Area weights (any non-negative numbers)
 * @param aspect  containerWidth / containerHeight in pixels
 * @returns       TileLayout per value index, all values in % (0–100)
 */
function buildTreemap(values: number[], aspect: number): TileLayout[] {
  const n = values.length;
  if (n === 0) return [];

  const total = values.reduce((s, v) => s + Math.max(v, 0), 0);

  // Fallback: equal grid when all caps are zero
  if (total === 0) {
    const cols = Math.ceil(Math.sqrt(n * aspect));
    const rows = Math.ceil(n / cols);
    return values.map((_, i) => ({
      x: (i % cols) / cols * 100,
      y: Math.floor(i / cols) / rows * 100,
      w: 100 / cols,
      h: 100 / rows,
    }));
  }

  // Sort descending; track original index so output[i] matches input[i]
  const sorted = values
    .map((v, i) => ({ v: Math.max(v, 0) / total, i }))
    .sort((a, b) => b.v - a.v);

  const output: TileLayout[] = new Array(n);

  function squarify(
    items: typeof sorted,
    x: number, y: number, w: number, h: number,
  ) {
    if (items.length === 0) return;
    if (items.length === 1) {
      output[items[0].i] = { x: x * 100, y: y * 100, w: w * 100, h: h * 100 };
      return;
    }

    // Lay the row along the short pixel side of the current rectangle
    const horizontal = w * aspect >= h;

    /** Worst pixel aspect ratio across all items in a candidate row */
    function worstRatio(row: typeof sorted, rowArea: number): number {
      let worst = 0;
      for (const item of row) {
        let pw: number, ph: number;
        if (horizontal) {
          const rowH = rowArea / w;
          const itemW = (item.v / rowArea) * w;
          pw = itemW * aspect;
          ph = rowH;
        } else {
          const rowW = rowArea / h;
          const itemH = (item.v / rowArea) * h;
          pw = rowW * aspect;
          ph = itemH;
        }
        const r = Math.max(pw / ph, ph / pw);
        if (r > worst) worst = r;
      }
      return worst;
    }

    // Greedily extend the row while aspect ratio improves
    let row: typeof sorted = [];
    let rowArea = 0;
    let prevWorst = Infinity;

    for (const item of items) {
      const candidate = [...row, item];
      const candidateArea = rowArea + item.v;
      const worst = worstRatio(candidate, candidateArea);
      if (worst <= prevWorst || row.length === 0) {
        row = candidate;
        rowArea = candidateArea;
        prevWorst = worst;
      } else {
        break;
      }
    }

    // Commit the row, recurse on the remainder
    if (horizontal) {
      const rowH = rowArea / w;
      let cx = x;
      for (const item of row) {
        const itemW = (item.v / rowArea) * w;
        output[item.i] = { x: cx * 100, y: y * 100, w: itemW * 100, h: rowH * 100 };
        cx += itemW;
      }
      squarify(items.slice(row.length), x, y + rowH, w, h - rowH);
    } else {
      const rowW = rowArea / h;
      let cy = y;
      for (const item of row) {
        const itemH = (item.v / rowArea) * h;
        output[item.i] = { x: x * 100, y: cy * 100, w: rowW * 100, h: itemH * 100 };
        cy += itemH;
      }
      squarify(items.slice(row.length), x + rowW, y, w - rowW, h);
    }
  }

  squarify(sorted, 0, 0, 1, 1);
  return output;
}

// ---------------------------------------------------------------------------
// Section 1 — Money Flow Summary (no progress bar — just counts)
// ---------------------------------------------------------------------------

function MoneyFlowSummary({ items }: { items: SectorRotationItem[] }) {
  const inflow  = items.filter((s) => etf1d(s) >= 0).sort((a, b) => etf1d(b) - etf1d(a));
  const outflow = items.filter((s) => etf1d(s) <  0).sort((a, b) => etf1d(a) - etf1d(b));

  const ratio = items.length > 0 ? inflow.length / items.length : 0.5;
  const bias  = ratio >= 0.7
    ? { label: "Risk On",  cls: "text-emerald-400" }
    : ratio >= 0.4
      ? { label: "Mixed",    cls: "text-amber-400"   }
      : { label: "Risk Off", cls: "text-red-400"     };

  return (
    <Card className="bg-zinc-900/50 border-zinc-800/80 mb-5">
      <CardHeader className="border-b border-zinc-800/60 pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-bold tracking-[0.15em] uppercase text-zinc-300">
            Money Flow
          </CardTitle>
          <span className={`text-xs font-bold ${bias.cls}`}>{bias.label}</span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-3 pb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] mb-2">
              <span className="text-emerald-400">↑ {inflow.length} sectors gaining</span>
            </p>
            <div className="space-y-1">
              {inflow.map((s) => (
                <div key={s.sector} className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-zinc-300 truncate">{s.sector}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {s.etf_ticker && <span className="text-[9px] text-zinc-500">{s.etf_ticker}</span>}
                    <span className="text-[10px] tabular-nums text-emerald-400 font-medium">{fmtPct(etf1d(s))}</span>
                  </div>
                </div>
              ))}
              {inflow.length === 0 && <p className="text-[10px] text-zinc-600">None</p>}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] mb-2">
              <span className="text-red-400">↓ {outflow.length} sectors losing</span>
            </p>
            <div className="space-y-1">
              {outflow.map((s) => (
                <div key={s.sector} className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-zinc-300 truncate">{s.sector}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {s.etf_ticker && <span className="text-[9px] text-zinc-500">{s.etf_ticker}</span>}
                    <span className="text-[10px] tabular-nums text-red-400 font-medium">{fmtPct(etf1d(s))}</span>
                  </div>
                </div>
              ))}
              {outflow.length === 0 && <p className="text-[10px] text-zinc-600">None</p>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section 2 — Market Insight Summary
// ---------------------------------------------------------------------------

interface InsightCard {
  title: string;
  detail: string;
  sentiment: "bullish" | "bearish" | "neutral";
}

const INSIGHT_BORDER: Record<InsightCard["sentiment"], string> = {
  bullish: "border-l-emerald-500",
  bearish: "border-l-red-500",
  neutral: "border-l-amber-500",
};

const INSIGHT_TITLE_CLS: Record<InsightCard["sentiment"], string> = {
  bullish: "text-emerald-400",
  bearish: "text-red-400",
  neutral: "text-amber-400",
};

function deriveInsights(
  items: SectorRotationItem[],
  stocksData: SectorStocksResponse | null,
): InsightCard[] {
  if (items.length === 0) return [];
  const cards: InsightCard[] = [];

  // 1. Regime Signal
  const positive = items.filter((s) => etf1d(s) >= 0).length;
  const total = items.length;
  const regime = positive >= 7 ? "Risk On" : positive >= 4 ? "Mixed" : "Risk Off";
  const regimeSentiment: InsightCard["sentiment"] =
    positive >= 7 ? "bullish" : positive >= 4 ? "neutral" : "bearish";
  const regimeDetail = `${positive} of ${total} sectors gaining — ${
    positive >= 7
      ? "broad market strength"
      : positive >= 4
        ? "mixed breadth"
        : "broad selling pressure"
  }`;
  cards.push({ title: `Regime Signal · ${regime}`, detail: regimeDetail, sentiment: regimeSentiment });

  // 2. Rotation Pattern — growth (XLK, XLC, XLY) vs defensive (XLU, XLP, XLV)
  const GROWTH_ETFS = new Set(["XLK", "XLC", "XLY"]);
  const DEFENSIVE_ETFS = new Set(["XLU", "XLP", "XLV"]);
  const growthItems = items.filter((s) => s.etf_ticker && GROWTH_ETFS.has(s.etf_ticker));
  const defensiveItems = items.filter((s) => s.etf_ticker && DEFENSIVE_ETFS.has(s.etf_ticker));
  if (growthItems.length > 0 && defensiveItems.length > 0) {
    const growthAvg = growthItems.reduce((s, i) => s + etf1d(i), 0) / growthItems.length;
    const defAvg = defensiveItems.reduce((s, i) => s + etf1d(i), 0) / defensiveItems.length;
    const diff = growthAvg - defAvg;
    const pattern =
      diff > 0.3 ? "Growth Rotation" : diff < -0.3 ? "Defensive Rotation" : "Neutral Rotation";
    const patSentiment: InsightCard["sentiment"] =
      diff > 0.3 ? "bullish" : diff < -0.3 ? "bearish" : "neutral";
    cards.push({
      title: `Rotation · ${pattern}`,
      detail: `Growth avg ${fmtPct(growthAvg)} vs Defensive avg ${fmtPct(defAvg)}`,
      sentiment: patSentiment,
    });
  }

  // 3. Smart Money Divergence — largest |ETF return − stock avg| on the day
  const withDiv = items
    .filter((s) => s.etf_return_1d != null)
    .map((s) => ({ ...s, div: (s.etf_return_1d as number) - s.avg_change_1d }))
    .sort((a, b) => Math.abs(b.div) - Math.abs(a.div));
  if (withDiv.length > 0) {
    const top = withDiv[0];
    const etfLeads = top.div > 0;
    cards.push({
      title: "Smart Money Divergence",
      detail: `${top.etf_ticker} ETF ${fmtPct(top.etf_return_1d)} vs stocks ${fmtPct(top.avg_change_1d)} — ${
        etfLeads ? `institution accumulating ${top.sector}` : `retail driven ${top.sector}`
      }`,
      sentiment: etfLeads ? "bullish" : "neutral",
    });
  }

  // 4. Momentum Leader — highest sector_momentum_spread
  const sorted = [...items].sort(
    (a, b) => (b.sector_momentum_spread ?? 0) - (a.sector_momentum_spread ?? 0),
  );
  if (sorted.length > 0) {
    const leader = sorted[0];
    const topStock = stocksData?.sector === leader.sector ? stocksData.stocks[0] : null;
    const stockPart = topStock
      ? ` · top stock ${topStock.ticker} (RS ${Math.round(topStock.rs_score)})`
      : "";
    cards.push({
      title: `Momentum Leader · ${leader.sector}`,
      detail: `Spread ${fmtPct(leader.sector_momentum_spread)}${stockPart}`,
      sentiment: "bullish",
    });
  }

  return cards;
}

function MarketInsightSummary({
  items,
  stocksData,
}: {
  items: SectorRotationItem[];
  stocksData: SectorStocksResponse | null;
}) {
  const cards = deriveInsights(items, stocksData);
  if (cards.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-2">
        Market Insights
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div
            key={card.title}
            className={`bg-zinc-900/70 border border-zinc-800/80 border-l-4 ${INSIGHT_BORDER[card.sentiment]} rounded-lg px-3 py-2.5`}
          >
            <p className={`text-[10px] font-bold leading-snug ${INSIGHT_TITLE_CLS[card.sentiment]}`}>
              {card.title}
            </p>
            <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{card.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 3 — Treemap
// ---------------------------------------------------------------------------

function Treemap({
  items,
  selectedSector,
  onSelect,
  aspect,
  getValue,
}: {
  items: SectorRotationItem[];
  selectedSector: string | null;
  onSelect: (sector: string) => void;
  aspect: number;
  getValue: (item: SectorRotationItem) => number;
}) {
  const tiles = buildTreemap(items.map((s) => s.total_market_cap), aspect);

  return (
    <div className="w-full relative" style={{ aspectRatio: `${aspect} / 1` }}>
      {items.map((item, idx) => {
        const tile = tiles[idx];
        if (!tile) return null;

        const v = getValue(item);
        const isSelected = selectedSector === item.sector;
        // Adapt label density based on tile size (percentages of container)
        const isTiny  = tile.w < 7  || tile.h < 10;
        const isSmall = tile.w < 14 || tile.h < 24;

        return (
          <button
            key={item.sector}
            onClick={() => onSelect(item.sector)}
            title={`${item.sector}${item.etf_ticker ? ` (${item.etf_ticker})` : ""} · ${fmtPct(v)}`}
            style={{
              position: "absolute",
              left:   `calc(${tile.x}% + 2px)`,
              top:    `calc(${tile.y}% + 2px)`,
              width:  `calc(${tile.w}% - 4px)`,
              height: `calc(${tile.h}% - 4px)`,
              backgroundColor: tileColor(v),
              borderColor: isSelected ? SELECTED_BORDER : "rgba(0,0,0,0.35)",
              borderWidth: isSelected ? "2px" : "1px",
              borderStyle: "solid",
              boxShadow: isSelected ? `0 0 0 2px ${SELECTED_BORDER}` : undefined,
            }}
            className="rounded overflow-hidden flex flex-col items-center justify-center text-center gap-0.5 p-1 transition-all hover:brightness-125 cursor-pointer"
          >
            {!isTiny && (
              <>
                <span
                  className={`font-semibold text-white leading-tight ${isSmall ? "text-[8px]" : "text-[11px]"}`}
                  style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%", display: "block" }}
                >
                  {item.sector}
                </span>
                {!isSmall && item.etf_ticker && (
                  <span className="text-[9px] text-white/55 block">{item.etf_ticker}</span>
                )}
                <span className={`tabular-nums font-bold text-white ${isSmall ? "text-[8px]" : "text-xs"}`}>
                  {fmtPct(v)}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 3 — Stock Panel
// ---------------------------------------------------------------------------

const RANK_BADGE: Record<number, string> = {
  0: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50",
  1: "bg-zinc-400/20 text-zinc-300 border-zinc-400/50",
  2: "bg-amber-700/20 text-amber-400 border-amber-700/50",
};

function StockRow({ stock, rank }: { stock: SectorStockItem; rank: number }) {
  const isTop3 = rank < 3;
  return (
    <tr className={`border-b border-zinc-800/50 ${isTop3 ? "bg-zinc-800/30" : "hover:bg-zinc-800/20"}`}>
      <td className="py-2 pl-4 pr-2">
        <div className="flex items-center gap-1.5">
          {isTop3 && (
            <Badge variant="outline" className={`text-[8px] px-1 py-0 ${RANK_BADGE[rank]}`}>
              #{rank + 1}
            </Badge>
          )}
          <span className={`text-xs font-bold ${isTop3 ? "text-zinc-100" : "text-zinc-300"}`}>
            {stock.ticker}
          </span>
        </div>
        <p className="text-[9px] text-zinc-500 truncate max-w-30 mt-0.5">{stock.company_name}</p>
      </td>
      <td className="py-2 px-2 text-right">
        <span className="text-[10px] tabular-nums text-zinc-400">{Math.round(stock.rs_score)}</span>
      </td>
      <td className={`py-2 px-2 text-right text-[10px] tabular-nums ${pctCls(stock.change_1d)}`}>
        {fmtPct(stock.change_1d)}
      </td>
      <td className={`py-2 px-2 text-right text-[10px] tabular-nums ${pctCls(stock.change_1w)}`}>
        {fmtPct(stock.change_1w)}
      </td>
      <td className="py-2 pl-2 pr-4 text-right">
        <Badge variant="outline" className={`text-[8px] px-1.5 py-0 ${signalCls(stock.momentum_signal)}`}>
          {stock.momentum_signal}
        </Badge>
      </td>
    </tr>
  );
}

function StockPanel({
  sector,
  data,
  loading,
  onClose,
}: {
  sector: string;
  data: SectorStocksResponse | null;
  loading: boolean;
  onClose: () => void;
}) {
  const stocks = data?.stocks ?? [];
  return (
    <Card className="bg-zinc-900/50 border-zinc-800/80 border-t-2 border-t-yellow-500/50 h-fit sticky top-4">
      <CardHeader className="border-b border-zinc-800/60 pb-3 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-xs font-bold text-zinc-100 tracking-wide truncate">{sector}</CardTitle>
            <p className="text-[9px] text-zinc-500 mt-0.5">Top stocks by RS score</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0 text-lg leading-none mt-0.5"
            aria-label="Close panel"
          >
            ×
          </button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 px-4 py-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 bg-zinc-800/50 rounded animate-pulse" />
            ))}
          </div>
        ) : stocks.length === 0 ? (
          <p className="text-xs text-zinc-500 px-4 py-4">No stocks found</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800/60">
                <th className="text-[8px] uppercase tracking-widest text-zinc-500 py-2 pl-4 pr-2">Ticker</th>
                <th className="text-[8px] uppercase tracking-widest text-zinc-500 py-2 px-2 text-right">RS</th>
                <th className="text-[8px] uppercase tracking-widest text-zinc-500 py-2 px-2 text-right">1d</th>
                <th className="text-[8px] uppercase tracking-widest text-zinc-500 py-2 px-2 text-right">1w</th>
                <th className="text-[8px] uppercase tracking-widest text-zinc-500 py-2 pl-2 pr-4 text-right">Signal</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock, i) => (
                <StockRow key={stock.ticker} stock={stock} rank={i} />
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Divergence Row — top 3 sectors where ETF return diverges most from stock avg
// ---------------------------------------------------------------------------

function DivergenceRow({ items }: { items: SectorRotationItem[] }) {
  const top3 = items
    .filter((s) => s.etf_return_1d != null)
    .map((s) => ({ s, div: (s.etf_return_1d as number) - s.avg_change_1d }))
    .sort((a, b) => Math.abs(b.div) - Math.abs(a.div))
    .slice(0, 3);

  if (top3.length === 0) return null;

  return (
    <div className="my-3 flex flex-wrap items-center gap-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500 shrink-0">
        Divergence · ETF vs Stock Avg
      </p>
      {top3.map(({ s, div }) => {
        const etfLeads = div > 0;
        const ticker = s.etf_ticker ?? s.sector;
        const label = etfLeads
          ? `↑ ${ticker} Institution leads ${fmtPct(div)}`
          : `↑ ${ticker} Retail leads ${fmtPct(-div)}`;
        const cls = etfLeads
          ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
          : "bg-yellow-500/10 text-yellow-300 border-yellow-500/30";
        return (
          <span
            key={s.sector}
            title={`ETF ${fmtPct(s.etf_return_1d)} vs stocks ${fmtPct(s.avg_change_1d)}`}
            className={`inline-flex items-center border rounded px-2 py-0.5 text-[10px] font-medium ${cls}`}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export function SectorRotationDashboard({ items }: { items: SectorRotationItem[] }) {
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [stocksData, setStocksData] = useState<SectorStocksResponse | null>(null);
  const [loadingStocks, setLoadingStocks] = useState(false);

  const panelOpen = selectedSector !== null;
  // Approximate pixel aspect of the treemap container:
  //   panel closed → full content width  ≈ 3:1
  //   panel open   → lg:col-span-2/3 of content ≈ 2:1
  const treemapAspect = panelOpen ? 2 : 3;

  const handleTileClick = useCallback(
    async (sector: string) => {
      if (selectedSector === sector) {
        setSelectedSector(null);
        setStocksData(null);
        return;
      }
      setSelectedSector(sector);
      setStocksData(null);
      setLoadingStocks(true);
      try {
        const data = await getSectorStocks(sector);
        setStocksData(data);
      } catch {
        setStocksData(null);
      } finally {
        setLoadingStocks(false);
      }
    },
    [selectedSector],
  );

  const handleClose = useCallback(() => {
    setSelectedSector(null);
    setStocksData(null);
  }, []);

  return (
    <div>
      {/* Section 1 — Money Flow */}
      <MoneyFlowSummary items={items} />

      {/* Section 2 — Market Insights */}
      <MarketInsightSummary items={items} stocksData={stocksData} />

      {/* Section 3 + 4 — Treemap + Stock Panel */}
      <div className={`grid gap-5 ${panelOpen ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"}`}>
        {/* Treemaps */}
        <div className={panelOpen ? "lg:col-span-2" : ""}>
          {/* ETF treemap */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                ETF Return · Institution Level
              </p>
              <p className="text-[9px] text-zinc-600">sized by market cap · click to drill down</p>
            </div>
            <Treemap
              items={items}
              selectedSector={selectedSector}
              onSelect={handleTileClick}
              aspect={treemapAspect}
              getValue={etf1d}
            />
          </div>

          {/* Divergence row */}
          <DivergenceRow items={items} />

          {/* Stock avg treemap */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Stock Avg · Our Universe
              </p>
              <p className="text-[9px] text-zinc-600">sized by market cap · click to drill down</p>
            </div>
            <Treemap
              items={items}
              selectedSector={selectedSector}
              onSelect={handleTileClick}
              aspect={treemapAspect}
              getValue={(s) => s.avg_change_1d}
            />
            <p className="text-[9px] text-zinc-600 mt-2 italic">
              Based on our tracked universe — may not represent full sector
            </p>
          </div>
        </div>

        {/* Stock Panel */}
        {panelOpen && (
          <div className="lg:col-span-1">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-3">
              Sector Drill-down
            </p>
            <StockPanel
              sector={selectedSector}
              data={stocksData}
              loading={loadingStocks}
              onClose={handleClose}
            />
          </div>
        )}
      </div>
    </div>
  );
}
