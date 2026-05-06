"use client";

import { useState } from "react";
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

export interface PortfolioRow {
  ticker: string;
  shares: number;
  entryPrice: number;
  currentPrice: number | null;
  marketValue: number | null;
  costBasis: number;
  pnlDollar: number | null;
  pnlPct: number | null;
  change1d: number | null;
  signal: string;
  momentumScore: number | null;
}

type SortKey = keyof PortfolioRow;
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SignalBadge({ signal }: { signal: string }) {
  const upper = signal.toUpperCase();
  const cls =
    upper === "BUY_CANDIDATE" || upper === "BUY CANDIDATE" || upper === "BUY"
      ? "bg-green-500/20 text-green-400 border border-green-500/50"
      : upper === "WATCH"
        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
        : upper === "WAIT"
          ? "bg-blue-500/20 text-blue-400 border border-blue-500/50"
          : upper === "AVOID"
            ? "bg-red-500/20 text-red-400 border border-red-500/50"
            : "bg-zinc-500/20 text-zinc-400 border border-zinc-600/50";
  const label =
    signal === "—"
      ? "—"
      : signal.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={`${cls} px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap`}>
      {label}
    </span>
  );
}

function PctCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-zinc-500 text-sm">—</span>;
  const cls = value >= 0 ? "text-emerald-300" : "text-red-300";
  return (
    <span className={`${cls} tabular-nums text-sm`}>
      {value >= 0 ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

function DollarCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-zinc-500 text-sm">—</span>;
  const cls = value >= 0 ? "text-emerald-300" : "text-red-300";
  return (
    <span className={`${cls} tabular-nums text-sm`}>
      {value >= 0 ? "+" : "-"}$
      {Math.abs(value).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </span>
  );
}

function fmt$(value: number) {
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SortableHead({
  label,
  sortKey,
  currentKey,
  dir,
  onClick,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === currentKey;
  return (
    <TableHead
      onClick={() => onClick(sortKey)}
      className={`cursor-pointer select-none text-[10px] uppercase tracking-widest transition-colors ${
        active ? "text-zinc-200" : "text-zinc-500 hover:text-zinc-300"
      } ${className ?? ""}`}
    >
      {label} {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
    </TableHead>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PortfolioTable({ rows }: { rows: PortfolioRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("marketValue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? (typeof a[sortKey] === "string" ? "" : -Infinity);
    const bv = b[sortKey] ?? (typeof b[sortKey] === "string" ? "" : -Infinity);
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="rounded-lg border border-zinc-800/80 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800/80">
        <p className="text-[10px] uppercase tracking-widest text-zinc-400">Positions</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800/80 hover:bg-transparent">
            <SortableHead
              label="Ticker"
              sortKey="ticker"
              currentKey={sortKey}
              dir={sortDir}
              onClick={handleSort}
            />
            <SortableHead
              label="Shares"
              sortKey="shares"
              currentKey={sortKey}
              dir={sortDir}
              onClick={handleSort}
              className="text-right"
            />
            <SortableHead
              label="Entry"
              sortKey="entryPrice"
              currentKey={sortKey}
              dir={sortDir}
              onClick={handleSort}
              className="text-right hidden sm:table-cell"
            />
            <SortableHead
              label="Cost"
              sortKey="costBasis"
              currentKey={sortKey}
              dir={sortDir}
              onClick={handleSort}
              className="text-right hidden md:table-cell"
            />
            <SortableHead
              label="Price"
              sortKey="currentPrice"
              currentKey={sortKey}
              dir={sortDir}
              onClick={handleSort}
              className="text-right"
            />
            <SortableHead
              label="Value"
              sortKey="marketValue"
              currentKey={sortKey}
              dir={sortDir}
              onClick={handleSort}
              className="text-right hidden sm:table-cell"
            />
            <SortableHead
              label="P&L $"
              sortKey="pnlDollar"
              currentKey={sortKey}
              dir={sortDir}
              onClick={handleSort}
              className="text-right hidden md:table-cell"
            />
            <SortableHead
              label="P&L %"
              sortKey="pnlPct"
              currentKey={sortKey}
              dir={sortDir}
              onClick={handleSort}
              className="text-right"
            />
            <SortableHead
              label="1D%"
              sortKey="change1d"
              currentKey={sortKey}
              dir={sortDir}
              onClick={handleSort}
              className="text-right hidden xl:table-cell"
            />
            <SortableHead
              label="Momentum"
              sortKey="momentumScore"
              currentKey={sortKey}
              dir={sortDir}
              onClick={handleSort}
              className="text-right hidden xl:table-cell"
            />
            <TableHead className="text-[10px] uppercase tracking-widest text-zinc-500 hidden sm:table-cell">
              Signal
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => (
            <TableRow
              key={row.ticker}
              className="border-zinc-800/60 hover:bg-zinc-800/30 py-3"
            >
              <TableCell className="text-sm font-semibold text-zinc-100 tabular-nums py-3">
                {row.ticker}
              </TableCell>
              <TableCell className="text-sm text-zinc-300 tabular-nums text-right py-3">
                {row.shares}
              </TableCell>
              <TableCell className="text-sm text-zinc-300 tabular-nums text-right py-3 hidden sm:table-cell">
                {fmt$(row.entryPrice)}
              </TableCell>
              <TableCell className="text-sm text-zinc-300 tabular-nums text-right py-3 hidden md:table-cell">
                {fmt$(row.costBasis)}
              </TableCell>
              <TableCell className="text-sm text-zinc-300 tabular-nums text-right py-3">
                {row.currentPrice !== null ? (
                  fmt$(row.currentPrice)
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-zinc-300 tabular-nums text-right py-3 hidden sm:table-cell">
                {row.marketValue !== null ? (
                  fmt$(row.marketValue)
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
              </TableCell>
              <TableCell className="text-right py-3 hidden md:table-cell">
                <DollarCell value={row.pnlDollar} />
              </TableCell>
              <TableCell className="text-right py-3">
                <PctCell value={row.pnlPct} />
              </TableCell>
              <TableCell className="text-right py-3 hidden xl:table-cell">
                <PctCell value={row.change1d} />
              </TableCell>
              <TableCell className="text-sm text-zinc-300 tabular-nums text-right py-3 hidden xl:table-cell">
                {row.momentumScore !== null ? (
                  row.momentumScore.toFixed(2)
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
              </TableCell>
              <TableCell className="py-3 hidden sm:table-cell">
                <SignalBadge signal={row.signal} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
