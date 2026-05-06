// ---------------------------------------------------------------------------
// Mock data for all API endpoints — enabled via NEXT_PUBLIC_USE_MOCK=true
// ---------------------------------------------------------------------------

import type {
  StockRanking,
  RelativeStrength,
  SignalProfile,
  WatchlistItem,
  StockSnapshot,
  LatestRanking,
  MarketPrice,
  Momentum,
  MarketRegime,
  VixHistory,
  DxyHistory,
  PortfolioPosition,
  PortfolioPositionsResponse,
  RlPaperState,
  RlPaperCycle,
  RlPaperTrade,
  RlLiveSignal,
  ListResponse,
  Signal,
} from "./api";

// ---------------------------------------------------------------------------
// Deterministic pseudo-random helpers
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed = 42) {
  return mulberry32(seed);
}

// ---------------------------------------------------------------------------
// Static universe of 100 representative S&P 500-style tickers
// ---------------------------------------------------------------------------

const TICKERS: Array<{ ticker: string; company: string; sector: string; theme: string }> = [
  { ticker: "AAPL",  company: "Apple Inc.",                   sector: "Technology",            theme: "Consumer Tech" },
  { ticker: "MSFT",  company: "Microsoft Corp.",              sector: "Technology",            theme: "Cloud & SaaS" },
  { ticker: "NVDA",  company: "NVIDIA Corp.",                 sector: "Technology",            theme: "AI & Semiconductors" },
  { ticker: "GOOGL", company: "Alphabet Inc.",                sector: "Communication Services",theme: "Digital Advertising" },
  { ticker: "AMZN",  company: "Amazon.com Inc.",              sector: "Consumer Discretionary",theme: "E-Commerce & Cloud" },
  { ticker: "META",  company: "Meta Platforms Inc.",          sector: "Communication Services",theme: "Social Media" },
  { ticker: "TSLA",  company: "Tesla Inc.",                   sector: "Consumer Discretionary",theme: "EV & Energy" },
  { ticker: "AVGO",  company: "Broadcom Inc.",                sector: "Technology",            theme: "AI & Semiconductors" },
  { ticker: "JPM",   company: "JPMorgan Chase & Co.",         sector: "Financials",            theme: "Banking" },
  { ticker: "V",     company: "Visa Inc.",                    sector: "Financials",            theme: "Payments" },
  { ticker: "MA",    company: "Mastercard Inc.",              sector: "Financials",            theme: "Payments" },
  { ticker: "UNH",   company: "UnitedHealth Group Inc.",      sector: "Healthcare",            theme: "Managed Care" },
  { ticker: "HD",    company: "Home Depot Inc.",              sector: "Consumer Discretionary",theme: "Home Improvement" },
  { ticker: "PG",    company: "Procter & Gamble Co.",         sector: "Consumer Staples",      theme: "Household Products" },
  { ticker: "COST",  company: "Costco Wholesale Corp.",       sector: "Consumer Staples",      theme: "Retail" },
  { ticker: "WMT",   company: "Walmart Inc.",                 sector: "Consumer Staples",      theme: "Retail" },
  { ticker: "LLY",   company: "Eli Lilly and Co.",            sector: "Healthcare",            theme: "Pharma & Biotech" },
  { ticker: "ORCL",  company: "Oracle Corp.",                 sector: "Technology",            theme: "Cloud & SaaS" },
  { ticker: "CRM",   company: "Salesforce Inc.",              sector: "Technology",            theme: "Cloud & SaaS" },
  { ticker: "AMD",   company: "Advanced Micro Devices Inc.",  sector: "Technology",            theme: "AI & Semiconductors" },
  { ticker: "NFLX",  company: "Netflix Inc.",                 sector: "Communication Services",theme: "Streaming" },
  { ticker: "ADBE",  company: "Adobe Inc.",                   sector: "Technology",            theme: "Cloud & SaaS" },
  { ticker: "NOW",   company: "ServiceNow Inc.",              sector: "Technology",            theme: "Cloud & SaaS" },
  { ticker: "INTU",  company: "Intuit Inc.",                  sector: "Technology",            theme: "FinTech" },
  { ticker: "AMAT",  company: "Applied Materials Inc.",       sector: "Technology",            theme: "AI & Semiconductors" },
  { ticker: "MU",    company: "Micron Technology Inc.",       sector: "Technology",            theme: "AI & Semiconductors" },
  { ticker: "QCOM",  company: "QUALCOMM Inc.",                sector: "Technology",            theme: "AI & Semiconductors" },
  { ticker: "LRCX",  company: "Lam Research Corp.",           sector: "Technology",            theme: "AI & Semiconductors" },
  { ticker: "KLAC",  company: "KLA Corp.",                    sector: "Technology",            theme: "AI & Semiconductors" },
  { ticker: "MRVL",  company: "Marvell Technology Inc.",      sector: "Technology",            theme: "AI & Semiconductors" },
  { ticker: "PANW",  company: "Palo Alto Networks Inc.",      sector: "Technology",            theme: "Cybersecurity" },
  { ticker: "CRWD",  company: "CrowdStrike Holdings Inc.",    sector: "Technology",            theme: "Cybersecurity" },
  { ticker: "FTNT",  company: "Fortinet Inc.",                sector: "Technology",            theme: "Cybersecurity" },
  { ticker: "ZS",    company: "Zscaler Inc.",                 sector: "Technology",            theme: "Cybersecurity" },
  { ticker: "DDOG",  company: "Datadog Inc.",                 sector: "Technology",            theme: "Cloud & SaaS" },
  { ticker: "SNOW",  company: "Snowflake Inc.",               sector: "Technology",            theme: "Cloud & SaaS" },
  { ticker: "NET",   company: "Cloudflare Inc.",              sector: "Technology",            theme: "Cybersecurity" },
  { ticker: "TEAM",  company: "Atlassian Corp.",              sector: "Technology",            theme: "Cloud & SaaS" },
  { ticker: "WDAY",  company: "Workday Inc.",                 sector: "Technology",            theme: "Cloud & SaaS" },
  { ticker: "TTD",   company: "The Trade Desk Inc.",          sector: "Technology",            theme: "Digital Advertising" },
  { ticker: "BAC",   company: "Bank of America Corp.",        sector: "Financials",            theme: "Banking" },
  { ticker: "WFC",   company: "Wells Fargo & Co.",            sector: "Financials",            theme: "Banking" },
  { ticker: "GS",    company: "Goldman Sachs Group Inc.",     sector: "Financials",            theme: "Investment Banking" },
  { ticker: "MS",    company: "Morgan Stanley",               sector: "Financials",            theme: "Investment Banking" },
  { ticker: "BLK",   company: "BlackRock Inc.",               sector: "Financials",            theme: "Asset Management" },
  { ticker: "SCHW",  company: "Charles Schwab Corp.",         sector: "Financials",            theme: "Asset Management" },
  { ticker: "AXP",   company: "American Express Co.",         sector: "Financials",            theme: "Payments" },
  { ticker: "SPGI",  company: "S&P Global Inc.",              sector: "Financials",            theme: "Data & Analytics" },
  { ticker: "MCO",   company: "Moody's Corp.",                sector: "Financials",            theme: "Data & Analytics" },
  { ticker: "ICE",   company: "Intercontinental Exchange Inc.",sector: "Financials",           theme: "Data & Analytics" },
  { ticker: "JNJ",   company: "Johnson & Johnson",            sector: "Healthcare",            theme: "Pharma & Biotech" },
  { ticker: "PFE",   company: "Pfizer Inc.",                  sector: "Healthcare",            theme: "Pharma & Biotech" },
  { ticker: "ABBV",  company: "AbbVie Inc.",                  sector: "Healthcare",            theme: "Pharma & Biotech" },
  { ticker: "MRK",   company: "Merck & Co. Inc.",             sector: "Healthcare",            theme: "Pharma & Biotech" },
  { ticker: "AMGN",  company: "Amgen Inc.",                   sector: "Healthcare",            theme: "Pharma & Biotech" },
  { ticker: "GILD",  company: "Gilead Sciences Inc.",         sector: "Healthcare",            theme: "Pharma & Biotech" },
  { ticker: "BIIB",  company: "Biogen Inc.",                  sector: "Healthcare",            theme: "Pharma & Biotech" },
  { ticker: "ISRG",  company: "Intuitive Surgical Inc.",      sector: "Healthcare",            theme: "MedTech" },
  { ticker: "ELV",   company: "Elevance Health Inc.",         sector: "Healthcare",            theme: "Managed Care" },
  { ticker: "CVS",   company: "CVS Health Corp.",             sector: "Healthcare",            theme: "Managed Care" },
  { ticker: "XOM",   company: "Exxon Mobil Corp.",            sector: "Energy",                theme: "Oil & Gas" },
  { ticker: "CVX",   company: "Chevron Corp.",                sector: "Energy",                theme: "Oil & Gas" },
  { ticker: "COP",   company: "ConocoPhillips",               sector: "Energy",                theme: "Oil & Gas" },
  { ticker: "EOG",   company: "EOG Resources Inc.",           sector: "Energy",                theme: "Oil & Gas" },
  { ticker: "SLB",   company: "SLB",                          sector: "Energy",                theme: "Oil Services" },
  { ticker: "OXY",   company: "Occidental Petroleum Corp.",   sector: "Energy",                theme: "Oil & Gas" },
  { ticker: "PSX",   company: "Phillips 66",                  sector: "Energy",                theme: "Refining" },
  { ticker: "MPC",   company: "Marathon Petroleum Corp.",     sector: "Energy",                theme: "Refining" },
  { ticker: "CAT",   company: "Caterpillar Inc.",             sector: "Industrials",           theme: "Machinery" },
  { ticker: "DE",    company: "Deere & Company",              sector: "Industrials",           theme: "Machinery" },
  { ticker: "HON",   company: "Honeywell International Inc.", sector: "Industrials",           theme: "Aerospace & Defense" },
  { ticker: "RTX",   company: "RTX Corp.",                    sector: "Industrials",           theme: "Aerospace & Defense" },
  { ticker: "LMT",   company: "Lockheed Martin Corp.",        sector: "Industrials",           theme: "Aerospace & Defense" },
  { ticker: "GE",    company: "GE Aerospace",                 sector: "Industrials",           theme: "Aerospace & Defense" },
  { ticker: "BA",    company: "Boeing Co.",                   sector: "Industrials",           theme: "Aerospace & Defense" },
  { ticker: "NOC",   company: "Northrop Grumman Corp.",       sector: "Industrials",           theme: "Aerospace & Defense" },
  { ticker: "UPS",   company: "United Parcel Service Inc.",   sector: "Industrials",           theme: "Logistics" },
  { ticker: "FDX",   company: "FedEx Corp.",                  sector: "Industrials",           theme: "Logistics" },
  { ticker: "NEE",   company: "NextEra Energy Inc.",          sector: "Utilities",             theme: "Clean Energy" },
  { ticker: "DUK",   company: "Duke Energy Corp.",            sector: "Utilities",             theme: "Electric Utilities" },
  { ticker: "SO",    company: "Southern Company",             sector: "Utilities",             theme: "Electric Utilities" },
  { ticker: "D",     company: "Dominion Energy Inc.",         sector: "Utilities",             theme: "Electric Utilities" },
  { ticker: "AEP",   company: "American Electric Power Co.",  sector: "Utilities",             theme: "Electric Utilities" },
  { ticker: "AMT",   company: "American Tower Corp.",         sector: "Real Estate",           theme: "Cell Towers" },
  { ticker: "PLD",   company: "Prologis Inc.",                sector: "Real Estate",           theme: "Industrial REIT" },
  { ticker: "EQIX",  company: "Equinix Inc.",                 sector: "Real Estate",           theme: "Data Centers" },
  { ticker: "CCI",   company: "Crown Castle Inc.",            sector: "Real Estate",           theme: "Cell Towers" },
  { ticker: "SPG",   company: "Simon Property Group Inc.",    sector: "Real Estate",           theme: "Retail REIT" },
  { ticker: "LIN",   company: "Linde plc",                    sector: "Materials",             theme: "Industrial Gases" },
  { ticker: "APD",   company: "Air Products and Chemicals Inc.",sector: "Materials",           theme: "Industrial Gases" },
  { ticker: "ECL",   company: "Ecolab Inc.",                  sector: "Materials",             theme: "Chemicals" },
  { ticker: "NEM",   company: "Newmont Corp.",                sector: "Materials",             theme: "Gold Mining" },
  { ticker: "FCX",   company: "Freeport-McMoRan Inc.",        sector: "Materials",             theme: "Copper & Mining" },
  { ticker: "MCD",   company: "McDonald's Corp.",             sector: "Consumer Discretionary",theme: "Restaurants" },
  { ticker: "SBUX",  company: "Starbucks Corp.",              sector: "Consumer Discretionary",theme: "Restaurants" },
  { ticker: "NKE",   company: "Nike Inc.",                    sector: "Consumer Discretionary",theme: "Apparel" },
  { ticker: "LOW",   company: "Lowe's Companies Inc.",        sector: "Consumer Discretionary",theme: "Home Improvement" },
  { ticker: "TGT",   company: "Target Corp.",                 sector: "Consumer Staples",      theme: "Retail" },
  { ticker: "KO",    company: "Coca-Cola Co.",                sector: "Consumer Staples",      theme: "Beverages" },
  { ticker: "PEP",   company: "PepsiCo Inc.",                 sector: "Consumer Staples",      theme: "Beverages" },
  { ticker: "WDC",   company: "Western Digital Corp.",        sector: "Technology",            theme: "Storage & Memory" },
  { ticker: "STX",   company: "Seagate Technology Holdings",  sector: "Technology",            theme: "Storage & Memory" },
  { ticker: "INTC",  company: "Intel Corp.",                  sector: "Technology",            theme: "AI & Semiconductors" },
  { ticker: "TXN",   company: "Texas Instruments Inc.",       sector: "Technology",            theme: "AI & Semiconductors" },
  { ticker: "SPY",   company: "SPDR S&P 500 ETF Trust",       sector: "ETF",                   theme: "Index" },
  { ticker: "QQQ",   company: "Invesco QQQ Trust",            sector: "ETF",                   theme: "Index" },
  { ticker: "SMH",   company: "VanEck Semiconductor ETF",     sector: "ETF",                   theme: "Index" },
];

// Extend to ~523 by generating synthetic tickers
const EXTRA_SECTORS = ["Technology","Financials","Healthcare","Consumer Discretionary","Industrials","Energy","Materials","Utilities","Real Estate","Consumer Staples","Communication Services"];
const EXTRA_THEMES  = ["Cloud & SaaS","AI & Semiconductors","Cybersecurity","FinTech","Pharma & Biotech","Oil & Gas","Machinery","Logistics","Clean Energy","Retail","Banking","Payments","Streaming","Managed Care","MedTech","Data & Analytics","Storage & Memory","Digital Advertising","Beverages","Industrial Gases"];

const rngBase = makeRng(1337);
for (let i = 0; i < 420; i++) {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let tk = "";
  const len = Math.floor(rngBase() * 2) + 3; // 3 or 4 chars
  for (let c = 0; c < len; c++) tk += letters[Math.floor(rngBase() * letters.length)];
  TICKERS.push({
    ticker: tk + i,
    company: `${tk} Corp. ${i}`,
    sector: EXTRA_SECTORS[Math.floor(rngBase() * EXTRA_SECTORS.length)],
    theme: EXTRA_THEMES[Math.floor(rngBase() * EXTRA_THEMES.length)],
  });
}

// ---------------------------------------------------------------------------
// Build stock rankings (latest snapshot date: 2026-05-05)
// ---------------------------------------------------------------------------

const DATA_DATE = "2026-05-05";
const SIGNALS: Signal[] = ["BUY_CANDIDATE", "WATCH", "WAIT", "AVOID"];
const TRENDS = ["Bullish", "Neutral", "Bearish"];
// Realistic signal distribution: ~12% BUY, ~22% WATCH, ~35% WAIT, ~31% AVOID
const SIGNAL_WEIGHTS = [0.12, 0.22, 0.35, 0.31];

function pickWeighted<T>(arr: T[], weights: number[], r: number): T {
  let cumul = 0;
  for (let i = 0; i < arr.length; i++) {
    cumul += weights[i];
    if (r < cumul) return arr[i];
  }
  return arr[arr.length - 1];
}

const rng = makeRng(42);

export const MOCK_RANKINGS: StockRanking[] = TICKERS.map((t, idx) => {
  const signal = pickWeighted(SIGNALS, SIGNAL_WEIGHTS, rng());
  const trendWeight =
    signal === "BUY_CANDIDATE" ? [0.75, 0.2, 0.05] :
    signal === "WATCH"         ? [0.45, 0.4, 0.15] :
    signal === "WAIT"          ? [0.15, 0.55, 0.3] :
                                 [0.05, 0.2, 0.75];
  const trend = pickWeighted(TRENDS, trendWeight, rng());
  const basePrice = 20 + rng() * 680;
  const momentumScore =
    signal === "BUY_CANDIDATE" ? 60 + rng() * 40 :
    signal === "WATCH"         ? 40 + rng() * 25 :
    signal === "WAIT"          ? 20 + rng() * 22 :
                                 rng() * 22;
  const ret30 =
    signal === "BUY_CANDIDATE" ? 2 + rng() * 18 :
    signal === "WATCH"         ? -2 + rng() * 14 :
    signal === "WAIT"          ? -8 + rng() * 10 :
                                 -20 + rng() * 10;
  return {
    ticker: t.ticker,
    company_name: t.company,
    signal,
    trend,
    momentum_score: parseFloat(momentumScore.toFixed(2)),
    rank_momentum: idx + 1,
    sector: t.sector,
    theme: t.theme,
    price: parseFloat(basePrice.toFixed(2)),
    return_30d: parseFloat(ret30.toFixed(2)),
    return_90d: parseFloat((ret30 * (1.5 + rng())).toFixed(2)),
    return_180d: parseFloat((ret30 * (2.5 + rng())).toFixed(2)),
    date: DATA_DATE,
  };
});

// ---------------------------------------------------------------------------
// Relative strength
// ---------------------------------------------------------------------------

export const MOCK_RELATIVE_STRENGTH: RelativeStrength[] = MOCK_RANKINGS.map((r, i) => ({
  ticker: r.ticker,
  rank: i + 1,
  rs_score: parseFloat((100 - (i / MOCK_RANKINGS.length) * 100).toFixed(1)),
  return_30d: r.return_30d,
  return_90d: r.return_90d,
}));

// ---------------------------------------------------------------------------
// Signal profile
// ---------------------------------------------------------------------------

const buyCount = MOCK_RANKINGS.filter((r) => r.signal === "BUY_CANDIDATE").length;
const watchCount = MOCK_RANKINGS.filter((r) => r.signal === "WATCH").length;
const waitCount = MOCK_RANKINGS.filter((r) => r.signal === "WAIT").length;
const avoidCount = MOCK_RANKINGS.filter((r) => r.signal === "AVOID").length;

export const MOCK_SIGNAL_PROFILE: SignalProfile = {
  signal_profile: "BULLISH",
  watchlist_rows: buyCount + watchCount,
  updated_at_utc: `${DATA_DATE}T20:00:00Z`,
  buy_candidate_count: buyCount,
  watch_count: watchCount,
  wait_count: waitCount,
  avoid_count: avoidCount,
};

// ---------------------------------------------------------------------------
// Watchlist
// ---------------------------------------------------------------------------

const RS_TREND_OPTIONS = ["UP", "DOWN", "NEUTRAL"];
const MOMENTUM_SIGNALS = ["BUY", "HOLD", "SELL"];
const EXTENSION_OPTIONS = ["NORMAL", "EXTENDED", "EXTENDED_EXTREME"];

const rngW = makeRng(99);
export const MOCK_WATCHLIST: WatchlistItem[] = MOCK_RANKINGS
  .filter((r) => r.signal !== "AVOID")
  .slice(0, 200)
  .map((r, i) => {
    const wSig =
      r.signal === "BUY_CANDIDATE" ? "BUY_CANDIDATE" :
      r.signal === "WATCH"         ? "WATCH" :
                                     "WAIT";
    const high52w = r.price * (1 + rngW() * 0.3);
    const dist52wPct = -((high52w - r.price) / high52w) * 100;
    return {
      ticker: r.ticker,
      price: r.price,
      momentum_signal: MOMENTUM_SIGNALS[Math.floor(rngW() * 3)],
      relative_strength_rank: i + 1,
      extension_signal: EXTENSION_OPTIONS[Math.floor(rngW() * EXTENSION_OPTIONS.length)],
      watchlist_signal: wSig,
      high_52w: parseFloat(high52w.toFixed(2)),
      dist_52w_pct: parseFloat(dist52wPct.toFixed(2)),
      rs_trend: RS_TREND_OPTIONS[Math.floor(rngW() * RS_TREND_OPTIONS.length)],
    };
  });

// ---------------------------------------------------------------------------
// Stock snapshot
// ---------------------------------------------------------------------------

const RECOMMENDATIONS = ["ENTRY ZONE", "MONITOR", "WAIT FOR PULLBACK", "UNDERPERFORMER - AVOID"];
const REC_WEIGHTS = [0.15, 0.25, 0.35, 0.25];

const rngS = makeRng(55);
export const MOCK_SNAPSHOT: Array<import("./api").StockSnapshot> = MOCK_RANKINGS.map((r) => {
  const rec = pickWeighted(RECOMMENDATIONS, REC_WEIGHTS, rngS());
  const stopLoss = r.price * (0.88 + rngS() * 0.07);
  const entryLow = r.price * (0.97 + rngS() * 0.03);
  const entryHigh = entryLow * (1.02 + rngS() * 0.04);
  const target = r.price * (1.1 + rngS() * 0.3);
  const rr = (target - entryHigh) / (entryHigh - stopLoss);
  return {
    ticker: r.ticker,
    price: r.price,
    change_1d: parseFloat((-3 + rngS() * 6).toFixed(2)),
    change_1w: parseFloat((-5 + rngS() * 10).toFixed(2)),
    change_1m: parseFloat(r.return_30d.toFixed(2)),
    change_ytd: parseFloat((-15 + rngS() * 40).toFixed(2)),
    entry_low: parseFloat(entryLow.toFixed(2)),
    entry_high: parseFloat(entryHigh.toFixed(2)),
    stop_loss: parseFloat(stopLoss.toFixed(2)),
    target_price: parseFloat(target.toFixed(2)),
    risk_reward: parseFloat(Math.max(0.5, rr).toFixed(2)),
    trade_probability: parseFloat((35 + rngS() * 50).toFixed(1)),
    recommendation: rec,
  };
});

// ---------------------------------------------------------------------------
// Market regime
// ---------------------------------------------------------------------------

export const MOCK_MARKET_REGIME: MarketRegime[] = [
  {
    date: DATA_DATE,
    total_stocks: MOCK_RANKINGS.length,
    above_ma50: Math.round(MOCK_RANKINGS.length * 0.62),
    above_ma200: Math.round(MOCK_RANKINGS.length * 0.54),
    pct_above_ma50: 62.1,
    pct_above_ma200: 54.3,
    bullish_count: Math.round(MOCK_RANKINGS.length * 0.58),
    neutral_count: Math.round(MOCK_RANKINGS.length * 0.22),
    bearish_count: Math.round(MOCK_RANKINGS.length * 0.20),
  },
];

// ---------------------------------------------------------------------------
// VIX history (last 5 days)
// ---------------------------------------------------------------------------

export const MOCK_VIX_HISTORY: VixHistory[] = [
  { date: "2026-05-05", signal: "Normal", spy_price: 543.21, ema9: 16.8, ema21: 17.4, vix: 16.42 },
  { date: "2026-05-02", signal: "Normal", spy_price: 540.15, ema9: 17.1, ema21: 17.6, vix: 17.85 },
  { date: "2026-05-01", signal: "Calm",   spy_price: 538.80, ema9: 17.3, ema21: 17.7, vix: 15.22 },
  { date: "2026-04-30", signal: "Normal", spy_price: 535.44, ema9: 17.5, ema21: 17.9, vix: 18.63 },
  { date: "2026-04-29", signal: "Normal", spy_price: 537.00, ema9: 17.8, ema21: 18.1, vix: 19.10 },
];

// ---------------------------------------------------------------------------
// DXY history (last 5 days)
// ---------------------------------------------------------------------------

export const MOCK_DXY_HISTORY: DxyHistory[] = [
  { date: "2026-05-05", close: 104.32 },
  { date: "2026-05-02", close: 103.85 },
  { date: "2026-05-01", close: 104.11 },
  { date: "2026-04-30", close: 103.60 },
  { date: "2026-04-29", close: 104.78 },
];

// ---------------------------------------------------------------------------
// Prices (simulate ~9 months of daily data for portfolio tickers + benchmarks)
// ---------------------------------------------------------------------------

function generatePriceHistory(ticker: string, startDate: string, startPrice: number, days: number): import("./api").MarketPrice[] {
  const rngP = makeRng(ticker.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  const prices: import("./api").MarketPrice[] = [];
  let price = startPrice;
  const d = new Date(startDate);
  for (let i = 0; i < days; i++) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      price = price * (1 + (rngP() - 0.5) * 0.04);
      prices.push({
        ticker,
        date: d.toISOString().slice(0, 10),
        price: parseFloat(price.toFixed(2)),
        volume: Math.round(1_000_000 + rngP() * 50_000_000),
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return prices;
}

const PORTFOLIO_START = "2024-07-25";
const PRICE_DAYS = 650;

const PORTFOLIO_TICKERS = ["NVDA", "MSFT", "AAPL", "AMZN", "META", "WDC", "AMD", "SPY", "QQQ", "SMH"];
const TICKER_START_PRICES: Record<string, number> = {
  NVDA: 118, MSFT: 440, AAPL: 210, AMZN: 196, META: 480,
  WDC: 68, AMD: 172, SPY: 543, QQQ: 480, SMH: 240,
};

let MOCK_PRICES_ALL: import("./api").MarketPrice[] = [];
for (const tk of PORTFOLIO_TICKERS) {
  MOCK_PRICES_ALL = MOCK_PRICES_ALL.concat(
    generatePriceHistory(tk, PORTFOLIO_START, TICKER_START_PRICES[tk] ?? 100, PRICE_DAYS)
  );
}

export { MOCK_PRICES_ALL };

// ---------------------------------------------------------------------------
// Momentum
// ---------------------------------------------------------------------------

export const MOCK_MOMENTUM: import("./api").Momentum[] = MOCK_RANKINGS.map((r) => ({
  ticker: r.ticker,
  momentum_score: r.momentum_score,
  date: DATA_DATE,
}));

// ---------------------------------------------------------------------------
// Portfolio positions (mock human portfolio)
// ---------------------------------------------------------------------------

export const MOCK_PORTFOLIO: PortfolioPositionsResponse = {
  items: [
    { ticker: "NVDA", shares: 50,  entry_price: 135.40, invested_usd: 6770,  entry_date: "2024-09-12", label: "Core" },
    { ticker: "MSFT", shares: 15,  entry_price: 415.00, invested_usd: 6225,  entry_date: "2024-08-05", label: "Core" },
    { ticker: "AAPL", shares: 30,  entry_price: 195.00, invested_usd: 5850,  entry_date: "2024-07-25", label: "Core" },
    { ticker: "AMZN", shares: 25,  entry_price: 185.00, invested_usd: 4625,  entry_date: "2024-10-01", label: "Growth" },
    { ticker: "META", shares: 10,  entry_price: 510.00, invested_usd: 5100,  entry_date: "2024-11-15", label: "Growth" },
    { ticker: "WDC",  shares: 80,  entry_price:  72.50, invested_usd: 5800,  entry_date: "2025-01-20", label: "Trade" },
    { ticker: "AMD",  shares: 35,  entry_price: 160.00, invested_usd: 5600,  entry_date: "2024-12-03", label: "Growth" },
  ] as PortfolioPosition[],
  count: 7,
  total_cash_invested: 40000,
};

// ---------------------------------------------------------------------------
// RL Paper Trading mock data
// ---------------------------------------------------------------------------

export const MOCK_RL_STATE: RlPaperState = {
  starting_capital_usd: 100000,
  cash_usd: 24830.45,
  positions: {
    NVDA: { entry_price: 128.50, shares: 50, cost_basis_usd: 6425, entry_date: "2026-02-14" },
    MSFT: { entry_price: 425.00, shares: 15, cost_basis_usd: 6375, entry_date: "2026-01-28" },
    AAPL: { entry_price: 205.00, shares: 25, cost_basis_usd: 5125, entry_date: "2026-03-05" },
    AMD:  { entry_price: 168.00, shares: 30, cost_basis_usd: 5040, entry_date: "2026-03-19" },
    META: { entry_price: 495.00, shares: 10, cost_basis_usd: 4950, entry_date: "2026-04-02" },
  },
  realized_pnl_usd: 12450.80,
  trades_count: 38,
  wins_count: 24,
};

const rngRL = makeRng(77);
export const MOCK_RL_CYCLES: RlPaperCycle[] = (() => {
  const cycles: RlPaperCycle[] = [];
  let equity = 100000;
  const d = new Date("2026-01-02");
  for (let i = 0; i < 90; i++) {
    equity = equity * (1 + (rngRL() - 0.45) * 0.012);
    cycles.push({
      ts: d.toISOString().slice(0, 19) + "Z",
      cash_usd: equity * 0.25,
      positions_count: Math.round(3 + rngRL() * 5),
      position_value_usd: equity * 0.75,
      unrealized_pnl_usd: equity * (rngRL() * 0.06 - 0.01),
      realized_pnl_usd: 12450.80 * (i / 90),
      equity_usd: parseFloat(equity.toFixed(2)),
      total_return_pct: parseFloat(((equity - 100000) / 100000).toFixed(4)),
      signal_date: d.toISOString().slice(0, 10),
    });
    d.setDate(d.getDate() + 1);
  }
  return cycles;
})();

const rngT = makeRng(33);
const TRADE_TICKERS = ["NVDA", "MSFT", "AAPL", "AMZN", "AMD", "META", "GOOGL", "AVGO", "TSM", "QCOM"];
export const MOCK_RL_TRADES: RlPaperTrade[] = (() => {
  const trades: RlPaperTrade[] = [];
  const d = new Date("2026-01-10");
  for (let i = 0; i < 38; i++) {
    const isBuy = i % 2 === 0;
    const tk = TRADE_TICKERS[Math.floor(rngT() * TRADE_TICKERS.length)];
    const price = 80 + rngT() * 450;
    const shares = Math.round(5 + rngT() * 30);
    trades.push({
      ts: d.toISOString().slice(0, 19) + "Z",
      event: isBuy ? "BUY" : "SELL",
      ticker: tk,
      price: parseFloat(price.toFixed(2)),
      shares,
      notional_usd: parseFloat((price * shares).toFixed(2)),
      hold_days: isBuy ? null : Math.round(3 + rngT() * 25),
      realized_pnl_usd: isBuy ? null : parseFloat((-300 + rngT() * 1200).toFixed(2)),
      trade_result: isBuy ? null : (rngT() > 0.37 ? "WIN" : "LOSS"),
      exit_reason: isBuy ? null : (rngT() > 0.5 ? "TARGET_HIT" : "STOP_LOSS"),
    });
    d.setDate(d.getDate() + Math.round(1 + rngT() * 3));
  }
  return trades.sort((a, b) => b.ts.localeCompare(a.ts));
})();

export const MOCK_RL_SIGNALS: RlLiveSignal[] = MOCK_RANKINGS
  .filter((r) => r.signal === "BUY_CANDIDATE")
  .slice(0, 20)
  .map((r) => ({
    date: DATA_DATE,
    ticker: r.ticker,
    signal: r.signal,
    watchlist_signal: "BUY_CANDIDATE",
    score: parseFloat(r.momentum_score.toFixed(2)),
    allocation_weight: parseFloat((0.03 + makeRng(r.rank_momentum)() * 0.07).toFixed(3)),
    price: r.price,
    source: "rl_model_v3",
  }));

// ---------------------------------------------------------------------------
// Latest rankings (operational)
// ---------------------------------------------------------------------------

export const MOCK_LATEST_RANKINGS: LatestRanking[] = MOCK_RANKINGS.map((r, i) => ({
  ticker: r.ticker,
  signal: r.signal,
  rank: i + 1,
  score: r.momentum_score,
  date: DATA_DATE,
}));
