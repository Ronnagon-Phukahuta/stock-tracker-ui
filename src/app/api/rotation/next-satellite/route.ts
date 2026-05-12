import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const API_TOKEN = process.env.INTERNAL_API_TOKEN ?? "";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from_ticker = searchParams.get("from_ticker");
  const top_n = searchParams.get("top_n");
  const universe = searchParams.get("universe");

  if (!from_ticker) {
    return NextResponse.json({ error: "from_ticker is required" }, { status: 400 });
  }

  const url = new URL("/v1/graph/next-satellite", BASE_URL);
  url.searchParams.set("from_ticker", from_ticker);
  if (top_n) url.searchParams.set("top_n", top_n);
  if (universe) url.searchParams.set("universe", universe);

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
