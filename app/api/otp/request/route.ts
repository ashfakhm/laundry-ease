import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requestOtp } from "@/lib/otp";

const schema = z.object({
  target: z.string().min(3),
  type: z.enum(["email", "phone"]),
});

export async function POST(req: NextRequest) {
  const json = await req.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const { target, type } = parsed.data;
  const result = await requestOtp(target, type);

  if (!result.ok) {
    const isRateLimit = result.error?.includes("Too many") || result.error?.includes("rate");
    return NextResponse.json(result, { status: isRateLimit ? 429 : 500 });
  }

  return NextResponse.json(result);
}
