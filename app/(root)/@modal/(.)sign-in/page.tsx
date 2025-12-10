"use client";
import Signin from "@/app/components/Sign-in";
import { useState } from "react";
import Link from "next/link";

export default function SignInModal() {
  return (
    <main className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Signin />
    </main>
  );
}
