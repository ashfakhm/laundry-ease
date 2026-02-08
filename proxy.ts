import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  collectAllowedOriginsFromRequest,
  extractRequestOrigin,
  isUnsafeHttpMethod,
} from "@/lib/security/origin";

/* ================= ROUTE MATCHER ================= */

type Matcher = string | RegExp;

function createRouteMatcher(routes: Matcher[]) {
  return (req: NextRequest) => {
    const pathname = req.nextUrl.pathname;
    return routes.some((route) =>
      typeof route === "string"
        ? pathname === route || pathname.startsWith(route + "/")
        : route.test(pathname),
    );
  };
}

/* ================= ROUTE GROUPS ================= */

const isPublicRoute = createRouteMatcher([
  "/",
  "/auth",
  "/signup",
  "/choose-role",
  "/unauthorized",
  "/robots.txt",
  "/sitemap.xml",
  /^\/api\/auth/,
  /^\/api\/otp/,
  /^\/api\/signup/,
  /^\/api\/providers/, // Allow public access to search providers
]);

const isAdminRoute = createRouteMatcher(["/admin"]);
const isProviderRoute = createRouteMatcher(["/provider"]);
const isSeekerRoute = createRouteMatcher(["/seeker"]);
const bypassApiOriginGuard = createRouteMatcher([
  /^\/api\/webhooks\//,
  /^\/api\/cron\//,
  /^\/api\/escrow\/release$/,
  /^\/api\/auth\//,
]);

/* ================= PROXY (Next.js 16+) ================= */

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const token = (await getToken({ req })) as JWT | null;

  if (
    pathname.startsWith("/api/") &&
    isUnsafeHttpMethod(req.method) &&
    !bypassApiOriginGuard(req)
  ) {
    const requestOrigin = extractRequestOrigin(req.headers);
    const allowedOrigins = new Set(
      collectAllowedOriginsFromRequest({
        requestUrl: req.url,
        headers: req.headers,
        envOrigins: [
          process.env.NEXT_PUBLIC_APP_URL,
          process.env.NEXT_PUBLIC_BASE_URL,
          process.env.NEXTAUTH_URL,
        ],
      }),
    );

    if (!requestOrigin || !allowedOrigins.has(requestOrigin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Role-based redirects for authenticated users after sign-in
  if (token && token.role && pathname === "/") {
    const role = token.role as string;
    if (role === "admin") {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    if (role === "provider") {
      return NextResponse.redirect(new URL("/provider", req.url));
    }
    if (role === "seeker") {
      return NextResponse.redirect(new URL("/seeker", req.url));
    }
  }

  /* 1️⃣ Public routes */
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  /* 2️⃣ Not authenticated */
  if (!token) {
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  /* 3️⃣ Logged in but role missing */
  if (!token.role && pathname !== "/choose-role") {
    return NextResponse.redirect(new URL("/choose-role", req.url));
  }

  /* 4️⃣ Role-based protection */
  if (isAdminRoute(req) && token.role !== "admin") {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  if (isProviderRoute(req) && token.role !== "provider") {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  if (isSeekerRoute(req) && token.role !== "seeker") {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  return NextResponse.next();
}

/* ================= MATCHER ================= */

export const config = {
  matcher: [
    "/((?!_next|.*\\.(?:css|js|json|png|jpg|jpeg|gif|svg|ico|woff2?)|favicon.ico).*)",
  ],
};
