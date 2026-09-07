import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    success: true,
    status: "ok",
    service: "Zoko Extractor API",
    coder: "Telegram @flexyy",
  });
}
