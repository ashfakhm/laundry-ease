import type { Metadata } from "next";
import { LandingPageClient } from "@/components/landing-page-client";

export const metadata: Metadata = {
  title: "LaundryEase – Premium Laundry Service",
  description:
    "LaundryEase is a premium laundry SaaS platform offering doorstep pickup, deadline-guaranteed delivery, and secure escrow payments for urban professionals.",
};

export default function LandingPage() {
  return <LandingPageClient />;
}
