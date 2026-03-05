import NextAuth, { type NextAuthOptions, type Session } from "next-auth";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/constants";
import type { JWT } from "next-auth/jwt";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { getUserByEmail } from "@/lib/db/index";
import bcrypt from "bcrypt";
import { env } from "@/lib/env";
import { Role } from "@/types/enums";

/**
 * How often (in seconds) the JWT callback re-checks the DB to detect
 * password changes. Keeps DB load low while ensuring invalidation
 * happens within a reasonable window after a password reset.
 */
const JWT_DB_RECHECK_INTERVAL_S = 5 * 60; // 5 minutes

export const authOptions: NextAuthOptions = {
  providers: [
    Google({
      clientId: env.GOOGLE_ID,
      clientSecret: env.GOOGLE_SECRET,
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          throw new Error("Invalid credentials");
        }
        const email = credentials.email.trim().toLowerCase();
        const { password } = credentials;

        let user;
        try {
          // Check seekers → providers → admins collections in order
          user = await getUserByEmail(email);
        } catch (err) {
          // DB connection failures (e.g. IP not whitelisted in Atlas, DNS issues)
          // must not leak infrastructure details to the client.
          console.error(
            "[AUTH] Database connection failed during sign-in:",
            err instanceof Error ? err.message : err,
          );
          throw new Error("SERVICE_UNAVAILABLE");
        }

        if (!user) {
          throw new Error("NO_ACCOUNT");
        }

        if (!user.passwordHash) {
          throw new Error("NO_PASSWORD_SET");
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          throw new Error("INVALID_CREDENTIALS");
        }

        if (!user._id) {
          throw new Error("User ID not found");
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS, // 7 days - matches PRD NFR-4 security requirement
  },
  callbacks: {
    async signIn({ user, account }) {
      // For Google OAuth, check if user exists in database
      if (account?.provider === "google") {
        const dbUser = await getUserByEmail(user.email);
        if (!dbUser?._id) {
          // Redirect to choose role page
          return "/choose-role";
        }
        // Sync role and canonical DB id for OAuth logins.
        user.role = dbUser.role;
        user.id = dbUser._id.toString();
        return true;
      }

      // Allow credentials provider (already validated in authorize)
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        // User is available on sign-in
        token.role = user.role;
        token.id = user.id;
        token._lastDbCheck = Math.floor(Date.now() / 1000);
      }

      // Keep id/role canonical even for OAuth refresh flows.
      if ((!token.id || !token.role) && token.email) {
        const dbUser = await getUserByEmail(token.email);
        if (dbUser?._id && dbUser.role) {
          token.id = dbUser._id.toString();
          token.role = dbUser.role;
          token._lastDbCheck = Math.floor(Date.now() / 1000);
        }
      }

      // --- Session invalidation after password reset ---
      // Periodically re-check the DB to see if the user's password was
      // changed after this JWT was issued. If so, force re-authentication
      // by returning an empty token (NextAuth treats it as signed-out).
      const nowS = Math.floor(Date.now() / 1000);
      const lastCheck = (token._lastDbCheck as number) || 0;

      if (token.email && nowS - lastCheck >= JWT_DB_RECHECK_INTERVAL_S) {
        token._lastDbCheck = nowS;

        const dbUser = await getUserByEmail(token.email);

        if (dbUser?.passwordChangedAt) {
          const changedAtS = Math.floor(
            new Date(dbUser.passwordChangedAt).getTime() / 1000,
          );
          const issuedAtS = (token.iat as number) || 0;

          if (changedAtS > issuedAtS) {
            // Password was changed after this token was issued.
            // Wipe the token to force sign-out on next session check.
            return { _invalidated: true } as JWT;
          }
        }

        // Refresh role/id in case they changed in the DB.
        if (dbUser?._id && dbUser.role) {
          token.id = dbUser._id.toString();
          token.role = dbUser.role;
        }
      }

      return token;
    },

    async session({ session, token }: { session: Session; token: JWT }) {
      // If the token was invalidated (password changed after this JWT was
      // issued), return null so NextAuth reports status "unauthenticated"
      // and the client redirects to the sign-in page automatically.
      if (token._invalidated) {
        return null as unknown as Session;
      }

      if (session.user) {
        // Safe assignment using Role definition
        session.user.role = (token.role as Role) ?? null;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth",
    error: "/auth", // Redirect to custom auth page on error
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
