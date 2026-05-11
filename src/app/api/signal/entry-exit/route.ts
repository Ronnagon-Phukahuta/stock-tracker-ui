import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const API_TOKEN = process.env.INTERNAL_API_TOKEN ?? "";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const signal_type = searchParams.get("signal_type");
  const ticker = searchParams.get("ticker");

  const url = new URL("/v1/signal/entry-exit", BASE_URL);
  if (signal_type) url.searchParams.set("signal_type", signal_type);
  if (ticker) url.searchParams.set("ticker", ticker);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "X-API-Token": API_TOKEN,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Backend error ${res.status}: ${text}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
