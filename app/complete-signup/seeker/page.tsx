// This page is deprecated; redirect users to the new signup flow.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacySeekerCompleteSignup() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/signup/seeker");
  }, [router]);

  return null;
}
