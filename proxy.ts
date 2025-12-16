// @ts-expect-error - next-auth exports have type resolution issues
import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/* ================= ROUTE MATCHER ================= */

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

/* ================= ROUTE GROUPS ================= */

const isPublicRoute = createRouteMatcher([
  "/",
  "/auth",
  "/signup",
  "/choose-role",
  "/unauthorized",
  /^\/api\/auth/,
  /^\/api\/otp/,
  /^\/api\/signup/,
]);

const isAdminRoute = createRouteMatcher([
  "/admin",
  "/dashboard/admin",
]);

const isProviderRoute = createRouteMatcher([
  "/provider",
  "/dashboard/provider",
]);

const isSeekerRoute = createRouteMatcher([
  "/seeker",
  "/dashboard/seeker",
]);

/* ================= MIDDLEWARE ================= */

export default async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const token = (await getToken({ req })) as JWT | null;

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