"use client";

import { useState, useMemo } from "react";
import { WatchlistItem } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ---------------------------------------------------------------------------
// Helpers & badges (exported so the server page can reuse them)
// ---------------------------------------------------------------------------

export function toTitleCase(s: string) {
  return (s ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function WatchlistSignalBadge({ signal }: { signal: string }) {
  const upper = signal.toUpperCase();
  const cls =
    upper === "BUY_CANDIDATE" || upper === "BUY"
      ? "bg-green-500/20 text-green-400 border-green-500/50"
      : upper === "WATCH"
        ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
        : upper === "WAIT"
          ? "bg-blue-500/20 text-blue-400 border-blue-500/50"
          : upper === "AVOID"
            ? "bg-red-500/20 text-red-400 border-red-500/50"
            : "bg-zinc-500/20 text-zinc-300 border-zinc-500/40";
  return (
    <Badge variant="outline" className={`${cls} text-[10px] font-medium`}>
      {toTitleCase(signal)}
    </Badge>
  );
}

export function MomentumSignalBadge({ signal }: { signal: string }) {
  const upper = signal.toUpperCase();
  const cls =
    upper === "BUY" || upper === "STRONG_BUY" || upper === "BUY_CANDIDATE"
      ? "bg-green-500/20 text-green-400 border-green-500/50"
      : upper === "SELL" || upper === "STRONG_SELL"
        ? "bg-red-500/20 text-red-400 border-red-500/50"
        : "bg-zinc-500/20 text-zinc-300 border-zinc-500/40";
  return (
    <Badge variant="outline" className={`${cls} text-[10px] font-medium`}>
      {toTitleCase(signal)}
    </Badge>
  );
}

export function ExtensionBadge({ signal }: { signal: string }) {
  const upper = (signal ?? '').toUpperCase();
  const cls = upper.includes("EXTEND")
    ? "bg-orange-500/25 text-orange-300 border-orange-500/50"
    : "bg-zinc-500/20 text-zinc-300 border-zinc-500/40";
  return (
    <Badge variant="outline" className={`${cls} text-[10px] font-medium`}>
      {signal ? toTitleCase(signal) : "—"}
    </Badge>
  );
}

export function RsTrendBadge({ trend }: { trend: string }) {
  const upper = trend.toUpperCase();
  const cls =
    upper === "UP" || upper === "IMPROVING"
      ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50"
      : upper === "DOWN" || upper === "DECLINING"
        ? "bg-red-500/25 text-red-300 border-red-500/50"
        : "bg-zinc-500/20 text-zinc-300 border-zinc-500/40";
  return (
    <Badge variant="outline" className={`${cls} text-[10px] font-medium`}>
      {toTitleCase(trend)}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortKey = "ticker" | "company" | "price" | "relative_strength_rank" | "rs_trend" | "watchlist_signal" | "momentum_signal" | "extension_signal" | "dist_52w_pct" | "high_52w";
type SortDir = "asc" | "desc";
type SignalFilter = "ALL" | "WAIT" | "WATCH" | "AVOID";

const SIGNAL_FILTERS: SignalFilter[] = ["ALL", "WAIT", "WATCH", "AVOID"];
const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

function sortItems(
  items: WatchlistItem[],
  companyNames: Record<string, string>,
  key: SortKey,
  dir: SortDir,
): WatchlistItem[] {
  const multiplier = dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    let av: string | number;
    let bv: string | number;
    switch (key) {
      case "company":
        av = companyNames[a.ticker] ?? a.ticker;
        bv = companyNames[b.ticker] ?? b.ticker;
        break;
      case "dist_52w_pct":
      case "high_52w":
      case "price":
      case "relative_strength_rank":
        av = a[key];
        bv = b[key];
        break;
      default:
        av = (a[key as keyof WatchlistItem] as string) ?? "";
        bv = (b[key as keyof WatchlistItem] as string) ?? "";
    }
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * multiplier;
    return String(av).localeCompare(String(bv)) * multiplier;
  });
}

// ---------------------------------------------------------------------------
// Column header with sort indicator
// ---------------------------------------------------------------------------

interface SortableHeadProps {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}

function SortableHead({ label, sortKey, currentKey, currentDir, onSort, className = "" }: SortableHeadProps) {
  const active = currentKey === sortKey;
  return (
    <TableHead
      className={`text-[10px] tracking-widest uppercase cursor-pointer select-none ${active ? "text-zinc-200" : "text-zinc-400"} hover:text-zinc-200 transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-[9px] ${active ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
          {active ? (currentDir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </span>
    </TableHead>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface WatchlistTableProps {
  items: WatchlistItem[];
  companyNames: Record<string, string>;
}

export function WatchlistTable({ items, companyNames }: WatchlistTableProps) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("relative_strength_rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }

  function handleSearch(value: string) {
    setSearch(value);
    setPage(0);
  }

  function handleSignalFilter(value: SignalFilter) {
    setSignalFilter(value);
    setPage(0);
  }

  const filtered = useMemo(() => {
    let result = items;
    if (signalFilter !== "ALL") {
      result = result.filter((w) => w.watchlist_signal.toUpperCase() === signalFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (w) =>
          w.ticker.toLowerCase().includes(q) ||
          (companyNames[w.ticker] ?? "").toLowerCase().includes(q),
      );
    }
    return sortItems(result, companyNames, sortKey, sortDir);
  }, [items, companyNames, signalFilter, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const start = filtered.length > 0 ? safePage * PAGE_SIZE + 1 : 0;
  const end = Math.min((safePage + 1) * PAGE_SIZE, filtered.length);

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-zinc-800/60">
        {/* Search */}
        <input
          type="text"
          placeholder="Search ticker or company…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="h-7 w-52 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
        {/* Signal filter pills */}
        <div className="flex items-center gap-1.5">
          {SIGNAL_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => handleSignalFilter(f)}
              className={`h-7 rounded-md px-3 text-[11px] font-medium transition-colors border ${
                signalFilter === f
                  ? "bg-zinc-700 border-zinc-500 text-zinc-100"
                  : "bg-transparent border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              {f === "ALL" ? "All" : toTitleCase(f)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800/60 hover:bg-transparent group">
            <SortableHead label="Ticker" sortKey="ticker" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="pl-4" />
            <SortableHead label="Company" sortKey="company" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
            <SortableHead label="Price" sortKey="price" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right" />
            <SortableHead label="RS Rank" sortKey="relative_strength_rank" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right hidden sm:table-cell" />
            <SortableHead label="RS Trend" sortKey="rs_trend" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
            <SortableHead label="Signal" sortKey="watchlist_signal" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortableHead label="Momentum" sortKey="momentum_signal" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
            <SortableHead label="Extension" sortKey="extension_signal" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
            <SortableHead label="Dist 52w Hi" sortKey="dist_52w_pct" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right hidden lg:table-cell" />
            <SortableHead label="52w High" sortKey="high_52w" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right pr-4 hidden lg:table-cell" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.length > 0 ? (
            pageItems.map((item) => (
              <TableRow key={item.ticker} className="border-zinc-800/40 hover:bg-zinc-800/30">
                <TableCell className="py-3 font-semibold text-zinc-100 tracking-wide pl-4">{item.ticker}</TableCell>
                <TableCell className="py-3 text-zinc-300 text-xs hidden md:table-cell max-w-40 truncate">
                  {companyNames[item.ticker] ?? "—"}
                </TableCell>
                <TableCell className="py-3 text-right tabular-nums text-zinc-300 text-xs">${item.price.toFixed(2)}</TableCell>
                <TableCell className="py-3 text-right tabular-nums text-zinc-300 text-xs hidden sm:table-cell">#{item.relative_strength_rank}</TableCell>
                <TableCell className="py-3 hidden sm:table-cell"><RsTrendBadge trend={item.rs_trend} /></TableCell>
                <TableCell className="py-3"><WatchlistSignalBadge signal={item.watchlist_signal} /></TableCell>
                <TableCell className="py-3 hidden md:table-cell"><MomentumSignalBadge signal={item.momentum_signal} /></TableCell>
                <TableCell className="py-3 hidden md:table-cell"><ExtensionBadge signal={item.extension_signal} /></TableCell>
                <TableCell className={`py-3 text-right tabular-nums text-xs hidden lg:table-cell ${item.dist_52w_pct >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                  {item.dist_52w_pct >= 0 ? "+" : ""}{(item.dist_52w_pct * 100).toFixed(1)}%
                </TableCell>
                <TableCell className="py-3 text-right tabular-nums text-zinc-300 text-xs pr-4 hidden lg:table-cell">${item.high_52w.toFixed(2)}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={10} className="py-10 text-center text-sm text-zinc-500">
                No results match your search
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination controls */}
      <div className="flex items-center justify-between border-t border-zinc-800/60 px-4 py-3">
        <span className="text-[11px] text-zinc-400 tabular-nums">
          {filtered.length > 0 ? `${start}–${end} of ${filtered.length.toLocaleString()}` : "0 results"}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-zinc-400 tabular-nums">
            Page {safePage + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="h-7 px-2.5 text-xs border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="h-7 px-2.5 text-xs border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
