"use client";

import { useState } from "react";
import Link from "next/link";
import SignUp from "@/app/components/Sign-up";

export default function SignUpModal() {
  return (
    <main className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <SignUp />
    </main>
  );
}
