import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const API_TOKEN = process.env.INTERNAL_API_TOKEN ?? "";

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${BASE_URL}/v1/portfolio/positions`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-Token": API_TOKEN,
      },
      body: JSON.stringify(body),
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
