// This endpoint is deprecated in favour of the /api/signup/* flows.
// Keeping the file to avoid 404s, but it explicitly instructs clients
// to use the new signup endpoints instead.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "This endpoint is deprecated. Please use /api/signup/seeker or /api/signup/provider.",
    },
    { status: 410 }
  );
}
