"use client";

import Signin from "@/app/components/Sign-in";
import Link from "next/link";
import { useState } from "react";

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#030708]">
      <Signin />
    </main>
  );
}
