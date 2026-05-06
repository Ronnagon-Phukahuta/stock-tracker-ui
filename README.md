# Stock Tracker UI

An AI-powered stock tracking dashboard built with Next.js 15. Displays market regime, signal distribution, momentum rankings, watchlist analysis, portfolio performance, and a reinforcement-learning trading agent — all in a dark terminal-style UI.

**Live demo:** https://stock-tracker-ui-smoky.vercel.app

> The live demo runs in mock-data mode. The backend API is private.

---

## Features

| Page | Description |
|---|---|
| **Overview** | Daily briefing — market regime, VIX, signal breadth, portfolio quick view, top momentum leaders |
| **Screener** | Full universe screener (~523 tickers) with signal badges, momentum deltas, sector/theme breakdown |
| **Watchlist** | Curated watchlist with RS rank, trend, extension signal, and buy-candidate highlights |
| **Snapshot** | Entry zone analysis — entry range, stop-loss, target price, risk/reward, trade probability |
| **Portfolio** | Position tracker with P&L, day change %, benchmark comparison (SPY/QQQ/SMH), and alpha |
| **RL vs Human** | Reinforcement-learning paper trading agent vs human portfolio — equity curve, trades, live signals |

## Tech Stack

- **Next.js 15** (App Router, server components)
- **TypeScript**
- **Tailwind CSS v4**
- **shadcn/ui** (Badge, Button, Card, Select, Table, Tabs, Skeleton)

---

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Enable mock data (no backend required)
NEXT_PUBLIC_USE_MOCK=true

# Real backend (leave unset when using mock)
NEXT_PUBLIC_API_URL=https://your-api-url
INTERNAL_API_TOKEN=your-secret-token
```

**Mock mode** (`NEXT_PUBLIC_USE_MOCK=true`) generates ~523 realistic tickers with deterministic pseudo-random data — no backend needed. All pages are fully functional.

**Real API mode** requires a running instance of the private stock-tracker backend. Set `NEXT_PUBLIC_API_URL` and `INTERNAL_API_TOKEN` and leave `NEXT_PUBLIC_USE_MOCK` unset or set to `false`.

---

## Deployment

Deployed on [Vercel](https://vercel.com). Set `NEXT_PUBLIC_USE_MOCK=true` in Vercel project environment variables for a self-contained demo deployment.
