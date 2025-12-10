import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Access your LaundryEase account.",
};

export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 rounded-xl border p-6 shadow">
        <h1 className="text-3xl font-semibold text-center">Sign In</h1>
        <form className="space-y-4">
          <input
            className="w-full rounded border px-4 py-2"
            placeholder="Email"
            type="email"
          />
          <input
            className="w-full rounded border px-4 py-2"
            placeholder="Password"
            type="password"
          />
          <button
            className="w-full rounded bg-primary px-4 py-2 font-semibold text-black"
            type="submit"
          >
            Continue
          </button>
        </form>
      </div>
    </main>
  );
}
