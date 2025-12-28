import NextAuth, { type NextAuthOptions, type Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { getUserByEmail } from "@/lib/db";
import bcrypt from "bcrypt";
import { env } from "@/lib/env";
import { Role } from "@/types/enums";

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
        const { email, password } = credentials;

        // Check seekers → providers → admins collections in order
        const user = await getUserByEmail(email);

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
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account }) {
      // For Google OAuth, check if user exists in database
      if (account?.provider === "google") {
        const dbUser = await getUserByEmail(user.email);
        if (!dbUser) {
          // Redirect to choose role page
          return "/choose-role";
        }
        // Update user object with role from database
        user.role = dbUser.role;
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
      }
      return token;
    },

    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        // Safe assignment using Role definition
        session.user.role = (token.role as Role) ?? null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    error: "/choose-role", // Redirect to choose role page on error
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
