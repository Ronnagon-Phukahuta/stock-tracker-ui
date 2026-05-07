import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const API_TOKEN = process.env.INTERNAL_API_TOKEN ?? "";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ index: string }> },
) {
  try {
    const { index } = await params;
    const res = await fetch(`${BASE_URL}/v1/portfolio/options-trades/${index}`, {
      method: "DELETE",
      headers: {
        "X-API-Token": API_TOKEN,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Backend error ${res.status}: ${text}` },
        { status: res.status },
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
