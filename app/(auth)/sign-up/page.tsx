"use client";

import SignUp from "@/app/components/Sign-up";
import Link from "next/link";
import { useState } from "react";

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#030708]">
      <SignUp />
    </main>
  );
}
