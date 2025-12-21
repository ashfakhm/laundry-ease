"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function GoBackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex items-center justify-center gap-2 rounded-xl border bg-background px-5 py-2.5 text-sm font-medium transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
    >
      <ArrowLeft className="h-4 w-4" />
      Go Back
    </button>
  );
}
