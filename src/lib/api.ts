// ---------------------------------------------------------------------------
// Typed API client for the stock-tracker backend
// Base URL  : NEXT_PUBLIC_API_URL  (accessible on server + client)
// Auth token: INTERNAL_API_TOKEN   (server-side only — never expose to browser)
// Set NEXT_PUBLIC_USE_MOCK=true to use local mock data instead of real API
// ---------------------------------------------------------------------------

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const API_TOKEN = process.env.INTERNAL_API_TOKEN ?? "";
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

// ---------------------------------------------------------------------------
// Generic response shapes
// ---------------------------------------------------------------------------

export interface ListResponse<T> {
  items: T[];
  count: number;
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type Signal = "BUY_CANDIDATE" | "WATCH" | "WAIT" | "AVOID";

export interface StockRanking {
  ticker: string;
  company_name?: string;
  signal: Signal;
  trend: string;
  momentum_score: number;
  rank_momentum: number;
  sector: string;
  theme: string;
  price: number;
  return_30d: number;
  return_90d: number;
  return_180d: number;
  date: string;
}

export interface RelativeStrength {
  ticker: string;
  rank: number;
  rs_score: number;
  return_30d: number;
  return_90d: number;
}

export interface SignalProfile {
  signal_profile: string;
  watchlist_rows: number;
  updated_at_utc: string;
  [key: string]: unknown;
}

export interface WatchlistItem {
  ticker: string;
  price: number;
  momentum_signal: string;
  relative_strength_rank: number;
  extension_signal: string;
  watchlist_signal: string;
  high_52w: number;
  dist_52w_pct: number;
  rs_trend: string;
}

export interface StockSnapshot {
  ticker: string;
  price: number;
  change_1d: number;
  change_1w: number;
  change_1m: number;
  change_ytd: number;
  entry_low: number;
  entry_high: number;
  stop_loss: number;
  target_price: number;
  risk_reward: number;
  trade_probability: number;
  recommendation: string;
}

export interface LatestRanking {
  ticker: string;
  signal: Signal;
  rank: number;
  score: number;
  date: string;
}

export interface MarketPrice {
  ticker: string;
  date: string;
  price: number;
  volume: number;
}

export interface Momentum {
  ticker: string;
  momentum_score: number;
  date: string;
}

export interface SpyBenchmark {
  date: string;
  close: number;
  return_pct: number;
}

export interface MarketRegime {
  date: string;
  total_stocks: number;
  above_ma50: number;
  above_ma200: number;
  pct_above_ma50: number;
  pct_above_ma200: number;
  bullish_count: number;
  neutral_count: number;
  bearish_count: number;
}

export interface VixHistory {
  date: string;
  signal: string;
  spy_price: number;
  ema9: number;
  ema21: number;
  vix: number;
}

export interface DxyHistory {
  date: string;
  close: number;
}

export interface EtfFlow {
  ticker: string;
  date: string;
  flow: number;
  [key: string]: unknown;
}

export interface EntryQualityScore {
  ticker: string;
  entry_quality: number;
  date: string;
  [key: string]: unknown;
}

// RL / Operational
export interface RlPaperStatePosition {
  entry_price: number;
  shares: number;
  cost_basis_usd: number;
  entry_date: string;
}

export interface RlPaperState {
  starting_capital_usd: number;
  cash_usd: number;
  positions: Record<string, RlPaperStatePosition>;
  realized_pnl_usd: number;
  trades_count: number;
  wins_count: number;
}

export interface RlPaperCycle {
  ts: string;
  cash_usd: number;
  positions_count: number;
  position_value_usd: number;
  unrealized_pnl_usd: number;
  realized_pnl_usd: number;
  equity_usd: number;
  total_return_pct: number;
  signal_date: string;
}

export interface RlPaperTrade {
  ts: string;
  event: "BUY" | "SELL";
  ticker: string;
  price: number;
  shares: number;
  notional_usd: number;
  hold_days: number | null;
  realized_pnl_usd: number | null;
  trade_result: string | null;
  exit_reason: string | null;
}

export interface RlLiveSignal {
  date: string;
  ticker: string;
  signal: Signal;
  watchlist_signal: string;
  score: number;
  allocation_weight: number;
  price: number;
  source: string;
}

// Health
export interface HealthResponse {
  service: string;
  environment: string;
  [key: string]: unknown;
}

// Universe
export interface UniverseResponse {
  items: string[];
}

// ML
export interface MlScoreRequest {
  ticker: string;
  feature_vector: number[];
  model_name: string;
  threshold?: number;
}

export interface MlScoreResponse {
  ticker: string;
  score: number;
  prediction: string;
  model_name: string;
  [key: string]: unknown;
}

// DuckDB proxy
export interface DuckDbReadRequest {
  db_path: string;
  sql: string;
  params?: unknown[];
}

export interface DuckDbReadResponse {
  rows: Record<string, unknown>[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Core fetch helper
// ---------------------------------------------------------------------------

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(path, BASE_URL || "http://localhost");
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  // When BASE_URL is set, return the full URL string; otherwise strip the fake origin.
  return BASE_URL ? url.toString() : `${path}${url.search}`;
}

async function apiFetch<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
  init?: RequestInit,
): Promise<T> {
  const url = buildUrl(path, params);
  const res = await fetch(url, {
    ...init,
    headers: {
      "X-API-Token": API_TOKEN,
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status} ${res.statusText} — ${url}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// 1. Stock Screener  (40_Stock_Screener.py)
// ---------------------------------------------------------------------------

export function getStockRankings(params?: {
  limit?: number;
  date_from?: string;
}): Promise<ListResponse<StockRanking>> {
  if (USE_MOCK) {
    return import("./mock-data").then(({ MOCK_RANKINGS }) => {
      const items = MOCK_RANKINGS.slice(0, params?.limit ?? MOCK_RANKINGS.length);
      return { items, count: items.length };
    });
  }
  return apiFetch("/v1/analytics/stock-rankings", params);
}

export function getLatestStockRankings(params?: {
  limit?: number;
}): Promise<ListResponse<StockRanking>> {
  if (USE_MOCK) {
    return import("./mock-data").then(({ MOCK_RANKINGS }) => {
      const items = MOCK_RANKINGS.slice(0, params?.limit ?? MOCK_RANKINGS.length);
      return { items, count: items.length };
    });
  }
  return apiFetch("/v1/analytics/stock-rankings/latest", params);
}

export function getRelativeStrength(params?: {
  limit?: number;
}): Promise<ListResponse<RelativeStrength>> {
  if (USE_MOCK) {
    return import("./mock-data").then(({ MOCK_RELATIVE_STRENGTH }) => {
      const items = MOCK_RELATIVE_STRENGTH.slice(0, params?.limit ?? MOCK_RELATIVE_STRENGTH.length);
      return { items, count: items.length };
    });
  }
  return apiFetch("/v1/curated/relative-strength", params);
}

export function getSignalProfile(): Promise<SignalProfile> {
  if (USE_MOCK) {
    return import("./mock-data").then(({ MOCK_SIGNAL_PROFILE }) => MOCK_SIGNAL_PROFILE);
  }
  return apiFetch("/v1/meta/signal-profile");
}

// ---------------------------------------------------------------------------
// 2. Watchlist  (10_Watchlist.py)
// ---------------------------------------------------------------------------

export function getLatestWatchlist(params?: {
  limit?: number;
}): Promise<ListResponse<WatchlistItem>> {
  if (USE_MOCK) {
    return import("./mock-data").then(({ MOCK_WATCHLIST }) => {
      const items = MOCK_WATCHLIST.slice(0, params?.limit ?? MOCK_WATCHLIST.length);
      return { items, count: items.length };
    });
  }
  return apiFetch("/v1/analytics/watchlist/latest", params);
}

export function getWatchlist(params?: {
  limit?: number;
}): Promise<ListResponse<WatchlistItem>> {
  if (USE_MOCK) {
    return import("./mock-data").then(({ MOCK_WATCHLIST }) => {
      const items = MOCK_WATCHLIST.slice(0, params?.limit ?? MOCK_WATCHLIST.length);
      return { items, count: items.length };
    });
  }
  return apiFetch("/v1/analytics/watchlist", params);
}

// ---------------------------------------------------------------------------
// 3. Stock Snapshot  (12_Stock_Snapshot.py)
// ---------------------------------------------------------------------------

export function getStockSnapshot(params?: {
  limit?: number;
}): Promise<ListResponse<StockSnapshot>> {
  if (USE_MOCK) {
    return import("./mock-data").then(({ MOCK_SNAPSHOT }) => {
      const items = MOCK_SNAPSHOT.slice(0, params?.limit ?? MOCK_SNAPSHOT.length);
      return { items, count: items.length };
    });
  }
  return apiFetch("/v1/curated/stock-snapshot", params);
}

export function getLatestRankings(params?: {
  limit?: number;
}): Promise<ListResponse<LatestRanking>> {
  if (USE_MOCK) {
    return import("./mock-data").then(({ MOCK_LATEST_RANKINGS }) => {
      const items = MOCK_LATEST_RANKINGS.slice(0, params?.limit ?? MOCK_LATEST_RANKINGS.length);
      return { items, count: items.length };
    });
  }
  return apiFetch("/v1/operational/latest-rankings", params);
}

// ---------------------------------------------------------------------------
// 4. Portfolio Monitor  (20_Portfolio_Monitor.py)
// ---------------------------------------------------------------------------

export function getPrices(params?: {
  limit?: number;
  tickers?: string;
  since_date?: string;
}): Promise<ListResponse<MarketPrice>> {
  if (USE_MOCK) {
    return import("./mock-data").then(({ MOCK_PRICES_ALL }) => {
      const requested = params?.tickers?.split(",").map((t) => t.trim()) ?? [];
      const since = params?.since_date ?? "2000-01-01";
      const items = MOCK_PRICES_ALL.filter(
        (p) => (requested.length === 0 || requested.includes(p.ticker)) && p.date >= since
      );
      return { items, count: items.length };
    });
  }
  return apiFetch("/v1/market/prices", params);
}

export function getMomentum(params?: {
  limit?: number;
}): Promise<ListResponse<Momentum>> {
  if (USE_MOCK) {
    return import("./mock-data").then(({ MOCK_MOMENTUM }) => {
      const items = MOCK_MOMENTUM.slice(0, params?.limit ?? MOCK_MOMENTUM.length);
      return { items, count: items.length };
    });
  }
  return apiFetch("/v1/curated/momentum", params);
}

export function getSpyBenchmark(params: {
  start_date: string;
  end_date: string;
}): Promise<ListResponse<SpyBenchmark>> {
  return apiFetch("/v1/market/spy-benchmark", params);
}

export interface PortfolioPosition {
  ticker: string;
  shares: number;
  entry_price: number;
  invested_usd: number;
  entry_date: string;
  label: string;
}

export interface PortfolioPositionsResponse extends ListResponse<PortfolioPosition> {
  total_cash_invested: number;
}

export function getPortfolioPositions(): Promise<PortfolioPositionsResponse> {
  if (USE_MOCK) {
    return import("./mock-data").then(({ MOCK_PORTFOLIO }) => MOCK_PORTFOLIO);
  }
  return apiFetch("/v1/portfolio/positions");
}

export function updatePortfolioPositions(
  positions: PortfolioPosition[],
  total_cash_invested?: number,
): Promise<{ updated: number }> {
  return apiFetch("/v1/portfolio/positions", undefined, {
    method: "PUT",
    body: JSON.stringify({ positions, total_cash_invested }),
  });
}

// ---------------------------------------------------------------------------
// 5. Home / Overview  (Home.py)
// ---------------------------------------------------------------------------

export function getLatestMarketRegime(params?: {
  limit?: number;
}): Promise<ListResponse<MarketRegime>> {
  if (USE_MOCK) {
    return import("./mock-data").then(({ MOCK_MARKET_REGIME }) => ({
      items: MOCK_MARKET_REGIME,
      count: MOCK_MARKET_REGIME.length,
    }));
  }
  return apiFetch("/v1/analytics/market-regime/latest", params);
}

export function getMarketRegime(params?: {
  limit?: number;
}): Promise<ListResponse<MarketRegime>> {
  if (USE_MOCK) {
    return import("./mock-data").then(({ MOCK_MARKET_REGIME }) => ({
      items: MOCK_MARKET_REGIME,
      count: MOCK_MARKET_REGIME.length,
    }));
  }
  return apiFetch("/v1/analytics/market-regime", params);
}

export function getVixHistory(params?: {
  limit?: number;
}): Promise<ListResponse<VixHistory>> {
  if (USE_MOCK) {
    return import("./mock-data").then(({ MOCK_VIX_HISTORY }) => {
      const items = MOCK_VIX_HISTORY.slice(0, params?.limit ?? MOCK_VIX_HISTORY.length);
      return { items, count: items.length };
    });
  }
  return apiFetch("/v1/analytics/vix-history", params);
}

export function getDxyHistory(params?: {
  limit?: number;
}): Promise<ListResponse<DxyHistory>> {
  if (USE_MOCK) {
    return import("./mock-data").then(({ MOCK_DXY_HISTORY }) => {
      const items = MOCK_DXY_HISTORY.slice(0, params?.limit ?? MOCK_DXY_HISTORY.length);
      return { items, count: items.length };
    });
  }
  return apiFetch("/v1/analytics/dxy-history", params);
}

// ---------------------------------------------------------------------------
// 6. RL vs Human  (72_RL_vs_Human.py)
// ---------------------------------------------------------------------------

/** Returns a single object — NOT items-wrapped. */
export function getRlPaperState(): Promise<RlPaperState> {
  if (USE_MOCK) {
    return import("./mock-data").then(({ MOCK_RL_STATE }) => MOCK_RL_STATE);
  }
  return apiFetch("/v1/operational/rl-paper-state");
}

export function getRlPaperCycles(params?: {
  limit?: number;
}): Promise<ListResponse<RlPaperCycle>> {
  if (USE_MOCK) {
    return import("./mock-data").then(({ MOCK_RL_CYCLES }) => {
      const items = MOCK_RL_CYCLES.slice(0, params?.limit ?? MOCK_RL_CYCLES.length);
      return { items, count: items.length };
    });
  }
  return apiFetch("/v1/operational/rl-paper-cycles", params);
}

export function getRlPaperTrades(params?: {
  limit?: number;
}): Promise<ListResponse<RlPaperTrade>> {
  if (USE_MOCK) {
    return import("./mock-data").then(({ MOCK_RL_TRADES }) => {
      const items = MOCK_RL_TRADES.slice(0, params?.limit ?? MOCK_RL_TRADES.length);
      return { items, count: items.length };
    });
  }
  return apiFetch("/v1/operational/rl-paper-trades", params);
}

export function getRlLiveSignals(params?: {
  limit?: number;
}): Promise<ListResponse<RlLiveSignal>> {
  if (USE_MOCK) {
    return import("./mock-data").then(({ MOCK_RL_SIGNALS }) => {
      const items = MOCK_RL_SIGNALS.slice(0, params?.limit ?? MOCK_RL_SIGNALS.length);
      return { items, count: items.length };
    });
  }
  return apiFetch("/v1/operational/rl-live-signals", params);
}

// ---------------------------------------------------------------------------
// Utility / shared endpoints
// ---------------------------------------------------------------------------

export function getHealth(): Promise<HealthResponse> {
  return apiFetch("/health");
}

export function getEtfFlow(params?: {
  limit?: number;
}): Promise<ListResponse<EtfFlow>> {
  return apiFetch("/v1/analytics/etf-flow", params);
}

export function getEntryQualityScores(params?: {
  limit?: number;
}): Promise<ListResponse<EntryQualityScore>> {
  return apiFetch("/v1/analytics/entry-quality-scores", params);
}

export function getAiUniverse(): Promise<UniverseResponse> {
  return apiFetch("/v1/meta/universe/ai");
}

export function getEnergyUniverse(): Promise<UniverseResponse> {
  return apiFetch("/v1/meta/universe/energy");
}

export function postMlScore(body: MlScoreRequest): Promise<MlScoreResponse> {
  return apiFetch("/v1/ml/score", undefined, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function postDuckDbRead(body: DuckDbReadRequest): Promise<DuckDbReadResponse> {
  return apiFetch("/v1/storage/duckdb/read", undefined, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Options Trading
// ---------------------------------------------------------------------------

export interface OptionsTrade {
  date: string;
  ticker: string;
  type: string;
  strike: number;
  expiry: string;
  contracts: number;
  pnl: number;
  note?: string | null;
}

export function getOptionsTrades(): Promise<ListResponse<OptionsTrade>> {
  return apiFetch("/v1/portfolio/options-trades");
}

// ---------------------------------------------------------------------------
// Options Signal
// ---------------------------------------------------------------------------

export interface OptionsSignalTicker {
  ticker: string;
  action: string;
  signal_strength: string | null;
  gate_reason: string | null;
  within_budget: boolean | null;
  latest_est_cost: number | null;
  hit_rate: number | null;
  hit_rate_recent: number | null;
  score_holistic: number | null;
  rsi: number | null;
  bb_position: string | null;
  stoch_k: number | null;
  call_signals: number | null;
  put_signals: number | null;
  regime_label: string | null;
  dte_range: string | null;
  take_profit_pct: number | null;
  stop_loss_pct: number | null;
  candle_direction: string | null;
  candle_streak_days: number | null;
}

export interface OptionsSignalResponse {
  generated_at: string | null;
  action_now: string;
  action_bias_count: string;
  market_structure: string | null;
  market_structure_reason: string | null;
  vix_latest: number | null;
  vix_label: string | null;
  breadth_pct: number | null;
  tickers: OptionsSignalTicker[];
}

export function getOptionsSignal(): Promise<OptionsSignalResponse> {
  return apiFetch("/v1/options/signal");
}

// ---------------------------------------------------------------------------
// Candle Analysis
// ---------------------------------------------------------------------------

export interface CandleAnalysisRow {
  n: number;
  direction: string;
  obs: number;
  reversal_pct: number;
  fwd1_pct: number;
  fwd3_pct: number;
  fwd7_pct: number;
  is_threshold: boolean;
}

export interface CandleAnalysisRegime {
  total_days: number;
  rows: CandleAnalysisRow[];
}

export interface CandleAnalysisResponse {
  generated_at: string | null;
  spy_date_range: { from: string; to: string } | null;
  spy_total_days: number | null;
  regimes: Record<string, CandleAnalysisRegime>;
  thresholds: Record<string, { direction: string; min_streak: number }> | null;
}

export function getCandleAnalysis(): Promise<CandleAnalysisResponse> {
  return apiFetch("/v1/options/candle-analysis");
}
