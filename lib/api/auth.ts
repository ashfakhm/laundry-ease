import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Role } from "@/types/enums";
import { getUserByEmail } from "@/lib/db/index";
import { Errors } from "./errors";

/**
 * Authentication and authorization middleware for API routes
 * Centralizes session validation and role checking
 */

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

export interface AuthResult {
  user: AuthenticatedUser;
}

function isLikelyDbObjectId(id: string | undefined): boolean {
  return !!id && /^[a-f0-9]{24}$/i.test(id);
}

/**
 * Requires authentication and optionally validates role
 * Throws AppError if auth fails
 */
export async function requireAuth(allowedRoles?: Role[]): Promise<AuthResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw Errors.unauthorized("Please sign in to continue");
  }

  let resolvedRole = session.user.role;
  let resolvedId = session.user.id;

  if (!resolvedId || !isLikelyDbObjectId(resolvedId) || !resolvedRole) {
    const dbUser = await getUserByEmail(session.user.email);
    if (!dbUser?._id || !dbUser.role) {
      throw Errors.unauthorized("Please sign in to continue");
    }
    resolvedId = dbUser._id.toString();
    resolvedRole = dbUser.role;
  }

  if (!resolvedRole) {
    throw Errors.unauthorized("Account role not configured");
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(resolvedRole)) {
      throw Errors.forbidden(
        `This action requires ${allowedRoles.join(" or ")} role`
      );
    }
  }

  return {
    user: {
      id: resolvedId,
      email: session.user.email,
      name: session.user.name ?? null,
      role: resolvedRole,
    },
  };
}

/**
 * Helper: Require Seeker role
 */
export async function requireSeeker(): Promise<AuthResult> {
  return requireAuth([Role.SEEKER]);
}

/**
 * Helper: Require Provider role
 */
export async function requireProvider(): Promise<AuthResult> {
  return requireAuth([Role.PROVIDER]);
}

/**
 * Helper: Require Admin role
 */
export async function requireAdmin(): Promise<AuthResult> {
  return requireAuth([Role.ADMIN]);
}

/**
 * Helper: Require Admin role and validate active admin record in DB.
 * Use this on high-risk administrative routes.
 */
export async function requireAdminWithDbCheck(): Promise<AuthResult> {
  const auth = await requireAdmin();
  const dbUser = await getUserByEmail(auth.user.email);
  if (!dbUser?._id || dbUser.role !== Role.ADMIN) {
    throw Errors.forbidden("Admin access required");
  }

  return {
    user: {
      ...auth.user,
      id: dbUser._id.toString(),
      role: Role.ADMIN,
    },
  };
}

/**
 * Optional auth - returns user if logged in, null otherwise
 */
export async function optionalAuth(): Promise<AuthResult | null> {
  try {
    return await requireAuth();
  } catch {
    return null;
  }
}
