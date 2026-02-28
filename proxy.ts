import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

let ratelimit: Ratelimit | null = null;
if (redisUrl && redisToken) {
  ratelimit = new Ratelimit({
    redis: new Redis({
      url: redisUrl,
      token: redisToken,
    }),
    limiter: Ratelimit.slidingWindow(10, "10 s"),
    ephemeralCache: new Map(),
    analytics: true,
  });
}
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
  /^\/api\/security\/csp-report$/,
]);

/* ================= PROXY (Next.js 16+) ================= */

export async function proxy(req: NextRequest, ev?: NextFetchEvent) {
  const pathname = req.nextUrl.pathname;
  const token = (await getToken({ req })) as JWT | null;

  /* 0.5️⃣ Rate Limiting for Auth & OTP (Protection against brute force / spam) */
  if (
    ratelimit &&
    (pathname.startsWith("/api/auth/") ||
      pathname.startsWith("/api/otp/") ||
      pathname.startsWith("/api/signup") ||
      pathname.startsWith("/api/forgot-password") ||
      pathname.startsWith("/api/reset-password"))
  ) {
    let ip = "127.0.0.1";
    if (process.env.TRUST_PROXY === "true") {
      ip =
        req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip")?.trim() ||
        req.headers.get("cf-connecting-ip")?.trim() ||
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "127.0.0.1";
    }
    const { success, pending } = await ratelimit.limit(`rl_${ip}_${pathname}`);
    if (ev) {
      ev.waitUntil(pending);
    }
    if (!success) {
      console.warn(
        `[Security] Rate limit exceeded for IP: ${ip} on ${pathname}`,
      );
      return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
    }
  }

  /* 0️⃣ Security Hardening: Admin IP Whitelisting */
  if (isAdminRoute(req)) {
    const allowedIps = process.env.ADMIN_ALLOWLIST_IPS?.split(",")
      .map((ip) => ip.trim())
      .filter(Boolean);

    if (allowedIps && allowedIps.length > 0) {
      let clientIp = "127.0.0.1";
      if (process.env.TRUST_PROXY === "true") {
        clientIp =
          req.headers.get("x-vercel-forwarded-for")?.split(",")[0] ||
          req.headers.get("x-real-ip") ||
          req.headers.get("cf-connecting-ip") ||
          req.headers.get("x-forwarded-for")?.split(",")[0] ||
          "127.0.0.1";
      }
      clientIp = clientIp.trim();

      // Allow localhost for dev convenience if not explicitly blocked
      const isLocalhost = clientIp === "127.0.0.1" || clientIp === "::1";
      const isAllowed =
        allowedIps.includes(clientIp) ||
        (process.env.NODE_ENV !== "production" && isLocalhost);

      if (!isAllowed) {
        console.warn(`[Security] Blocked Admin access from IP: ${clientIp}`);
        return NextResponse.redirect(new URL("/unauthorized", req.url));
      }
    }
  }

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
