// @ts-expect-error - next-auth exports have type resolution issues with bundler moduleResolution
import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default async function proxy(req: NextRequest) {
  const token = await getToken({ req });
  const pathname = req.nextUrl.pathname;

  // Public routes accessible without authentication
  const publicRoutes = [
    "/",
    "/api/auth",
    "/auth",
    "/choose-role",
    "/signup",
    "/api/otp",
    "/api/signup",
  ];

  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // If no session and not on public route, redirect to sign in
  if (!token && !isPublicRoute) {
    const url = new URL("/auth", req.url);
    return NextResponse.redirect(url);
  }

  // Allow public routes
  if (isPublicRoute) {
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
