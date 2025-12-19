import { Role } from "./enums";
import { DefaultSession } from "next-auth";

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role | null;
    id?: string;
  }
}

declare module "next-auth" {
  interface User {
    role: Role | null;
    id: string;
  }
  interface Session {
    user: {
      role: Role | null;
      id: string;
    } & DefaultSession["user"];
  }
}
