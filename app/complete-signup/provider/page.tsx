// This page is deprecated; redirect users to the new signup flow.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyProviderCompleteSignup() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/signup/provider");
  }, [router]);

  return null;
}
