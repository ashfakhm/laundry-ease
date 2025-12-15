import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: "seeker" | "provider" | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "seeker" | "provider" | null;
  }
}
