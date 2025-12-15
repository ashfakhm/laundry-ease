"use client";
import { useState } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";

const schema = z.object({
  name: z.string().min(1),
  services: z.string().min(1), // comma-separated
  pricing: z.number().nonnegative(),
  location: z.string().min(1),
  documents: z.string().optional(), // comma-separated
});

export default function ProviderSignup() {
  const [form, setForm] = useState({
    name: "",
    services: "",
    pricing: "",
    location: "",
    documents: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({
      ...form,
      pricing: Number(form.pricing),
    });
    if (!parsed.success) return setError("Please fill all required fields");
    setError(null);
    setLoading(true);
    const res = await fetch("/api/complete-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "provider",
        name: form.name,
        services: form.services
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        pricing: Number(form.pricing),
        location: form.location,
        documents: form.documents
          ? form.documents
              .split(",")
              .map((d) => d.trim())
              .filter(Boolean)
          : undefined,
      }),
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
        <h1 className="text-2xl font-semibold">Complete Signup (Provider)</h1>
        <input
          className="w-full px-3 py-2 rounded border"
          placeholder="Business / Owner name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          required
        />
        <input
          className="w-full px-3 py-2 rounded border"
          placeholder="Services (comma-separated)"
          value={form.services}
          onChange={(e) => set("services", e.target.value)}
          required
        />
        <input
          className="w-full px-3 py-2 rounded border"
          placeholder="Pricing (number)"
          inputMode="decimal"
          value={form.pricing}
          onChange={(e) => set("pricing", e.target.value)}
          required
        />
        <input
          className="w-full px-3 py-2 rounded border"
          placeholder="Location"
          value={form.location}
          onChange={(e) => set("location", e.target.value)}
          required
        />
        <input
          className="w-full px-3 py-2 rounded border"
          placeholder="Documents (URLs, comma-separated)"
          value={form.documents}
          onChange={(e) => set("documents", e.target.value)}
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
