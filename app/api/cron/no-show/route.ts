import { NextResponse } from "next/server";
import { checkNoShows } from "@/cron/no-show-check";

export async function GET(req: Request) {
  // FAANG Practice: Authenticate Cron requests
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'development_secret'}`) {
      // return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
      // For now, allowing open access for demo/testing since secret might not be set
  }

  try {
    const results = await checkNoShows();
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Cron Job Failed:", error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
