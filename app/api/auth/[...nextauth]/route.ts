import NextAuth from "next-auth";
// @ts-expect-error - next-auth exports have type resolution issues
import type { NextAuthOptions, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { getUserByEmail } from "@/lib/db";
import bcrypt from "bcrypt";

export const authOptions: NextAuthOptions = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await getUserByEmail(email);
        if (!user || !user.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user._id?.toString() || email,
          email,
          name: user.name || undefined,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn() {
      // Allow OAuth to create a session even if no DB user exists yet
      // App access is gated by middleware until role completion
      return true;
    },
    async jwt({ token }: { token: JWT }) {
      // Populate token.role from DB if available
      if (token?.email) {
        const dbUser = await getUserByEmail(token.email as string);
        token.role = dbUser?.role ?? null;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.role =
          (token.role as "seeker" | "provider" | "admin" | null) ?? null;
      }
      return session;
    },
  },
};

// @ts-expect-error - NextAuth default export has call signature at runtime
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
