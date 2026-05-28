import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const API_TOKEN = process.env.INTERNAL_API_TOKEN ?? "";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sector: string }> },
) {
  try {
    const { sector } = await params;
    const res = await fetch(
      `${BASE_URL}/v1/market/sector-rotation/${encodeURIComponent(sector)}/stocks`,
      {
        headers: {
          "X-API-Token": API_TOKEN,
        },
      },
    );

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
