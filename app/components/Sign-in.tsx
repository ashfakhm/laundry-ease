"use client";
import Link from "next/link";
import { useState } from "react";

export default function Signin() {
  const [userType, setUserType] = useState<"seeker" | "provider">("seeker");
  return (
    <div className="w-full max-w-md space-y-6 rounded-xl border border-gray-700 bg-[#0d161a] p-8 shadow-2xl">
      <h1 className="text-3xl font-semibold text-center text-white">Sign In</h1>

      {/* Toggle Button - Better Visibility */}
      <div className="space-y-2">
        <p className="text-sm text-gray-400 text-center">Sign in as</p>
        <div className="flex rounded-lg bg-[#182830] p-1.5 gap-2">
          <button
            type="button"
            onClick={() => setUserType("seeker")}
            className={`flex-1 rounded-lg px-6 py-3 font-bold transition-all text-sm uppercase tracking-wide ${
              userType === "seeker"
                ? "bg-primary text-black shadow-lg scale-105"
                : "text-white/70 hover:text-white hover:bg-[#1f3644]"
            }`}
          >
            Seeker
          </button>
          <button
            type="button"
            onClick={() => setUserType("provider")}
            className={`flex-1 rounded-lg px-6 py-3 font-bold transition-all text-sm uppercase tracking-wide ${
              userType === "provider"
                ? "bg-primary text-black shadow-lg scale-105"
                : "text-white/70 hover:text-white hover:bg-[#1f3644]"
            }`}
          >
            Provider
          </button>
        </div>
      </div>

      <form className="space-y-4">
        <input
          className="w-full rounded-lg border border-gray-600 bg-[#182830] px-4 py-3 text-white placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="Email"
          type="email"
        />
        <input
          className="w-full rounded-lg border border-gray-600 bg-[#182830] px-4 py-3 text-white placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="Password"
          type="password"
        />
        <button
          className="w-full rounded-lg bg-primary px-4 py-3.5 font-bold text-black hover:bg-primary/90 transition-all hover:shadow-lg text-base"
          type="submit"
        >
          Sign In
        </button>
      </form>

      <p className="text-center text-sm text-gray-400">
        Don't have an account?{" "}
        <Link
          href="/sign-up"
          className="text-primary font-semibold hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
