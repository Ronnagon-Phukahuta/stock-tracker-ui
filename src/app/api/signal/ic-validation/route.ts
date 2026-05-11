import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const API_TOKEN = process.env.INTERNAL_API_TOKEN ?? "";

export async function GET(_req: NextRequest) {
  const url = new URL("/v1/signal/ic-validation", BASE_URL);

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
