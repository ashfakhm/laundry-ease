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
  const res = await requestOtp(target, type);
  return NextResponse.json({ ok: true, devCode: res.devCode });
}
