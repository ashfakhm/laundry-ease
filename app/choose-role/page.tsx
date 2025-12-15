"use client";
import { useRouter } from "next/navigation";

export default function ChooseRole() {
  const router = useRouter();

  function choose(role: "seeker" | "provider") {
    document.cookie = `signup_role=${role}; path=/`;
    router.push("/auth");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="space-y-6 text-center">
        <h1 className="text-3xl font-semibold">Choose your role</h1>
        <div className="flex gap-4 justify-center">
          <button
            className="px-6 py-3 rounded border hover:bg-accent"
            onClick={() => choose("seeker")}
          >
            I am a Seeker
          </button>
          <button
            className="px-6 py-3 rounded border hover:bg-accent"
            onClick={() => choose("provider")}
          >
            I am a Provider
          </button>
        </div>
      </div>
    </main>
  );
}
