import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { getUserByEmail } from "@/lib/db/index";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["seeker", "provider"]),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = schema.safeParse(json);
    
    if (!parsed.success) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid email or role format")
      );
    }

    const { email } = parsed.data;
    
    // Check if user exists. getUserByEmail already filters for isDeleted: { $ne: true }
    // for seekers and providers, while admins are always active.
    const user = await getUserByEmail(email);
    
    if (user) {
      if (user.role === "admin") {
         return successResponse({
           available: false,
           message: "This email is reserved and cannot be used for signup.",
         });
      }
      return successResponse({
        available: false,
        message: "An account with this email already exists. Please sign in instead."
      });
    }

    return successResponse({
      available: true,
      message: "Email available."
    });
  } catch (error) {
    return errorResponse(error);
  }
}
