import { Role } from "./enums";
import { DefaultSession } from "next-auth";


declare module "next-auth/jwt" {
  interface JWT {
    role?: Role | null;
  }
}

declare module "next-auth" {
    interface User {
        role: Role | null
    }
    interface Session {
        user: {
            role: Role | null;
        } & DefaultSession["user"]
    }
}
