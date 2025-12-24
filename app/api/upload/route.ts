import { NextResponse } from "next/server";
import { uploadInvoicePhoto } from "@/lib/cloudinary";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const url = await uploadInvoicePhoto(buffer, file.name, file.type);
  return NextResponse.json({ url });
}
