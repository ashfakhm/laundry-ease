import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  createProviderProfile,
  createUser,
  getUserByEmail,
  updateUserRoleAndName,
  User,
} from "@/lib/db";
import { ObjectId } from "mongodb";
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
    let user: User | null = await getUserByEmail(email);

    if (role === "provider") {
      const parsed = providerSchema.parse(body);
      if (user) {
        await updateUserRoleAndName(email, {
          role: "provider",
          name: parsed.name,
        });
      } else {
        user = await createUser({
          email,
          role: "provider",
          name: parsed.name,
        });
      }
      if (!user?._id) throw new Error("User ID not found after creation/update");
      await createProviderProfile({
        userId: user._id,
        services: parsed.services,
        pricing: parsed.pricing,
        location: parsed.location,
        documents: parsed.documents,
      });
    } else {
      const parsed = baseSchema.parse(body);
      if (user) {
        await updateUserRoleAndName(email, {
          role: "seeker",
          name: parsed.name,
        });
      } else {
        await createUser({
          email,
          role: "seeker",
          name: parsed.name,
        });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Invalid data";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

