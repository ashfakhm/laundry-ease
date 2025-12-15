import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default async function proxy(req: NextRequest) {
  const token = await getToken({ req });

  // If no session, allow public access
  if (!token) return NextResponse.next();

  const pathname = req.nextUrl.pathname;

  // Allow auth, choose-role, and complete-signup routes
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/choose-role") ||
    pathname.startsWith("/complete-signup") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/api/otp") ||
    pathname.startsWith("/api/signup")
  ) {
    return NextResponse.next();
  }

  // If authenticated but no role yet, force role flow
  const jwt = token as JWT;
  if (!jwt.role) {
    const url = new URL("/choose-role", req.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|.*\\.(?:css|js|json|png|jpg|jpeg|gif|svg|ico|woff2?)|favicon.ico).*)",
  ],
};
