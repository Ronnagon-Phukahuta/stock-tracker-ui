export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { getSectorRotation } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { SectorRotationDashboard } from "./SectorRotationDashboard";

export default async function SectorRotationPage() {
  const result = await getSectorRotation().catch(() => null);
  const items = result?.items ?? [];

  const timestamp = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <header className="border-b border-zinc-800/80 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h1 className="text-sm font-semibold tracking-[0.15em] text-zinc-200 uppercase">
            Stock Tracker
            <span className="ml-2 text-zinc-400 font-normal tracking-normal normal-case">
              // Sector Rotation
            </span>
          </h1>
          {items.length > 0 && (
            <span className="text-[10px] text-zinc-400 tabular-nums">
              {items.length} sectors
            </span>
          )}
        </div>
        <span className="text-xs text-zinc-400 tabular-nums">{timestamp}</span>
      </header>

      <div className="px-6 py-5 max-w-screen-2xl mx-auto">
        {items.length === 0 ? (
          <Card className="bg-zinc-900/50 border-zinc-800/80">
            <CardContent className="py-10 text-center text-zinc-500 text-sm">
              No sector data available
            </CardContent>
          </Card>
        ) : (
          <SectorRotationDashboard items={items} />
        )}
      </div>
    </main>
  );
}
