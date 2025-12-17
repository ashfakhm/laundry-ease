import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  createSeeker,
  createProvider,
  getUserByEmail,
  emailExists,
} from "@/lib/db";
import { z } from "zod";

type SessionUser = {
  user?: {
    email?: string;
    name?: string;
  };
};

const baseSchema = z.object({
  name: z.string().min(1),
  role: z.enum(["seeker", "provider"]),
});

const providerSchema = baseSchema.extend({
  services: z.array(z.string()).min(1),
  pricing: z.number().nonnegative(),
  location: z.string().min(1),
  documents: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as SessionUser | null;
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const role = body?.role as "seeker" | "provider";
  const email = session.user.email;

  try {
    // Check if user already exists in any collection
    const exists = await emailExists(email);
    if (exists) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 409 }
      );
    }

    if (role === "provider") {
      const parsed = providerSchema.parse(body);
      // Create provider in providers collection
      await createProvider({
        email,
        name: parsed.name,
        services: parsed.services,
        pricing: parsed.pricing,
        location: parsed.location,
      });
    } else {
      const parsed = baseSchema.parse(body);
      // Create seeker in seekers collection
      await createSeeker({
        email,
        name: parsed.name,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Invalid data";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
