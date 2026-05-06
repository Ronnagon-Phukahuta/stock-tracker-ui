"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PortfolioPosition } from "@/lib/api";
import { Button } from "@/components/ui/button";

async function savePositions(positions: PortfolioPosition[]): Promise<void> {
  const res = await fetch("/api/portfolio", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ positions }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Draft {
  ticker: string;
  avg_price: string;
  invested_usd: string;
  entry_date: string;
  label: string;
}

function positionToDraft(p: PortfolioPosition): Draft {
  return {
    ticker: p.ticker,
    avg_price: p.entry_price.toString(),
    invested_usd: p.invested_usd.toString(),
    entry_date: p.entry_date,
    label: p.label,
  };
}

function emptyDraft(): Draft {
  return { ticker: "", avg_price: "", invested_usd: "", entry_date: "", label: "" };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PortfolioEditor({
  positions,
}: {
  positions: PortfolioPosition[];
}) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function openModal() {
    setDrafts(positions.length > 0 ? positions.map(positionToDraft) : [emptyDraft()]);
    setError(null);
    setOpen(true);
  }

  function updateDraft(i: number, field: keyof Draft, value: string) {
    setDrafts((prev) =>
      prev.map((d, idx) => (idx === i ? { ...d, [field]: value } : d)),
    );
  }

  function addRow() {
    setDrafts((prev) => [...prev, emptyDraft()]);
  }

  function removeRow(i: number) {
    setDrafts((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleSave() {
    const parsed: PortfolioPosition[] = [];
    for (const d of drafts) {
      const ticker = d.ticker.trim().toUpperCase();
      if (!ticker) continue; // skip blank rows
      const entry_price = parseFloat(d.avg_price);
      const invested_usd = parseFloat(d.invested_usd);
      if (isNaN(entry_price) || entry_price <= 0) {
        setError(`Invalid avg price for ${ticker}`);
        return;
      }
      if (isNaN(invested_usd) || invested_usd <= 0) {
        setError(`Invalid invested amount for ${ticker}`);
        return;
      }
      parsed.push({
        ticker,
        shares: invested_usd / entry_price,
        entry_price,
        invested_usd,
        entry_date: d.entry_date.trim(),
        label: d.label.trim(),
      });
    }

    startTransition(async () => {
      try {
        await savePositions(parsed);
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={openModal}
        className="text-xs border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
      >
        Edit Positions
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="relative z-10 bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col font-mono mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-100 tracking-wide">
                Edit Positions
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-zinc-200 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-2">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-[10px] text-zinc-500 uppercase tracking-widest px-1 mb-1">
                <span>Ticker</span>
                <span>Avg Price ($)</span>
                <span>Invested ($)</span>
                <span className="w-6" />
              </div>

              {drafts.map((d, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center"
                >
                  <input
                    value={d.ticker}
                    onChange={(e) =>
                      updateDraft(i, "ticker", e.target.value.toUpperCase())
                    }
                    placeholder="AAPL"
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 uppercase placeholder:normal-case placeholder:text-zinc-600"
                  />
                  <input
                    value={d.avg_price}
                    onChange={(e) => updateDraft(i, "avg_price", e.target.value)}
                    placeholder="0.00"
                    inputMode="decimal"
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 tabular-nums focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
                  />
                  <input
                    value={d.invested_usd}
                    onChange={(e) =>
                      updateDraft(i, "invested_usd", e.target.value)
                    }
                    placeholder="0.00"
                    inputMode="decimal"
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 tabular-nums focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
                  />
                  <button
                    onClick={() => removeRow(i)}
                    className="text-zinc-600 hover:text-red-400 text-lg leading-none w-6 text-center"
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                onClick={addRow}
                className="text-xs text-violet-400 hover:text-violet-300 mt-3 block"
              >
                + Add position
              </button>
            </div>

            {/* Error */}
            {error && (
              <p className="px-5 py-2 text-xs text-red-400 border-t border-zinc-800">
                {error}
              </p>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                className="text-xs border-zinc-700 text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isPending}
                className="text-xs bg-violet-600 hover:bg-violet-500 text-white border-0"
              >
                {isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
