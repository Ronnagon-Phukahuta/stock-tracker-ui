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
  mining_signals_active?: boolean | null;
  mining_skip_reason?: string | null;
  mining_recommended_ticker?: string | null;
  mining_edge_reason?: string | null;
  wf_consistent?: boolean | null;
  wf_cycle_note?: string | null;
  exit_advice?: string | null;
  exit_urgency?: string | null;
  rotation_signal?: string | null;
  rotation_target?: string | null;
  rotation_urgency?: string | null;
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
// Options Universe
// ---------------------------------------------------------------------------

export interface OptionsUniverseItem {
  ticker: string;
  liquidity_grade: "A" | "B" | "C" | "F";
  avg_volume_30d: number;
  spot_price: number;
  vix_latest: number;
  hold_mode: "short_hold" | "long_hold";
  days_to_earnings: number;
  earnings_flag: boolean;
  scan_date: string;
  regime?: string;
}

export interface OptionsUniverseSummary {
  total_scanned: number;
  grade_a: number;
  grade_b: number;
  grade_c: number;
  grade_f: number;
  short_hold: number;
  long_hold: number;
  earnings_blocked: number;
  filtered_count: number;
  filter_note: string;
  vix_latest: number;
  scan_date: string;
}

export interface OptionsUniverseResponse {
  items: OptionsUniverseItem[];
  count: number;
  summary: OptionsUniverseSummary;
}

export function getOptionsUniverse(
  minGrade = "B",
  excludeEarnings = true,
): Promise<OptionsUniverseResponse> {
  return apiFetch(
    `/v1/options/universe?min_grade=${minGrade}&exclude_earnings=${excludeEarnings}`,
  );
}

export interface OptionsPick {
  ticker: string;
  liquidity_grade: "A" | "B" | "C" | "F";
  hold_mode: "short_hold" | "long_hold";
  spot_price: number;
  liquid_rank: number;
  rs_rank: number;
  momentum_score: number;
  pick_score: number;
  days_to_earnings: number;
  earnings_flag: boolean;
  action_label: "ENTRY" | "WATCH" | "AVOID";
  reasoning: string;
  market_override: boolean;
}

export interface TodaysPicksResponse {
  picks: OptionsPick[];
  generated_at: string;
  vix_latest: number;
  regime: "Bull" | "Sideway" | "Bear";
  regime_has_edge: boolean;
  regime_criteria?: { note: string } | null;
  strategy: {
    hold_days: number;
    dte_min: number;
    dte_max: number;
    exit_target_pct: string;
    stop_loss_pct: string;
  };
}

export function getTodaysPicks(): Promise<TodaysPicksResponse> {
  return apiFetch("/v1/options/todays-picks");
}

// ---------------------------------------------------------------------------
// Exit Timing
// ---------------------------------------------------------------------------

export interface ExitTimingTicker {
  ticker: string;
  return_3d: number;
  bucket: string;
  bucket_label: string;
  day4_win_rate: number;
  day4_avg_incremental: number;
  recommendation: "HOLD" | "EXIT" | "NEUTRAL";
  reasoning: string;
  // Entry quality fields
  entry_bucket?: string;
  entry_bucket_label?: string;
  entry_day3_win_rate?: number;
  entry_recommendation?: "ENTER" | "WAIT" | "AVOID";
  entry_validated?: boolean;
  entry_reasoning?: string;
  // Extended fields returned when entry_date params are provided
  actual_return?: number;
  days_held?: number;
  next_hold_day?: number;
  win_rate?: number;
  avg_incremental?: number;
  validated?: boolean;
  regime_used?: string;
}

export interface ExitTimingResponse {
  generated_at: string;
  regime: string;
  tickers: ExitTimingTicker[];
}

export function getExitTiming(): Promise<ExitTimingResponse> {
  return apiFetch("/v1/options/exit-timing");
}

// ---------------------------------------------------------------------------
// Candle Analysis
// ---------------------------------------------------------------------------

export interface WfFold {
  year: number;
  reversal_pct_test: number | null;
  obs_test: number;
}

export interface CandleAnalysisRow {
  n: number;
  direction: string;
  obs: number;
  reversal_pct: number;
  fwd1_pct: number;
  fwd3_pct: number;
  fwd7_pct: number;
  is_threshold: boolean;
  // VIX band breakdown (optional)
  obs_vix1?: number | null;
  obs_vix2?: number | null;
  obs_vix3?: number | null;
  obs_vix4?: number | null;
  reversal_pct_vix1?: number | null;
  reversal_pct_vix2?: number | null;
  reversal_pct_vix3?: number | null;
  reversal_pct_vix4?: number | null;
  // Walk-forward validation (optional)
  wf_consistent?: boolean | null;
  wf_folds?: WfFold[] | null;
  // Exit timing (optional)
  optimal_exit_day?: string | number | null;
  fwd1_pct_positive?: number | null;
  fwd3_pct_positive?: number | null;
  fwd7_pct_positive?: number | null;
}

export interface CandleAnalysisTickerBlock {
  rows?: CandleAnalysisRow[] | null;
  regimes?: Record<string, { rows: CandleAnalysisRow[] }> | null;
}

export interface CandleAnalysisRegime {
  total_days: number;
  rows: CandleAnalysisRow[];
  tickers?: Record<string, CandleAnalysisTickerBlock> | null;
}

export interface TransitionRisk {
  alert: string;
  probability: number;
}

export interface CandleAnalysisResponse {
  generated_at: string | null;
  spy_date_range: { from: string; to: string } | null;
  spy_total_days: number | null;
  regimes: Record<string, CandleAnalysisRegime>;
  thresholds: Record<string, { direction: string; min_streak: number }> | null;
  tickers?: Record<string, CandleAnalysisTickerBlock> | null;
  current_vix?: number | null;
  current_vix_band?: string | null;
  transition_risk?: TransitionRisk | null;
  current_spy_streak_days?: number | null;
  current_spy_direction?: string | null;
  prev_spy_up_streak_days?: number | null;
}

export function getCandleAnalysis(): Promise<CandleAnalysisResponse> {
  return apiFetch("/v1/options/candle-analysis");
}

// ---------------------------------------------------------------------------
// Rotation / Graph
// ---------------------------------------------------------------------------

export interface RotationCandidate {
  ticker_b: string;
  theme_b: string;
  correlation_60d: number;
  rs_rank: number;
  momentum_score: number;
  theme_momentum: number;
  rotation_score: number;
  lead_lag_days: number;
}

export function getNextSatellite(params: {
  from_ticker: string;
  universe?: "ai_infra" | "tech_sp500";
  top_n?: number;
}): Promise<ListResponse<RotationCandidate>> {
  // Use BFF proxy so INTERNAL_API_TOKEN stays server-side (safe for client calls)
  const qs = new URLSearchParams({ from_ticker: params.from_ticker });
  if (params.universe) qs.set("universe", params.universe);
  if (params.top_n !== undefined) qs.set("top_n", String(params.top_n));
  return fetch(`/api/rotation/next-satellite?${qs}`).then((r) => r.json());
}

export interface ThemeEdge {
  theme_a: string;
  theme_b: string;
  momentum_flow: number;
  avg_momentum_a: number;
  avg_momentum_b: number;
  correlation?: number;
  edge_count?: number;
}

export function getThemeEdges(params?: {
  universe?: "ai_infra" | "tech_sp500";
}): Promise<ListResponse<ThemeEdge>> {
  return apiFetch("/v1/graph/theme-edges", params);
}

export interface TopTickerByTheme {
  theme: string;
  ticker: string;
  rs_rank: number;
  momentum_score: number;
}

export function getTopTickersByTheme(params?: {
  universe?: string;
  top_n?: number;
}): Promise<ListResponse<TopTickerByTheme>> {
  return apiFetch("/v1/graph/top-tickers-by-theme", params);
}

export interface ChainNode {
  id: string;
  ticker: string;
  theme: string;
  rs_rank: number;
  momentum_score: number;
  hop: number;
}

export interface ChainEdge {
  source: string;
  target: string;
  correlation: number;
  rotation_score: number;
}

export interface ChainGraph {
  nodes: ChainNode[];
  edges: ChainEdge[];
}

export function getChain(params: {
  from_ticker: string;
  depth?: number;
  universe?: string;
}): Promise<ChainGraph> {
  return apiFetch("/v1/graph/chain", params);
}

export interface EntryExitSignal {
  ticker: string;
  date: string;
  computed_at: string;
  entry_signal?: "ENTRY" | "WATCH" | "WAIT";
  entry_score?: number;
  exit_signal?: "EXIT_IMMEDIATE" | "EXIT_WARN" | "HOLD_WATCH" | "HOLD";
  exit_score?: number;
  momentum_delta?: number;
  rs_rank_delta?: number;
  rs_score_delta?: number;
  momentum_now?: number;
}

export interface EntryExitSignalResponse {
  date: string | null;
  signals: EntryExitSignal[];
}

export async function getEntryExitSignals(
  signalType?: "entry" | "exit",
  ticker?: string,
): Promise<EntryExitSignalResponse> {
  const params = new URLSearchParams();
  if (signalType) params.set("signal_type", signalType);
  if (ticker) params.set("ticker", ticker);
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/signal/entry-exit${query}`);
  if (!res.ok) throw new Error(`API error ${res.status} — /api/signal/entry-exit`);
  return res.json() as Promise<EntryExitSignalResponse>;
}

export interface IcPoint {
  date: string;
  horizon: number;
  ic: number;
  n_tickers: number;
}

export async function getIcValidation(): Promise<IcPoint[]> {
  const res = await fetch("/api/signal/ic-validation");
  if (!res.ok) throw new Error(`API error ${res.status} — /api/signal/ic-validation`);
  const json = await res.json() as { items?: IcPoint[] };
  return json.items ?? [];
}

export interface BacktestRow {
  date: string;
  horizon: number;
  n_entry: number;
  n_watch: number;
  n_wait: number;
  mean_entry: number;
  mean_watch: number;
  mean_wait: number;
  spread_entry_wait: number | null;
}

export async function getBacktestResults(): Promise<BacktestRow[]> {
  const res = await fetch("/api/signal/backtest-results");
  if (!res.ok) throw new Error(`API error ${res.status} — /api/signal/backtest-results`);
  const json = await res.json() as { items?: BacktestRow[] };
  return json.items ?? [];
}

// ---------------------------------------------------------------------------
// Sector Rotation
// ---------------------------------------------------------------------------

export interface SectorRotationItem {
  sector: string;
  etf_ticker: string | null;
  stock_count: number;
  total_market_cap: number;
  avg_change_1d: number;
  avg_change_1w: number;
  avg_change_1m: number;
  avg_volatility: number;
  sector_momentum_spread: number;
  etf_return_1d: number | null;
  etf_return_1w: number | null;
  etf_return_1m: number | null;
  last_updated: string;
}

export function getSectorRotation(): Promise<ListResponse<SectorRotationItem>> {
  return apiFetch("/v1/market/sector-rotation");
}

export interface SectorStockItem {
  ticker: string;
  company_name: string;
  rs_score: number;
  change_1d: number;
  change_1w: number;
  change_1m: number;
  momentum_signal: string;
  price: number;
}

export interface SectorStocksResponse {
  sector: string;
  stocks: SectorStockItem[];
  count: number;
}

export async function getSectorStocks(sector: string): Promise<SectorStocksResponse> {
  const res = await fetch(`/api/sector-rotation/${encodeURIComponent(sector)}`);
  if (!res.ok) throw new Error(`API error ${res.status} — sector stocks`);
  return res.json() as Promise<SectorStocksResponse>;
}
