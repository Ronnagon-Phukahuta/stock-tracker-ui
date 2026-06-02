export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { getAnalytics } from "@/lib/api";
import { AnalyticsDashboard } from "./AnalyticsDashboard";

export default async function AnalyticsPage() {
  let data = null;
  let error: string | null = null;

  try {
    data = await getAnalytics();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load analytics";
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8">
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">Options Analytics</h1>
          <p className="text-xs text-zinc-500 mt-1">Performance summary across all closed options trades</p>
        </div>

        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 text-sm text-red-400">
            {error}
          </div>
        ) : data ? (
          <AnalyticsDashboard data={data} />
        ) : (
          <div className="text-sm text-zinc-500">No data available.</div>
        )}
      </div>
    </main>
  );
}
