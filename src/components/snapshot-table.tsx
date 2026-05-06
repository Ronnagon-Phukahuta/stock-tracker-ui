"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SnapshotRow {
  ticker: string;
  price: number;
  change_1d: number;
  change_1w: number;
  change_1m: number;
  change_ytd: number;
  entry_low: number | null;
  entry_high: number | null;
  stop_loss: number | null;
  target_price: number | null;
  risk_reward: number | null;
  trade_probability: number | null;
  recommendation: string;
}

type SortKey = keyof SnapshotRow;
type SortDir = "asc" | "desc";

const ROW_OPTIONS = [25, 50, 75, 100] as const;
type RowCount = (typeof ROW_OPTIONS)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pctCell(value: number) {
  const cls = value >= 0 ? "text-emerald-300" : "text-red-300";
  return (
    <span className={`${cls} tabular-nums text-sm`}>
      {value >= 0 ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function RecommendationBadge({ rec }: { rec: string }) {
  const upper = rec.toUpperCase();
  const cls =
    upper === "ENTRY ZONE"
      ? "bg-green-500/20 text-green-400 border-green-500/50"
      : upper === "MONITOR"
        ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
        : upper === "WAIT FOR PULLBACK"
          ? "bg-blue-500/20 text-blue-400 border-blue-500/50"
          : upper === "UNDERPERFORMER - AVOID"
            ? "bg-red-500/20 text-red-400 border-red-500/50"
            : "bg-zinc-500/20 text-zinc-400 border-zinc-600/50";
  return (
    <Badge variant="outline" className={`${cls} text-[10px] font-medium whitespace-nowrap`}>
      {rec}
    </Badge>
  );
}

function TradeProbBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 60 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  const textCls = pct >= 60 ? "text-emerald-300" : pct >= 40 ? "text-amber-300" : "text-red-300";
  return (
    <div className="flex items-center gap-2 min-w-24">
      <div className="flex-1 h-1.5 rounded-full bg-zinc-800">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs tabular-nums ${textCls} w-9 text-right`}>{pct.toFixed(0)}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable header
// ---------------------------------------------------------------------------

interface SortableHeadProps {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}

function SortableHead({ label, sortKey, currentKey, currentDir, onSort, className = "" }: SortableHeadProps) {
  const active = currentKey === sortKey;
  return (
    <TableHead
      onClick={() => onSort(sortKey)}
      className={`text-[10px] tracking-widest uppercase cursor-pointer select-none whitespace-nowrap transition-colors ${active ? "text-zinc-200" : "text-zinc-400 hover:text-zinc-200"} ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-[9px] ${active ? "opacity-100" : "opacity-30"}`}>
          {active ? (currentDir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </span>
    </TableHead>
  );
}

// ---------------------------------------------------------------------------
// Sort helper
// ---------------------------------------------------------------------------

function sortRows(rows: SnapshotRow[], key: SortKey, dir: SortDir): SnapshotRow[] {
  const m = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * m;
    return String(av).localeCompare(String(bv)) * m;
  });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface SnapshotTableProps {
  rows: SnapshotRow[];
}

export function SnapshotTable({ rows }: SnapshotTableProps) {
  const [rowCount, setRowCount] = useState<RowCount>(25);
  const [sortKey, setSortKey] = useState<SortKey>("trade_probability");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const filtered = useMemo(() => {
    let result = rows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((r) => r.ticker.toLowerCase().includes(q));
    }
    return sortRows(result, sortKey, sortDir);
  }, [rows, search, sortKey, sortDir]);

  const visible = filtered.slice(0, rowCount);

  return (
    <div className="space-y-0">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-zinc-800/60 bg-zinc-900/30">
        {/* Search */}
        <input
          type="text"
          placeholder="Search ticker..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 w-44 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
        />

        <div className="flex-1" />

        {/* Row count */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Top</span>
          {ROW_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setRowCount(n)}
              className={`h-7 w-10 rounded-md text-[11px] font-medium transition-colors border ${
                rowCount === n
                  ? "bg-zinc-700 border-zinc-500 text-zinc-100"
                  : "bg-transparent border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      <div className="px-4 py-2 text-[11px] text-zinc-500 border-b border-zinc-800/40">
        Showing {visible.length.toLocaleString()} of {filtered.length.toLocaleString()} stocks
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800/60 hover:bg-transparent">
              <SortableHead label="Ticker" sortKey="ticker" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="pl-4" />
              <SortableHead label="Price" sortKey="price" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right" />
              <SortableHead label="1D%" sortKey="change_1d" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right hidden xl:table-cell" />
              <SortableHead label="1W%" sortKey="change_1w" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right hidden xl:table-cell" />
              <SortableHead label="1M%" sortKey="change_1m" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right hidden sm:table-cell" />
              <SortableHead label="YTD%" sortKey="change_ytd" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right hidden xl:table-cell" />
              <SortableHead label="Entry Zone" sortKey="entry_low" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden xl:table-cell" />
              <SortableHead label="Stop Loss" sortKey="stop_loss" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right hidden xl:table-cell" />
              <SortableHead label="Target" sortKey="target_price" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right hidden xl:table-cell" />
              <SortableHead label="R:R" sortKey="risk_reward" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right hidden xl:table-cell" />
              <SortableHead label="Trade Prob" sortKey="trade_probability" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
              <SortableHead label="Recommendation" sortKey="recommendation" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden sm:table-cell pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length > 0 ? (
              visible.map((row) => (
                <TableRow key={row.ticker} className="border-zinc-800/40 hover:bg-zinc-800/30">
                  <TableCell className="py-3 font-semibold text-zinc-100 tracking-wide pl-4">{row.ticker}</TableCell>
                  <TableCell className="py-3 text-right tabular-nums text-zinc-300 text-sm">${row.price.toFixed(2)}</TableCell>
                  <TableCell className="py-3 text-right hidden xl:table-cell">{pctCell(row.change_1d)}</TableCell>
                  <TableCell className="py-3 text-right hidden xl:table-cell">{pctCell(row.change_1w)}</TableCell>
                  <TableCell className="py-3 text-right hidden sm:table-cell">{pctCell(row.change_1m)}</TableCell>
                  <TableCell className="py-3 text-right hidden xl:table-cell">{pctCell(row.change_ytd)}</TableCell>
                  <TableCell className="py-3 text-sm text-zinc-300 hidden xl:table-cell tabular-nums">
                    {row.entry_low !== null && row.entry_high !== null
                      ? `$${row.entry_low.toFixed(2)}-$${row.entry_high.toFixed(2)}`
                      : <span className="text-zinc-600">—</span>}
                  </TableCell>
                  <TableCell className="py-3 text-right tabular-nums text-zinc-300 text-sm hidden xl:table-cell">
                    {row.stop_loss !== null ? `$${row.stop_loss.toFixed(2)}` : <span className="text-zinc-600">—</span>}
                  </TableCell>
                  <TableCell className="py-3 text-right tabular-nums text-zinc-300 text-sm hidden xl:table-cell">
                    {row.target_price !== null ? `$${row.target_price.toFixed(2)}` : <span className="text-zinc-600">—</span>}
                  </TableCell>
                  <TableCell className="py-3 text-right tabular-nums text-sm hidden xl:table-cell">
                    {row.risk_reward !== null
                      ? <span className={row.risk_reward >= 2 ? "text-emerald-300" : row.risk_reward >= 1 ? "text-amber-300" : "text-red-300"}>{row.risk_reward.toFixed(2)}</span>
                      : <span className="text-zinc-600">—</span>}
                  </TableCell>
                  <TableCell className="py-3 hidden sm:table-cell">
                    {row.trade_probability !== null
                      ? <TradeProbBar value={row.trade_probability} />
                      : <span className="text-zinc-600 text-sm">—</span>}
                  </TableCell>
                  <TableCell className="py-3 hidden sm:table-cell pr-4">
                    <RecommendationBadge rec={row.recommendation} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={12} className="py-10 text-center text-sm text-zinc-500">
                  No results match your search
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}