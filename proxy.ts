import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// ---------------------------------------------------------------------------
// Next.js 16 Proxy (replaces middleware.ts)
//
// Runs on the Edge Runtime for every matched route. Responsible for:
//   1. Dashboard route protection — unauthenticated users → /auth
//   2. Role-based route gating   — wrong role → correct dashboard
//   3. Auth page redirect         — authenticated users → their dashboard
//   4. Admin IP allowlist         — ADMIN_ALLOWLIST_IPS enforcement
//
// Heavy checks (DB queries, rate limiting, CSRF origin validation) remain in
// the route handlers via requireAuth / requireSameOrigin / enforceRateLimit.
// ---------------------------------------------------------------------------

type Role = "seeker" | "provider" | "admin";

// ── Route definitions ──────────────────────────────────────────────────────

/** Dashboard path prefixes that require authentication + specific role. */
const ROLE_ROUTE_MAP: Record<string, Role> = {
  "/seeker": "seeker",
  "/provider": "provider",
  "/admin": "admin",
};

/** All dashboard prefixes (derived once). */
const DASHBOARD_PREFIXES = Object.keys(ROLE_ROUTE_MAP);

/** Public pages that authenticated users should be redirected away from. */
const AUTH_PAGES = ["/auth", "/signup", "/choose-role"];

/** Role → default dashboard landing. */
const ROLE_DASHBOARDS: Record<Role, string> = {
  seeker: "/seeker",
  provider: "/provider",
  admin: "/admin",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function getDashboardForRole(role: Role): string {
  return ROLE_DASHBOARDS[role] ?? "/auth";
}

function isRoleValid(role: unknown): role is Role {
  return role === "seeker" || role === "provider" || role === "admin";
}

/**
 * Resolve the required role for a given pathname by checking prefix matches.
 * Returns `null` if the path is not a role-gated dashboard route.
 */
function getRequiredRole(pathname: string): Role | null {
  for (const prefix of DASHBOARD_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return ROLE_ROUTE_MAP[prefix];
    }
  }
  return null;
}

/**
 * Check whether a path is an auth/public page that authenticated users
 * should be bounced away from.
 */
function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`),
  );
}

/**
 * Extract the client IP from trusted proxy headers (same logic as
 * `lib/api/security.ts#extractClientIp` but Edge-compatible without env
 * module import).
 */
function extractClientIp(req: NextRequest): string {
  const vercelForwarded = req.headers.get("x-vercel-forwarded-for");
  if (vercelForwarded) {
    const first = vercelForwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return "127.0.0.1";
}

/**
 * Parse ADMIN_ALLOWLIST_IPS env var into a Set of trimmed, non-empty IPs.
 * Cached at module scope since env vars don't change at runtime.
 */
let _adminAllowlistIps: Set<string> | null = null;

function getAdminAllowlistIps(): Set<string> {
  if (_adminAllowlistIps === null) {
    const raw = process.env.ADMIN_ALLOWLIST_IPS ?? "";
    _adminAllowlistIps = new Set(
      raw
        .split(",")
        .map((ip) => ip.trim())
        .filter(Boolean),
    );
  }
  return _adminAllowlistIps;
}

// ── Proxy function ─────────────────────────────────────────────────────────

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // ── 1. Decode JWT (Edge-safe, no DB call) ────────────────────────────
  // getToken reads the NextAuth session cookie and verifies the JWT
  // signature using NEXTAUTH_SECRET. Returns null if unauthenticated.
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const userRole = token?.role;
  const isAuthenticated = !!token && isRoleValid(userRole);

  // ── 2. Admin IP allowlist enforcement ────────────────────────────────
  // If ADMIN_ALLOWLIST_IPS is configured, restrict /admin routes AND
  // /api/admin routes to those IPs only. This runs even before auth
  // checks so disallowed IPs get a hard 403 regardless of session.
  const isAdminPath =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (isAdminPath) {
    const allowlist = getAdminAllowlistIps();
    if (allowlist.size > 0) {
      const trustProxy = process.env.TRUST_PROXY === "true";
      const clientIp = trustProxy ? extractClientIp(req) : "127.0.0.1";

      if (!allowlist.has(clientIp)) {
        // Return 403 for API routes, redirect to /forbidden for pages
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            {
              success: false,
              ok: false,
              message: "Access denied",
              error: {
                code: "FORBIDDEN",
                message: "Access denied",
              },
            },
            { status: 403 },
          );
        }
        return NextResponse.redirect(new URL("/forbidden", req.url));
      }
    }
  }

  // ── 3. Redirect authenticated users away from auth pages ─────────────
  if (isAuthenticated && isAuthPage(pathname)) {
    const dashboard = getDashboardForRole(userRole as Role);
    return NextResponse.redirect(new URL(dashboard, req.url));
  }

  // ── 4. Dashboard route protection ────────────────────────────────────
  const requiredRole = getRequiredRole(pathname);

  if (requiredRole) {
    // 4a. Not authenticated → redirect to /auth with callbackUrl
    if (!isAuthenticated) {
      const authUrl = new URL("/auth", req.url);
      authUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(authUrl);
    }

    // 4b. Wrong role → redirect to the user's own dashboard
    if (userRole !== requiredRole) {
      const correctDashboard = getDashboardForRole(userRole as Role);
      return NextResponse.redirect(new URL(correctDashboard, req.url));
    }
  }

  // ── 5. Pass through ──────────────────────────────────────────────────
  return NextResponse.next();
}

// ── Matcher configuration ──────────────────────────────────────────────────
// Only run the proxy on routes that actually need protection.
// Excludes static assets, image optimization, and Next.js internals.
export const config = {
  matcher: [
    /*
     * Match:
     *   /seeker, /seeker/*     — seeker dashboard
     *   /provider, /provider/* — provider dashboard
     *   /admin, /admin/*       — admin dashboard + admin API routes
     *   /api/admin/*           — admin API endpoints (IP allowlist)
     *   /auth, /signup, etc.   — auth pages (redirect if logged in)
     */
    "/seeker/:path*",
    "/provider/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/auth",
    "/signup",
    "/signup/:path*",
    "/choose-role",
    "/choose-role/:path*",
  ],
};
