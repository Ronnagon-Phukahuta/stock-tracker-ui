"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PortfolioPosition } from "@/lib/api";

async function saveCashInvested(
  positions: PortfolioPosition[],
  total_cash_invested: number,
): Promise<void> {
  const res = await fetch("/api/portfolio", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ positions, total_cash_invested }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
}

export function CashInvestedEditor({
  positions,
  initialValue,
}: {
  positions: PortfolioPosition[];
  initialValue: number;
}) {
  const [value, setValue] = useState(initialValue.toFixed(2));
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSave() {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0) {
      setError("Enter a valid amount");
      return;
    }
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await saveCashInvested(positions, parsed);
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-zinc-500 text-sm">$</span>
      <input
        value={value}
        onChange={(e) => { setValue(e.target.value); setSaved(false); }}
        onBlur={handleSave}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
        inputMode="decimal"
        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 tabular-nums focus:outline-none focus:border-zinc-500 w-32"
      />
      {isPending && <span className="text-[10px] text-zinc-500">saving…</span>}
      {saved && !isPending && <span className="text-[10px] text-emerald-400">saved</span>}
      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </div>
  );
}
