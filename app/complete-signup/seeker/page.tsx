"use client";
import { useState } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";

const schema = z.object({ name: z.string().min(1) });

export default function SeekerSignup() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ name });
    if (!parsed.success) return setError("Please provide your name");
    setError(null);
    setLoading(true);
    const res = await fetch("/api/complete-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role: "seeker" }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data?.error || "Failed to complete signup");
      return;
    }
    document.cookie = "signup_role=; Max-Age=0; path=/";
    router.replace("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">Complete Signup (Seeker)</h1>
        <input
          className="w-full px-3 py-2 rounded border"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={loading}
          className="w-full px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Saving..." : "Finish"}
        </button>
      </form>
    </main>
  );
}
