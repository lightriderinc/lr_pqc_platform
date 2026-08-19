import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Not active. Use the qSearch page directly." },
    { status: 403 }
  );
}