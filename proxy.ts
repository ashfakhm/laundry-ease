import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route-matching utility for middleware
 * Supports both string paths and regex patterns
 */
type Matcher = string | RegExp;

function createRouteMatcher(routes: Matcher[]) {
  return (req: NextRequest) => {
    const pathname = req.nextUrl.pathname;
    return routes.some((route) =>
      typeof route === "string"
        ? pathname === route || pathname.startsWith(route + "/")
        : route.test(pathname)
    );
  };
}

/**
 * Public routes - accessible without authentication
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/auth",
  "/signup",
  "/choose-role",
  "/unauthorized",
  /^\/api\/auth/,
  /^\/api\/otp/,
  /^\/api\/signup/,
  /^\/api\/providers/, // Allow public access to search providers
]);

/**
 * Protected routes by role
 */
const isAdminRoute = createRouteMatcher(["/admin"]);
const isProviderRoute = createRouteMatcher(["/provider"]);
const isSeekerRoute = createRouteMatcher(["/seeker"]);

/**
 * Modern Proxy Handler for Next.js 15+
 * Handles authentication, authorization, and role-based routing
 */
export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const token = (await getToken({ req })) as JWT | null;

  /**
   * Step 1: Redirect authenticated users to their dashboard
   */
  if (token && token.role && pathname === "/") {
    const role = token.role as string;
    switch (role) {
      case "admin":
        return NextResponse.redirect(new URL("/admin", req.url));
      case "provider":
        return NextResponse.redirect(new URL("/provider", req.url));
      case "seeker":
        return NextResponse.redirect(new URL("/seeker", req.url));
    }
  }

  /**
   * Step 2: Allow public routes without authentication
   */
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  /**
   * Step 3: Require authentication for protected routes
   */
  if (!token) {
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  /**
   * Step 4: Redirect to role selection if missing
   */
  if (!token.role && pathname !== "/choose-role") {
    return NextResponse.redirect(new URL("/choose-role", req.url));
  }

  /**
   * Step 5: Enforce role-based access control
   */
  if (isAdminRoute(req) && token.role !== "admin") {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  if (isProviderRoute(req) && token.role !== "provider") {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  if (isSeekerRoute(req) && token.role !== "seeker") {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  /**
   * Allow the request to proceed
   */
  return NextResponse.next();
}

/**
 * Matcher configuration
 * Excludes static assets and Next.js internals
 */
export const config = {
  matcher: [
    "/((?!_next|.*\\.(?:css|js|json|png|jpg|jpeg|gif|svg|ico|woff2?)|favicon.ico).*)",
  ],
};
