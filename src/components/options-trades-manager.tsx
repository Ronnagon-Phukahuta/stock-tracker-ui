"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { OptionsTrade } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtUsd(v: number) {
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// API helpers (call Next.js API routes which proxy with INTERNAL_API_TOKEN)
// ---------------------------------------------------------------------------

async function apiAddTrade(trade: Omit<OptionsTrade, never>): Promise<void> {
  const res = await fetch("/api/options-trades", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trade),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
}

async function apiDeleteTrade(index: number): Promise<void> {
  const res = await fetch(`/api/options-trades/${index}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// Form draft type
// ---------------------------------------------------------------------------

interface TradeDraft {
  date: string;
  ticker: string;
  type: "CALL" | "PUT";
  strike: string;
  expiry: string;
  contracts: string;
  pnl: string;
  note: string;
}

function emptyDraft(): TradeDraft {
  return {
    date: todayStr(),
    ticker: "SPY",
    type: "CALL",
    strike: "",
    expiry: "",
    contracts: "1",
    pnl: "",
    note: "",
  };
}

// ---------------------------------------------------------------------------
// Modal component
// ---------------------------------------------------------------------------

function AddTradeModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<TradeDraft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set(field: keyof TradeDraft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const strike = parseFloat(draft.strike);
    const contracts = parseInt(draft.contracts, 10);
    const pnl = parseFloat(draft.pnl);

    if (!draft.date) { setError("Date is required"); return; }
    if (!draft.ticker.trim()) { setError("Ticker is required"); return; }
    if (isNaN(strike) || strike <= 0) { setError("Enter a valid strike price"); return; }
    if (!draft.expiry) { setError("Expiry is required"); return; }
    if (isNaN(contracts) || contracts < 1) { setError("Contracts must be at least 1"); return; }
    if (isNaN(pnl)) { setError("Enter a valid P&L (can be negative)"); return; }

    setError(null);
    startTransition(async () => {
      try {
        await apiAddTrade({
          date: draft.date,
          ticker: draft.ticker.trim().toUpperCase(),
          type: draft.type,
          strike,
          expiry: draft.expiry,
          contracts,
          pnl,
          note: draft.note.trim() || null,
        });
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <p className="text-sm font-semibold text-zinc-100 tracking-wide">Add Options Trade</p>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          {/* Date + Ticker */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-400 mb-1">Date</label>
              <input
                type="date"
                value={draft.date}
                onChange={(e) => set("date", e.target.value)}
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-400 mb-1">Ticker</label>
              <input
                type="text"
                value={draft.ticker}
                onChange={(e) => set("ticker", e.target.value.toUpperCase())}
                placeholder="SPY"
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 uppercase placeholder-zinc-600 focus:outline-none focus:border-violet-500 font-mono"
              />
            </div>
          </div>

          {/* Type + Strike */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-400 mb-1">Type</label>
              <select
                value={draft.type}
                onChange={(e) => set("type", e.target.value as "CALL" | "PUT")}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 font-mono text-zinc-100"
              >
                <option value="CALL">CALL</option>
                <option value="PUT">PUT</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-400 mb-1">Strike</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={draft.strike}
                onChange={(e) => set("strike", e.target.value)}
                placeholder="500.00"
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 font-mono"
              />
            </div>
          </div>

          {/* Expiry + Contracts */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-400 mb-1">Expiry</label>
              <input
                type="date"
                value={draft.expiry}
                onChange={(e) => set("expiry", e.target.value)}
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-400 mb-1">Contracts</label>
              <input
                type="number"
                min="1"
                step="1"
                value={draft.contracts}
                onChange={(e) => set("contracts", e.target.value)}
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono"
              />
            </div>
          </div>

          {/* P&L */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-zinc-400 mb-1">P&amp;L (can be negative)</label>
            <input
              type="number"
              step="0.01"
              value={draft.pnl}
              onChange={(e) => set("pnl", e.target.value)}
              placeholder="-250.00"
              required
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 font-mono"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-zinc-400 mb-1">Note (optional)</label>
            <input
              type="text"
              value={draft.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder='e.g. "demo" or leave blank'
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 font-mono"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 text-zinc-400 hover:text-zinc-100 border border-zinc-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="flex-1 bg-violet-600 hover:bg-violet-500 text-white border-0"
            >
              {isPending ? "Saving…" : "Add Trade"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function OptionsTradesManager({ initialTrades }: { initialTrades: OptionsTrade[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const trades = [...initialTrades].sort((a, b) => b.date.localeCompare(a.date));

  function handleSaved() {
    setShowAdd(false);
    router.refresh();
  }

  function handleDeleteClick(index: number) {
    setDeleteError(null);
    setDeletingIndex(index);
  }

  function handleDeleteConfirm() {
    if (deletingIndex === null) return;
    startTransition(async () => {
      try {
        await apiDeleteTrade(deletingIndex);
        setDeletingIndex(null);
        router.refresh();
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  // -------------------------------------------------------------------------
  // Summary stats
  // -------------------------------------------------------------------------
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const wins = trades.filter((t) => t.pnl > 0).length;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : null;
  const avgPnl = trades.length > 0 ? totalPnl / trades.length : null;

  return (
    <>
      {showAdd && (
        <AddTradeModal onClose={() => setShowAdd(false)} onSaved={handleSaved} />
      )}

      {/* Delete confirm dialog */}
      {deletingIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget && !isPending) setDeletingIndex(null); }}
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm mx-4 shadow-2xl">
            <div className="px-5 py-4 border-b border-zinc-800">
              <p className="text-sm font-semibold text-zinc-100">Delete this trade?</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-zinc-400">This action cannot be undone.</p>
              {deleteError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {deleteError}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setDeletingIndex(null); setDeleteError(null); }}
                  disabled={isPending}
                  className="flex-1 text-zinc-400 hover:text-zinc-100 border border-zinc-700"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDeleteConfirm}
                  disabled={isPending}
                  className="flex-1"
                >
                  {isPending ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="space-y-4">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-[10px] uppercase tracking-widest text-zinc-400">Options Trading History</p>
            <span className="text-[10px] text-zinc-600">{trades.length} trades</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAdd(true)}
            className="text-xs border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700 text-zinc-200"
          >
            + Add Trade
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Total Options P&L */}
          <Card
            className={`bg-zinc-900/50 border-zinc-800/80 border-t-2 ${
              totalPnl >= 0 ? "border-t-emerald-500/40" : "border-t-red-500/40"
            }`}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">Total Options P&amp;L</p>
              <p
                className={`text-2xl font-semibold tabular-nums ${
                  totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {totalPnl >= 0 ? "+" : "-"}{fmtUsd(Math.abs(totalPnl))}
              </p>
              <p className="text-[10px] text-zinc-400 mt-2">all trades combined</p>
            </CardContent>
          </Card>

          {/* Win Rate */}
          <Card className="bg-zinc-900/50 border-zinc-800/80 border-t-2 border-t-sky-500/40">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">Win Rate</p>
              <p className="text-2xl font-semibold tabular-nums text-sky-400">
                {winRate !== null ? `${winRate.toFixed(1)}%` : "—"}
              </p>
              <p className="text-[10px] text-zinc-400 mt-2">
                {wins} / {trades.length} trades
              </p>
            </CardContent>
          </Card>

          {/* Total Trades */}
          <Card className="bg-zinc-900/50 border-zinc-800/80 border-t-2 border-t-violet-500/40">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">Total Trades</p>
              <p className="text-2xl font-semibold tabular-nums text-zinc-100">{trades.length}</p>
              <p className="text-[10px] text-zinc-400 mt-2">options contracts closed</p>
            </CardContent>
          </Card>

          {/* Avg P&L per Trade */}
          <Card
            className={`bg-zinc-900/50 border-zinc-800/80 border-t-2 ${
              (avgPnl ?? 0) >= 0 ? "border-t-amber-500/40" : "border-t-red-500/40"
            }`}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-3">Avg P&amp;L / Trade</p>
              {avgPnl !== null ? (
                <p
                  className={`text-2xl font-semibold tabular-nums ${
                    avgPnl >= 0 ? "text-amber-400" : "text-red-400"
                  }`}
                >
                  {avgPnl >= 0 ? "+" : "-"}{fmtUsd(Math.abs(avgPnl))}
                </p>
              ) : (
                <p className="text-2xl font-semibold tabular-nums text-zinc-500">—</p>
              )}
              <p className="text-[10px] text-zinc-400 mt-2">per closed trade</p>
            </CardContent>
          </Card>
        </div>

        {/* Trade history table */}
        <div className="rounded-lg border border-zinc-800/80 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/80">
            <p className="text-[10px] uppercase tracking-widest text-zinc-400">Trade History</p>
          </div>
          {trades.length === 0 ? (
            <div className="px-4 py-8 text-center text-zinc-500 text-xs">No options trades found.</div>
          ) : (
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-zinc-800/60">
                  <th className="text-left text-[10px] uppercase tracking-widest text-zinc-500 px-4 py-2">Date</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-zinc-500 px-4 py-2">Ticker</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-zinc-500 px-4 py-2">Type</th>
                  <th className="text-right text-[10px] uppercase tracking-widest text-zinc-500 px-4 py-2">Strike</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-zinc-500 px-4 py-2">Expiry</th>
                  <th className="text-right text-[10px] uppercase tracking-widest text-zinc-500 px-4 py-2">Contracts</th>
                  <th className="text-right text-[10px] uppercase tracking-widest text-zinc-500 px-4 py-2">P&amp;L</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-zinc-500 px-4 py-2">Note</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {trades.map((trade, i) => (
                  <tr key={i} className="border-b border-zinc-800/40 hover:bg-zinc-800/20 group">
                    <td className="px-4 py-3 text-zinc-300 tabular-nums">{trade.date.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-zinc-100 font-semibold">{trade.ticker}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-semibold uppercase ${
                          trade.type?.toUpperCase() === "CALL" ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {trade.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                      {fmtUsd(trade.strike)}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 tabular-nums">{trade.expiry?.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300">{trade.contracts}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={trade.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {trade.pnl >= 0 ? "+" : "-"}{fmtUsd(Math.abs(trade.pnl))}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {trade.note?.toLowerCase() === "demo" ? (
                        <span className="inline-flex items-center rounded-full bg-violet-500/20 border border-violet-500/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-violet-300">
                          Demo
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-xs">{trade.note ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <button
                        onClick={() => handleDeleteClick(i)}
                        title="Delete trade"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-red-400 text-base leading-none p-1 rounded"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
