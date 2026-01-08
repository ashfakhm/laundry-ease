import { auth } from "@/app/api/auth/[...nextauth]/route";
import { Role } from "@/types/enums";
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

/**
 * Requires authentication and optionally validates role
 * Throws AppError if auth fails
 */
export async function requireAuth(allowedRoles?: Role[]): Promise<AuthResult> {
  const session = await auth();

  if (!session?.user?.email || !session.user.id) {
    throw Errors.unauthorized("Please sign in to continue");
  }

  const role = session.user.role;
  if (!role) {
    throw Errors.unauthorized("Account role not configured");
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(role)) {
      throw Errors.forbidden(
        `This action requires ${allowedRoles.join(" or ")} role`
      );
    }
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name ?? null,
      role,
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
 * Optional auth - returns user if logged in, null otherwise
 */
export async function optionalAuth(): Promise<AuthResult | null> {
  try {
    return await requireAuth();
  } catch {
    return null;
  }
}
