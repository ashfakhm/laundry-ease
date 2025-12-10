"use client";
import Link from "next/link";
import { useState } from "react";

export default function SignUp() {
  const [userType, setUserType] = useState<"seeker" | "provider">("seeker");
  return (
    <div className="w-full max-w-md space-y-6 rounded-xl border border-gray-700 bg-[#0d161a] p-8 shadow-2xl">
      <h1 className="text-3xl font-semibold text-center text-white">Sign Up</h1>

      {/* Toggle Button */}
      <div className="space-y-2">
        <p className="text-sm text-gray-400 text-center">Sign up as</p>
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

      {/* Conditional Form Based on User Type */}
      {userType === "seeker" ? (
        <form className="space-y-4">
          <input
            className="w-full rounded-lg border border-gray-600 bg-[#182830] px-4 py-3 text-white placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Full Name"
            type="text"
          />
          <input
            className="w-full rounded-lg border border-gray-600 bg-[#182830] px-4 py-3 text-white placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Email"
            type="email"
          />
          <input
            className="w-full rounded-lg border border-gray-600 bg-[#182830] px-4 py-3 text-white placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Phone Number"
            type="tel"
          />
          <input
            className="w-full rounded-lg border border-gray-600 bg-[#182830] px-4 py-3 text-white placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Password"
            type="password"
          />
          <input
            className="w-full rounded-lg border border-gray-600 bg-[#182830] px-4 py-3 text-white placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Confirm Password"
            type="password"
          />
          <button
            className="w-full rounded-lg bg-primary px-4 py-3.5 font-bold text-black hover:bg-primary/90 transition-all hover:shadow-lg text-base"
            type="submit"
          >
            Create Seeker Account
          </button>
        </form>
      ) : (
        <form className="space-y-4">
          <input
            className="w-full rounded-lg border border-gray-600 bg-[#182830] px-4 py-3 text-white placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Business Name"
            type="text"
          />
          <input
            className="w-full rounded-lg border border-gray-600 bg-[#182830] px-4 py-3 text-white placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Owner Name"
            type="text"
          />
          <input
            className="w-full rounded-lg border border-gray-600 bg-[#182830] px-4 py-3 text-white placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Email"
            type="email"
          />
          <input
            className="w-full rounded-lg border border-gray-600 bg-[#182830] px-4 py-3 text-white placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Phone Number"
            type="tel"
          />
          <input
            className="w-full rounded-lg border border-gray-600 bg-[#182830] px-4 py-3 text-white placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Business Address"
            type="text"
          />
          <input
            className="w-full rounded-lg border border-gray-600 bg-[#182830] px-4 py-3 text-white placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Password"
            type="password"
          />
          <input
            className="w-full rounded-lg border border-gray-600 bg-[#182830] px-4 py-3 text-white placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Confirm Password"
            type="password"
          />
          <button
            className="w-full rounded-lg bg-primary px-4 py-3.5 font-bold text-black hover:bg-primary/90 transition-all hover:shadow-lg text-base"
            type="submit"
          >
            Create Provider Account
          </button>
        </form>
      )}

      <p className="text-center text-sm text-gray-400">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="text-primary font-semibold hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
